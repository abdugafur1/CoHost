import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { collection, doc, getDoc, getDocs, query, runTransaction, setDoc, updateDoc, where, writeBatch } from 'firebase/firestore'
import rules from '../../firestore.rules?raw'

declare const process: { env: { FIRESTORE_EMULATOR_HOST?: string } }

// Experiment only: these narrow compatibility exceptions are NOT installed in firestore.rules.
// They repair the old hostId title query and missing reservation lookup without
// granting students unpublished-event access or weakening any write protocol.
const readCompatibilityRules = rules.replace('    match /events/{eventId} {', `
    match /events/{eventId} {
      allow get, list: if signedIn()
        && get(/databases/$(database)/documents/userProfiles/$(resource.data.hostId)).data.ownerId == request.auth.uid
        && get(/databases/$(database)/documents/userProfiles/$(resource.data.hostId)).data.id == resource.data.hostId
        && get(/databases/$(database)/documents/userProfiles/$(resource.data.hostId)).data.profileType == 'organization';
`).replace('    match /eventTitleReservations/{reservationId} {', `
    match /eventTitleReservations/{reservationId} {
      allow get: if signedIn()
        && !exists(/databases/$(database)/documents/eventTitleReservations/$(reservationId));
`)

// Historical nonzero co-host counts are metadata only: legacy resolutions do
// not increase event attendance. Version 2 still requires zero and accounting.
const cohostStart = readCompatibilityRules.indexOf('    match /cohostRequests')
const compatibilityRules = readCompatibilityRules.slice(0, cohostStart)
  + readCompatibilityRules.slice(cohostStart).replace(
    '&& request.resource.data.attendeeCount == 0',
    "&& (get(eventDoc).data.get('collaborationVersion', 0) != 2 ? request.resource.data.attendeeCount >= 0 : request.resource.data.attendeeCount == 0)",
  )

const host = { id: 'host-profile', ownerId: 'host-owner', profileType: 'organization', name: 'Host Club' }
const partner = { id: 'partner-profile', ownerId: 'partner-owner', profileType: 'organization', name: 'Partner Club' }
const student = { id: 'student-profile', ownerId: 'student-owner', profileType: 'student', name: 'Student' }
const event = (id: string) => ({
  id, hostId: host.id, hostOwnerId: host.ownerId, hostName: host.name, hostProfileType: 'organization',
  title: id, location: 'Campus', description: 'Event', audience: 'everyone', dateOptions: ['2026-12-01'],
  capacity: 30, attendees: 0, createdAt: '2026-11-01', titleReservationId: `${id}-title`,
})
const requestId = (eventId: string) => `${eventId}_${partner.ownerId}_${partner.id}_cohost`
const incoming = (eventId: string, attendeeCount: number) => ({
  requestType: 'cohost', eventId, eventTitle: eventId, hostOwnerId: host.ownerId, hostProfileId: host.id,
  requesterOwnerId: partner.ownerId, requesterProfileId: partner.id, requesterName: partner.name,
  requesterProfileType: 'organization', availableDates: ['2026-12-01'], attendeeCount,
  message: 'Original client message', status: 'pending', createdAt: '2026-11-01',
})

for (const candidate of [false, true]) {
  describe.skipIf(!process.env.FIRESTORE_EMULATOR_HOST)(candidate ? 'narrow Rules-only compatibility experiment' : 'current Rules deployed-payload baseline', () => {
    let env: RulesTestEnvironment
    beforeAll(async () => {
      env = await initializeTestEnvironment({ projectId: 'demo-cohost', firestore: { rules: candidate ? compatibilityRules : rules } })
    })
    afterEach(async () => { await env.clearFirestore() })
    afterAll(async () => { await env.cleanup() })
    const dbFor = (uid: string) => env.authenticatedContext(uid).firestore()
    const seed = async () => {
      await env.withSecurityRulesDisabled(async context => {
        const db = context.firestore()
        for (const p of [host, partner, student]) await setDoc(doc(db, 'userProfiles', p.id), p)
        await setDoc(doc(db, 'events', 'legacy'), event('legacy'))
        await setDoc(doc(db, 'events', 'pending'), { ...event('pending'), publicationStatus: 'pending_collaboration' })
        await setDoc(doc(db, 'events', 'published'), { ...event('published'), publicationStatus: 'published' })
        await setDoc(doc(db, 'events', 'v2'), { ...event('v2'), publicationStatus: 'pending_collaboration', collaborationVersion: 2, confirmedCoHosts: [] })
        await setDoc(doc(db, 'eventCollaboration', 'v2'), { pendingCount: 0, totalRequests: 0, acceptedCount: 0,
          partnerProfileIds: [], lastRequestId: '', revision: 0 })
        for (const id of ['legacy', 'pending', 'published', 'v2']) await setDoc(doc(db, 'eventTitleReservations', `${id}-title`), {
          eventId: id, hostId: host.id, hostOwnerId: host.ownerId, title: id,
        })
      })
    }

    it('rejects the live unfiltered events query for both students and organizations', async () => {
      await seed()
      await assertFails(getDocs(collection(dbFor(student.ownerId), 'events')))
      await assertFails(getDocs(collection(dbFor(host.ownerId), 'events')))
    })

    it('only the narrow candidate authorizes the old hostId duplicate-title query', async () => {
      await seed()
      const read = getDocs(query(collection(dbFor(host.ownerId), 'events'), where('hostId', '==', host.id)))
      if (candidate) expect((await assertSucceeds(read)).size).toBe(4)
      else await assertFails(read)
      await assertFails(getDocs(query(collection(dbFor(student.ownerId), 'events'), where('hostId', '==', host.id))))
      await assertFails(getDocs(query(collection(dbFor(partner.ownerId), 'events'), where('hostId', '==', host.id))))
    })

    it('candidate permits missing reservation lookup but never another host\'s existing reservation', async () => {
      await seed()
      const read = getDoc(doc(dbFor(host.ownerId), 'eventTitleReservations', 'missing-title'))
      if (candidate) expect((await assertSucceeds(read)).exists()).toBe(false)
      else await assertFails(read)
      await assertFails(getDoc(doc(dbFor(partner.ownerId), 'eventTitleReservations', 'legacy-title')))
      await assertFails(getDoc(doc(dbFor(student.ownerId), 'eventTitleReservations', 'legacy-title')))
    })

    it('candidate enables old creation and editing but does not make the event published or discoverable', async () => {
      await seed()
      const db = dbFor(host.ownerId)
      const oldCreate = async () => {
        await getDocs(query(collection(db, 'events'), where('hostId', '==', host.id)))
        await runTransaction(db, async tx => {
          const reservation = doc(db, 'eventTitleReservations', 'new-title')
          await tx.get(reservation)
          tx.set(reservation, { eventId: 'new', hostId: host.id, hostOwnerId: host.ownerId, title: 'new' })
          tx.set(doc(db, 'events', 'new'), { ...event('new'), titleReservationId: 'new-title' })
        })
      }
      if (!candidate) { await assertFails(oldCreate()); return }
      await assertSucceeds(oldCreate())
      await assertSucceeds(updateDoc(doc(db, 'events', 'new'), { description: 'Owner edit' }))
      expect((await getDoc(doc(db, 'events', 'new'))).data()).not.toHaveProperty('publicationStatus')
      await assertFails(getDoc(doc(dbFor(student.ownerId), 'events', 'new')))
      await assertFails(updateDoc(doc(db, 'events', 'new'), { publicationStatus: 'published', collaborationRequirementsCompleted: true }))
    })

    it('corrected filtered discovery preserves student privacy with either ruleset', async () => {
      await seed()
      const studentDb = dbFor(student.ownerId)
      const published = await assertSucceeds(getDocs(query(collection(studentDb, 'events'), where('publicationStatus', '==', 'published'))))
      expect(published.docs.map(d => d.id)).toEqual(['published'])
      await assertFails(getDoc(doc(studentDb, 'events', 'legacy')))
      await assertFails(getDoc(doc(studentDb, 'events', 'pending')))
      await assertSucceeds(getDocs(query(collection(dbFor(host.ownerId), 'events'), where('hostOwnerId', '==', host.ownerId))))
    })

    it('only the candidate accepts historical nonzero co-host metadata on legacy pending events', async () => {
      await seed()
      const oldWrite = setDoc(doc(dbFor(partner.ownerId), 'cohostRequests', requestId('pending')), incoming('pending', 2))
      if (candidate) {
        await assertSucceeds(oldWrite)
        expect((await getDoc(doc(dbFor(host.ownerId), 'events', 'pending'))).data()?.attendees).toBe(0)
      } else {
        await assertFails(oldWrite)
        await assertSucceeds(setDoc(doc(dbFor(partner.ownerId), 'cohostRequests', requestId('pending')), incoming('pending', 0)))
      }
      await assertFails(setDoc(doc(dbFor(partner.ownerId), 'cohostRequests', requestId('legacy')), incoming('legacy', 0)))
    })

    it('zero count alone does not bypass accounting on migrated events', async () => {
      await seed()
      await assertFails(setDoc(doc(dbFor(partner.ownerId), 'cohostRequests', requestId('v2')), incoming('v2', 0)))
      await assertFails(updateDoc(doc(dbFor(host.ownerId), 'eventCollaboration', 'v2'), { pendingCount: 0, revision: 1 }))
      const db = dbFor(partner.ownerId), b = writeBatch(db)
      b.set(doc(db, 'cohostRequests', requestId('v2')), incoming('v2', 2))
      b.update(doc(db, 'eventCollaboration', 'v2'), { pendingCount: 1, totalRequests: 1, revision: 1, lastRequestId: requestId('v2') })
      await assertFails(b.commit())

    })

    it('old approval payload works only for eligible legacy requests and cannot forge attribution', async () => {
      await seed()
      await env.withSecurityRulesDisabled(async context => {
        await setDoc(doc(context.firestore(), 'cohostRequests', requestId('pending')), incoming('pending', 2))
        await setDoc(doc(context.firestore(), 'cohostRequests', requestId('v2')), incoming('v2', 0))
      })
      const db = dbFor(host.ownerId)
      const resolution = { status: 'accepted', resolvedAt: 'now', resolvedByProfileId: host.id }
      await assertFails(updateDoc(doc(dbFor(student.ownerId), 'cohostRequests', requestId('pending')), resolution))
      await assertSucceeds(updateDoc(doc(db, 'cohostRequests', requestId('pending')), resolution))
      expect((await getDoc(doc(db, 'events', 'pending'))).data()?.attendees).toBe(0)
      await assertFails(updateDoc(doc(db, 'cohostRequests', requestId('v2')), resolution))
      await assertFails(updateDoc(doc(db, 'events', 'pending'), { confirmedCoHosts: [{ profileId: partner.id, name: 'Forged' }] }))
    })

    it('does not waive resource matching for legacy request compatibility', async () => {
      await seed()
      await env.withSecurityRulesDisabled(async context => {
        await updateDoc(doc(context.firestore(), 'events', 'pending'), { resourcesNeeded: ['Venue'] })
      })
      const db = dbFor(partner.ownerId)
      await assertFails(setDoc(doc(db, 'cohostRequests', requestId('pending')), incoming('pending', candidate ? 2 : 0)))
    })

    it('keeps verified version-2 submission, attribution, completion and publication working', async () => {
      await seed()
      const partnerDb = dbFor(partner.ownerId)
      const submission = writeBatch(partnerDb)
      submission.set(doc(partnerDb, 'cohostRequests', requestId('v2')), incoming('v2', 0))
      submission.update(doc(partnerDb, 'eventCollaboration', 'v2'), {
        pendingCount: 1, totalRequests: 1, revision: 1, lastRequestId: requestId('v2'),
      })
      await assertSucceeds(submission.commit())
      const db = dbFor(host.ownerId), approval = writeBatch(db)
      approval.update(doc(db, 'cohostRequests', requestId('v2')), { status: 'accepted', resolvedAt: 'now', resolvedByProfileId: host.id })
      approval.update(doc(db, 'eventCollaboration', 'v2'), {
        pendingCount: 0, acceptedCount: 1, partnerProfileIds: [partner.id], revision: 2, lastRequestId: requestId('v2'),
      })
      const hosts = [{ profileId: partner.id, name: partner.name }]
      approval.update(doc(db, 'events', 'v2'), { confirmedCoHosts: hosts })
      await assertSucceeds(approval.commit())
      await assertFails(getDoc(doc(dbFor(student.ownerId), 'events', 'v2')))
      await assertSucceeds(updateDoc(doc(db, 'events', 'v2'), { publicationStatus: 'ready_to_publish', collaborationRequirementsCompleted: true }))
      await assertSucceeds(updateDoc(doc(db, 'events', 'v2'), { publicationStatus: 'published' }))
      expect((await getDoc(doc(dbFor(student.ownerId), 'events', 'v2'))).data()?.confirmedCoHosts).toEqual(hosts)
      await assertFails(getDoc(doc(dbFor(student.ownerId), 'cohostRequests', requestId('v2'))))
    })

    it('legacy event deletion and publication stay blocked rather than erasing history', async () => {
      await seed()
      const db = dbFor(host.ownerId)
      const b = writeBatch(db); b.delete(doc(db, 'events', 'legacy')); b.delete(doc(db, 'eventTitleReservations', 'legacy-title'))
      await assertFails(b.commit())
      await assertFails(updateDoc(doc(db, 'events', 'pending'), { publicationStatus: 'ready_to_publish', collaborationRequirementsCompleted: true }))
    })
  })
}
