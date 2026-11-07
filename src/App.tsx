import { type ChangeEvent, type FormEvent, useEffect, useRef, useState } from 'react'
import './App.css'
import {
  continueWithoutEmail,
  DuplicateEventTitleError,
  createEventRequestId,
  deleteEventItem,
  resolveEventRequest,
  ensureOrganizationAccount,
  saveOrganizationProfile,
  saveUserProfile,
  signInWithGoogle,
  signOutUser,
  saveEventItem,
  saveEventRequest,
  subscribeAuthUser,
  subscribeEvents,
  subscribeEventRequests,
  subscribePublicOrganizations,
  subscribeUserProfiles,
  updateEventItem,
  publishEvent,
} from './services/cohost'
import {
  getLocalDeviceId,
  loadActiveProfileId,
  loadLocalProfiles,
  saveActiveProfileId,
  saveLocalProfiles,
} from './services/localPersistence'
import { OrganizationDashboard } from './components/OrganizationDashboard'
import { StudentDashboard } from './components/StudentDashboard'
import { ProfilePage } from './components/ProfilePage'
import { ClubDiscovery } from './components/ClubDiscovery'
import { RequestsPage } from './components/RequestsPage'
import { InboxPanel } from './components/DashboardComponents'
import type {
  CoHostRequestDetails,
  HostFormValues,
  ProfileFormValues,
  ResourceFormField,
  RequestDraftValues,
} from './components/DashboardComponents'
import type {
  EventAudience,
  EventItem,
  EventRequest,
  InboxNotice,
  ProfileType,
  PublicOrganization,
  UserProfile,
} from './types'

const emptyProfileForm: ProfileFormValues = {
  name: '',
  profileType: 'student' as ProfileType,
  focus: 'General club activities',
  location: '',
  description: '',
  interests: [],
  eventTypes: [],
  availableResources: [],
  collaborationPreferences: [],
  directoryVisible: false,
}

const emptyHostForm: HostFormValues = {
  title: '',
  location: '',
  startDate: '',
  endDate: '',
  capacity: '12',
  description: '',
  audience: 'everyone' as EventAudience,
  resourcesOffered: [],
  offerDescription: '',
  offerOtherResource: '',
  offerOtherDescription: '',
  resourcesNeeded: [],
  needDescription: '',
  needOtherResource: '',
  needOtherDescription: '',
}

const emptyDraft: RequestDraftValues = {
  dates: [] as string[],
  attendeeCount: '2',
  message: '',
}

const readNotificationsStorageKey = 'cohost.readNotificationIds'

const loadReadNotificationState = (): { ids: string[]; error: string | null } => {
  try {
    const savedIds = localStorage.getItem(readNotificationsStorageKey)
    if (!savedIds) return { ids: [], error: null }
    const parsedIds: unknown = JSON.parse(savedIds)
    if (!Array.isArray(parsedIds) || !parsedIds.every((id) => typeof id === 'string')) {
      throw new Error('Saved inbox read state is invalid.')
    }
    return { ids: parsedIds, error: null }
  } catch (error) {
    return {
      ids: [],
      error: `Could not restore inbox read state: ${
        error instanceof Error ? error.message : 'unknown storage error'
      }`,
    }
  }
}

const getDatesInRange = (startDate: string, endDate: string) => {
  const dates: string[] = []
  const currentDate = new Date(`${startDate}T00:00:00`)
  const lastDate = new Date(`${endDate}T00:00:00`)

  while (currentDate <= lastDate) {
    const monthNumber = currentDate.getMonth() + 1
    const dayNumber = currentDate.getDate()
    dates.push(
      `${currentDate.getFullYear()}-${monthNumber < 10 ? `0${monthNumber}` : monthNumber}-${
        dayNumber < 10 ? `0${dayNumber}` : dayNumber
      }`,
    )
    currentDate.setDate(currentDate.getDate() + 1)
  }

  return dates
}

const App = () => {
  const [savedReadState] = useState(loadReadNotificationState)
  const [profiles, setProfiles] = useState<UserProfile[]>([])
  const [activeProfile, setActiveProfile] = useState<UserProfile | null>(null)
  const [events, setEvents] = useState<EventItem[]>([])
  const [eventRequests, setEventRequests] = useState<EventRequest[]>([])
  const [readNotificationIds, setReadNotificationIds] = useState(savedReadState.ids)
  const [authUserId, setAuthUserId] = useState<string | null>(null)
  const [isAnonymousSession, setIsAnonymousSession] = useState(false)
  const [authDisplayName, setAuthDisplayName] = useState<string | null>(null)
  const [authPhotoUrl, setAuthPhotoUrl] = useState<string | null>(null)
  const [authEmail, setAuthEmail] = useState<string | null>(null)
  const [isGoogleAccount, setIsGoogleAccount] = useState(false)
  const [profileForm, setProfileForm] = useState(emptyProfileForm)
  const [editProfileForm, setEditProfileForm] = useState(emptyProfileForm)
  const [currentPage, setCurrentPage] = useState<
    'dashboard' | 'events' | 'requests' | 'inbox' | 'profile' | 'discover'
  >('dashboard')
  const [requestSelection, setRequestSelection] = useState<{
    id: string
    requestType: EventRequest['requestType']
  } | null>(null)
  const [publicOrganizations, setPublicOrganizations] = useState<PublicOrganization[]>([])
  const [isDirectoryLoading, setIsDirectoryLoading] = useState(true)
  const [directoryError, setDirectoryError] = useState<string | null>(null)
  const [hostForm, setHostForm] = useState(emptyHostForm)
  const [requestDrafts, setRequestDrafts] = useState<Record<string, RequestDraftValues>>({})
  const [statusMessage, setStatusMessage] = useState('')
  const [errorMessage, setErrorMessage] = useState<string | null>(savedReadState.error)
  const [eventFormFeedback, setEventFormFeedback] = useState<{
    type: 'success' | 'error'
    message: string
  } | null>(null)
  const [isPublishing, setIsPublishing] = useState(false)
  const publishingRef = useRef(false)
  const pendingRequestIdsRef = useRef(new Set<string>())
  const completedRequestIdsRef = useRef(new Set<string>())
  const creatingProfileRef = useRef(false)
  const [isCreatingProfile, setIsCreatingProfile] = useState(false)
  const eventFeedbackRef = useRef<HTMLParagraphElement>(null)

  useEffect(() => {
    if (eventFormFeedback?.type === 'success') {
      eventFeedbackRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'center' })
    }
  }, [eventFormFeedback])

  useEffect(
    () =>
      subscribeAuthUser(
        (user) => {
          const nextUserId = user?.uid ?? null
          let availableProfiles: UserProfile[] = []
          let restoredProfile: UserProfile | null = null
          try {
            const localOwnerId = nextUserId ?? getLocalDeviceId()
            availableProfiles = loadLocalProfiles().filter(
              (profile) => profile.ownerId === localOwnerId,
            )
            const storedActiveId = loadActiveProfileId()
            restoredProfile =
              availableProfiles.find((profile) => profile.id === storedActiveId) ??
              availableProfiles[0] ??
              null
            if (restoredProfile) saveActiveProfileId(restoredProfile.id)
          } catch (error) {
            setErrorMessage(
              `Could not load this account's local profiles: ${
                error instanceof Error ? error.message : 'unknown storage error'
              }`,
            )
          }
          setAuthUserId(nextUserId)
          setIsAnonymousSession(user?.isAnonymous ?? false)
          setAuthDisplayName(user?.displayName ?? null)
          setAuthPhotoUrl(user?.photoURL ?? null)
          setAuthEmail(user?.email ?? null)
          setIsGoogleAccount(
            user?.providerData?.some((provider) => provider.providerId === 'google.com') ?? false,
          )
          setEventRequests([])
          setProfiles(availableProfiles)
          setActiveProfile(restoredProfile)
          setCurrentPage('dashboard')
        },
        (error) => setErrorMessage(`Could not restore your local account: ${error.message}`),
      ),
    [],
  )

  useEffect(
    () => {
      let isCancelled = false
      let unsubscribe = () => {}
      const profileType =
        activeProfile?.ownerId === authUserId ? activeProfile.profileType : null

      const startSubscription = async () => {
        if (profileType === 'organization' && activeProfile) {
          await ensureOrganizationAccount(activeProfile)
        }
        if (isCancelled) return
        unsubscribe = subscribeEvents(
          profileType,
          profileType === 'organization' ? activeProfile?.ownerId ?? null : null,
          setEvents,
          (error) => setErrorMessage(`Could not load events: ${error.message}`),
        )
      }

      void startSubscription().catch((error: unknown) => {
        if (isCancelled) return
        const firebaseError = error as Error & { code?: string }
        console.error('Could not provision organization event discovery access', {
          stage: 'organizationAccounts bootstrap batch',
          profileId: activeProfile?.id,
          ownerId: activeProfile?.ownerId,
          code: firebaseError.code ?? 'unknown',
          message: firebaseError.message,
          error,
        })
        setErrorMessage(
          `Could not authorize event discovery: ${
            error instanceof Error ? error.message : 'unknown Firebase error'
          }`,
        )
      })

      return () => {
        isCancelled = true
        unsubscribe()
      }
    },
    [authUserId, activeProfile],
  )

  useEffect(
    () =>
      subscribePublicOrganizations(
        (organizations) => {
          setPublicOrganizations(organizations)
          setIsDirectoryLoading(false)
          setDirectoryError(null)
        },
        (error) => {
          setDirectoryError(error.message)
          setIsDirectoryLoading(false)
        },
      ),
    [],
  )

  useEffect(() => {
    if (!authUserId || !activeProfile || activeProfile.ownerId !== authUserId) return

    return subscribeEventRequests(
      authUserId,
      activeProfile.id,
      activeProfile.profileType,
      setEventRequests,
      (error) => setErrorMessage(`Could not load event requests: ${error.message}`),
    )
  }, [authUserId, activeProfile])

  useEffect(() => {
    if (!authUserId) return

    return subscribeUserProfiles(
      authUserId,
      (savedProfiles) => {
        try {
          const localProfiles = loadLocalProfiles().filter(
            (localProfile) => localProfile.ownerId === authUserId,
          )
          // The server snapshot is authoritative after a reset. Do not resurrect
          // deleted cloud profiles or overwrite newer profiles from a device cache.
          const mergedProfiles = savedProfiles.filter((profile) => profile.ownerId === authUserId)
          if (localProfiles.some(profile => !mergedProfiles.some(saved => saved.id === profile.id))) {
            setStatusMessage('Your cloud profile list has changed. Create or select a profile to continue.')
            setErrorMessage(null)
          }
          saveLocalProfiles(mergedProfiles)
          setProfiles(mergedProfiles)
          const savedActiveProfileId = loadActiveProfileId()
          setActiveProfile((current) => {
            const currentProfile = current
              ? mergedProfiles.find((profile) => profile.id === current.id)
              : undefined
            return (
              currentProfile ??
              mergedProfiles.find((profile) => profile.id === savedActiveProfileId) ??
              mergedProfiles[0] ??
              null
            )
          })
        } catch (error) {
          setErrorMessage(
            `Could not persist your profiles on this device: ${
              error instanceof Error ? error.message : 'unknown storage error'
            }`,
          )
        }
      },
      (error) => setErrorMessage(`Could not load your saved profiles: ${error.message}`),
    )
  }, [authUserId])

  const handleProfileFieldChange = (
    event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
  ) => {
    const { name, value } = event.target

    setProfileForm((current) => ({
      ...current,
      [name]: value,
    }))
  }

  const handleEditProfileFieldChange = (
    event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
  ) => {
    const { name, value } = event.target
    setEditProfileForm((current) => ({ ...current, [name]: value }))
  }

  const handleHostFieldChange = (
    event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
  ) => {
    const { name, value } = event.target

    setEventFormFeedback(null)
    setHostForm((current) => ({
      ...current,
      [name]: value,
    }))
  }

  const handleHostResourceFieldChange = (field: ResourceFormField, value: string | string[]) => {
    setEventFormFeedback(null)
    setHostForm((current) => {
      if (field === 'resourcesOffered') {
        const resources = Array.isArray(value) ? value : []
        return {
          ...current,
          resourcesOffered: resources,
          ...(resources.indexOf('Other') === -1
            ? { offerOtherResource: '', offerOtherDescription: '' }
            : {}),
        }
      }
      if (field === 'resourcesNeeded') {
        const resources = Array.isArray(value) ? value : []
        return {
          ...current,
          resourcesNeeded: resources,
          ...(resources.indexOf('Other') === -1
            ? { needOtherResource: '', needOtherDescription: '' }
            : {}),
        }
      }
      return { ...current, [field]: typeof value === 'string' ? value : '' }
    })
  }

  const handleRequestDraftChange = (
    eventId: string,
    field: 'attendeeCount' | 'message',
    value: string,
  ) => {
    setRequestDrafts((current) => ({
      ...current,
      [eventId]: {
        ...(current[eventId] ?? { ...emptyDraft }),
        [field]: value,
      },
    }))
  }

  const handleContinueWithoutEmail = async () => {
    try {
      const user = await continueWithoutEmail()
      setAuthUserId(user.uid)
      const deviceId = getLocalDeviceId()
      const localProfiles = loadLocalProfiles().filter(
        (profile) => profile.ownerId === user.uid || profile.ownerId === deviceId,
      )
      const syncedProfiles = localProfiles.map((profile) => ({ ...profile, ownerId: user.uid }))
      saveLocalProfiles(syncedProfiles)
      setProfiles(syncedProfiles)
      const currentProfile =
        syncedProfiles.find((profile) => profile.id === activeProfile?.id) ??
        syncedProfiles.find((profile) => profile.id === loadActiveProfileId()) ??
        syncedProfiles[0] ??
        null
      setActiveProfile(currentProfile)
      if (currentProfile) saveActiveProfileId(currentProfile.id)
      await Promise.all(localProfiles.filter(profile => profile.ownerId === deviceId)
        .map(profile => saveUserProfile({ ...profile, ownerId: user.uid })))
      setStatusMessage('Your device account is ready and profiles are synced.')
      setErrorMessage(null)
      setCurrentPage('dashboard')
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : 'Unable to continue without email right now.',
      )
    }
  }

  const handleGoogleSignIn = async () => {
    try {
      const user = await signInWithGoogle()
      setErrorMessage(null)
      setStatusMessage(
        user.isAnonymous
          ? 'Your anonymous Firebase session is ready.'
          : 'Your Google account is connected to this Firebase session.',
      )
    } catch (error) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        (error.code === 'auth/credential-already-in-use' ||
          error.code === 'auth/account-exists-with-different-credential')
      ) {
        setErrorMessage(
          'This Google account already has a separate Firebase account. Sign out, then sign in with Google; anonymous-account profiles remain owned by that anonymous account.',
        )
        return
      }
      setErrorMessage(
        `Could not connect your Google account: ${
          error instanceof Error ? error.message : 'unknown authentication error'
        }`,
      )
    }
  }

  const handleSignOut = async () => {
    try {
      await signOutUser()
      setStatusMessage('You have signed out. Your cloud profiles have not been deleted.')
      setErrorMessage(null)
      setCurrentPage('dashboard')
    } catch (error) {
      setErrorMessage(
        `Could not sign out: ${
          error instanceof Error ? error.message : 'unknown authentication error'
        }`,
      )
    }
  }

  const handleCreateProfile = async (event: FormEvent<HTMLFormElement>): Promise<boolean> => {
    event.preventDefault()
    if (creatingProfileRef.current) return false
    creatingProfileRef.current = true
    setIsCreatingProfile(true)

    const profileName = profileForm.name.trim()
    const location = profileForm.location.trim()

    if (!profileName || !location) {
      setErrorMessage('Add your name and location before saving the profile.')
      creatingProfileRef.current = false
      setIsCreatingProfile(false)
      return false
    }

    try {
      const user = await continueWithoutEmail()
      setAuthUserId(user.uid)
      setIsAnonymousSession(user.isAnonymous)
      const deviceId = getLocalDeviceId()
      const localProfiles = loadLocalProfiles().filter(
        (profile) =>
          profile.ownerId === user.uid || (user.isAnonymous && profile.ownerId === deviceId),
      )
      const nextProfile: UserProfile = {
        id: crypto.randomUUID(),
        ownerId: user.uid,
        name: profileName,
        profileType: profileForm.profileType,
        focus: profileForm.focus,
        location,
        description:
          profileForm.description.trim() ||
          (profileForm.profileType === 'student'
            ? 'A student ready to take part in campus events.'
            : 'An organization ready to co-host campus events.'),
        createdAt: new Date().toISOString(),
        ...(profileForm.profileType === 'organization'
          ? {
              interests: profileForm.interests ?? [],
              eventTypes: profileForm.eventTypes ?? [],
              availableResources: profileForm.availableResources ?? [],
              collaborationPreferences: profileForm.collaborationPreferences ?? [],
              directoryVisible: false,
            }
          : {}),
      }
      const syncedProfiles = [
        nextProfile,
        ...localProfiles
          .filter((profile) => profile.id !== nextProfile.id)
          .map((profile) => ({ ...profile, ownerId: user.uid })),
      ]

      await Promise.all([saveUserProfile(nextProfile), ...localProfiles.filter(profile => profile.ownerId === deviceId)
        .map(profile => saveUserProfile({ ...profile, ownerId: user.uid }))])
      saveLocalProfiles(syncedProfiles)
      saveActiveProfileId(nextProfile.id)
      setProfiles(syncedProfiles)
      setActiveProfile(nextProfile)
      setProfileForm(emptyProfileForm)
      setStatusMessage(`${nextProfile.name}'s ${nextProfile.profileType} profile was created.`)
      setErrorMessage(null)
      setCurrentPage('dashboard')
      return true
    } catch (error) {
      setErrorMessage(
        `Could not create and sync the profile: ${
          error instanceof Error ? error.message : 'unknown account or storage error'
        }`,
      )
      return false
    } finally {
      creatingProfileRef.current = false
      setIsCreatingProfile(false)
    }
  }

  const handleUpdateProfile = async (event: FormEvent<HTMLFormElement>): Promise<boolean> => {
    event.preventDefault()
    if (!activeProfile) {
      setErrorMessage('Select a profile before editing it.')
      return false
    }
    if (!authUserId || activeProfile.ownerId !== authUserId) {
      setErrorMessage('Sign in to the Firebase account that owns this profile before editing it.')
      return false
    }

    const name = editProfileForm.name.trim()
    const location = editProfileForm.location.trim()
    if (!name || !location) {
      setErrorMessage('Add a name and location before saving the profile.')
      return false
    }

    const updatedProfile: UserProfile = {
      ...activeProfile,
      name,
      focus: editProfileForm.focus,
      location,
      description: editProfileForm.description.trim(),
      ...(activeProfile.profileType === 'organization'
        ? {
            interests: editProfileForm.interests ?? activeProfile.interests ?? [activeProfile.focus],
            eventTypes: editProfileForm.eventTypes ?? activeProfile.eventTypes ?? [],
            availableResources:
              editProfileForm.availableResources ?? activeProfile.availableResources ?? [],
            collaborationPreferences:
              editProfileForm.collaborationPreferences ??
              activeProfile.collaborationPreferences ??
              [],
            directoryVisible: editProfileForm.directoryVisible ?? false,
          }
        : {}),
    }
    const updatedProfiles = profiles.map((profile) =>
      profile.id === updatedProfile.id ? updatedProfile : profile,
    )

    try {
      saveLocalProfiles(updatedProfiles)
    } catch (error) {
      setErrorMessage(
        `Could not save your profile on this device: ${
          error instanceof Error ? error.message : 'unknown storage error'
        }`,
      )
      return false
    }

    setProfiles(updatedProfiles)
    setActiveProfile(updatedProfile)
    setErrorMessage(null)
    try {
      if (updatedProfile.profileType === 'organization') {
        await saveOrganizationProfile(updatedProfile)
      } else {
        await saveUserProfile(updatedProfile)
      }
      setStatusMessage(`${updatedProfile.name}'s profile has been updated.`)
      return true
    } catch (error) {
      setErrorMessage(
        `Profile changes are saved on this device, but Firebase sync failed: ${
          error instanceof Error ? error.message : 'unknown Firebase error'
        }`,
      )
      return false
    }
  }

  const handleHostEvent = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (publishingRef.current) return

    if (!authUserId || !activeProfile || activeProfile.profileType !== 'organization') {
      setEventFormFeedback({
        type: 'error',
        message: 'Only student organizations can post events.',
      })
      return
    }

    const title = hostForm.title.trim()
    const location = hostForm.location.trim()
    const dateOptions =
      hostForm.startDate && hostForm.endDate
        ? getDatesInRange(hostForm.startDate, hostForm.endDate)
        : []

    if (!title || !location || dateOptions.length === 0) {
      setEventFormFeedback({
        type: 'error',
        message: 'Event title, location, and a complete date range are required.',
      })
      return
    }

    publishingRef.current = true
    setIsPublishing(true)
    setEventFormFeedback(null)

    try {
      const nextEvent: EventItem = {
        id: crypto.randomUUID(),
        hostId: activeProfile.id,
        hostOwnerId: authUserId,
        hostName: activeProfile.name,
        hostProfileType: activeProfile.profileType,
        title,
        location,
        description: hostForm.description.trim() || 'Looking for a co-hosting partner.',
        audience: hostForm.audience,
        resourcesOffered: [...hostForm.resourcesOffered],
        offerDescription: hostForm.offerDescription.trim(),
        offerOtherResource:
          hostForm.resourcesOffered.indexOf('Other') !== -1
            ? hostForm.offerOtherResource.trim()
            : '',
        offerOtherDescription:
          hostForm.resourcesOffered.indexOf('Other') !== -1
            ? hostForm.offerOtherDescription.trim()
            : '',
        resourcesNeeded: [...hostForm.resourcesNeeded],
        needDescription: hostForm.needDescription.trim(),
        needOtherResource:
          hostForm.resourcesNeeded.indexOf('Other') !== -1
            ? hostForm.needOtherResource.trim()
            : '',
        needOtherDescription:
          hostForm.resourcesNeeded.indexOf('Other') !== -1
            ? hostForm.needOtherDescription.trim()
            : '',
        dateOptions,
        capacity: Number(hostForm.capacity) || 12,
        attendees: 0,
        createdAt: new Date().toISOString(),
        publicationStatus: 'draft',
        collaborationRequirementsCompleted: false,
      }

      await saveEventItem(nextEvent)
      setEvents((current) => [nextEvent, ...current.filter((item) => item.id !== nextEvent.id)])
      setHostForm(emptyHostForm)
      setEventFormFeedback({
        type: 'success',
        message: `Event '${nextEvent.title}' was saved as Draft. Start Collaboration when you are ready to receive co-host requests. It is not visible to students until published.`,
      })
    } catch (error) {
      setEventFormFeedback({
        type: 'error',
        message:
          error instanceof DuplicateEventTitleError
            ? error.message
            : `Could not save the event: ${
                error instanceof Error ? error.message : 'unknown Firebase error'
              }`,
      })
    } finally {
      publishingRef.current = false
      setIsPublishing(false)
    }
  }

  const handleUpdateEvent = async (event: EventItem) => {
    if (!authUserId || activeProfile?.profileType !== 'organization') {
      throw new Error('An organization profile is required to manage events.')
    }
    if (event.hostOwnerId !== authUserId || event.hostId !== activeProfile.id) {
      throw new Error('Only the account that published this event can edit it.')
    }

    const updatedEvent = await updateEventItem({
      ...event,
      publicationStatus: event.publicationStatus ?? 'pending_collaboration',
      collaborationRequirementsCompleted: event.collaborationRequirementsCompleted ?? false,
    })
    setEvents((current) =>
      current.map((item) => (item.id === updatedEvent.id ? updatedEvent : item)),
    )
  }

  const handlePublishEvent = async (event: EventItem) => {
    if (!authUserId || activeProfile?.profileType !== 'organization') {
      throw new Error('An organization profile is required to publish events.')
    }
    if (event.hostOwnerId !== authUserId || event.hostId !== activeProfile.id) {
      throw new Error('Only the account that published this event can publish it.')
    }

    await publishEvent(event.id)
  }

  const handleDeleteEvent = async (event: EventItem) => {
    if (!authUserId || activeProfile?.profileType !== 'organization') {
      throw new Error('An organization profile is required to manage events.')
    }
    if (event.hostOwnerId !== authUserId || event.hostId !== activeProfile.id) {
      throw new Error('Only the account that published this event can delete it.')
    }

    await deleteEventItem(event)
    setEvents((current) => current.filter((item) => item.id !== event.id))
  }

  const handleJoinRequest = async (
    eventItem: EventItem,
    requestKind: 'participation' | 'cohost',
    coHostDetails?: CoHostRequestDetails,
  ): Promise<boolean> => {
    if (!activeProfile || !authUserId || activeProfile.ownerId !== authUserId) {
      setErrorMessage('Create a profile before requesting to join an event.')
      return false
    }

    if (
      (requestKind === 'participation' && activeProfile.profileType !== 'student') ||
      (requestKind === 'cohost' && activeProfile.profileType !== 'organization')
    ) {
      setErrorMessage('Switch to the matching profile type to submit this request.')
      return false
    }

    if (
      eventItem.hostId === activeProfile.id ||
      eventItem.hostOwnerId === activeProfile.ownerId
    ) {
      setErrorMessage('You cannot request to join an event hosted by your account.')
      return false
    }

    if (eventItem.audience === 'organizations' && activeProfile.profileType !== 'organization') {
      setErrorMessage('This event is open to organizations only.')
      return false
    }

    if (
      requestKind === 'participation' &&
      eventItem.publicationStatus !== 'published'
    ) {
      setErrorMessage('Participation requests are only available for published events.')
      return false
    }

    if (
      requestKind === 'cohost' &&
      eventItem.publicationStatus !== 'pending_collaboration'
    ) {
      setErrorMessage('Co-hosting requests are only available while an event is pending collaboration.')
      return false
    }

    if (requestKind === 'cohost' && !coHostDetails) {
      setErrorMessage('Select the resources your organization can provide before submitting.')
      return false
    }

    const hostNeeds = eventItem.resourcesNeeded ?? []
    const resourcesProvided = coHostDetails?.resourcesProvided ?? []
    if (
      requestKind === 'cohost' &&
      ((!coHostDetails?.contributionDescription.trim()) ||
        (hostNeeds.length > 0 &&
          (resourcesProvided.length === 0 ||
            resourcesProvided.some((resource) => hostNeeds.indexOf(resource) === -1))) ||
        (hostNeeds.length === 0 &&
          resourcesProvided.some((resource) => resource !== 'General contribution')))
    ) {
      setErrorMessage('Provide a description and select only resources requested by the host.')
      return false
    }

    const draft = requestDrafts[eventItem.id] ?? { ...emptyDraft }
    const selectedDates = draft.dates.length > 0 ? draft.dates : eventItem.dateOptions.slice(0, 1)
    const attendeeCount =
      requestKind === 'participation' ? 1 : 0
    const estimatedAttendees = coHostDetails?.estimatedAttendees
    if (
      requestKind === 'cohost' &&
      estimatedAttendees !== undefined &&
      (!Number.isInteger(estimatedAttendees) || estimatedAttendees < 1)
    ) {
      setErrorMessage('Estimated attendance must be a positive whole number.')
      return false
    }
    if (selectedDates.length === 0) {
      setErrorMessage('Choose at least one date before sending your request.')
      return false
    }

    const openSpots = eventItem.capacity - eventItem.attendees
    if (requestKind === 'participation' && attendeeCount > openSpots) {
      setErrorMessage(`Only ${openSpots} spots remain for this event.`)
      return false
    }

    const requestId = createEventRequestId(
      eventItem.id,
      activeProfile.ownerId,
      activeProfile.id,
      requestKind,
    )
    if (
      eventRequests.some((request) => request.id === requestId) ||
      completedRequestIdsRef.current.has(requestId)
    ) {
      setErrorMessage('A request for this event has already been sent from this profile.')
      return false
    }
    if (pendingRequestIdsRef.current.has(requestId)) {
      setErrorMessage('Your request is already being submitted.')
      return false
    }

    const newRequest: EventRequest = {
      id: requestId,
      requestType: requestKind,
      eventId: eventItem.id,
      eventTitle: eventItem.title,
      hostOwnerId: eventItem.hostOwnerId,
      hostProfileId: eventItem.hostId,
      requesterOwnerId: activeProfile.ownerId,
      requesterProfileId: activeProfile.id,
      requesterName: activeProfile.name,
      requesterProfileType: activeProfile.profileType,
      availableDates: selectedDates,
      attendeeCount,
      message:
        requestKind === 'cohost'
          ? `Co-hosting request: ${draft.message.trim() || 'Interested in collaborating on this event.'}`
          : draft.message.trim() || 'Interested in joining this event.',
      status: 'pending',
      createdAt: new Date().toISOString(),
      ...(requestKind === 'cohost'
        ? {
            resourcesProvided,
            contributionDescription: coHostDetails?.contributionDescription.trim() ?? '',
            ...(estimatedAttendees === undefined ? {} : { estimatedAttendees }),
          }
        : {}),
    }

    pendingRequestIdsRef.current.add(requestId)
    try {
      await saveEventRequest(newRequest)
      completedRequestIdsRef.current.add(requestId)
      setRequestDrafts((current) => ({
        ...current,
        [eventItem.id]: { ...emptyDraft },
      }))
      setStatusMessage(
        requestKind === 'cohost'
          ? `Your co-hosting request for ${eventItem.title} has been sent.`
          : `Your participation request for ${eventItem.title} has been sent.`,
      )
      setErrorMessage(null)
      return true
    } catch (error) {
      const errorCode =
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        typeof error.code === 'string'
          ? error.code
          : 'unknown'
      const errorMessage =
        error instanceof Error
          ? error.message
          : typeof error === 'object' &&
              error !== null &&
              'message' in error &&
              typeof error.message === 'string'
            ? error.message
            : 'Unknown Firebase error'
      console.error('Failed to submit event request to Firebase.', {
        code: errorCode,
        message: errorMessage,
        error,
      })
      setErrorMessage(
        `Could not send your ${requestKind === 'cohost' ? 'co-hosting' : 'participation'} request. Firebase error ${errorCode}: ${errorMessage}. Please try again or contact support with this error code.`,
      )
      return false
    } finally {
      pendingRequestIdsRef.current.delete(requestId)
    }
  }

  const markNotificationRead = (noticeId: string) => {
    try {
      const nextIds = readNotificationIds.indexOf(noticeId) !== -1
        ? readNotificationIds
        : [...readNotificationIds, noticeId]
      localStorage.setItem(readNotificationsStorageKey, JSON.stringify(nextIds))
      setReadNotificationIds(nextIds)
    } catch (error) {
      setErrorMessage(
        `Could not save inbox read state: ${
          error instanceof Error ? error.message : 'unknown storage error'
        }`,
      )
    }
  }

  const handleResolveRequest = async (
    eventRequest: EventRequest,
    status: Extract<EventRequest['status'], 'accepted' | 'declined'>,
  ): Promise<boolean> => {
    if (!authUserId || activeProfile?.ownerId !== authUserId) {
      setErrorMessage('Sign in to the event host account before responding to requests.')
      return false
    }
    if (
      activeProfile.profileType !== 'organization' ||
      eventRequest.hostOwnerId !== authUserId ||
      eventRequest.hostProfileId !== activeProfile.id
    ) {
      setErrorMessage('You are not authorized to respond to this request.')
      return false
    }

    try {
      await resolveEventRequest(eventRequest, status, authUserId, activeProfile.id)
      setEventRequests((current) =>
        current.map((request) =>
          request.id === eventRequest.id && request.requestType === eventRequest.requestType
            ? {
                ...request,
                status,
                resolvedAt: new Date().toISOString(),
                resolvedByProfileId: activeProfile.id,
              }
            : request,
        ),
      )
      setStatusMessage(
        `The ${eventRequest.requestType === 'cohost' ? 'co-hosting' : 'participation'} request was ${status}.`,
      )
      setErrorMessage(null)
      return true
    } catch (error) {
      setErrorMessage(
        `Could not ${status === 'accepted' ? 'accept' : 'decline'} the request: ${
          error instanceof Error ? error.message : 'unknown Firebase error'
        }`,
      )
      return false
    }
  }

  const handleSelectProfile = (profileId: string) => {
    const selectedProfile = profiles.find((profile) => profile.id === profileId)
    if (!selectedProfile) return
    try {
      const isOwnedProfile = authUserId
        ? selectedProfile.ownerId === authUserId
        : selectedProfile.ownerId === getLocalDeviceId()
      if (!isOwnedProfile) {
        setErrorMessage('You can only switch to profiles owned by the active account.')
        return
      }
      saveActiveProfileId(selectedProfile.id)
      setActiveProfile(selectedProfile)
      setCurrentPage('dashboard')
      setErrorMessage(null)
    } catch (error) {
      setErrorMessage(
        `Could not save your active profile selection: ${
          error instanceof Error ? error.message : 'unknown storage error'
        }`,
      )
    }
  }

  const activeProfileRequests = activeProfile?.ownerId === authUserId
    ? eventRequests.filter((request) => {
        const isOutgoing =
          request.requesterOwnerId === authUserId &&
          request.requesterProfileId === activeProfile.id &&
          (activeProfile.profileType === 'student'
            ? request.requestType === 'participation'
            : request.requestType === 'cohost')
        const isIncoming =
          activeProfile.profileType === 'organization' &&
          request.hostOwnerId === authUserId &&
          request.hostProfileId === activeProfile.id
        return isOutgoing !== isIncoming
      })
    : []

  const inbox: InboxNotice[] = activeProfileRequests.map((request) => {
    const isOutgoing =
      request.requesterOwnerId === authUserId &&
      request.requesterProfileId === activeProfile?.id
    const requestLabel = request.requestType === 'cohost' ? 'Co-hosting' : 'Participation'
    const statusLabel = request.status[0].toUpperCase() + request.status.slice(1)
    return {
      id: request.id,
      profileId: activeProfile?.id ?? '',
      title: isOutgoing
        ? `${requestLabel} request ${statusLabel.toLowerCase()}`
        : request.status === 'pending'
          ? `New ${requestLabel.toLowerCase()} request for ${request.eventTitle}`
          : `${requestLabel} request ${statusLabel.toLowerCase()} for ${request.eventTitle}`,
      message: isOutgoing
        ? `Your request for ${request.eventTitle} is ${request.status}.`
        : request.requestType === 'cohost'
          ? `${request.requesterName} sent a co-hosting request for ${request.eventTitle} with estimated attendance ${
              request.estimatedAttendees ??
              (request.attendeeCount > 0 ? request.attendeeCount : 'Not sure yet')
            }.`
          : `${request.requesterName} requested ${request.attendeeCount} ${
              request.attendeeCount === 1 ? 'spot' : 'spots'
            } for ${request.eventTitle}.`,
      type: isOutgoing ? 'outgoing' : 'incoming',
      relatedEventId: request.eventId,
      requestId: request.id,
      requestType: request.requestType,
      createdAt: request.createdAt,
      isRead: readNotificationIds.indexOf(request.id) !== -1,
    }
  })

  const handleRequestDatesChange = (eventId: string, dates: string[]) => {
    setRequestDrafts((current) => ({
      ...current,
      [eventId]: { ...(current[eventId] ?? { ...emptyDraft }), dates },
    }))
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 bg-slate-950/80 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-4 px-6 py-5">
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-cyan-300">Campus co-hosting</p>
            <h1 className="text-3xl font-black text-white">CoHost</h1>
          </div>
        </div>
        <nav
          aria-label="Main navigation"
          className="app-navigation mx-auto flex max-w-7xl flex-wrap items-center gap-2 px-6 pb-4"
        >
          {(['dashboard', 'events', 'requests', 'inbox', 'discover', 'profile'] as const).map((page) => (
            <button
              key={page}
              type="button"
              aria-current={currentPage === page ? 'page' : undefined}
              onClick={() => setCurrentPage(page)}
              className={`rounded-full px-4 py-2 text-sm font-semibold capitalize transition ${
                currentPage === page
                  ? 'bg-gradient-to-r from-blue-600 to-violet-600 text-white'
                  : 'border border-slate-200 bg-white text-slate-600 hover:bg-blue-50'
              }`}
            >
              {page === 'discover' ? 'Discover Clubs' : page}
            </button>
          ))}
        </nav>
      </header>
      <main className="mx-auto max-w-7xl px-6 py-10">
        {statusMessage ? (
          <div className="mb-6 rounded-2xl border border-emerald-500/50 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
            {statusMessage}
          </div>
        ) : null}
        {errorMessage ? (
          <div
            role="alert"
            className="mb-6 rounded-2xl border border-rose-500/50 bg-rose-500/10 px-4 py-3 text-sm text-rose-100"
          >
            {errorMessage}
          </div>
        ) : null}
        {currentPage === 'discover' ? (
          <ClubDiscovery
            organizations={publicOrganizations}
            events={events}
            activeProfile={activeProfile}
            authUserId={authUserId}
            requestDrafts={requestDrafts}
            isLoading={isDirectoryLoading}
            error={directoryError}
            onDraftChange={handleRequestDraftChange}
            onDatesChange={handleRequestDatesChange}
            onRequest={handleJoinRequest}
          />
        ) : currentPage === 'requests' ? (
          <RequestsPage
            requests={activeProfileRequests}
            events={events}
            profile={activeProfile}
            selection={requestSelection}
            onSelectionHandled={() => setRequestSelection(null)}
            onResolveRequest={handleResolveRequest}
          />
        ) : currentPage === 'profile' ? (
          <ProfilePage
            activeProfile={activeProfile}
            profiles={profiles}
            authUserId={authUserId}
            authDisplayName={authDisplayName}
            authPhotoUrl={authPhotoUrl}
            authEmail={authEmail}
            isGoogleAccount={isGoogleAccount}
            isAnonymousSession={isAnonymousSession}
            profileForm={profileForm}
            editProfileForm={editProfileForm}
            isCreatingProfile={isCreatingProfile}
            onSelectProfile={(profileId) => {
              handleSelectProfile(profileId)
              const profile = profiles.find((item) => item.id === profileId)
              setEditProfileForm(
                profile
                  ? {
                      name: profile.name,
                      profileType: profile.profileType,
                      focus: profile.focus,
                      location: profile.location,
                      description: profile.description,
                      interests:
                        profile.interests ??
                        (profile.profileType === 'organization' ? [profile.focus] : []),
                      eventTypes: profile.eventTypes ?? [],
                      availableResources: profile.availableResources ?? [],
                      collaborationPreferences: profile.collaborationPreferences ?? [],
                      directoryVisible: profile.directoryVisible ?? false,
                    }
                  : emptyProfileForm,
              )
            }}
            onCreateProfileStart={() => setProfileForm(emptyProfileForm)}
            onCreateProfile={handleCreateProfile}
            onProfileFieldChange={handleProfileFieldChange}
            onEditProfileStart={() => {
              if (!activeProfile) return
              setEditProfileForm({
                name: activeProfile.name,
                profileType: activeProfile.profileType,
                focus: activeProfile.focus,
                location: activeProfile.location,
                description: activeProfile.description,
                interests:
                  activeProfile.interests ??
                  (activeProfile.profileType === 'organization' ? [activeProfile.focus] : []),
                eventTypes: activeProfile.eventTypes ?? [],
                availableResources: activeProfile.availableResources ?? [],
                collaborationPreferences: activeProfile.collaborationPreferences ?? [],
                directoryVisible: activeProfile.directoryVisible ?? false,
              })
            }}
            onEditProfileSave={handleUpdateProfile}
            onEditProfileFieldChange={handleEditProfileFieldChange}
            onOrganizationSettingsChange={(field, value) =>
              setEditProfileForm((current) => ({ ...current, [field]: value }))
            }
            onContinueWithoutEmail={() => void handleContinueWithoutEmail()}
            onGoogleSignIn={() => void handleGoogleSignIn()}
            onSignOut={() => void handleSignOut()}
          />
        ) : currentPage === 'inbox' ? (
          <section className="mx-auto max-w-3xl" aria-label="Inbox page">
            <InboxPanel
              inbox={inbox}
              profileId={activeProfile?.id ?? null}
              onMarkRead={markNotificationRead}
              onViewRequest={(notice) => {
                if (notice.requestId && notice.requestType) {
                  setRequestSelection({
                    id: notice.requestId,
                    requestType: notice.requestType,
                  })
                }
                setCurrentPage('requests')
              }}
            />
          </section>
        ) : activeProfile?.profileType === 'organization' ? (
          <OrganizationDashboard
            activeProfile={activeProfile}
            events={events}
            eventRequests={eventRequests}
            hostForm={hostForm}
            requestDrafts={requestDrafts}
            view={currentPage === 'events' ? 'events' : 'dashboard'}
            eventFormFeedback={eventFormFeedback}
            eventFeedbackRef={eventFeedbackRef}
            isPublishing={isPublishing}
            onHostFieldChange={handleHostFieldChange}
            onHostResourceFieldChange={handleHostResourceFieldChange}
            onHostRangeChange={(startDate, endDate) => {
              setEventFormFeedback(null)
              setHostForm((current) => ({ ...current, startDate, endDate }))
            }}
            onHostEvent={handleHostEvent}
            onUpdateEvent={handleUpdateEvent}
            onPublishEvent={handlePublishEvent}
            onDeleteEvent={handleDeleteEvent}
            onDraftChange={handleRequestDraftChange}
            onDatesChange={handleRequestDatesChange}
            onRequest={handleJoinRequest}
          />
        ) : (
          <StudentDashboard
            activeProfile={activeProfile}
            events={events}
            requestDrafts={requestDrafts}
            view={currentPage === 'events' ? 'events' : 'dashboard'}
            onDraftChange={handleRequestDraftChange}
            onDatesChange={handleRequestDatesChange}
            onRequest={handleJoinRequest}
          />
        )}
      </main>
    </div>
  )
}

export default App
