import {
  browserLocalPersistence,
  GoogleAuthProvider,
  linkWithPopup,
  onAuthStateChanged,
  setPersistence,
  signInWithPopup,
  signInAnonymously,
  signOut,
  type User,
} from 'firebase/auth'
import {
  collection,
  doc,
  getDocs,
  onSnapshot,
  query,
  runTransaction,
  setDoc,
  where,
  writeBatch,
  type QueryConstraint,
} from 'firebase/firestore'
import type {
  ConfirmedCoHost,
  UserProfile,
  EventItem,
  EventRequest,
  PublicOrganization,
} from '../types'
import { auth, db } from './firebase'

export const initialCollaboration = () => ({
  pendingCount: 0, totalRequests: 0, acceptedCount: 0,
  partnerProfileIds: [] as string[], lastRequestId: '', revision: 0,
})

export const publishEvent = async (eventId: string): Promise<ConfirmedCoHost[]> => {
  if (!auth.currentUser) throw new Error('Sign in to publish this event.')
  return runTransaction(db, async (transaction) => {
    const eventRef = doc(db, 'events', eventId)
    const snapshot = await transaction.get(eventRef)
    if (!snapshot.exists()) throw new Error('This event no longer exists.')
    const event = snapshot.data() as EventItem
    if (event.hostOwnerId !== auth.currentUser?.uid) throw new Error('Only the host owner can publish.')
    if (event.collaborationVersion !== 2) {
      throw new Error('This event does not use V2 accounting. Create a new V2 event before publishing.')
    }
    const control = await transaction.get(doc(db, 'eventCollaboration', eventId))
    if (!control.exists() || control.data().pendingCount !== 0) throw new Error('Resolve all co-host requests first.')
    if (event.publicationStatus !== 'ready_to_publish' || !event.collaborationRequirementsCompleted) {
      throw new Error('Complete collaboration before publishing.')
    }
    transaction.update(eventRef, { publicationStatus: 'published' })
    return event.confirmedCoHosts ?? []
  })
}

export const continueWithoutEmail = async (): Promise<User> => {
  await setPersistence(auth, browserLocalPersistence)
  const user = auth.currentUser ?? (await signInAnonymously(auth)).user
  return user
}

export const signInWithGoogle = async (): Promise<User> => {
  await setPersistence(auth, browserLocalPersistence)
  const provider = new GoogleAuthProvider()
  const currentUser = auth.currentUser

  if (currentUser?.isAnonymous) {
    return (await linkWithPopup(currentUser, provider)).user
  }

  return (await signInWithPopup(auth, provider)).user
}

export const signOutUser = async (): Promise<void> => signOut(auth)

export const saveUserProfile = async (profile: UserProfile) => {
  const profileRef = doc(db, 'userProfiles', profile.id)
  if (profile.profileType === 'organization') {
    await saveOrganizationProfile(profile)
    return
  }
  await setDoc(profileRef, profile)
}

export const ensureOrganizationAccount = async (profile: UserProfile) => {
  if (profile.profileType !== 'organization') return
  const uid = auth.currentUser?.uid
  if (!uid || profile.ownerId !== uid) throw new Error('Sign in as the organization owner.')
  await runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(doc(db, 'userProfiles', profile.id))
    if (!snapshot.exists()) throw new Error('Your cloud profile is missing. Sync or recover it before continuing.')
    const cloud = snapshot.data() as UserProfile
    if (cloud.id !== profile.id || cloud.ownerId !== uid || cloud.profileType !== 'organization') {
      throw new Error('The cloud organization profile does not match this account.')
    }
    // Recover directory state only from current cloud data, never the local cache.
    const listingRef = doc(db, 'publicOrganizations', profile.id)
    if (cloud.directoryVisible === true) {
      const normalized = { ...cloud, interests: cloud.interests ?? [], eventTypes: cloud.eventTypes ?? [],
        availableResources: cloud.availableResources ?? [], collaborationPreferences: cloud.collaborationPreferences ?? [] }
      const defaults: Record<string, string[]> = {}
      for (const field of ['interests', 'eventTypes', 'availableResources', 'collaborationPreferences'] as const) {
        if (cloud[field] === undefined) defaults[field] = normalized[field]
      }
      if (Object.keys(defaults).length) transaction.update(doc(db, 'userProfiles', profile.id), defaults)
      transaction.set(listingRef, toPublicOrganization(normalized))
    } else {
      transaction.delete(listingRef)
    }
    transaction.set(doc(db, 'organizationAccounts', uid), { profileId: snapshot.id ?? profile.id })
  })
}

const toPublicOrganization = (profile: UserProfile): PublicOrganization => ({
  profileId: profile.id,
  name: profile.name,
  description: profile.description,
  focus: profile.focus,
  location: profile.location,
  interests: profile.interests ?? [profile.focus],
  eventTypes: profile.eventTypes ?? [],
  availableResources: profile.availableResources ?? [],
  collaborationPreferences: profile.collaborationPreferences ?? [],
})

export const saveOrganizationProfile = async (profile: UserProfile) => {
  if (profile.profileType !== 'organization') {
    throw new Error('Only organization profiles can be published to the public directory.')
  }

  const synchronizedProfile: UserProfile = {
    ...profile,
    interests: profile.interests ?? [profile.focus],
    eventTypes: profile.eventTypes ?? [],
    availableResources: profile.availableResources ?? [],
    collaborationPreferences: profile.collaborationPreferences ?? [],
    directoryVisible: profile.directoryVisible === true,
  }
  const batch = writeBatch(db)
  batch.set(doc(db, 'userProfiles', synchronizedProfile.id), synchronizedProfile)
  batch.set(doc(db, 'organizationAccounts', synchronizedProfile.ownerId), {
    profileId: synchronizedProfile.id,
  })
  const listingRef = doc(db, 'publicOrganizations', synchronizedProfile.id)
  if (synchronizedProfile.directoryVisible) {
    batch.set(listingRef, toPublicOrganization(synchronizedProfile))
  } else {
    batch.delete(listingRef)
  }
  await batch.commit()
}

export const subscribePublicOrganizations = (
  onOrganizations: (organizations: PublicOrganization[]) => void,
  onError: (error: Error) => void,
) =>
  onSnapshot(
    collection(db, 'publicOrganizations'),
    (snapshot) => {
      const organizations = snapshot.docs
        .map((organizationSnapshot) => ({
          ...(organizationSnapshot.data() as Omit<PublicOrganization, 'profileId'>),
          profileId: organizationSnapshot.id,
        }))
        .sort((first, second) => first.name.localeCompare(second.name))
      onOrganizations(organizations)
    },
    onError,
  )

export const subscribeUserProfiles = (
  ownerId: string,
  onProfiles: (profiles: UserProfile[]) => void,
  onError: (error: Error) => void,
) =>
  onSnapshot(
    query(collection(db, 'userProfiles'), where('ownerId', '==', ownerId)),
    (snapshot) => {
      // A cache-only empty result is not evidence that cloud profiles were deleted.
      if (snapshot.metadata?.fromCache) return
      const profiles = snapshot.docs
        .map((profileSnapshot) => profileSnapshot.data() as UserProfile)
        .sort((first, second) => second.createdAt.localeCompare(first.createdAt))
      onProfiles(profiles)
    },
    onError,
  )

export const subscribeEvents = (
  profileType: UserProfile['profileType'] | null,
  ownerId: string | null,
  onEvents: (events: EventItem[]) => void,
  onError: (error: Error) => void,
) => {
  const eventCollection = collection(db, 'events')
  const queryResults = new Map<string, Map<string, EventItem>>()
  const subscriptions: Array<() => void> = []
  const queryDefinitions: Array<{
    name: string
    constraints: QueryConstraint[]
  }> =
    profileType === 'organization' && ownerId
      ? [
          { name: 'organization-owned-events', constraints: [where('hostOwnerId', '==', ownerId)] },
          {
            name: 'organization-collaboration-opportunities',
            constraints: [where('publicationStatus', '==', 'pending_collaboration')],
          },
          {
            name: 'organization-published-events',
            constraints: [where('publicationStatus', '==', 'published')],
          },
        ]
      : [
          {
            name: 'student-published-events',
            constraints: [where('publicationStatus', '==', 'published')],
          },
        ]

  const emitEvents = () => {
    const eventsById = new Map<string, EventItem>()
    for (const events of queryResults.values()) {
      for (const [eventId, event] of events) eventsById.set(eventId, event)
    }
    onEvents(
      Array.from(eventsById.values()).sort((first, second) =>
        second.createdAt.localeCompare(first.createdAt),
      ),
    )
  }

  for (const definition of queryDefinitions) {
    const eventQuery = query(eventCollection, ...definition.constraints)
    const unsubscribe = onSnapshot(
      eventQuery,
      (snapshot) => {
        const events = new Map(
          snapshot.docs.map((eventSnapshot) => [
            eventSnapshot.id,
            { ...(eventSnapshot.data() as EventItem), id: eventSnapshot.id },
          ]),
        )
        queryResults.set(definition.name, events)
        emitEvents()
      },
      (error) => {
        const firebaseError = error as Error & { code?: string }
        console.error('Event discovery query failed', {
          query: definition.name,
          filters: definition.constraints,
          code: firebaseError.code ?? 'unknown',
          message: firebaseError.message,
          error,
        })
        onError(error)
      },
    )
    subscriptions.push(unsubscribe)
  }

  return () => subscriptions.forEach((unsubscribe) => unsubscribe())
}

export const subscribeEventRequests = (
  ownerId: string,
  profileId: string,
  profileType: UserProfile['profileType'],
  onRequests: (requests: EventRequest[]) => void,
  onError: (error: Error) => void,
) => {
  const subscriptions: {
    collectionName: 'participationRequests' | 'cohostRequests'
    requestType: EventRequest['requestType']
    ownerField: 'requesterOwnerId' | 'hostOwnerId'
    profileField: 'requesterProfileId' | 'hostProfileId'
  }[] =
    profileType === 'student'
      ? [
          {
            collectionName: 'participationRequests',
            requestType: 'participation',
            ownerField: 'requesterOwnerId',
            profileField: 'requesterProfileId',
          },
        ]
      : [
          {
            collectionName: 'cohostRequests',
            requestType: 'cohost',
            ownerField: 'requesterOwnerId',
            profileField: 'requesterProfileId',
          },
          {
            collectionName: 'participationRequests',
            requestType: 'participation',
            ownerField: 'hostOwnerId',
            profileField: 'hostProfileId',
          },
          {
            collectionName: 'cohostRequests',
            requestType: 'cohost',
            ownerField: 'hostOwnerId',
            profileField: 'hostProfileId',
          },
        ]
  let active = true
  const requestsBySubscription: EventRequest[][] = subscriptions.map(() => [])
  const unsubscribe = subscriptions.map(
    ({ collectionName, requestType, ownerField, profileField }, index) =>
      onSnapshot(
        query(
          collection(db, collectionName),
          where(ownerField, '==', ownerId),
          where(profileField, '==', profileId),
        ),
        (snapshot) => {
          if (!active) return
          requestsBySubscription[index] = snapshot.docs.map(
            (requestSnapshot) =>
              ({
                ...requestSnapshot.data(),
                id: requestSnapshot.id,
                requestType,
              }) as EventRequest,
          )
          const requests: EventRequest[] = []
          requestsBySubscription.forEach((subscriptionRequests) =>
            subscriptionRequests.forEach((request) => {
              if (!requests.some((candidate) => candidate.id === request.id)) {
                requests.push(request)
              }
            }),
          )
          requests.sort((first, second) => second.createdAt.localeCompare(first.createdAt))
          onRequests(requests)
        },
        onError,
      ),
  )

  return () => {
    active = false
    unsubscribe.forEach((stop) => stop())
  }
}

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

const getEventsForTitleCheck = async (hostOwnerId: string) => {
  try {
    return await getDocs(
      query(collection(db, 'events'), where('hostOwnerId', '==', hostOwnerId)),
    )
  } catch (error) {
    const firebaseError = error as Error & { code?: string }
    console.error('Event title-check query failed', {
      operation: 'list events for authenticated host owner',
      filters: ['hostOwnerId == authenticated owner'],
      code: firebaseError.code ?? 'unknown',
      message: firebaseError.message,
      error,
    })
    throw error
  }
}

export const saveEventItem = async (event: EventItem) => {
  const normalizedTitle = normalizeEventTitle(event.title)
  const existingEvents = await getEventsForTitleCheck(event.hostOwnerId)
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
    // Default to compatibility mode until the staged Rules/client rollout is approved.
    if (import.meta.env.VITE_PUBLICATION_V2_ENABLED === 'true') {
      transaction.set(eventRef, { ...event, titleReservationId, collaborationVersion: 2, confirmedCoHosts: [] })
      transaction.set(doc(db, 'eventCollaboration', event.id), initialCollaboration())
    } else {
      transaction.set(eventRef, { ...event, titleReservationId, cohostRequestIds: [] })
    }
  })
}

export const updateEventItem = async (event: EventItem) => {
  const normalizedTitle = normalizeEventTitle(event.title)
  const existingEvents = await getEventsForTitleCheck(event.hostOwnerId)
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
  let updatedEvent = { ...event, titleReservationId: nextReservationId }

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

    // Never replay stale attribution or protocol fields from a dashboard snapshot.
    updatedEvent = { ...event, titleReservationId: nextReservationId }
    for (const field of ['confirmedCoHosts', 'collaborationVersion', 'cohostRequestIds', 'attendees', 'lastAcceptedParticipationRequestId'] as const) {
      if (field in currentEvent) Object.assign(updatedEvent, { [field]: currentEvent[field] })
      else delete updatedEvent[field]
    }
    if (updatedEvent.publicationStatus === 'ready_to_publish' && currentEvent.publicationStatus !== 'ready_to_publish') {
      if (currentEvent.collaborationVersion !== 2) throw new Error('This event does not use V2 accounting. Create a new V2 event before completing collaboration.')
      const control = await transaction.get(doc(db, 'eventCollaboration', event.id))
      if (!control.exists() || control.data().pendingCount !== 0) throw new Error('Resolve all co-host requests first.')
    }
    if (!nextReservation.exists()) {
      transaction.set(nextReservationRef, {
        eventId: event.id,
        hostId: event.hostId,
        hostOwnerId: event.hostOwnerId,
        title: event.title,
      })
    }
    transaction.update(eventRef, updatedEvent)
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
    if (currentEvent.collaborationVersion !== 2) throw new Error('Legacy events must be retained. Cancel this event instead.')
    const control = await transaction.get(doc(db, 'eventCollaboration', event.id))
    if (!control.exists() || control.data().totalRequests > 0) {
      throw new Error('Events with collaboration history must be retained. Cancel this event instead.')
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

export const createEventRequestId = (
  eventId: string,
  requesterOwnerId: string,
  requesterProfileId: string,
  requestType: EventRequest['requestType'],
) => `${eventId}_${requesterOwnerId}_${requesterProfileId}_${requestType}`

const getRequestCollectionName = (requestType: EventRequest['requestType']) =>
  requestType === 'participation' ? 'participationRequests' : 'cohostRequests'

export const saveEventRequest = async (request: EventRequest) => {
  const requestRef = doc(db, getRequestCollectionName(request.requestType), request.id)
  const data = {
    requestType: request.requestType,
    eventId: request.eventId,
    eventTitle: request.eventTitle,
    hostOwnerId: request.hostOwnerId,
    hostProfileId: request.hostProfileId,
    requesterOwnerId: request.requesterOwnerId,
    requesterProfileId: request.requesterProfileId,
    requesterName: request.requesterName,
    requesterProfileType: request.requesterProfileType,
    availableDates: request.availableDates,
    attendeeCount: request.attendeeCount,
    message: request.message,
    status: request.status,
    createdAt: request.createdAt,
    ...(request.requestType === 'cohost'
      ? {
          resourcesProvided: request.resourcesProvided ?? [],
          contributionDescription: request.contributionDescription ?? '',
          ...(request.estimatedAttendees === undefined
            ? {}
            : { estimatedAttendees: request.estimatedAttendees }),
        }
      : {}),
  }
  if (request.requestType !== 'cohost') {
    await setDoc(requestRef, data)
    return
  }
  await runTransaction(db, async (transaction) => {
    const eventRef = doc(db, 'events', request.eventId)
    const snapshot = await transaction.get(eventRef)
    if (!snapshot.exists()) throw new Error('This event no longer exists.')
    const event = snapshot.data() as EventItem
    if (event.collaborationVersion === 2) {
      const controlRef = doc(db, 'eventCollaboration', request.eventId)
      const controlSnapshot = await transaction.get(controlRef)
      if (!controlSnapshot.exists()) throw new Error('Request accounting is unavailable. Refresh and try again.')
      const c = controlSnapshot.data()
      transaction.update(controlRef, {
        pendingCount: c.pendingCount + 1, totalRequests: c.totalRequests + 1,
        lastRequestId: request.id, revision: c.revision + 1,
      })
    }
    transaction.set(requestRef, data)
  })
}

export const resolveEventRequest = async (
  request: EventRequest,
  status: Extract<EventRequest['status'], 'accepted' | 'declined'>,
  hostOwnerId: string,
  hostProfileId: string,
) => {
  const requestRef = doc(db, getRequestCollectionName(request.requestType), request.id)
  const eventRef = doc(db, 'events', request.eventId)
  const resolvedAt = new Date().toISOString()

  await runTransaction(db, async (transaction) => {
    const [requestSnapshot, eventSnapshot] = await Promise.all([
      transaction.get(requestRef),
      transaction.get(eventRef),
    ])

    if (!requestSnapshot.exists() || !eventSnapshot.exists()) {
      throw new Error('This request or its event no longer exists.')
    }

    const storedRequest = requestSnapshot.data() as EventRequest
    const event = eventSnapshot.data() as EventItem
    if (
      event.hostOwnerId !== hostOwnerId ||
      storedRequest.hostOwnerId !== hostOwnerId ||
      storedRequest.hostProfileId !== hostProfileId ||
      event.hostId !== hostProfileId
    ) {
      throw new Error('You are not authorized to respond to this request.')
    }
    if (storedRequest.status !== 'pending') {
      throw new Error('This request has already been reviewed.')
    }

    if (storedRequest.requestType === 'cohost' && event.collaborationVersion === 2) {
      const controlRef = doc(db, 'eventCollaboration', request.eventId)
      const controlSnapshot = await transaction.get(controlRef)
      if (!controlSnapshot.exists()) throw new Error('Request accounting is unavailable.')
      const c = controlSnapshot.data()
      const partnerIds = c.partnerProfileIds as string[]
      if (status === 'accepted') {
        if (partnerIds.length >= 8) throw new Error('This event already has eight confirmed co-host organizations.')
        if (partnerIds.indexOf(storedRequest.requesterProfileId) !== -1) throw new Error('This organization is already a confirmed co-host.')
        transaction.update(eventRef, { confirmedCoHosts: [...(event.confirmedCoHosts ?? []), {
          profileId: storedRequest.requesterProfileId, name: storedRequest.requesterName,
        }] })
      }
      transaction.update(controlRef, {
        pendingCount: c.pendingCount - 1, lastRequestId: request.id, revision: c.revision + 1,
        ...(status === 'accepted' ? { acceptedCount: c.acceptedCount + 1,
          partnerProfileIds: [...partnerIds, storedRequest.requesterProfileId] } : {}),
      })
    }

    if (status === 'accepted' && storedRequest.requestType === 'participation') {
      const nextAttendeeCount = event.attendees + storedRequest.attendeeCount
      if (nextAttendeeCount > event.capacity) {
        throw new Error('There are not enough spots remaining to accept this request.')
      }
      transaction.update(eventRef, {
        attendees: nextAttendeeCount,
        lastAcceptedParticipationRequestId: request.id,
      })
    }

    transaction.update(requestRef, { status, resolvedAt, resolvedByProfileId: hostProfileId })
  })
}
