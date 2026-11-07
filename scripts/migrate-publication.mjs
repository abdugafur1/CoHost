import { createHash } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'

const canonical = value => Array.isArray(value) ? value.map(canonical)
  : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map(k => [k, canonical(value[k])])) : value
export const titleReservationId = event => createHash('sha256').update(`${event.hostId}\0${event.title.trim().toLowerCase()}`).digest('hex')

// Pure audit: no SDK, credentials, network or writes. Never discard a request.
export function planMigration(input) {
  const { eventId, event, requests, profiles, reservation } = input
  const issues = [], partners = new Map()
  const host = profiles[event.hostId]
  if (!host || host.id !== event.hostId || host.ownerId !== event.hostOwnerId || host.profileType !== 'organization'
      || event.hostProfileType !== 'organization') issues.push('Hosting organization identity is invalid.')
  if (!eventId || eventId.includes('/') || !event.title?.trim()) issues.push('Invalid event identity or title.')
  if (event.collaborationVersion === 2) issues.push('Event is already migrated; no changes planned.')
  if (!Array.isArray(requests) || new Set(requests.map(r => r.id)).size !== requests.length) issues.push('Duplicate or missing request inventory.')
  for (const id of event.cohostRequestIds ?? []) {
    if (!requests.some(r => r.id === id)) issues.push(`Historical registry request ${id} is missing from the inventory.`)
  }
  let pendingCount = 0
  for (const r of requests) {
    const p = profiles[r.requesterProfileId]
    if (!r.id || r.id.includes('/') || r.eventId !== eventId || r.requestType !== 'cohost'
      || r.hostOwnerId !== event.hostOwnerId || r.hostProfileId !== event.hostId
      || r.requesterOwnerId === event.hostOwnerId || r.requesterProfileId === event.hostId
      || r.requesterProfileType !== 'organization' || !['pending', 'accepted', 'declined'].includes(r.status)) {
      issues.push(`Request ${r.id}: invalid identity, event linkage or status.`)
    }
    // Audit all historical identities; unresolved anomalies stop the migration.
    if (!p || p.id !== r.requesterProfileId || p.ownerId !== r.requesterOwnerId
      || p.profileType !== 'organization' || typeof p.name !== 'string' || !p.name.trim()
      || p.name !== r.requesterName) issues.push(`Request ${r.id}: organization profile/name mismatch.`)
    if (r.status === 'pending') pendingCount++
    if (r.status === 'accepted' && p) partners.set(r.requesterProfileId, { profileId: r.requesterProfileId, name: r.requesterName })
  }
  const confirmedCoHosts = [...partners.values()].sort((a, b) => a.profileId.localeCompare(b.profileId))
  if (confirmedCoHosts.length > 8) issues.push('More than eight confirmed organizations; never truncate attribution.')
  if (event.confirmedCoHosts && JSON.stringify([...event.confirmedCoHosts].sort((a, b) => a.profileId.localeCompare(b.profileId))) !== JSON.stringify(confirmedCoHosts)) {
    issues.push('Existing public attribution disagrees with audited accepted requests.')
  }
  const status = event.publicationStatus ?? 'draft'
  if (!['draft', 'pending_collaboration', 'ready_to_publish', 'published', 'cancelled'].includes(status)) issues.push('Unknown publication status.')
  if (['ready_to_publish', 'published'].includes(status) && (pendingCount !== 0 || event.collaborationRequirementsCompleted !== true)) {
    issues.push('Ready/published legacy event has pending requests or lacks explicit completion. Requires human review.')
  }
  if (!Number.isInteger(event.attendees) || !Number.isInteger(event.capacity) || event.attendees < 0 || event.capacity < event.attendees) issues.push('Invalid attendance/capacity.')
  const reservationId = event.titleReservationId ?? titleReservationId(event)
  if (reservation && (reservation.eventId !== eventId || reservation.hostId !== event.hostId
    || reservation.hostOwnerId !== event.hostOwnerId || reservation.title !== event.title)) issues.push('Title reservation conflicts with event.')
  const fingerprint = createHash('sha256').update(JSON.stringify(canonical(input))).digest('hex')
  return {
    eventId, fingerprint, ready: issues.length === 0, issues,
    inventory: requests.map(r => ({ id: r.id, status: r.status, requesterProfileId: r.requesterProfileId })),
    eventPatch: { collaborationVersion: 2, confirmedCoHosts, publicationStatus: status,
      collaborationRequirementsCompleted: event.collaborationRequirementsCompleted === true, titleReservationId: reservationId },
    control: { pendingCount, totalRequests: requests.length, acceptedCount: confirmedCoHosts.length,
      partnerProfileIds: confirmedCoHosts.map(p => p.profileId), lastRequestId: '', revision: 0 },
    reservationId, reservationToCreate: reservation ? null : { eventId, hostId: event.hostId, hostOwnerId: event.hostOwnerId, title: event.title },
  }
}

export async function loadInventory(db, eventId, transaction) {
  const read = ref => transaction ? transaction.get(ref) : ref.get()
  const eventSnapshot = await read(db.collection('events').doc(eventId))
  if (!eventSnapshot.exists) throw new Error('Event not found.')
  const event = eventSnapshot.data()
  const requestSnapshot = await read(db.collection('cohostRequests').where('eventId', '==', eventId))
  const requests = requestSnapshot.docs.map(d => ({ ...d.data(), id: d.id }))
  const ids = [...new Set([event.hostId, ...requests.map(r => r.requesterProfileId)])]
  const profiles = Object.create(null)
  for (const id of ids) {
    if (typeof id !== 'string' || !id || id.includes('/')) continue
    const p = await read(db.collection('userProfiles').doc(id))
    if (p.exists) profiles[id] = p.data()
  }
  const reservationId = event.titleReservationId ?? titleReservationId(event)
  const reservation = await read(db.collection('eventTitleReservations').doc(reservationId))
  return { eventId, event, requests, profiles, reservation: reservation.exists ? reservation.data() : null }
}

export async function applyMigration(db, eventId, expectedFingerprint) {
  return db.runTransaction(async tx => {
    const lockRef = db.collection('eventMigrationLocks').doc(eventId)
    const lock = await tx.get(lockRef)
    if (!lock.exists || lock.data().protocol !== 'publication-v2') throw new Error('An explicit migration freeze is required.')
    const controlRef = db.collection('eventCollaboration').doc(eventId)
    const existing = await tx.get(controlRef)
    // Earlier experimental two-slot controls must be audited separately, never overwritten.
    if (existing.exists) throw new Error('Accounting document already exists; stop for manual review.')
    const plan = planMigration(await loadInventory(db, eventId, tx))
    if (!plan.ready) throw new Error(plan.issues.join('\n'))
    if (plan.fingerprint !== expectedFingerprint) throw new Error('Inventory changed since review. Run dry-run again; no writes applied.')
    tx.update(db.collection('events').doc(eventId), plan.eventPatch)
    tx.create(controlRef, plan.control)
    if (plan.reservationToCreate) tx.create(db.collection('eventTitleReservations').doc(plan.reservationId), plan.reservationToCreate)
    // Original events and every request are retained; successful migration alone releases the freeze.
    tx.delete(lockRef)
    return plan
  })
}

async function main() {
  const args = process.argv.slice(2)
  const value = name => { const index = args.indexOf(name); return index >= 0 ? args[index + 1] : undefined }
  const fixture = value('--fixture'), project = value('--project'), eventId = value('--event')
  const apply = args.includes('--apply'), freeze = args.includes('--freeze')
  const report = value('--report')
  if (!report) throw new Error('Specify --report <local JSON file>. Default operation is read-only dry-run.')
  if (apply && freeze) throw new Error('Freeze and apply are separate reviewed steps.')
  if (fixture) {
    if (apply || freeze) throw new Error('Fixture mode is read-only.')
    const plan = planMigration(JSON.parse(await readFile(fixture, 'utf8')))
    await writeFile(report, JSON.stringify(plan, null, 2))
    console.log(`Dry-run: ${plan.ready ? 'READY FOR REVIEW' : 'BLOCKED'}; report: ${report}`)
    return
  }
  if (!project || !eventId || eventId.includes('/')) throw new Error('Specify --project and a single --event document ID.')
  if ((apply || freeze) && (value('--confirm-project') !== project || !args.includes('--ack-lock-rules'))) {
    throw new Error('Writes require --confirm-project matching --project and --ack-lock-rules after verifying freeze Rules are active.')
  }
  if (apply && !value('--expected-plan')) throw new Error('Apply requires --expected-plan <reviewed fingerprint>.')
  // Migration-only dependency, loaded only in explicitly requested connected mode.
  const require = createRequire(new URL('../functions/package.json', import.meta.url))
  const { initializeApp, applicationDefault } = require('firebase-admin/app')
  const { getFirestore } = require('firebase-admin/firestore')
  const db = getFirestore(initializeApp({ projectId: project, ...(process.env.FIRESTORE_EMULATOR_HOST ? {} : { credential: applicationDefault() }) }))
  try {
    if (freeze) {
      await db.runTransaction(async tx => {
        const e = await tx.get(db.collection('events').doc(eventId))
        if (!e.exists || e.data().collaborationVersion === 2) throw new Error('Event is missing or already migrated.')
        tx.create(db.collection('eventMigrationLocks').doc(eventId), { protocol: 'publication-v2' })
      })
    }
    const plan = apply ? await applyMigration(db, eventId, value('--expected-plan')) : planMigration(await loadInventory(db, eventId))
    await writeFile(report, JSON.stringify({ mode: apply ? 'applied' : freeze ? 'frozen-dry-run' : 'dry-run', project, ...plan }, null, 2))
    console.log(`${apply ? 'Applied reviewed migration' : 'Dry-run'}: ${plan.ready ? 'READY FOR REVIEW' : 'BLOCKED'}; report: ${report}`)
    if (!plan.ready) process.exitCode = 1
  } finally { await db.terminate() }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(error => { console.error(error.message); process.exitCode = 1 })
}
