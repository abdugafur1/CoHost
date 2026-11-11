import { test } from 'node:test'
import assert from 'node:assert/strict'
import { planMigration } from './migrate-publication.mjs'

export const fixture = () => ({
  eventId: 'test-1', event: { title: 'Test 1', hostId: 'esport', hostOwnerId: 'esport-owner',
    hostProfileType: 'organization', attendees: 0, capacity: 30 },
  requests: [{ id: 'original-tennis-request', eventId: 'test-1', requestType: 'cohost',
    hostOwnerId: 'esport-owner', hostProfileId: 'esport', requesterOwnerId: 'tennis-owner',
    requesterProfileId: 'tennis', requesterProfileType: 'organization', requesterName: 'Tennis Club', status: 'accepted',
    message: 'Original private negotiation', resourcesProvided: ['Venue'] }],
  profiles: { esport: { id: 'esport', ownerId: 'esport-owner', profileType: 'organization', name: 'Esport Club' },
    tennis: { id: 'tennis', ownerId: 'tennis-owner', profileType: 'organization', name: 'Tennis Club' } }, reservation: null,
})

test('Test 1 audit preserves Tennis partnership, every request, and legacy privacy without modifying input', () => {
  const input = fixture(), original = JSON.stringify(input), plan = planMigration(input)
  assert.equal(plan.ready, true)
  assert.equal(JSON.stringify(input), original)
  assert.deepEqual(plan.eventPatch.confirmedCoHosts, [{ profileId: 'tennis', name: 'Tennis Club' }])
  assert.equal(plan.eventPatch.publicationStatus, 'draft')
  assert.deepEqual(plan.inventory.map(r => r.id), ['original-tennis-request'])
  assert.equal(plan.control.totalRequests, 1)
})

test('pending and declined history is fully counted without consuming accepted capacity', () => {
  const input = fixture()
  for (let i = 0; i < 15; i++) input.requests.push({ ...input.requests[0], id: `history-${i}`, status: i < 5 ? 'pending' : 'declined' })
  const plan = planMigration(input)
  assert.equal(plan.ready, true)
  assert.equal(plan.control.pendingCount, 5)
  assert.equal(plan.control.acceptedCount, 1)
  assert.equal(plan.control.totalRequests, 16)
  assert.equal(plan.inventory.length, 16)
})

test('mismatched identities, omitted registry entries and conflicting snapshots block migration', () => {
  for (const mutate of [
    x => { x.profiles.tennis.ownerId = 'attacker' },
    x => { x.requests[0].eventId = 'another-event' },
    x => { x.requests[0].status = 'unverified' },
    x => { delete x.profiles.tennis },
    x => { x.event.cohostRequestIds = ['omitted'] },
    x => { x.event.confirmedCoHosts = [{ profileId: 'fake', name: 'Fake Club' }] },
    x => { x.reservation = { eventId: 'other' } },
  ]) {
    const x = fixture(); mutate(x)
    assert.equal(planMigration(x).ready, false)
  }
})

test('more than eight accepted organizations are reported without truncation', () => {
  const input = fixture()
  for (let i = 0; i < 8; i++) {
    input.profiles[`p${i}`] = { id: `p${i}`, ownerId: `o${i}`, profileType: 'organization', name: `Club ${i}` }
    input.requests.push({ ...input.requests[0], id: `request-${i}`, requesterProfileId: `p${i}`, requesterOwnerId: `o${i}`, requesterName: `Club ${i}` })
  }
  const plan = planMigration(input)
  assert.equal(plan.ready, false)
  assert.equal(plan.eventPatch.confirmedCoHosts.length, 9)
  assert.equal(plan.inventory.length, 9)
})

test('fingerprints detect changes to historical messages as well as request states', () => {
  const input = fixture(), before = planMigration(input).fingerprint
  input.requests[0].message = 'Edited after review'
  assert.notEqual(planMigration(input).fingerprint, before)
})

test('ready and published events with pending requests or missing completion stop for human review', () => {
  for (const status of ['ready_to_publish', 'published']) {
    const input = fixture(); input.event.publicationStatus = status
    assert.equal(planMigration(input).ready, false)
    input.event.collaborationRequirementsCompleted = true
    assert.equal(planMigration(input).ready, true)
    input.requests[0].status = 'pending'
    assert.equal(planMigration(input).ready, false)
  }
})


test('CLI defaults to offline report-only mode and rejects write switches in fixture mode', async () => {
  const { mkdtemp, writeFile, readFile, unlink, rmdir } = await import('node:fs/promises')
  const { tmpdir } = await import('node:os')
  const { join } = await import('node:path')
  const { execFileSync } = await import('node:child_process')
  const dir = await mkdtemp(join(tmpdir(), 'cohost-migration-audit-'))
  const inputPath = join(dir, 'fixture.json'), report = join(dir, 'report.json')
  const original = JSON.stringify(fixture())
  try {
    await writeFile(inputPath, original)
    const tool = new URL('./migrate-publication.mjs', import.meta.url)
    const { fileURLToPath } = await import('node:url')
    const args = [fileURLToPath(tool), '--fixture', inputPath, '--report', report]
    const output = execFileSync(process.execPath, args, { encoding: 'utf8' })
    assert.match(output, /Dry-run/)
    assert.equal(JSON.parse(await readFile(report, 'utf8')).ready, true)
    assert.equal(await readFile(inputPath, 'utf8'), original)
    assert.throws(() => execFileSync(process.execPath, [...args, '--apply'], { stdio: 'pipe' }))
  } finally { await unlink(inputPath); await unlink(report); await rmdir(dir) }
})

test('CLI refuses connected writes without matching explicit project confirmation before SDK loading', async () => {
  const { execFileSync } = await import('node:child_process')
  const { fileURLToPath } = await import('node:url')
  assert.throws(() => execFileSync(process.execPath, [fileURLToPath(new URL('./migrate-publication.mjs', import.meta.url)),
    '--project', 'demo-cohost', '--event', 'test-1', '--freeze', '--report', 'unused.json'], { stdio: 'pipe' }),
    error => /Writes require/.test(String(error.stderr)))
})
