import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { assertFails, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { collection, doc, getDoc, getDocs, query, where, deleteDoc, setDoc, type Firestore } from 'firebase/firestore'
import rules from '../../firestore.rules?raw'
import type { EventItem, EventRequest, UserProfile } from '../types'

const session = vi.hoisted(() => ({ database: null as Firestore | null, uid: null as string | null }))
vi.mock('./firebase', () => ({
  get db() { if (!session.database) throw new Error('Emulator test database is not selected'); return session.database },
  auth: { get currentUser() { return session.uid ? { uid: session.uid } : null } },
}))
import { ensureOrganizationAccount, publishEvent, saveUserProfile, saveOrganizationProfile, saveEventItem,
  saveEventRequest, resolveEventRequest, updateEventItem, createEventRequestId } from './cohost'

declare const process: { env: { FIRESTORE_EMULATOR_HOST?: string } }
const organization = (id: string): UserProfile => ({ id, ownerId: `${id}-owner`, profileType: 'organization', name: `${id} Club`,
  description: 'Campus club', focus: 'Sports', location: 'Campus', createdAt: '2026-11-01', directoryVisible: false })

describe.skipIf(!process.env.FIRESTORE_EMULATOR_HOST)('clean launch using the actual client services', () => {
  let env: RulesTestEnvironment
  const as = (uid: string) => { session.uid = uid; session.database = env.authenticatedContext(uid).firestore() as unknown as Firestore; return session.database }
  beforeAll(async () => { env = await initializeTestEnvironment({ projectId: 'demo-cohost', firestore: { rules } }) })
  afterEach(async () => { await env.clearFirestore(); session.database = null; session.uid = null; vi.unstubAllEnvs() })
  afterAll(async () => { await env.cleanup() })

  it('runs profile creation through collaboration, publication, public attribution and student acceptance from empty data', async () => {
    vi.stubEnv('VITE_PUBLICATION_V2_ENABLED', 'true')
    const host = organization('host'), partner = organization('partner'), declined = organization('declined')
    for (const profile of [host, partner, declined]) {
      as(profile.ownerId); await saveUserProfile(profile); await ensureOrganizationAccount(profile)
      expect((await getDoc(doc(session.database!, 'organizationAccounts', profile.ownerId))).data()?.profileId).toBe(profile.id)
      expect((await getDoc(doc(session.database!, 'publicOrganizations', profile.id))).exists()).toBe(false)
    }
    as(partner.ownerId); await saveOrganizationProfile({ ...partner, directoryVisible: true })
    as(host.ownerId)
    const event: EventItem = { id: 'new-v2', hostId: host.id, hostOwnerId: host.ownerId, hostName: host.name, hostProfileType: 'organization',
      title: 'Clean launch', description: 'Fresh event', location: 'Campus', audience: 'everyone', dateOptions: ['2026-12-01'],
      capacity: 20, attendees: 0, createdAt: '2026-11-01', publicationStatus: 'draft', collaborationRequirementsCompleted: false }
    await saveEventItem(event)
    const er = doc(session.database!, 'events', event.id)
    let current = (await getDoc(er)).data() as EventItem
    expect(current.collaborationVersion).toBe(2)
    expect(current.confirmedCoHosts).toEqual([])
    expect((await getDoc(doc(session.database!, 'eventCollaboration', event.id))).data()).toEqual({
      pendingCount: 0, totalRequests: 0, acceptedCount: 0, partnerProfileIds: [], lastRequestId: '', revision: 0,
    })
    current = await updateEventItem({ ...current, publicationStatus: 'pending_collaboration' })
    const requests: EventRequest[] = []
    for (const p of [partner, declined]) {
      as(p.ownerId)
      expect((await getDocs(query(collection(session.database!, 'events'), where('publicationStatus', '==', 'pending_collaboration')))).size).toBe(1)
      const request: EventRequest = { id: createEventRequestId(event.id, p.ownerId, p.id, 'cohost'), requestType: 'cohost', eventId: event.id,
        eventTitle: event.title, hostOwnerId: host.ownerId, hostProfileId: host.id, requesterOwnerId: p.ownerId, requesterProfileId: p.id,
        requesterName: p.name, requesterProfileType: 'organization', availableDates: event.dateOptions, attendeeCount: 0,
        message: 'Private agreement', status: 'pending', createdAt: '2026-11-01', resourcesProvided: ['General contribution'], contributionDescription: 'We can help' }
      await saveEventRequest(request); requests.push(request)
    }
    as(host.ownerId)
    await expect(updateEventItem({ ...current, publicationStatus: 'ready_to_publish', collaborationRequirementsCompleted: true })).rejects.toThrow('Resolve all')
    await resolveEventRequest(requests[0], 'accepted', host.ownerId, host.id)
    await resolveEventRequest(requests[1], 'declined', host.ownerId, host.id)
    // current is intentionally stale: client edit must retain the accepted public partner.
    current = await updateEventItem({ ...current, publicationStatus: 'ready_to_publish', collaborationRequirementsCompleted: true })
    expect(current.confirmedCoHosts).toEqual([{ profileId: partner.id, name: partner.name }])
    const student = { ...organization('student'), profileType: 'student' as const }
    as(student.ownerId); await saveUserProfile(student)
    await assertFails(getDoc(doc(session.database!, 'events', event.id)))
    as(host.ownerId); expect(await publishEvent(event.id)).toEqual([{ profileId: partner.id, name: partner.name }])
    as(student.ownerId)
    const visible = await getDocs(query(collection(session.database!, 'events'), where('publicationStatus', '==', 'published')))
    expect(visible.docs[0].data().confirmedCoHosts).toEqual([{ profileId: partner.id, name: partner.name }])
    await assertFails(getDoc(doc(session.database!, 'cohostRequests', requests[0].id)))
    const participation: EventRequest = { ...requests[0], id: createEventRequestId(event.id, student.ownerId, student.id, 'participation'),
      requestType: 'participation', requesterOwnerId: student.ownerId, requesterProfileId: student.id, requesterName: student.name,
      requesterProfileType: 'student', attendeeCount: 1 }
    await saveEventRequest(participation)
    as(host.ownerId); await resolveEventRequest(participation, 'accepted', host.ownerId, host.id)
    expect((await getDoc(doc(session.database!, 'events', event.id))).data()?.attendees).toBe(1)
  })

  it('recovers marker and opted-in directory listing from cloud values, never stale local profile fields', async () => {
    const profile = { ...organization('existing'), directoryVisible: true }
    as(profile.ownerId); await saveUserProfile(profile)
    await deleteDoc(doc(session.database!, 'organizationAccounts', profile.ownerId))
    await deleteDoc(doc(session.database!, 'publicOrganizations', profile.id))
    await ensureOrganizationAccount({ ...profile, name: 'Stale device name', directoryVisible: false })
    expect((await getDoc(doc(session.database!, 'userProfiles', profile.id))).data()?.name).toBe(profile.name)
    expect((await getDoc(doc(session.database!, 'publicOrganizations', profile.id))).data()?.name).toBe(profile.name)
    expect((await getDoc(doc(session.database!, 'organizationAccounts', profile.ownerId))).data()?.profileId).toBe(profile.id)
  })
  it('recovers an opted-in existing profile missing optional directory arrays using cloud defaults only', async () => {
    const profile = { ...organization('older-cloud'), directoryVisible: true }
    as(profile.ownerId)
    await setDoc(doc(session.database!, 'userProfiles', profile.id), profile)
    await ensureOrganizationAccount({ ...profile, name: 'Stale cache' })
    const privateProfile = (await getDoc(doc(session.database!, 'userProfiles', profile.id))).data()!
    const publicProfile = (await getDoc(doc(session.database!, 'publicOrganizations', profile.id))).data()!
    expect(privateProfile.name).toBe(profile.name)
    expect(publicProfile.name).toBe(profile.name)
    expect(privateProfile.interests).toEqual([])
    expect(publicProfile.interests).toEqual([])
  })

})
