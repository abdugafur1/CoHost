import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  collection,
  getDocs,
  onSnapshot,
  runTransaction,
  setDoc,
  where,
  writeBatch,
} from 'firebase/firestore'
import {
  createEventRequestId,
  deleteEventItem,
  DuplicateEventTitleError,
  ensureOrganizationAccount,
  resolveEventRequest,
  publishEvent,
  saveOrganizationProfile,
  saveEventItem,
  saveEventRequest,
  signInWithGoogle,
  signOutUser,
  subscribeEvents,
  subscribePublicOrganizations,
  subscribeEventRequests,
  updateEventItem,
} from './cohost'
import { auth } from './firebase'
import type { EventItem, EventRequest, UserProfile } from '../types'

vi.mock('firebase/auth', () => ({
  GoogleAuthProvider: class GoogleAuthProvider {},
  browserLocalPersistence: {},
  linkWithPopup: vi.fn(),
  onAuthStateChanged: vi.fn(),
  setPersistence: vi.fn(),
  signInWithPopup: vi.fn(),
  signInAnonymously: vi.fn(),
  signOut: vi.fn(),
}))

vi.mock('firebase/firestore', () => ({
  addDoc: vi.fn(),
  collection: vi.fn((_, name: string) => ({ name })),
  doc: vi.fn((_, collectionName: string, id: string) => ({ collectionName, id })),
  getDocs: vi.fn(),
  onSnapshot: vi.fn(() => vi.fn()),
  query: vi.fn((collectionRef, ...constraints) => ({ collectionRef, constraints })),
  runTransaction: vi.fn(),
  setDoc: vi.fn(),
  writeBatch: vi.fn(),
  where: vi.fn((field: string, operator: string, value: string) => ({
    field,
    operator,
    value,
  })),
}))

vi.mock('./firebase', () => ({
  app: {},
  auth: {},
  db: {},
}))

const event: EventItem = {
  id: 'event-1',
  hostId: 'organization-1',
  hostOwnerId: 'owner-1',
  hostName: 'Campus Organization',
  hostProfileType: 'organization',
  title: 'Esport',
  location: 'Student Center',
  description: 'A campus event.',
  audience: 'everyone',
  dateOptions: ['2026-11-15'],
  capacity: 20,
  attendees: 0,
  createdAt: '2026-11-01T10:00:00.000Z',
}

const eventRequest: EventRequest = {
  id: 'event-1_owner-1_student-1_participation',
  requestType: 'participation',
  eventId: event.id,
  eventTitle: event.title,
  hostOwnerId: event.hostOwnerId,
  hostProfileId: event.hostId,
  requesterOwnerId: 'owner-1',
  requesterProfileId: 'student-1',
  requesterName: 'Jordan Student',
  requesterProfileType: 'student',
  availableDates: ['2026-11-15'],
  attendeeCount: 1,
  message: 'Interested in joining.',
  status: 'pending',
  createdAt: '2026-11-02T10:00:00.000Z',
}

const emptyEventsResult = { docs: [] }
const transactionSet = vi.fn()
const transactionDelete = vi.fn()
const transactionUpdate = vi.fn()
const directoryBatchSet = vi.fn()
const directoryBatchDelete = vi.fn()
const directoryBatchCommit = vi.fn()

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubEnv('VITE_PUBLICATION_V2_ENABLED', 'true')
  vi.mocked(writeBatch).mockReturnValue({
    set: directoryBatchSet,
    delete: directoryBatchDelete,
    commit: directoryBatchCommit,
  } as never)
  directoryBatchCommit.mockResolvedValue(undefined)
  vi.mocked(getDocs).mockResolvedValue(emptyEventsResult as never)
  vi.mocked(runTransaction).mockImplementation(async (_firestore, updateFunction) => {
    const transaction = {
      get: vi.fn().mockResolvedValue({ exists: () => false }),
      set: transactionSet,
      delete: transactionDelete,
      update: transactionUpdate,
    }
    await updateFunction(transaction as never)
    return undefined
  })

})

describe('saveOrganizationProfile', () => {
  const organization: UserProfile = {
    id: 'public-club-id',
    ownerId: 'private-owner-uid',
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

  it('atomically updates the private profile and explicitly public listing without publishing owner data', async () => {
    await saveOrganizationProfile(organization)

    expect(directoryBatchSet).toHaveBeenCalledTimes(3)
    expect(directoryBatchSet).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ collectionName: 'userProfiles', id: organization.id }),
      organization,
    )
    expect(directoryBatchSet).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ collectionName: 'organizationAccounts', id: organization.ownerId }),
      { profileId: organization.id },
    )
    expect(directoryBatchSet).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({ collectionName: 'publicOrganizations', id: organization.id }),
      {
        profileId: organization.id,
        name: organization.name,
        description: organization.description,
        focus: organization.focus,
        location: organization.location,
        interests: organization.interests,
        eventTypes: organization.eventTypes,
        availableResources: organization.availableResources,
        collaborationPreferences: organization.collaborationPreferences,
      },
    )
    expect(directoryBatchCommit).toHaveBeenCalledTimes(1)
  })

  it('bootstraps from the current cloud identity without overwriting a stale local profile', async () => {
    Object.defineProperty(auth, 'currentUser', { configurable: true, value: { uid: organization.ownerId } })
    vi.mocked(runTransaction).mockImplementation(async (_db, callback) => {
      await callback({ get: vi.fn(async () => ({ exists: () => true, data: () => ({ ...organization, name: 'New cloud name' }) })),
        set: transactionSet } as never)
      return undefined
    })
    try {
      await ensureOrganizationAccount({ ...organization, name: 'Stale local name' })
      expect(transactionSet).toHaveBeenCalledWith(
        expect.objectContaining({ collectionName: 'organizationAccounts', id: organization.ownerId }), { profileId: organization.id })
      expect(transactionSet).toHaveBeenCalledWith(expect.objectContaining({ collectionName: 'publicOrganizations' }),
        expect.objectContaining({ name: 'New cloud name' }))
      expect(transactionSet).not.toHaveBeenCalledWith(expect.objectContaining({ collectionName: 'userProfiles' }), expect.anything())
      expect(directoryBatchSet).not.toHaveBeenCalled()
    } finally { Reflect.deleteProperty(auth, 'currentUser') }
  })

  it.each(['missing', 'wrong-owner', 'student', 'wrong-id'])('rejects bootstrap with a %s cloud profile', async kind => {
    Object.defineProperty(auth, 'currentUser', { configurable: true, value: { uid: organization.ownerId } })
    vi.mocked(runTransaction).mockImplementation(async (_db, callback) => {
      await callback({ get: vi.fn(async () => ({ exists: () => kind !== 'missing', data: () => ({ ...organization,
        ...(kind === 'wrong-owner' ? { ownerId: 'other' } : kind === 'student' ? { profileType: 'student' } : kind === 'wrong-id' ? { id: 'other' } : {}) }) })),
        set: transactionSet } as never)
      return undefined
    })
    try {
      await expect(ensureOrganizationAccount(organization)).rejects.toThrow()
      expect(transactionSet).not.toHaveBeenCalled()
    } finally { Reflect.deleteProperty(auth, 'currentUser') }
  })

  it('propagates bootstrap read failures without rewriting the cloud profile', async () => {
    Object.defineProperty(auth, 'currentUser', { configurable: true, value: { uid: organization.ownerId } })
    vi.mocked(runTransaction).mockRejectedValueOnce(new Error('permission denied'))
    try {
      await expect(ensureOrganizationAccount(organization)).rejects.toThrow('permission denied')
      expect(directoryBatchSet).not.toHaveBeenCalled()
    } finally { Reflect.deleteProperty(auth, 'currentUser') }
  })

  it('updates the existing listing in place when organization discovery details change', async () => {
    const updatedOrganization = {
      ...organization,
      name: 'Robotics and Design Collective',
      description: 'Builds robots and hosts workshops.',
    }

    await saveOrganizationProfile(updatedOrganization)

    expect(directoryBatchSet).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ collectionName: 'userProfiles', id: organization.id }),
      updatedOrganization,
    )
    expect(directoryBatchSet).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ collectionName: 'organizationAccounts', id: organization.ownerId }),
      { profileId: organization.id },
    )
    expect(directoryBatchSet).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({ collectionName: 'publicOrganizations', id: organization.id }),
      expect.objectContaining({
        profileId: organization.id,
        name: updatedOrganization.name,
        description: updatedOrganization.description,
      }),
    )
  })

  it('normalizes legacy organization profiles before syncing directory fields', async () => {
    const legacyProfile = {
      ...organization,
      interests: undefined,
      eventTypes: undefined,
      availableResources: undefined,
      collaborationPreferences: undefined,
    }

    await saveOrganizationProfile(legacyProfile)

    expect(directoryBatchSet).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ collectionName: 'userProfiles', id: organization.id }),
      expect.objectContaining({
        interests: ['Technology'],
        eventTypes: [],
        availableResources: [],
        collaborationPreferences: [],
      }),
    )
    expect(directoryBatchSet).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({ collectionName: 'publicOrganizations', id: organization.id }),
      expect.objectContaining({
        interests: ['Technology'],
        eventTypes: [],
        availableResources: [],
        collaborationPreferences: [],
      }),
    )
  })

  it('removes the public listing when directory visibility is disabled', async () => {
    await saveOrganizationProfile({ ...organization, directoryVisible: false })

    expect(directoryBatchDelete).toHaveBeenCalledWith(
      expect.objectContaining({ collectionName: 'publicOrganizations', id: organization.id }),
    )
    expect(directoryBatchCommit).toHaveBeenCalledTimes(1)
  })

  it('rejects student profiles before writing to the public directory', async () => {
    await expect(
      saveOrganizationProfile({ ...organization, profileType: 'student' }),
    ).rejects.toThrow(/only organization profiles/i)
    expect(writeBatch).not.toHaveBeenCalled()
  })

  it('subscribes to public listings and maps document IDs into sorted profile IDs', () => {
    const onOrganizations = vi.fn()
    const onError = vi.fn()
    vi.mocked(onSnapshot).mockImplementationOnce(
      ((_reference: unknown, onNext: unknown) => {
        const emitSnapshot = onNext as (
          snapshot: { docs: { id: string; data: () => object }[] },
        ) => void
        emitSnapshot({
          docs: [
            { id: 'z-club', data: () => ({ name: 'Zenith Club' }) },
            { id: 'a-club', data: () => ({ name: 'Arts Club' }) },
          ],
        })
        return vi.fn()
      }) as never,
    )

    subscribePublicOrganizations(onOrganizations, onError)

    expect(collection).toHaveBeenCalledWith(expect.anything(), 'publicOrganizations')
    expect(onOrganizations).toHaveBeenCalledWith([
      expect.objectContaining({ profileId: 'a-club', name: 'Arts Club' }),
      expect.objectContaining({ profileId: 'z-club', name: 'Zenith Club' }),
    ])
  })
})

describe('subscribeEvents', () => {
  it('uses rule-compatible role-specific event queries for organizations', () => {
    subscribeEvents('organization', 'owner-1', vi.fn(), vi.fn())

    expect(onSnapshot).toHaveBeenCalledTimes(3)
    expect(where).toHaveBeenCalledWith('hostOwnerId', '==', 'owner-1')
    expect(where).toHaveBeenCalledWith('publicationStatus', '==', 'pending_collaboration')
    expect(where).toHaveBeenCalledWith('publicationStatus', '==', 'published')
  })

  it('queries only published events for students', () => {
    subscribeEvents('student', null, vi.fn(), vi.fn())

    expect(onSnapshot).toHaveBeenCalledTimes(1)
    expect(where).toHaveBeenCalledTimes(1)
    expect(where).toHaveBeenCalledWith('publicationStatus', '==', 'published')
  })
})

describe('saveEventItem', () => {
  it('rejects a title already published by the same organization, ignoring case and whitespace', async () => {
    vi.mocked(getDocs).mockResolvedValue({
      docs: [{ data: () => ({ ...event, title: '  eSpOrT  ' }) }],
    } as never)

    await expect(saveEventItem(event)).rejects.toBeInstanceOf(DuplicateEventTitleError)
    expect(runTransaction).not.toHaveBeenCalled()
  })

  it('allows the same title for another organization and reserves a new title atomically', async () => {
    vi.mocked(getDocs).mockResolvedValue({
      docs: [{ data: () => ({ ...event, hostId: 'organization-2', hostOwnerId: 'owner-2' }) }],
    } as never)

    await expect(saveEventItem(event)).resolves.toBeUndefined()

    expect(where).toHaveBeenCalledWith('hostOwnerId', '==', event.hostOwnerId)
    expect(runTransaction).toHaveBeenCalledTimes(1)
    expect(transactionSet).toHaveBeenCalledTimes(3)
    expect(transactionSet).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ collectionName: 'eventTitleReservations' }),
      expect.objectContaining({ eventId: event.id, title: event.title }),
    )
    expect(transactionSet).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ collectionName: 'events', id: event.id }),
      expect.objectContaining({
        ...event,
        titleReservationId: expect.any(String),
      }),
    )
  })

  it('rejects a title reservation claimed by a concurrent publisher', async () => {
    vi.mocked(runTransaction).mockImplementation(async (_firestore, updateFunction) => {
      await updateFunction({
        get: vi.fn().mockResolvedValue({ exists: () => true }),
        set: vi.fn(),
      } as never)
      return undefined
    })

    await expect(saveEventItem(event)).rejects.toBeInstanceOf(DuplicateEventTitleError)
  })

  it('propagates Firebase write failures', async () => {
    vi.mocked(runTransaction).mockRejectedValue(new Error('permission denied'))

    await expect(saveEventItem(event)).rejects.toThrow('permission denied')
  })

  it('updates event details and rotates the title reservation atomically', async () => {
    const storedEvent: EventItem = { ...event, titleReservationId: 'old-reservation' }
    const updatedEvent: EventItem = { ...storedEvent, title: 'Updated Esport' }
    vi.mocked(runTransaction).mockImplementation(async (_firestore, updateFunction) => {
      await updateFunction({
        get: vi.fn(async (reference: { collectionName: string; id: string }) => {
          if (reference.collectionName === 'events') {
            return { exists: (): boolean => true, data: () => storedEvent }
          }
          if (reference.id === 'old-reservation') {
            return { exists: (): boolean => true, data: () => ({ eventId: event.id }) }
          }
          return { exists: (): boolean => false }
        }),
        set: transactionSet,
        update: transactionUpdate,
        delete: transactionDelete,
      } as never)
      return undefined
    })

    await expect(updateEventItem(updatedEvent)).resolves.toEqual(
      expect.objectContaining({ title: 'Updated Esport', titleReservationId: expect.any(String) }),
    )
    expect(where).toHaveBeenCalledWith('hostOwnerId', '==', event.hostOwnerId)
    expect(transactionUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ collectionName: 'events', id: event.id }),
      expect.objectContaining({ title: 'Updated Esport' }),
    )
    expect(transactionDelete).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'old-reservation' }),
    )
  })

  it('rejects renaming an event to another event title from the same organization', async () => {
    vi.mocked(getDocs).mockResolvedValue({
      docs: [{ id: 'existing-event', data: () => ({ ...event, id: 'existing-event' }) }],
    } as never)

    await expect(updateEventItem({ ...event, title: ' esport ' })).rejects.toBeInstanceOf(
      DuplicateEventTitleError,
    )
    expect(runTransaction).not.toHaveBeenCalled()
  })

  it('deletes an event and its title reservation atomically', async () => {
    const storedEvent: EventItem = { ...event, titleReservationId: 'event-reservation', collaborationVersion: 2 }
    vi.mocked(runTransaction).mockImplementation(async (_firestore, updateFunction) => {
      await updateFunction({
        get: vi.fn(async (reference: { collectionName: string }) =>
          reference.collectionName === 'events'
            ? { exists: (): boolean => true, data: () => storedEvent }
            : { exists: (): boolean => true, data: () => ({ eventId: event.id, totalRequests: 0 }) },
        ),
        set: transactionSet,
        delete: transactionDelete,
      } as never)
      return undefined
    })

    await expect(deleteEventItem(storedEvent)).resolves.toBeUndefined()
    expect(transactionDelete).toHaveBeenCalledWith(
      expect.objectContaining({ collectionName: 'events', id: event.id }),
    )
    expect(transactionDelete).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'event-reservation' }),
    )
  })

  it('rejects event edits when the authenticated event owner does not match', async () => {
    vi.mocked(runTransaction).mockImplementation(async (_firestore, updateFunction) => {
      await updateFunction({
        get: vi.fn().mockResolvedValue({
          exists: (): boolean => true,
          data: () => ({ ...event, hostOwnerId: 'other-owner' }),
        }),
        set: transactionSet,
        delete: transactionDelete,
      } as never)
      return undefined
    })

    await expect(updateEventItem(event)).rejects.toThrow('not authorized')
  })
})

describe('Firebase account access', () => {
  it('uses the Google provider for account sign-in and signs out through Firebase Auth', async () => {
    const { linkWithPopup, setPersistence, signInWithPopup, signOut } = await import(
      'firebase/auth'
    )
    const user = { uid: 'google-user' }
    vi.mocked(signInWithPopup).mockResolvedValue({ user } as never)
    vi.mocked(signOut).mockResolvedValue(undefined)

    await expect(signInWithGoogle()).resolves.toBe(user)
    expect(setPersistence).toHaveBeenCalledTimes(1)
    expect(signInWithPopup).toHaveBeenCalledTimes(1)
    expect(linkWithPopup).not.toHaveBeenCalled()

    await expect(signOutUser()).resolves.toBeUndefined()
    expect(signOut).toHaveBeenCalledTimes(1)
  })

  it('links an anonymous Firebase session instead of replacing its profile owner', async () => {
    const { linkWithPopup, signInWithPopup } = await import('firebase/auth')
    const user = { uid: 'existing-anonymous-user' }
    Object.defineProperty(auth, 'currentUser', {
      configurable: true,
      value: { isAnonymous: true },
    })
    vi.mocked(linkWithPopup).mockResolvedValue({ user } as never)

    try {
      await expect(signInWithGoogle()).resolves.toBe(user)
      expect(linkWithPopup).toHaveBeenCalledTimes(1)
      expect(signInWithPopup).not.toHaveBeenCalled()
    } finally {
      Reflect.deleteProperty(auth, 'currentUser')
    }
  })
})

describe('event requests', () => {
  beforeEach(() => {
    vi.mocked(runTransaction).mockImplementation(async (_db, callback) => callback({
      get: vi.fn(async () => ({ exists: () => true, data: () => event })),
      set: setDoc,
    } as never))
  })
  it('stores participation and co-hosting requests in separate collections', async () => {
    await saveEventRequest(eventRequest)
    await saveEventRequest({
      ...eventRequest,
      id: 'event-1_owner-1_student-1_cohost',
      requestType: 'cohost',
      requesterProfileType: 'organization',
      attendeeCount: 0,
      resourcesProvided: ['Venue'],
      contributionDescription: 'We can provide the venue.',
      estimatedAttendees: 25,
    })

    expect(setDoc).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ collectionName: 'participationRequests', id: eventRequest.id }),
      expect.objectContaining({
        requestType: 'participation',
        hostProfileId: event.hostId,
        status: 'pending',
      }),
    )
    expect(setDoc).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ collectionName: 'cohostRequests' }),
      expect.objectContaining({
        requestType: 'cohost',
        status: 'pending',
        attendeeCount: 0,
        resourcesProvided: ['Venue'],
        contributionDescription: 'We can provide the venue.',
        estimatedAttendees: 25,
      }),
    )
  })

  it('omits an unknown attendance estimate for co-host requests', async () => {
    await saveEventRequest({
      ...eventRequest,
      id: 'event-1_owner-1_organization-1_cohost',
      requestType: 'cohost',
      requesterProfileType: 'organization',
      attendeeCount: 0,
    })

    const savedRequest = vi.mocked(setDoc).mock.calls[0]?.[1]
    expect(savedRequest).not.toHaveProperty('estimatedAttendees')
    expect(savedRequest).toMatchObject({ attendeeCount: 0 })
  })

  it('uses a stable unique id per account, profile, event, and request type', () => {
    expect(
      createEventRequestId(
        event.id,
        eventRequest.requesterOwnerId,
        eventRequest.requesterProfileId,
        'participation',
      ),
    ).toBe(
      'event-1_owner-1_student-1_participation',
    )
    expect(
      createEventRequestId(event.id, eventRequest.requesterOwnerId, 'organization-1', 'cohost'),
    ).toBe(
      'event-1_owner-1_organization-1_cohost',
    )
  })

  it('surfaces Firestore permission failures when creating requests', async () => {
    vi.mocked(setDoc).mockRejectedValue(new Error('permission denied'))

    await expect(saveEventRequest(eventRequest)).rejects.toThrow('permission denied')
  })

  it('subscribes students only to outgoing participation requests for their profile and account', () => {
    const unsubscribe = subscribeEventRequests('owner-1', 'student-1', 'student', vi.fn(), vi.fn())

    expect(onSnapshot).toHaveBeenCalledTimes(1)
    expect(collection).toHaveBeenCalledWith({}, 'participationRequests')
    expect(where).toHaveBeenCalledWith('requesterOwnerId', '==', 'owner-1')
    expect(where).toHaveBeenCalledWith('requesterProfileId', '==', 'student-1')
    unsubscribe()
  })

  it('subscribes organizations to only their outgoing and incoming request profile records', () => {
    const unsubscribe = subscribeEventRequests(
      'owner-2',
      'organization-2',
      'organization',
      vi.fn(),
      vi.fn(),
    )

    expect(onSnapshot).toHaveBeenCalledTimes(3)
    expect(collection).toHaveBeenCalledWith({}, 'cohostRequests')
    expect(collection).toHaveBeenCalledWith({}, 'participationRequests')
    expect(where).toHaveBeenCalledWith('requesterOwnerId', '==', 'owner-2')
    expect(where).toHaveBeenCalledWith('requesterProfileId', '==', 'organization-2')
    expect(where).toHaveBeenCalledWith('hostOwnerId', '==', 'owner-2')
    expect(where).toHaveBeenCalledWith('hostProfileId', '==', 'organization-2')
    unsubscribe()
  })

  it('scopes identical profile IDs to separate Firebase accounts', () => {
    subscribeEventRequests('first-owner', 'profile-id', 'student', vi.fn(), vi.fn())
    subscribeEventRequests('second-owner', 'profile-id', 'student', vi.fn(), vi.fn())

    expect(where).toHaveBeenCalledWith('requesterOwnerId', '==', 'first-owner')
    expect(where).toHaveBeenCalledWith('requesterOwnerId', '==', 'second-owner')
    expect(where).toHaveBeenCalledWith('requesterProfileId', '==', 'profile-id')
  })

  it('accepts a participation request and increments attendance in the same transaction', async () => {
    vi.mocked(runTransaction).mockImplementation(async (_firestore, updateFunction) => {
      await updateFunction({
        get: vi.fn(async (reference: { collectionName: string }) =>
          reference.collectionName === 'events'
            ? {
                exists: () => true,
                data: () => event,
              }
            : {
                exists: () => true,
                data: () => eventRequest,
              },
        ),
        update: transactionUpdate,
      } as never)
      return undefined
    })

    await resolveEventRequest(eventRequest, 'accepted', event.hostOwnerId, event.hostId)

    expect(transactionUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ collectionName: 'events', id: event.id }),
      {
        attendees: 1,
        lastAcceptedParticipationRequestId: eventRequest.id,
      },
    )
    expect(transactionUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ collectionName: 'participationRequests' }),
      expect.objectContaining({
        status: 'accepted',
        resolvedAt: expect.any(String),
        resolvedByProfileId: event.hostId,
      }),
    )
  })

  it('declines a request without changing confirmed attendance', async () => {
    vi.mocked(runTransaction).mockImplementation(async (_firestore, updateFunction) => {
      await updateFunction({
        get: vi.fn(async (reference: { collectionName: string }) =>
          reference.collectionName === 'events'
            ? { exists: () => true, data: () => event }
            : { exists: () => true, data: () => eventRequest },
        ),
        update: transactionUpdate,
      } as never)
      return undefined
    })

    await resolveEventRequest(eventRequest, 'declined', event.hostOwnerId, event.hostId)

    expect(transactionUpdate).toHaveBeenCalledTimes(1)
    expect(transactionUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ collectionName: 'participationRequests' }),
      expect.objectContaining({ status: 'declined' }),
    )
  })

  it('accepts a co-host request by updating only its status and resolution metadata', async () => {
    const cohostRequest: EventRequest = {
      ...eventRequest,
      id: `${event.id}_requester-owner_organization-1_cohost`,
      requestType: 'cohost',
      requesterOwnerId: 'requester-owner',
      requesterProfileId: 'organization-1',
      requesterName: 'Partner Organization',
      requesterProfileType: 'organization',
      attendeeCount: 3,
      resourcesProvided: ['Venue'],
      contributionDescription: 'We can provide the venue.',
    }
    vi.mocked(runTransaction).mockImplementation(async (_firestore, updateFunction) => {
      await updateFunction({
        get: vi.fn(async (reference: { collectionName: string }) =>
          reference.collectionName === 'events'
            ? { exists: () => true, data: () => event }
            : { exists: () => true, data: () => cohostRequest },
        ),
        update: transactionUpdate,
      } as never)
      return undefined
    })

    await resolveEventRequest(cohostRequest, 'accepted', event.hostOwnerId, event.hostId)

    expect(transactionUpdate).toHaveBeenCalledTimes(1)
    expect(transactionUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ collectionName: 'cohostRequests', id: cohostRequest.id }),
      expect.objectContaining({
        status: 'accepted',
        resolvedAt: expect.any(String),
        resolvedByProfileId: event.hostId,
      }),
    )
  })

  it('rejects approvals that exceed capacity before writing either document', async () => {
    vi.mocked(runTransaction).mockImplementation(async (_firestore, updateFunction) => {
      await updateFunction({
        get: vi.fn(async (reference: { collectionName: string }) =>
          reference.collectionName === 'events'
            ? { exists: () => true, data: () => ({ ...event, attendees: 20 }) }
            : { exists: () => true, data: () => eventRequest },
        ),
        update: transactionUpdate,
      } as never)
      return undefined
    })

    await expect(
      resolveEventRequest(eventRequest, 'accepted', event.hostOwnerId, event.hostId),
    ).rejects.toThrow('not enough spots')
    expect(transactionUpdate).not.toHaveBeenCalled()
  })

  it('rejects approval attempts from a profile other than the event host profile', async () => {
    vi.mocked(runTransaction).mockImplementation(async (_firestore, updateFunction) => {
      await updateFunction({
        get: vi.fn(async (reference: { collectionName: string }) =>
          reference.collectionName === 'events'
            ? { exists: () => true, data: () => event }
            : { exists: () => true, data: () => eventRequest },
        ),
        update: transactionUpdate,
      } as never)
      return undefined
    })

    await expect(
      resolveEventRequest(eventRequest, 'accepted', event.hostOwnerId, 'another-profile'),
    ).rejects.toThrow('not authorized')
    expect(transactionUpdate).not.toHaveBeenCalled()
  })

  it('rejects approval attempts from a different Firebase account', async () => {
    vi.mocked(runTransaction).mockImplementation(async (_firestore, updateFunction) => {
      await updateFunction({
        get: vi.fn(async (reference: { collectionName: string }) =>
          reference.collectionName === 'events'
            ? { exists: () => true, data: () => event }
            : { exists: () => true, data: () => eventRequest },
        ),
        update: transactionUpdate,
      } as never)
      return undefined
    })

    await expect(
      resolveEventRequest(eventRequest, 'accepted', 'different-owner', event.hostId),
    ).rejects.toThrow('not authorized')
    expect(transactionUpdate).not.toHaveBeenCalled()
  })
})


describe('compatibility rollout gate', () => {
  it('creates legacy events by default without inventing trusted accounting', async () => {
    vi.stubEnv('VITE_PUBLICATION_V2_ENABLED', undefined)
    await saveEventItem(event)
    expect(transactionSet).toHaveBeenCalledTimes(2)
    expect(transactionSet).toHaveBeenCalledWith(expect.objectContaining({ collectionName: 'events' }),
      expect.objectContaining({ cohostRequestIds: [] }))
    expect(transactionSet).not.toHaveBeenCalledWith(expect.objectContaining({ collectionName: 'eventCollaboration' }), expect.anything())
  })
})

describe('Spark publication transaction', () => {
  it('reads accepted requests and writes the public snapshot without a callable', async () => {
    Object.defineProperty(auth, 'currentUser', { configurable: true, value: { uid: event.hostOwnerId } })
    vi.mocked(runTransaction).mockImplementation(async (_db, callback) => {
      await callback({
        get: vi.fn(async (ref: { collectionName: string }) => ({
          exists: () => true,
          data: () => ref.collectionName === 'events'
            ? { ...event, publicationStatus: 'ready_to_publish', collaborationRequirementsCompleted: true, collaborationVersion: 2, confirmedCoHosts: [{ profileId: 'partner', name: 'Partner Club' }] }
            : { pendingCount: 0 },
        })),
        update: transactionUpdate,
      } as never)
      return undefined
    })
    try {
      await publishEvent(event.id)
      expect(transactionUpdate).toHaveBeenCalledWith(expect.objectContaining({ id: event.id }), {
        publicationStatus: 'published',
      })
    } finally {
      Reflect.deleteProperty(auth, 'currentUser')
    }
  })

  it('rejects legacy publication instead of inventing an empty request registry', async () => {
    Object.defineProperty(auth, 'currentUser', { configurable: true, value: { uid: event.hostOwnerId } })
    vi.mocked(runTransaction).mockImplementation(async (_db, callback) => {
      await callback({
        get: vi.fn(async () => ({ exists: () => true, data: () => ({ ...event,
          publicationStatus: 'ready_to_publish', collaborationRequirementsCompleted: true }) })),
        update: transactionUpdate,
      } as never)
      return undefined
    })
    try {
      await expect(publishEvent(event.id)).rejects.toThrow('does not use V2 accounting')
      expect(transactionUpdate).not.toHaveBeenCalled()
    } finally {
      Reflect.deleteProperty(auth, 'currentUser')
    }
  })
})
