import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getDocs, runTransaction, where } from 'firebase/firestore'
import {
  deleteEventItem,
  DuplicateEventTitleError,
  saveEventItem,
  updateEventItem,
} from './cohost'
import type { EventItem } from '../types'

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
  onSnapshot: vi.fn(),
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

const emptyEventsResult = { docs: [] }
const transactionSet = vi.fn()
const transactionDelete = vi.fn()

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(getDocs).mockResolvedValue(emptyEventsResult as never)
  vi.mocked(runTransaction).mockImplementation(async (_firestore, updateFunction) => {
    const transaction = {
      get: vi.fn().mockResolvedValue({ exists: () => false }),
      set: transactionSet,
      delete: transactionDelete,
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
