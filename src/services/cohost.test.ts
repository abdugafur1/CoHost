import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  collection,
  getDocs,
  onSnapshot,
  runTransaction,
  setDoc,
  where,
} from 'firebase/firestore'
import {
  createEventRequestId,
  deleteEventItem,
  DuplicateEventTitleError,
  resolveEventRequest,
  saveEventItem,
  saveEventRequest,
  subscribeEventRequests,
  updateEventItem,
} from './cohost'
import type { EventItem, EventRequest } from '../types'

vi.mock('firebase/auth', () => ({
  browserLocalPersistence: {},
  onAuthStateChanged: vi.fn(),
  setPersistence: vi.fn(),
  signInAnonymously: vi.fn(),
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
  where: vi.fn((field: string, operator: string, value: string) => ({
    field,
    operator,
    value,
  })),
}))

vi.mock('./firebase', () => ({
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

beforeEach(() => {
  vi.clearAllMocks()
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
      docs: [{ data: () => ({ ...event, hostId: 'organization-2' }) }],
    } as never)

    await expect(saveEventItem(event)).resolves.toBeUndefined()

    expect(where).toHaveBeenCalledWith('hostId', '==', event.hostId)
    expect(runTransaction).toHaveBeenCalledTimes(1)
    expect(transactionSet).toHaveBeenCalledTimes(2)
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
        delete: transactionDelete,
      } as never)
      return undefined
    })

    await expect(updateEventItem(updatedEvent)).resolves.toEqual(
      expect.objectContaining({ title: 'Updated Esport', titleReservationId: expect.any(String) }),
    )
    expect(transactionSet).toHaveBeenCalledWith(
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
    const storedEvent: EventItem = { ...event, titleReservationId: 'event-reservation' }
    vi.mocked(runTransaction).mockImplementation(async (_firestore, updateFunction) => {
      await updateFunction({
        get: vi.fn(async (reference: { collectionName: string }) =>
          reference.collectionName === 'events'
            ? { exists: (): boolean => true, data: () => storedEvent }
            : { exists: (): boolean => true, data: () => ({ eventId: event.id }) },
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

describe('event requests', () => {
  it('stores participation and co-hosting requests in separate collections', async () => {
    await saveEventRequest(eventRequest)
    await saveEventRequest({
      ...eventRequest,
      id: 'event-1_owner-1_student-1_cohost',
      requestType: 'cohost',
      requesterProfileType: 'organization',
      attendeeCount: 2,
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
      expect.objectContaining({ requestType: 'cohost', status: 'pending' }),
    )
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
