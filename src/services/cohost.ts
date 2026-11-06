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
  onSnapshot,
  query,
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

export const saveEventItem = async (event: EventItem) => {
  const eventRef = doc(db, 'events', event.id)
  await setDoc(eventRef, event)
}

export const saveEventRequest = async (request: EventRequest) => {
  const requestRef = collection(db, 'eventRequests')
  await addDoc(requestRef, request)
}
