import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
} from 'vitest'
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing'
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  runTransaction,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore'
import firestoreRules from '../../firestore.rules?raw'
import type { PublicOrganization, UserProfile } from '../types'

declare const process: { env: { FIRESTORE_EMULATOR_HOST?: string } }

const profileId = 'club-profile'
const ownerId = 'club-owner'
const organizationProfile: UserProfile = {
  id: profileId,
  ownerId,
  name: 'Robotics Collective',
  profileType: 'organization',
  focus: 'Technology',
  location: 'North campus',
  description: 'Builds helpful robots.',
  createdAt: '2026-11-01T10:00:00.000Z',
  interests: ['Technology', 'Education'],
  eventTypes: ['Workshops'],
  availableResources: ['Technical Support'],
  collaborationPreferences: ['Open to co-hosting'],
  directoryVisible: true,
}

const publicListing: PublicOrganization = {
  profileId,
  name: organizationProfile.name,
  description: organizationProfile.description,
  focus: organizationProfile.focus,
  location: organizationProfile.location,
  interests: organizationProfile.interests ?? [],
  eventTypes: organizationProfile.eventTypes ?? [],
  availableResources: organizationProfile.availableResources ?? [],
  collaborationPreferences: organizationProfile.collaborationPreferences ?? [],
}

let testEnvironment: RulesTestEnvironment

const seedOrganization = async (profile: UserProfile = organizationProfile) => {
  await testEnvironment.withSecurityRulesDisabled(async (context) => {
    const database = context.firestore()
    await setDoc(doc(database, 'userProfiles', profileId), profile)
    if (profile.directoryVisible) {
      await setDoc(doc(database, 'publicOrganizations', profileId), publicListing)
    }
  })
}

describe.skipIf(!process.env.FIRESTORE_EMULATOR_HOST)(
  'Firestore organization directory rules',
  () => {
  beforeAll(async () => {
    testEnvironment = await initializeTestEnvironment({
      projectId: 'demo-cohost',
      firestore: { rules: firestoreRules },
      },
    )
  })

  afterEach(async () => {
    await testEnvironment.clearFirestore()
  })

  afterAll(async () => {
    await testEnvironment.cleanup()
  })

  it('allows public listing reads while keeping private organization profiles owner-only', async () => {
    await seedOrganization()
    const anonymousDb = testEnvironment.unauthenticatedContext().firestore()

    await assertSucceeds(getDoc(doc(anonymousDb, 'publicOrganizations', profileId)))
    await assertFails(getDoc(doc(anonymousDb, 'userProfiles', profileId)))
  })

  it('allows the authenticated profile owner to publish a matching organization listing atomically', async () => {
    const ownerDb = testEnvironment.authenticatedContext(ownerId).firestore()
    const batch = writeBatch(ownerDb)
    batch.set(doc(ownerDb, 'userProfiles', profileId), organizationProfile)
    batch.set(doc(ownerDb, 'publicOrganizations', profileId), publicListing)

    await assertSucceeds(batch.commit())

    const listing = await getDoc(
      doc(testEnvironment.unauthenticatedContext().firestore(), 'publicOrganizations', profileId),
    )
    expect(listing.data()).not.toHaveProperty('ownerId')
    expect(listing.data()).toMatchObject({ name: organizationProfile.name })
  })

  it('rejects publishing a listing for another user’s organization profile', async () => {
    await seedOrganization()
    const attackerDb = testEnvironment.authenticatedContext('another-owner').firestore()

    await assertFails(
      setDoc(doc(attackerDb, 'publicOrganizations', profileId), {
        ...publicListing,
        name: 'Impersonated Club',
      }),
    )
  })

  it('rejects student profiles and private fields in public listings', async () => {
    const ownerDb = testEnvironment.authenticatedContext(ownerId).firestore()
    const studentProfile = { ...organizationProfile, profileType: 'student' as const }
    const studentBatch = writeBatch(ownerDb)
    studentBatch.set(doc(ownerDb, 'userProfiles', profileId), studentProfile)
    studentBatch.set(doc(ownerDb, 'publicOrganizations', profileId), publicListing)

    await assertFails(studentBatch.commit())
    await seedOrganization()

    await assertFails(
      setDoc(doc(ownerDb, 'publicOrganizations', profileId), {
        ...publicListing,
        ownerId,
      }),
    )
  })

  it('allows the owner to opt out and removes the public listing without deleting the profile', async () => {
    await seedOrganization()
    const ownerDb = testEnvironment.authenticatedContext(ownerId).firestore()
    const batch = writeBatch(ownerDb)
    batch.update(doc(ownerDb, 'userProfiles', profileId), { directoryVisible: false })
    batch.delete(doc(ownerDb, 'publicOrganizations', profileId))

    await assertSucceeds(batch.commit())
    await assertSucceeds(getDoc(doc(ownerDb, 'userProfiles', profileId)))
    const listing = await getDoc(
      doc(testEnvironment.unauthenticatedContext().firestore(), 'publicOrganizations', profileId),
    )
    expect(listing.exists()).toBe(false)
  })

  it('hides unpublished events from students while allowing verified organizations to discover them', async () => {
    const partnerProfile: UserProfile = {
      ...organizationProfile,
      id: 'partner-organization-profile',
      ownerId: 'partner-organization-owner',
      name: 'Partner Organization',
    }
    const privateEvent = {
      id: 'private-workshop',
      title: 'Private Collaboration Workshop',
      hostId: profileId,
      hostOwnerId: ownerId,
      publicationStatus: 'pending_collaboration',
    }
    const publishedEvent = {
      ...privateEvent,
      id: 'published-workshop',
      title: 'Published Workshop',
      publicationStatus: 'published',
    }
    const draftEvent = {
      ...privateEvent,
      id: 'draft-workshop',
      title: 'Draft Workshop',
      publicationStatus: 'draft',
    }
    const privateCohostRequest = {
      requestType: 'cohost',
      eventId: privateEvent.id,
      hostOwnerId: ownerId,
      requesterOwnerId: partnerProfile.ownerId,
      status: 'accepted',
    }
    await testEnvironment.withSecurityRulesDisabled(async (context) => {
      const database = context.firestore()
      await setDoc(doc(database, 'userProfiles', profileId), organizationProfile)
      await setDoc(doc(database, 'userProfiles', partnerProfile.id), partnerProfile)
      await setDoc(doc(database, 'events', privateEvent.id), privateEvent)
      await setDoc(doc(database, 'events', publishedEvent.id), publishedEvent)
      await setDoc(doc(database, 'events', draftEvent.id), draftEvent)
      await setDoc(doc(database, 'cohostRequests', 'private-cohost-request'), privateCohostRequest)
      await setDoc(doc(database, 'eventTitleReservations', 'private-title'), {
        eventId: privateEvent.id,
        hostId: profileId,
        hostOwnerId: ownerId,
        title: privateEvent.title,
      })
    })

    const studentDb = testEnvironment.authenticatedContext('student-owner').firestore()
    const organizationDb = testEnvironment.authenticatedContext(ownerId).firestore()
    const partnerDb = testEnvironment.authenticatedContext(partnerProfile.ownerId).firestore()
    const attackerDb = testEnvironment.authenticatedContext('attacker-owner').firestore()
    await assertFails(getDoc(doc(studentDb, 'events', privateEvent.id)))
    await assertFails(getDoc(doc(studentDb, 'cohostRequests', 'private-cohost-request')))
    await assertFails(getDocs(collection(studentDb, 'events')))
    await assertFails(getDoc(doc(studentDb, 'eventTitleReservations', 'private-title')))
    const publishedEvents = await getDocs(
      query(collection(studentDb, 'events'), where('publicationStatus', '==', 'published')),
    )
    expect(publishedEvents.docs.map((snapshot) => snapshot.id)).toEqual([publishedEvent.id])

    await assertSucceeds(
      setDoc(doc(partnerDb, 'organizationAccounts', partnerProfile.ownerId), {
        profileId: partnerProfile.id,
      }),
    )
    await assertSucceeds(
      setDoc(doc(organizationDb, 'organizationAccounts', ownerId), { profileId }),
    )
    await assertFails(
      setDoc(doc(attackerDb, 'organizationAccounts', 'attacker-owner'), { profileId }),
    )
    await assertSucceeds(getDoc(doc(organizationDb, 'events', privateEvent.id)))
    await assertSucceeds(getDoc(doc(organizationDb, 'events', draftEvent.id)))
    await assertFails(getDoc(doc(partnerDb, 'events', draftEvent.id)))
    await assertFails(getDocs(collection(partnerDb, 'events')))
    await assertFails(
      getDocs(query(collection(organizationDb, 'events'), where('hostId', '==', profileId))),
    )
    const collaborationEvents = await getDocs(
      query(
        collection(partnerDb, 'events'),
        where('publicationStatus', '==', 'pending_collaboration'),
      ),
    )
    expect(collaborationEvents.docs.map((snapshot) => snapshot.id)).toEqual([privateEvent.id])
    const organizationPublishedEvents = await getDocs(
      query(collection(partnerDb, 'events'), where('publicationStatus', '==', 'published')),
    )
    expect(organizationPublishedEvents.docs.map((snapshot) => snapshot.id)).toEqual([
      publishedEvent.id,
    ])
    const ownerEvents = await getDocs(
      query(collection(organizationDb, 'events'), where('hostOwnerId', '==', ownerId)),
    )
    expect(ownerEvents.docs.map((snapshot) => snapshot.id).sort()).toEqual(
      [privateEvent.id, publishedEvent.id, draftEvent.id].sort(),
    )
    await assertSucceeds(
      getDoc(doc(organizationDb, 'eventTitleReservations', 'private-title')),
    )
  })

  it('only lets accounts mark an owned organization profile for event discovery', async () => {
    const profile: UserProfile = {
      ...organizationProfile,
      id: 'atomic-organization-profile',
      ownerId: 'atomic-organization-owner',
    }
    const ownerDb = testEnvironment.authenticatedContext(profile.ownerId).firestore()
    const batch = writeBatch(ownerDb)
    batch.set(doc(ownerDb, 'userProfiles', profile.id), profile)
    batch.set(doc(ownerDb, 'organizationAccounts', profile.ownerId), { profileId: profile.id })
    await assertSucceeds(batch.commit())

    const studentProfile: UserProfile = {
      ...profile,
      id: 'atomic-student-profile',
      ownerId: 'atomic-student-owner',
      profileType: 'student',
    }
    const studentDb = testEnvironment.authenticatedContext(studentProfile.ownerId).firestore()
    const studentBatch = writeBatch(studentDb)
    studentBatch.set(doc(studentDb, 'userProfiles', studentProfile.id), studentProfile)
    studentBatch.set(doc(studentDb, 'organizationAccounts', studentProfile.ownerId), {
      profileId: studentProfile.id,
    })
    await assertFails(studentBatch.commit())
  })

  it('rejects student participation requests for unpublished and cancelled events', async () => {
    const student: UserProfile = {
      ...organizationProfile,
      id: 'publication-student',
      ownerId: 'publication-student-owner',
      name: 'Publication Student',
      profileType: 'student',
    }
    const event = {
      id: 'publication-check-event',
      hostId: profileId,
      hostOwnerId: ownerId,
      hostName: organizationProfile.name,
      hostProfileType: 'organization',
      title: 'Publication Check Event',
      location: 'North campus',
      description: 'An event.',
      audience: 'everyone',
      dateOptions: ['2026-12-01'],
      capacity: 30,
      attendees: 0,
      createdAt: '2026-11-01T10:00:00.000Z',
      publicationStatus: 'pending_collaboration',
      collaborationRequirementsCompleted: false,
    }
    await testEnvironment.withSecurityRulesDisabled(async (context) => {
      const database = context.firestore()
      await setDoc(doc(database, 'userProfiles', profileId), organizationProfile)
      await setDoc(doc(database, 'userProfiles', student.id), student)
      await setDoc(doc(database, 'events', event.id), event)
    })
    const studentDb = testEnvironment.authenticatedContext(student.ownerId).firestore()
    const requestId = `${event.id}_${student.ownerId}_${student.id}_participation`
    const participationRequest = {
      requestType: 'participation',
      eventId: event.id,
      eventTitle: event.title,
      hostOwnerId: ownerId,
      hostProfileId: profileId,
      requesterOwnerId: student.ownerId,
      requesterProfileId: student.id,
      requesterName: student.name,
      requesterProfileType: 'student',
      availableDates: ['2026-12-01'],
      attendeeCount: 1,
      message: '',
      status: 'pending',
      createdAt: '2026-11-02T10:00:00.000Z',
    }

    await assertFails(
      setDoc(doc(studentDb, 'participationRequests', requestId), participationRequest),
    )
    await testEnvironment.withSecurityRulesDisabled(async (context) => {
      await updateDoc(doc(context.firestore(), 'events', event.id), {
        publicationStatus: 'cancelled',
      })
    })
    await assertFails(
      setDoc(doc(studentDb, 'participationRequests', requestId), participationRequest),
    )
  })

  it('requires the hosting owner to complete collaboration before publishing', async () => {
    const eventId = 'ready-to-publish-event'
    const reservationId = 'ready-to-publish-title'
    const event = {
      id: eventId,
      hostId: profileId,
      hostOwnerId: ownerId,
      hostName: organizationProfile.name,
      hostProfileType: 'organization',
      title: 'Ready to Publish Event',
      location: 'North campus',
      description: 'An event.',
      audience: 'everyone',
      dateOptions: ['2026-12-01'],
      capacity: 30,
      attendees: 0,
      createdAt: '2026-11-01T10:00:00.000Z',
      publicationStatus: 'pending_collaboration',
      collaborationRequirementsCompleted: false,
      titleReservationId: reservationId,
      cohostRequestIds: [],
    }
    await testEnvironment.withSecurityRulesDisabled(async (context) => {
      const database = context.firestore()
      await setDoc(doc(database, 'userProfiles', profileId), organizationProfile)
      await setDoc(doc(database, 'events', eventId), event)
      await setDoc(doc(database, 'eventTitleReservations', reservationId), {
        eventId,
        hostId: profileId,
        hostOwnerId: ownerId,
        title: event.title,
      })
    })

    const hostDb = testEnvironment.authenticatedContext(ownerId).firestore()
    const otherDb = testEnvironment.authenticatedContext('other-owner').firestore()
    const eventRef = doc(hostDb, 'events', eventId)
    await assertFails(
      updateDoc(eventRef, {
        publicationStatus: 'ready_to_publish',
        collaborationRequirementsCompleted: false,
      }),
    )
    await assertFails(
      updateDoc(eventRef, {
        publicationStatus: 'ready_to_publish',
        collaborationRequirementsCompleted: true,
      }),
    )
    await assertFails(updateDoc(doc(otherDb, 'events', eventId), { publicationStatus: 'published' }))
    await assertFails(updateDoc(eventRef, { publicationStatus: 'published' }))
    await assertFails(updateDoc(eventRef, { confirmedCoHosts: [{ profileId: 'partner', name: 'Fake Club' }] }))
  })

  it('lets the owner start collaboration on a legacy draft without changing existing requests', async () => {
    const eventId = 'legacy-draft-event'
    const reservationId = 'legacy-draft-title'
    const legacyEvent = {
      id: eventId,
      hostId: profileId,
      hostOwnerId: ownerId,
      hostName: organizationProfile.name,
      hostProfileType: 'organization',
      title: 'Test 1',
      location: 'North campus',
      description: 'Legacy event description.',
      audience: 'everyone',
      dateOptions: ['2026-12-01'],
      capacity: 30,
      attendees: 0,
      createdAt: '2026-11-01T10:00:00.000Z',
      titleReservationId: reservationId,
    }
    const acceptedRequest = {
      id: `${eventId}_partner-owner_partner-profile_cohost`,
      requestType: 'cohost',
      eventId,
      eventTitle: legacyEvent.title,
      hostOwnerId: ownerId,
      hostProfileId: profileId,
      requesterOwnerId: 'partner-owner',
      requesterProfileId: 'partner-profile',
      requesterName: 'Partner Club',
      requesterProfileType: 'organization',
      availableDates: ['2026-12-01'],
      attendeeCount: 0,
      message: 'We can contribute.',
      status: 'accepted',
      createdAt: '2026-11-02T10:00:00.000Z',
      resourcesProvided: ['Venue'],
      contributionDescription: 'We can provide the venue.',
    }
    await testEnvironment.withSecurityRulesDisabled(async (context) => {
      const database = context.firestore()
      await setDoc(doc(database, 'userProfiles', profileId), organizationProfile)
      await setDoc(doc(database, 'events', eventId), legacyEvent)
      await setDoc(doc(database, 'eventTitleReservations', reservationId), {
        eventId,
        hostId: profileId,
        hostOwnerId: ownerId,
        title: legacyEvent.title,
      })
      await setDoc(doc(database, 'cohostRequests', acceptedRequest.id), acceptedRequest)
    })

    const ownerDb = testEnvironment.authenticatedContext(ownerId).firestore()
    const eventRef = doc(ownerDb, 'events', eventId)
    const reservationRef = doc(ownerDb, 'eventTitleReservations', reservationId)
    await assertSucceeds(
      runTransaction(ownerDb, async (transaction) => {
        const [eventSnapshot, reservationSnapshot] = await Promise.all([
          transaction.get(eventRef),
          transaction.get(reservationRef),
        ])
        expect(eventSnapshot.exists()).toBe(true)
        expect(reservationSnapshot.exists()).toBe(true)
        transaction.update(eventRef, {
          publicationStatus: 'pending_collaboration',
          collaborationRequirementsCompleted: false,
        })
      }),
    )

    await testEnvironment.withSecurityRulesDisabled(async (context) => {
      const database = context.firestore()
      const updatedEvent = await getDoc(doc(database, 'events', eventId))
      const unchangedRequest = await getDoc(doc(database, 'cohostRequests', acceptedRequest.id))
      expect(updatedEvent.data()).toMatchObject({
        ...legacyEvent,
        publicationStatus: 'pending_collaboration',
        collaborationRequirementsCompleted: false,
      })
      expect(unchangedRequest.data()).toEqual(acceptedRequest)
    })
  })

  it('prevents an owner from changing the profile owner identifier while updating a listing', async () => {
    await seedOrganization()
    const ownerDb = testEnvironment.authenticatedContext(ownerId).firestore()
    const batch = writeBatch(ownerDb)
    batch.update(doc(ownerDb, 'userProfiles', profileId), { ownerId: 'attacker' })
    batch.set(doc(ownerDb, 'publicOrganizations', profileId), publicListing)

    await assertFails(batch.commit())
  })

  it('allows partial co-host matching but rejects resources the event did not request', async () => {
    const requesterProfile: UserProfile = {
      ...organizationProfile,
      id: 'requester-profile',
      ownerId: 'requester-owner',
      name: 'Volunteer Club',
    }
    const event = {
      id: 'collaboration-event',
      hostId: profileId,
      hostOwnerId: ownerId,
      hostName: organizationProfile.name,
      hostProfileType: 'organization',
      title: 'Community Workshop',
      location: 'North campus',
      description: 'A workshop.',
      audience: 'organizations',
      dateOptions: ['2026-12-01'],
      capacity: 30,
      attendees: 0,
      createdAt: '2026-11-01T10:00:00.000Z',
      resourcesNeeded: ['Venue', 'Volunteers', 'Funding'],
      publicationStatus: 'pending_collaboration',
      collaborationRequirementsCompleted: false,
    }
    await testEnvironment.withSecurityRulesDisabled(async (context) => {
      const database = context.firestore()
      await setDoc(doc(database, 'userProfiles', profileId), organizationProfile)
      await setDoc(doc(database, 'userProfiles', requesterProfile.id), requesterProfile)
      await setDoc(doc(database, 'events', event.id), event)
    })

    const requesterDb = testEnvironment.authenticatedContext(requesterProfile.ownerId).firestore()
    const requestId = `${event.id}_${requesterProfile.ownerId}_${requesterProfile.id}_cohost`
    const request = {
      requestType: 'cohost',
      eventId: event.id,
      eventTitle: event.title,
      hostOwnerId: ownerId,
      hostProfileId: profileId,
      requesterOwnerId: requesterProfile.ownerId,
      requesterProfileId: requesterProfile.id,
      requesterName: requesterProfile.name,
      requesterProfileType: 'organization',
      availableDates: ['2026-12-01'],
      attendeeCount: 0,
      message: 'We would like to collaborate.',
      status: 'pending',
      createdAt: '2026-11-02T10:00:00.000Z',
      resourcesProvided: ['Venue'],
      contributionDescription: 'We can provide the venue.',
      estimatedAttendees: 4,
    }

    await assertFails(
      setDoc(doc(requesterDb, 'cohostRequests', requestId), {
        ...request,
        resourcesProvided: ['Unrequested'],
      }),
    )
    await assertFails(
      setDoc(doc(requesterDb, 'cohostRequests', requestId), {
        ...request,
        estimatedAttendees: 2.5,
      }),
    )
    await assertFails(
      setDoc(doc(requesterDb, 'cohostRequests', requestId), {
        ...request,
        estimatedAttendees: null,
      }),
    )
    await assertFails(
      setDoc(doc(requesterDb, 'cohostRequests', requestId), {
        ...request,
        resourcesProvided: 'Venue',
      }),
    )
    await assertFails(
      setDoc(doc(requesterDb, 'cohostRequests', requestId), {
        ...request,
        contributionDescription: '   ',
      }),
    )
    await assertSucceeds(setDoc(doc(requesterDb, 'cohostRequests', requestId), request))
    await assertFails(
      updateDoc(doc(requesterDb, 'cohostRequests', requestId), {
        contributionDescription: 'Changed after submission.',
      }),
    )
  })

  it('accepts unknown attendance without counting attendees and verifies both organization profiles', async () => {
    const requesterProfile: UserProfile = {
      ...organizationProfile,
      id: 'attendance-requester-profile',
      ownerId: 'attendance-requester',
      name: 'Attendance Requester Club',
    }
    const event = {
      id: 'attendance-event',
      hostId: profileId,
      hostOwnerId: ownerId,
      hostName: organizationProfile.name,
      hostProfileType: 'organization',
      title: 'Attendance Event',
      location: 'North campus',
      description: 'An event.',
      audience: 'organizations',
      dateOptions: ['2026-12-01'],
      capacity: 30,
      attendees: 0,
      createdAt: '2026-11-01T10:00:00.000Z',
      resourcesNeeded: ['Venue', 'Volunteers'],
      publicationStatus: 'pending_collaboration',
      collaborationRequirementsCompleted: false,
    }
    await testEnvironment.withSecurityRulesDisabled(async (context) => {
      const database = context.firestore()
      await setDoc(doc(database, 'userProfiles', profileId), organizationProfile)
      await setDoc(doc(database, 'userProfiles', requesterProfile.id), requesterProfile)
      await setDoc(doc(database, 'events', event.id), event)
    })

    const requestId = `${event.id}_${requesterProfile.ownerId}_${requesterProfile.id}_cohost`
    const request = {
      requestType: 'cohost',
      eventId: event.id,
      eventTitle: event.title,
      hostOwnerId: ownerId,
      hostProfileId: profileId,
      requesterOwnerId: requesterProfile.ownerId,
      requesterProfileId: requesterProfile.id,
      requesterName: requesterProfile.name,
      requesterProfileType: 'organization',
      availableDates: ['2026-12-01'],
      attendeeCount: 0,
      message: 'We would like to collaborate.',
      status: 'pending',
      createdAt: '2026-11-02T10:00:00.000Z',
      resourcesProvided: ['Venue'],
      contributionDescription: 'We can provide the venue.',
    }
    const requesterDb = testEnvironment.authenticatedContext(requesterProfile.ownerId).firestore()
    const otherOwnerDb = testEnvironment.authenticatedContext('not-the-requester').firestore()

    await assertFails(
      setDoc(doc(otherOwnerDb, 'cohostRequests', requestId), request),
    )
    const forgedRequestId =
      `${event.id}_not-the-requester_${requesterProfile.id}_cohost`
    await assertFails(
      setDoc(doc(otherOwnerDb, 'cohostRequests', forgedRequestId), {
        ...request,
        requesterOwnerId: 'not-the-requester',
      }),
    )
    await assertFails(
      setDoc(doc(requesterDb, 'cohostRequests', requestId), {
        ...request,
        hostOwnerId: 'not-the-host',
      }),
    )
    await assertFails(
      setDoc(doc(requesterDb, 'cohostRequests', requestId), {
        ...request,
        attendeeCount: 1,
      }),
    )
    await assertSucceeds(setDoc(doc(requesterDb, 'cohostRequests', requestId), request))
  })

  it('rejects co-host requests when either referenced organization profile is missing', async () => {
    const requesterProfile: UserProfile = {
      ...organizationProfile,
      id: 'missing-profile-requester',
      ownerId: 'missing-profile-requester-owner',
      name: 'Requester Club',
    }
    const event = {
      id: 'missing-profile-event',
      hostId: profileId,
      hostOwnerId: ownerId,
      hostName: organizationProfile.name,
      hostProfileType: 'organization',
      title: 'Missing Profile Event',
      location: 'North campus',
      description: 'An event.',
      audience: 'organizations',
      dateOptions: ['2026-12-01'],
      capacity: 30,
      attendees: 0,
      createdAt: '2026-11-01T10:00:00.000Z',
    }
    const foreignHostProfile: UserProfile = {
      ...organizationProfile,
      id: 'foreign-host-profile',
      ownerId: 'foreign-host-owner',
      name: 'Foreign Host Club',
    }
    const foreignHostEvent = {
      ...event,
      id: 'foreign-host-event',
      hostId: foreignHostProfile.id,
      title: 'Foreign Host Event',
      hostName: foreignHostProfile.name,
    }
    await testEnvironment.withSecurityRulesDisabled(async (context) => {
      const database = context.firestore()
      await setDoc(doc(database, 'events', event.id), event)
      await setDoc(doc(database, 'events', foreignHostEvent.id), foreignHostEvent)
      await setDoc(doc(database, 'userProfiles', profileId), organizationProfile)
      await setDoc(doc(database, 'userProfiles', foreignHostProfile.id), foreignHostProfile)
    })
    const requestId = `${event.id}_${requesterProfile.ownerId}_${requesterProfile.id}_cohost`
    const request = {
      requestType: 'cohost',
      eventId: event.id,
      eventTitle: event.title,
      hostOwnerId: ownerId,
      hostProfileId: profileId,
      requesterOwnerId: requesterProfile.ownerId,
      requesterProfileId: requesterProfile.id,
      requesterName: requesterProfile.name,
      requesterProfileType: 'organization',
      availableDates: ['2026-12-01'],
      attendeeCount: 0,
      message: 'We would like to collaborate.',
      status: 'pending',
      createdAt: '2026-11-02T10:00:00.000Z',
      resourcesProvided: ['General contribution'],
      contributionDescription: 'We can contribute.',
    }
    const requesterDb = testEnvironment.authenticatedContext(requesterProfile.ownerId).firestore()

    await assertFails(
      setDoc(
        doc(requesterDb, 'cohostRequests', requestId),
        request,
      ),
    )
    await testEnvironment.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'userProfiles', requesterProfile.id), requesterProfile)
    })
    const foreignHostRequestId =
      `${foreignHostEvent.id}_${requesterProfile.ownerId}_${requesterProfile.id}_cohost`
    await assertFails(
      setDoc(
        doc(requesterDb, 'cohostRequests', foreignHostRequestId),
        {
          ...request,
          eventId: foreignHostEvent.id,
          eventTitle: foreignHostEvent.title,
          hostProfileId: foreignHostProfile.id,
        },
      ),
    )
    await assertFails(
      setDoc(
        doc(requesterDb, 'cohostRequests', requestId),
        { ...request, hostProfileId: 'missing-host-profile' },
      ),
    )
  })

  it('allows a general contribution for a legacy event without resource fields', async () => {
    const requesterProfile: UserProfile = {
      ...organizationProfile,
      id: 'legacy-requester-profile',
      ownerId: 'legacy-requester',
      name: 'Legacy Partner Club',
    }
    const legacyEvent = {
      id: 'legacy-event',
      hostId: profileId,
      hostOwnerId: ownerId,
      hostName: organizationProfile.name,
      hostProfileType: 'organization',
      title: 'Legacy Campus Event',
      location: 'North campus',
      description: 'An older event.',
      audience: 'organizations',
      dateOptions: ['2026-12-01'],
      capacity: 30,
      attendees: 0,
      createdAt: '2026-10-01T10:00:00.000Z',
      publicationStatus: 'pending_collaboration',
      collaborationRequirementsCompleted: false,
    }
    await testEnvironment.withSecurityRulesDisabled(async (context) => {
      const database = context.firestore()
      await setDoc(doc(database, 'userProfiles', profileId), organizationProfile)
      await setDoc(doc(database, 'userProfiles', requesterProfile.id), requesterProfile)
      await setDoc(doc(database, 'events', legacyEvent.id), legacyEvent)
    })

    const requesterDb = testEnvironment.authenticatedContext(requesterProfile.ownerId).firestore()
    const requestId = `${legacyEvent.id}_${requesterProfile.ownerId}_${requesterProfile.id}_cohost`
    await assertSucceeds(
      setDoc(doc(requesterDb, 'cohostRequests', requestId), {
        requestType: 'cohost',
        eventId: legacyEvent.id,
        eventTitle: legacyEvent.title,
        hostOwnerId: ownerId,
        hostProfileId: profileId,
        requesterOwnerId: requesterProfile.ownerId,
        requesterProfileId: requesterProfile.id,
        requesterName: requesterProfile.name,
        requesterProfileType: 'organization',
        availableDates: ['2026-12-01'],
        attendeeCount: 0,
        message: 'We can help.',
        status: 'pending',
        createdAt: '2026-11-02T10:00:00.000Z',
      }),
    )
  })

  const control = () => ({ pendingCount: 0, totalRequests: 0, acceptedCount: 0,
    partnerProfileIds: [] as string[], lastRequestId: '', revision: 0 })
  const hostDb = () => testEnvironment.authenticatedContext(ownerId).firestore()
  const eventData = () => ({
    id: 'secure', hostId: profileId, hostOwnerId: ownerId, hostName: organizationProfile.name,
    hostProfileType: 'organization', title: 'Secure', attendees: 0, capacity: 30,
    dateOptions: ['2026-12-01'], audience: 'everyone', createdAt: '2026-11-01',
    publicationStatus: 'pending_collaboration', collaborationRequirementsCompleted: false,
    titleReservationId: 'secure-title', collaborationVersion: 2, confirmedCoHosts: [],
  })
  const seedAccounting = async () => {
    await testEnvironment.withSecurityRulesDisabled(async context => {
      const db = context.firestore()
      await setDoc(doc(db, 'userProfiles', profileId), organizationProfile)
      await setDoc(doc(db, 'events', 'secure'), eventData())
      await setDoc(doc(db, 'eventTitleReservations', 'secure-title'), {
        eventId: 'secure', hostId: profileId, hostOwnerId: ownerId, title: 'Secure',
      })
      await setDoc(doc(db, 'eventCollaboration', 'secure'), control())
      for (let i = 0; i < 12; i++) {
        await setDoc(doc(db, 'userProfiles', `partner-${i}`), {
          ...organizationProfile, id: `partner-${i}`, ownerId: `partner-owner-${i}`, name: `Partner ${i}`,
        })
        await setDoc(doc(db, 'organizationAccounts', `partner-owner-${i}`), { profileId: `partner-${i}` })
      }
    })
  }
  const incoming = (i: number) => ({
    requestType: 'cohost', eventId: 'secure', eventTitle: 'Secure', hostOwnerId: ownerId,
    hostProfileId: profileId, requesterOwnerId: `partner-owner-${i}`, requesterProfileId: `partner-${i}`,
    requesterName: `Partner ${i}`, requesterProfileType: 'organization', status: 'pending',
    availableDates: ['2026-12-01'], attendeeCount: 0, message: 'Private proposal', createdAt: '2026-11-07',
    resourcesProvided: ['General contribution'], contributionDescription: 'We can help.',
  })
  const requestIdFor = (i: number) => `secure_partner-owner-${i}_partner-${i}_cohost`
  const submit = async (i: number) => {
    const db = testEnvironment.authenticatedContext(`partner-owner-${i}`).firestore()
    await runTransaction(db, async tx => {
      const ref = doc(db, 'eventCollaboration', 'secure')
      const c = (await tx.get(ref)).data()!
      tx.set(doc(db, 'cohostRequests', requestIdFor(i)), incoming(i))
      tx.update(ref, { pendingCount: c.pendingCount + 1, totalRequests: c.totalRequests + 1,
        lastRequestId: requestIdFor(i), revision: c.revision + 1 })
    })
  }
  const resolve = async (i: number, status = 'accepted', uid = ownerId) => {
    const db = testEnvironment.authenticatedContext(uid).firestore()
    await runTransaction(db, async tx => {
      const cr = doc(db, 'eventCollaboration', 'secure')
      const er = doc(db, 'events', 'secure')
      const rr = doc(db, 'cohostRequests', requestIdFor(i))
      const [cs, es, rs] = await Promise.all([tx.get(cr), tx.get(er), tx.get(rr)])
      const c = cs.data()!, e = es.data()!, r = rs.data()!
      tx.update(rr, { status, resolvedAt: '2026-11-07', resolvedByProfileId: profileId })
      tx.update(cr, { pendingCount: c.pendingCount - 1, lastRequestId: requestIdFor(i), revision: c.revision + 1,
        ...(status === 'accepted' ? { acceptedCount: c.acceptedCount + 1,
          partnerProfileIds: [...c.partnerProfileIds, r.requesterProfileId] } : {}) })
      if (status === 'accepted') tx.update(er, { confirmedCoHosts: [...e.confirmedCoHosts,
        { profileId: r.requesterProfileId, name: r.requesterName }] })
    })
  }
  const complete = async () => {
    const db = hostDb()
    await runTransaction(db, async tx => {
      await tx.get(doc(db, 'eventCollaboration', 'secure'))
      const ref = doc(db, 'events', 'secure')
      await tx.get(ref)
      tx.update(ref, { publicationStatus: 'ready_to_publish', collaborationRequirementsCompleted: true })
    })
  }

  it('supports more than two incoming requests and eight accepted partners, rejecting a ninth', async () => {
    await seedAccounting()
    for (let i = 0; i < 10; i++) await assertSucceeds(submit(i))
    for (let i = 0; i < 8; i++) await assertSucceeds(resolve(i))
    await assertFails(resolve(8))
    await assertSucceeds(resolve(8, 'declined'))
    await assertSucceeds(resolve(9, 'declined'))
    await assertSucceeds(complete())
    const db = hostDb()
    await assertSucceeds(updateDoc(doc(db, 'events', 'secure'), { publicationStatus: 'published' }))
    const student = testEnvironment.authenticatedContext('student').firestore()
    const event = await assertSucceeds(getDoc(doc(student, 'events', 'secure')))
    expect(event.data()?.confirmedCoHosts).toHaveLength(8)
    await assertFails(getDoc(doc(student, 'cohostRequests', requestIdFor(0))))
    await assertFails(getDoc(doc(student, 'eventCollaboration', 'secure')))
  })

  it('declined history does not consume confirmed partnership capacity', async () => {
    await seedAccounting()
    for (let i = 0; i < 4; i++) { await submit(i); await resolve(i, 'declined') }
    await submit(4); await resolve(4)
    const db = hostDb()
    expect((await getDoc(doc(db, 'eventCollaboration', 'secure'))).data()).toMatchObject({
      pendingCount: 0, acceptedCount: 1, totalRequests: 5,
    })
    expect((await getDoc(doc(db, 'cohostRequests', requestIdFor(0)))).data()?.status).toBe('declined')
  })

  it('rejects counter tampering, standalone requests, and reuse of one increment for two requests', async () => {
    await seedAccounting()
    const db = hostDb()
    await assertFails(updateDoc(doc(db, 'eventCollaboration', 'secure'), { pendingCount: 0, revision: 1 }))
    const requester = testEnvironment.authenticatedContext('partner-owner-0').firestore()
    await assertFails(setDoc(doc(requester, 'cohostRequests', requestIdFor(0)), incoming(0)))
    // One owner can have two organization profiles: a batch still cannot charge only once.
    await testEnvironment.withSecurityRulesDisabled(async context => {
      await updateDoc(doc(context.firestore(), 'userProfiles', 'partner-1'), { ownerId: 'partner-owner-0' })
    })
    const batch = writeBatch(requester)
    batch.set(doc(requester, 'cohostRequests', requestIdFor(0)), incoming(0))
    batch.set(doc(requester, 'cohostRequests', 'secure_partner-owner-0_partner-1_cohost'), {
      ...incoming(1), requesterOwnerId: 'partner-owner-0',
    })
    batch.update(doc(requester, 'eventCollaboration', 'secure'), { pendingCount: 1, totalRequests: 1,
      revision: 1, lastRequestId: requestIdFor(0) })
    await assertFails(batch.commit())
  })

  it('rejects unauthorized approval, missing attribution, forged names, duplicate approval and standalone attribution', async () => {
    await seedAccounting(); await submit(0)
    await assertFails(resolve(0, 'accepted', 'partner-owner-1'))
    const db = hostDb(), rr = doc(db, 'cohostRequests', requestIdFor(0))
    await assertFails(updateDoc(rr, { status: 'accepted', resolvedAt: 'now', resolvedByProfileId: profileId }))
    const batch = writeBatch(db)
    batch.update(rr, { status: 'accepted', resolvedAt: 'now', resolvedByProfileId: profileId })
    batch.update(doc(db, 'eventCollaboration', 'secure'), { pendingCount: 0, acceptedCount: 1,
      partnerProfileIds: ['partner-0'], revision: 2, lastRequestId: requestIdFor(0) })
    await assertFails(batch.commit())
    await assertFails(updateDoc(doc(db, 'events', 'secure'), { confirmedCoHosts: [{ profileId: 'partner-0', name: 'Fake' }] }))
    await resolve(0)
    await assertFails(resolve(0))
    await assertFails(updateDoc(doc(db, 'events', 'secure'), { confirmedCoHosts: [] }))
  })

  it.each(['owner', 'id', 'type', 'name', 'missing'])('rejects accepted requests with invalid requester profile: %s', async kind => {
    await seedAccounting(); await submit(0)
    await testEnvironment.withSecurityRulesDisabled(async context => {
      const ref = doc(context.firestore(), 'userProfiles', 'partner-0')
      if (kind === 'missing') { const b = writeBatch(context.firestore()); b.delete(ref); await b.commit() }
      else await updateDoc(ref, kind === 'owner' ? { ownerId: 'other' } : kind === 'id' ? { id: 'other' }
        : kind === 'type' ? { profileType: 'student' } : { name: 'Changed' })
    })
    await assertFails(resolve(0))
    await assertSucceeds(resolve(0, 'declined'))
  })

  it('serializes concurrent submissions and prevents completion while pending', async () => {
    await seedAccounting()
    const submissions = await Promise.all([submit(0), submit(1), submit(2)].map(p => p.then(() => true, () => false)))
    for (let i = 0; i < submissions.length; i++) if (!submissions[i]) await submit(i)
    const db = hostDb()
    expect((await getDoc(doc(db, 'eventCollaboration', 'secure'))).data()?.pendingCount).toBe(3)
    await assertFails(complete())
    const approvals = await Promise.all([resolve(0), resolve(1, 'declined'), resolve(2)].map(p => p.then(() => true, () => false)))
    for (let i = 0; i < approvals.length; i++) if (!approvals[i]) await resolve(i, i === 1 ? 'declined' : 'accepted')
    await complete()
    await assertFails(submit(3))
  })

  it('races the first submission with completion without leaving a ready event with pending requests', async () => {
    await seedAccounting()
    const results = await Promise.all([submit(0), complete()].map(p => p.then(() => true, () => false)))
    expect(results.filter(Boolean)).toHaveLength(1)
    const db = hostDb()
    const e = (await getDoc(doc(db, 'events', 'secure'))).data()!
    const c = (await getDoc(doc(db, 'eventCollaboration', 'secure'))).data()!
    expect(e.publicationStatus === 'ready_to_publish' ? c.pendingCount === 0 : c.pendingCount === 1).toBe(true)
  })

  it('rejects draft/direct publication, unauthorized publication, and publication with pending requests', async () => {
    await seedAccounting(); await submit(0)
    const db = hostDb()
    await assertFails(updateDoc(doc(db, 'events', 'secure'), { publicationStatus: 'published', collaborationRequirementsCompleted: true }))
    const other = testEnvironment.authenticatedContext('other').firestore()
    await assertFails(updateDoc(doc(other, 'events', 'secure'), { publicationStatus: 'published' }))
    await resolve(0); await complete()
    await assertFails(updateDoc(doc(other, 'events', 'secure'), { publicationStatus: 'published' }))
    await assertSucceeds(updateDoc(doc(db, 'events', 'secure'), { publicationStatus: 'published' }))
  })

  it('allows a legacy creation payload, preserves accepted requests, and requires trusted migration before publication', async () => {
    await seedAccounting()
    const db = hostDb()
    const { collaborationVersion: _v, confirmedCoHosts: _h, ...legacy } = eventData()
    void _v; void _h
    const batch = writeBatch(db)
    batch.set(doc(db, 'events', 'legacy-new'), { ...legacy, id: 'legacy-new', titleReservationId: 'legacy-new-title' })
    batch.set(doc(db, 'eventTitleReservations', 'legacy-new-title'), {
      eventId: 'legacy-new', hostId: profileId, hostOwnerId: ownerId, title: 'Secure',
    })
    await assertSucceeds(batch.commit())
    await assertFails(updateDoc(doc(db, 'events', 'legacy-new'), { collaborationVersion: 2 }))
    await assertFails(updateDoc(doc(db, 'events', 'legacy-new'), { publicationStatus: 'ready_to_publish', collaborationRequirementsCompleted: true }))
    await assertFails(setDoc(doc(db, 'eventCollaboration', 'legacy-new'), control()))
  })

  it('allows actual legacy approval and keeps the accepted request readable to both owners', async () => {
    await seedAccounting()
    await testEnvironment.withSecurityRulesDisabled(async context => {
      const e = eventData() as Record<string, unknown>; delete e.collaborationVersion; delete e.confirmedCoHosts
      await setDoc(doc(context.firestore(), 'events', 'secure'), e)
    })
    const partner = testEnvironment.authenticatedContext('partner-owner-0').firestore()
    await assertSucceeds(setDoc(doc(partner, 'cohostRequests', requestIdFor(0)), incoming(0)))
    const db = hostDb()
    await assertSucceeds(updateDoc(doc(db, 'cohostRequests', requestIdFor(0)), {
      status: 'accepted', resolvedAt: 'now', resolvedByProfileId: profileId,
    }))
    expect((await getDoc(doc(partner, 'cohostRequests', requestIdFor(0)))).data()?.status).toBe('accepted')
    expect((await getDoc(doc(db, 'cohostRequests', requestIdFor(0)))).data()?.status).toBe('accepted')
    await assertFails(getDoc(doc(partner, 'events', 'unknown-legacy')))
  })

  it('migration locks freeze mutations without hiding existing events or requests', async () => {
    await seedAccounting(); await submit(0)
    await testEnvironment.withSecurityRulesDisabled(async context => {
      await setDoc(doc(context.firestore(), 'eventMigrationLocks', 'secure'), { frozen: true })
    })
    const db = hostDb()
    await assertSucceeds(getDoc(doc(db, 'events', 'secure')))
    await assertSucceeds(getDoc(doc(db, 'cohostRequests', requestIdFor(0))))
    await assertFails(resolve(0)); await assertFails(submit(1)); await assertFails(complete())
    await assertFails(setDoc(doc(db, 'eventMigrationLocks', 'secure'), { frozen: false }))
  })

  it('supports published student participation creation and atomic host acceptance', async () => {
    await seedAccounting(); await complete()
    const db = hostDb()
    await updateDoc(doc(db, 'events', 'secure'), { publicationStatus: 'published' })
    await testEnvironment.withSecurityRulesDisabled(async context => {
      await setDoc(doc(context.firestore(), 'userProfiles', 'student-profile'), {
        ...organizationProfile, id: 'student-profile', ownerId: 'student-owner', profileType: 'student', name: 'Student',
      })
    })
    const student = testEnvironment.authenticatedContext('student-owner').firestore()
    const id = 'secure_student-owner_student-profile_participation'
    await assertSucceeds(setDoc(doc(student, 'participationRequests', id), {
      requestType: 'participation', eventId: 'secure', eventTitle: 'Secure', hostOwnerId: ownerId, hostProfileId: profileId,
      requesterOwnerId: 'student-owner', requesterProfileId: 'student-profile', requesterName: 'Student',
      requesterProfileType: 'student', availableDates: ['2026-12-01'], attendeeCount: 1,
      message: '', status: 'pending', createdAt: 'now',
    }))
    const b = writeBatch(db)
    b.update(doc(db, 'participationRequests', id), { status: 'accepted', resolvedAt: 'now', resolvedByProfileId: profileId })
    b.update(doc(db, 'events', 'secure'), { attendees: 1, lastAcceptedParticipationRequestId: id })
    await assertSucceeds(b.commit())
    expect((await getDoc(doc(student, 'participationRequests', id))).data()?.status).toBe('accepted')
  })
  it('initializes accounting only atomically with a new event and rejects forged initial counters', async () => {
    await seedAccounting()
    const db = hostDb()
    const create = (id: string, pendingCount: number) => {
      const b = writeBatch(db)
      b.set(doc(db, 'events', id), { ...eventData(), id, titleReservationId: `${id}-title` })
      b.set(doc(db, 'eventTitleReservations', `${id}-title`), { eventId: id, hostId: profileId, hostOwnerId: ownerId, title: 'Secure' })
      b.set(doc(db, 'eventCollaboration', id), { ...control(), pendingCount, totalRequests: pendingCount })
      return b.commit()
    }
    await assertFails(create('forged-initial', 1))
    await assertSucceeds(create('new-accounted-event', 0))
    await assertFails(updateDoc(doc(db, 'eventCollaboration', 'new-accounted-event'), { pendingCount: 0, revision: 1 }))
  })

  it('preserves old direct and registry-appending request payloads on unmigrated events', async () => {
    await seedAccounting()
    await testEnvironment.withSecurityRulesDisabled(async context => {
      const e = eventData() as Record<string, unknown>; delete e.collaborationVersion; delete e.confirmedCoHosts
      e.cohostRequestIds = []
      await setDoc(doc(context.firestore(), 'events', 'secure'), e)
    })
    const db = testEnvironment.authenticatedContext('partner-owner-0').firestore()
    const b = writeBatch(db)
    b.set(doc(db, 'cohostRequests', requestIdFor(0)), incoming(0))
    b.update(doc(db, 'events', 'secure'), { cohostRequestIds: [requestIdFor(0)] })
    await assertSucceeds(b.commit())
    const other = testEnvironment.authenticatedContext('partner-owner-1').firestore()
    await assertSucceeds(setDoc(doc(other, 'cohostRequests', requestIdFor(1)), incoming(1)))
    const host = hostDb()
    await assertSucceeds(updateDoc(doc(host, 'cohostRequests', requestIdFor(0)), {
      status: 'accepted', resolvedAt: 'now', resolvedByProfileId: profileId,
    }))
    await assertFails(updateDoc(doc(host, 'events', 'secure'), { confirmedCoHosts: [{ profileId: 'fake', name: 'Forged' }] }))
  })

  it('cannot resolve two requests with one decrement or append an already accepted organization', async () => {
    await seedAccounting(); await submit(0); await submit(1)
    const db = hostDb()
    const b = writeBatch(db)
    for (let i = 0; i < 2; i++) b.update(doc(db, 'cohostRequests', requestIdFor(i)), {
      status: 'declined', resolvedAt: 'now', resolvedByProfileId: profileId,
    })
    b.update(doc(db, 'eventCollaboration', 'secure'), { pendingCount: 1, revision: 3, lastRequestId: requestIdFor(0) })
    await assertFails(b.commit())
    await resolve(0)
    // Emulate a preserved historical duplicate from a trusted migration baseline.
    await testEnvironment.withSecurityRulesDisabled(async context => {
      await updateDoc(doc(context.firestore(), 'cohostRequests', requestIdFor(1)), {
        requesterOwnerId: 'partner-owner-0', requesterProfileId: 'partner-0', requesterName: 'Partner 0',
      })
    })
    await assertFails(resolve(1))
  })

  it('rejects an old unaccounted write on a migrated event without hiding its existing request', async () => {
    await seedAccounting(); await submit(0)
    const partner = testEnvironment.authenticatedContext('partner-owner-0').firestore()
    await assertSucceeds(getDoc(doc(partner, 'cohostRequests', requestIdFor(0))))
    const db = hostDb()
    await assertFails(updateDoc(doc(db, 'cohostRequests', requestIdFor(0)), {
      status: 'declined', resolvedAt: 'now', resolvedByProfileId: profileId,
    }))
    await resolve(0, 'declined')
  })

})
