import {
  browserLocalPersistence,
  onAuthStateChanged,
  setPersistence,
  signInAnonymously,
  type User,
} from 'firebase/auth'
import {
  addDoc,
  collection,
  doc,
  getDocs,
  onSnapshot,
  query,
  runTransaction,
  setDoc,
  where,
} from 'firebase/firestore'
import type { UserProfile, EventItem, EventRequest } from '../types'
import { auth, db } from './firebase'

export const continueWithoutEmail = async (): Promise<User> => {
  await setPersistence(auth, browserLocalPersistence)
  const user = auth.currentUser ?? (await signInAnonymously(auth)).user
  return user
}

export const saveUserProfile = async (profile: UserProfile) => {
  const profileRef = doc(db, 'userProfiles', profile.id)
  await setDoc(profileRef, profile)
}

export const subscribeUserProfiles = (
  ownerId: string,
  onProfiles: (profiles: UserProfile[]) => void,
  onError: (error: Error) => void,
) =>
  onSnapshot(
    query(collection(db, 'userProfiles'), where('ownerId', '==', ownerId)),
    (snapshot) => {
      const profiles = snapshot.docs
        .map((profileSnapshot) => profileSnapshot.data() as UserProfile)
        .sort((first, second) => second.createdAt.localeCompare(first.createdAt))
      onProfiles(profiles)
    },
    onError,
  )

export const subscribeEvents = (
  onEvents: (events: EventItem[]) => void,
  onError: (error: Error) => void,
) =>
  onSnapshot(
    collection(db, 'events'),
    (snapshot) => {
      const events = snapshot.docs
        .map((eventSnapshot) => ({
          ...(eventSnapshot.data() as EventItem),
          id: eventSnapshot.id,
        }))
        .sort((first, second) => second.createdAt.localeCompare(first.createdAt))
      onEvents(events)
    },
    onError,
  )

export const subscribeAuthUser = (
  onUser: (user: User | null) => void,
  onError: (error: Error) => void,
) => onAuthStateChanged(auth, onUser, onError)

export class DuplicateEventTitleError extends Error {
  constructor() {
    super('An event with this title already exists. Please choose a different title.')
    this.name = 'DuplicateEventTitleError'
  }
}

const normalizeEventTitle = (title: string) => title.trim().toLowerCase()

const getTitleReservationId = async (hostId: string, normalizedTitle: string) => {
  const value = new TextEncoder().encode(`${hostId}\u0000${normalizedTitle}`)
  const digest = await crypto.subtle.digest('SHA-256', value)
  return Array.from(
    new Uint8Array(digest),
    (byte) => `${byte < 16 ? '0' : ''}${byte.toString(16)}`,
  ).join('')
}

export const saveEventItem = async (event: EventItem) => {
  const normalizedTitle = normalizeEventTitle(event.title)
  const existingEvents = await getDocs(
    query(collection(db, 'events'), where('hostId', '==', event.hostId)),
  )
  const duplicateExists = existingEvents.docs.some((eventSnapshot) => {
    const existingEvent = eventSnapshot.data() as EventItem
    return (
      existingEvent.hostId === event.hostId &&
      normalizeEventTitle(existingEvent.title) === normalizedTitle
    )
  })

  if (duplicateExists) throw new DuplicateEventTitleError()

  const titleReservationId = await getTitleReservationId(event.hostId, normalizedTitle)
  const eventRef = doc(db, 'events', event.id)
  const reservationRef = doc(db, 'eventTitleReservations', titleReservationId)

  await runTransaction(db, async (transaction) => {
    const reservation = await transaction.get(reservationRef)
    if (reservation.exists()) throw new DuplicateEventTitleError()

    transaction.set(reservationRef, {
      eventId: event.id,
      hostId: event.hostId,
      hostOwnerId: event.hostOwnerId,
      title: event.title,
    })
    transaction.set(eventRef, { ...event, titleReservationId })
  })
}

export const updateEventItem = async (event: EventItem) => {
  const normalizedTitle = normalizeEventTitle(event.title)
  const existingEvents = await getDocs(
    query(collection(db, 'events'), where('hostId', '==', event.hostId)),
  )
  const duplicateExists = existingEvents.docs.some((eventSnapshot) => {
    const existingEvent = eventSnapshot.data() as EventItem
    return (
      eventSnapshot.id !== event.id &&
      existingEvent.hostId === event.hostId &&
      normalizeEventTitle(existingEvent.title) === normalizedTitle
    )
  })

  if (duplicateExists) throw new DuplicateEventTitleError()

  const eventRef = doc(db, 'events', event.id)
  const nextReservationId = await getTitleReservationId(event.hostId, normalizedTitle)
  const nextReservationRef = doc(db, 'eventTitleReservations', nextReservationId)
  const updatedEvent = { ...event, titleReservationId: nextReservationId }

  await runTransaction(db, async (transaction) => {
    const [eventSnapshot, nextReservation] = await Promise.all([
      transaction.get(eventRef),
      transaction.get(nextReservationRef),
    ])

    if (!eventSnapshot.exists()) throw new Error('This event no longer exists.')
    const currentEvent = eventSnapshot.data() as EventItem
    if (currentEvent.hostOwnerId !== event.hostOwnerId || currentEvent.hostId !== event.hostId) {
      throw new Error('You are not authorized to edit this event.')
    }

    if (nextReservation.exists() && nextReservation.data().eventId !== event.id) {
      throw new DuplicateEventTitleError()
    }
    const currentReservationRef = currentEvent.titleReservationId
      ? doc(db, 'eventTitleReservations', currentEvent.titleReservationId)
      : null
    const currentReservation =
      currentReservationRef && currentReservationRef.id !== nextReservationRef.id
        ? await transaction.get(currentReservationRef)
        : null
    if (
      currentReservation?.exists() &&
      currentReservation.data().eventId !== event.id
    ) {
      throw new Error('The existing event title reservation is invalid.')
    }

    if (!nextReservation.exists()) {
      transaction.set(nextReservationRef, {
        eventId: event.id,
        hostId: event.hostId,
        hostOwnerId: event.hostOwnerId,
        title: event.title,
      })
    }
    transaction.set(eventRef, updatedEvent)
    if (
      currentReservationRef &&
      currentReservationRef.id !== nextReservationRef.id &&
      currentReservation?.exists()
    ) {
      transaction.delete(currentReservationRef)
    }
  })

  return updatedEvent
}

export const deleteEventItem = async (event: EventItem) => {
  const eventRef = doc(db, 'events', event.id)
  await runTransaction(db, async (transaction) => {
    const eventSnapshot = await transaction.get(eventRef)

    if (!eventSnapshot.exists()) throw new Error('This event no longer exists.')
    const currentEvent = eventSnapshot.data() as EventItem
    if (currentEvent.hostOwnerId !== event.hostOwnerId || currentEvent.hostId !== event.hostId) {
      throw new Error('You are not authorized to delete this event.')
    }
    const reservationRef = currentEvent.titleReservationId
      ? doc(db, 'eventTitleReservations', currentEvent.titleReservationId)
      : null
    const reservation = reservationRef ? await transaction.get(reservationRef) : null
    if (reservation?.exists() && reservation.data().eventId !== event.id) {
      throw new Error('The event title reservation is invalid.')
    }

    transaction.delete(eventRef)
    if (reservationRef && reservation?.exists()) transaction.delete(reservationRef)
  })
}

export const saveEventRequest = async (request: EventRequest) => {
  const requestRef = collection(db, 'eventRequests')
  await addDoc(requestRef, request)
}
