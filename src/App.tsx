import { type ChangeEvent, type FormEvent, useEffect, useRef, useState } from 'react'
import './App.css'
import {
  continueWithoutEmail,
  DuplicateEventTitleError,
  createEventRequestId,
  deleteEventItem,
  resolveEventRequest,
  saveUserProfile,
  saveEventItem,
  saveEventRequest,
  subscribeAuthUser,
  subscribeEvents,
  subscribeEventRequests,
  subscribeUserProfiles,
  updateEventItem,
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
import { WorkspaceHome } from './components/WorkspaceHome'
import type {
  HostFormValues,
  ProfileFormValues,
  RequestDraftValues,
} from './components/DashboardComponents'
import type {
  EventAudience,
  EventItem,
  EventRequest,
  InboxNotice,
  ProfileType,
  UserProfile,
  WorkspacePage,
} from './types'

const emptyProfileForm: ProfileFormValues = {
  name: '',
  profileType: 'student' as ProfileType,
  focus: 'General club activities',
  location: '',
  description: '',
}

const emptyHostForm: HostFormValues = {
  title: '',
  location: '',
  startDate: '',
  endDate: '',
  capacity: '12',
  description: '',
  audience: 'everyone' as EventAudience,
}

const emptyDraft: RequestDraftValues = {
  dates: [] as string[],
  attendeeCount: '2',
  message: '',
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

const loadInitialProfileState = () => {
  try {
    const profiles = loadLocalProfiles()
    const activeProfileId = loadActiveProfileId()
    return {
      profiles,
      activeProfile: profiles.find((profile) => profile.id === activeProfileId) ?? profiles[0] ?? null,
      error: null,
    }
  } catch (error) {
    return {
      profiles: [],
      activeProfile: null,
      error: error instanceof Error ? error.message : 'Could not load your saved local profile.',
    }
  }
}

const readWorkspacePage = (): WorkspacePage => {
  const hash = window.location.hash.slice(1)
  return ['events', 'host', 'manage', 'inbox', 'profile'].indexOf(hash) !== -1
    ? hash as WorkspacePage : 'home'
}

const App = () => {
  const [page, setPage] = useState<WorkspacePage>(readWorkspacePage)
  const [discoveryEventId, setDiscoveryEventId] = useState<string | null>(null)
  const navigate = (next: WorkspacePage) => {
    setPage(next)
    window.location.hash = next
  }
  const [initialProfileState] = useState(loadInitialProfileState)
  const [profiles, setProfiles] = useState<UserProfile[]>(initialProfileState.profiles)
  const [activeProfile, setActiveProfile] = useState<UserProfile | null>(
    initialProfileState.activeProfile,
  )
  const [events, setEvents] = useState<EventItem[]>([])
  const [eventRequests, setEventRequests] = useState<EventRequest[]>([])
  const [readNotificationIds, setReadNotificationIds] = useState<string[]>([])
  const [authUserId, setAuthUserId] = useState<string | null>(null)
  const [profileForm, setProfileForm] = useState<ProfileFormValues>(() => ({
    ...emptyProfileForm,
    profileType: readWorkspacePage() === 'host' ? 'organization' : 'student',
  }))
  const [hostForm, setHostForm] = useState(emptyHostForm)
  const [requestDrafts, setRequestDrafts] = useState<Record<string, RequestDraftValues>>({})
  const [statusMessage, setStatusMessage] = useState('')
  const [errorMessage, setErrorMessage] = useState<string | null>(initialProfileState.error)
  const [eventFormFeedback, setEventFormFeedback] = useState<{
    type: 'success' | 'error'
    message: string
  } | null>(null)
  const [isPublishing, setIsPublishing] = useState(false)
  const publishingRef = useRef(false)
  const eventFeedbackRef = useRef<HTMLParagraphElement>(null)

  useEffect(() => {
    const onHashChange = () => {
      const next = readWorkspacePage()
      setPage(next)
      setErrorMessage(null)
      setStatusMessage('')
      if (next === 'host') {
        setProfileForm((current) => ({ ...current, profileType: 'organization' }))
      }
    }
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

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
          setAuthUserId(nextUserId)
          if (!nextUserId) setEventRequests([])
        },
        (error) => setErrorMessage(`Could not restore your local account: ${error.message}`),
      ),
    [],
  )

  useEffect(
    () =>
      subscribeEvents(
        setEvents,
        (error) => setErrorMessage(`Could not load events: ${error.message}`),
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
          const mergedProfiles = [
            ...savedProfiles,
            ...localProfiles.filter(
              (localProfile) =>
                !savedProfiles.some((savedProfile) => savedProfile.id === localProfile.id),
            ),
          ]
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
      setActiveProfile((current) =>
        syncedProfiles.find((profile) => profile.id === current?.id) ?? syncedProfiles[0] ?? null,
      )
      await Promise.all(syncedProfiles.map(saveUserProfile))
      setStatusMessage('Your device account is ready and profiles are synced.')
      setErrorMessage(null)
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : 'Unable to continue without email right now.',
      )
    }
  }

  const handleCreateProfile = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const profileName = profileForm.name.trim()
    const location = profileForm.location.trim()

    if (!profileName || !location) {
      setErrorMessage('Add your name and location before saving the profile.')
      return
    }

    let deviceId: string
    try {
      deviceId = getLocalDeviceId()
    } catch (error) {
      setErrorMessage(
        `Could not access local storage: ${error instanceof Error ? error.message : 'unknown storage error'}`,
      )
      return
    }

    const newProfile: UserProfile = {
      id: crypto.randomUUID(),
      ownerId: authUserId ?? deviceId,
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
    }

    let localProfiles: UserProfile[]
    try {
      localProfiles = [newProfile, ...loadLocalProfiles().filter((profile) => profile.id !== newProfile.id)]
      saveLocalProfiles(localProfiles)
      saveActiveProfileId(newProfile.id)
    } catch (error) {
      setErrorMessage(
        `Could not save your profile on this device: ${
          error instanceof Error ? error.message : 'unknown storage error'
        }`,
      )
      return
    }

    setProfiles(localProfiles)
    setActiveProfile(newProfile)
    setProfileForm(emptyProfileForm)
    setStatusMessage(
      newProfile.profileType === 'organization'
        ? `${newProfile.name} is ready to host and request co-hosted events.`
        : `${newProfile.name} is ready to discover and request events.`,
    )
    setErrorMessage(null)

    try {
      const user = await continueWithoutEmail()
      setAuthUserId(user.uid)
      const syncedProfile = { ...newProfile, ownerId: user.uid }
      const syncedProfiles = localProfiles.map((profile) =>
        profile.id === syncedProfile.id ? syncedProfile : profile,
      )
      saveLocalProfiles(syncedProfiles)
      setProfiles(syncedProfiles)
      setActiveProfile(syncedProfile)
      await saveUserProfile(syncedProfile)
      if (page === 'profile' && discoveryEventId) navigate('events')
    } catch (error) {
      setErrorMessage(
        `Profile is saved on this device, but Firebase sync failed: ${
          error instanceof Error ? error.message : 'unknown Firebase error'
        }`,
      )
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
        dateOptions,
        capacity: Number(hostForm.capacity) || 12,
        attendees: 0,
        createdAt: new Date().toISOString(),
      }

      await saveEventItem(nextEvent)
      setEvents((current) => [nextEvent, ...current.filter((item) => item.id !== nextEvent.id)])
      setHostForm(emptyHostForm)
      setEventFormFeedback({
        type: 'success',
        message: `Event '${nextEvent.title}' has been published successfully!`,
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

    const updatedEvent = await updateEventItem(event)
    setEvents((current) =>
      current.map((item) => (item.id === updatedEvent.id ? updatedEvent : item)),
    )
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
  ) => {
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

    const draft = requestDrafts[eventItem.id] ?? { ...emptyDraft }
    const selectedDates = draft.dates
    const attendeeCount =
      activeProfile.profileType === 'student' ? 1 : Number(draft.attendeeCount)
    if (selectedDates.length === 0) {
      setErrorMessage('Choose at least one date before sending your request.')
      return false
    }

    if (!selectedDates.every((date) => eventItem.dateOptions.indexOf(date) !== -1)) {
      setErrorMessage('Choose dates from the event’s current availability.')
      return false
    }
    if (!Number.isInteger(attendeeCount) || attendeeCount < 1) {
      setErrorMessage('Participant count must be a whole number of at least one.')
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
    if (eventRequests.some((request) => request.id === requestId)) {
      setErrorMessage('A request for this event has already been sent from this profile.')
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
    }

    try {
      await saveEventRequest(newRequest)
      setEventRequests((current) => current.some((request) => request.id === newRequest.id)
        ? current : [newRequest, ...current])
      setRequestDrafts((current) => ({
        ...current,
        [eventItem.id]: { ...emptyDraft },
      }))
      setStatusMessage('')
      setErrorMessage(null)
      return true
    } catch (error) {
      setErrorMessage(
        `Could not send your request: ${
          error instanceof Error ? error.message : 'unknown Firebase error'
        }`,
      )
      return false
    }
  }

  const markNotificationRead = (noticeId: string) => {
    setReadNotificationIds((current) =>
      current.indexOf(noticeId) !== -1 ? current : [...current, noticeId],
    )
  }

  const handleResolveRequest = async (
    eventRequest: EventRequest,
    status: Extract<EventRequest['status'], 'accepted' | 'declined'>,
  ) => {
    if (!authUserId || activeProfile?.ownerId !== authUserId) {
      setErrorMessage('Sign in to the event host account before responding to requests.')
      return
    }
    if (
      activeProfile.profileType !== 'organization' ||
      eventRequest.hostOwnerId !== authUserId ||
      eventRequest.hostProfileId !== activeProfile.id
    ) {
      setErrorMessage('You are not authorized to respond to this request.')
      return
    }

    try {
      await resolveEventRequest(eventRequest, status, authUserId, activeProfile.id)
      setStatusMessage(
        `The ${eventRequest.requestType === 'cohost' ? 'co-hosting' : 'participation'} request was ${status}.`,
      )
      setErrorMessage(null)
    } catch (error) {
      setErrorMessage(
        `Could not ${status === 'accepted' ? 'accept' : 'decline'} the request: ${
          error instanceof Error ? error.message : 'unknown Firebase error'
        }`,
      )
    }
  }

  const handleSelectProfile = (profileId: string) => {
    const selectedProfile = profiles.find((profile) => profile.id === profileId)
    if (!selectedProfile) return
    saveActiveProfileId(selectedProfile.id)
    setActiveProfile(selectedProfile)
    setRequestDrafts({})
    setEventRequests([])
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
        : `${request.requesterName} requested ${request.attendeeCount} ${
            request.attendeeCount === 1 ? 'spot' : 'spots'
          } for ${request.eventTitle}.`,
      type: isOutgoing ? 'outgoing' : 'incoming',
      relatedEventId: request.eventId,
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
    <div className="app-shell">
      <a className="skip-link" href="#main-content" onClick={(event) => {
        event.preventDefault()
        const main = document.getElementById('main-content')
        main?.focus()
        main?.scrollIntoView?.({ block: 'start' })
      }}>Skip to content</a>
      <header className="site-header">
        <div className="header-inner">
          <a href="#home" className="wordmark" aria-label="CoHost home"><span className="brand-symbol" aria-hidden="true">co.</span><h1>CoHost</h1></a>
          <nav aria-label="Main navigation">
            {([
              ['home', 'Home'], ['events', 'Find an event'], ['host', 'Create an event'],
              ...(activeProfile?.profileType === 'organization' ? [['manage', 'My events']] : []),
              ['inbox', 'Inbox'], ['profile', 'Profile'],
            ] as [WorkspacePage, string][]).map(([destination, label]) => (
              <a key={destination} href={`#${destination}`} aria-current={page === destination ? 'page' : undefined}>
                {label}
              </a>
            ))}
          </nav>
          <button type="button" onClick={handleContinueWithoutEmail} className="button-secondary account-button">{authUserId ? 'Account saved on this device' : 'Continue without email'}</button>
        </div>
      </header>

      <main id="main-content" className="main-content" tabIndex={-1}>
        {statusMessage ? (
          <div aria-live="polite" className="status-note">
            {statusMessage}
          </div>
        ) : null}
        {errorMessage ? (
          <div
            role="alert"
            className="error-note"
          >
            {errorMessage}
          </div>
        ) : null}
        {page === 'home' ? <WorkspaceHome profile={activeProfile} /> : activeProfile?.profileType === 'organization' ? (
          <OrganizationDashboard
            page={page}
            discoveryEventId={discoveryEventId}
            onSelectDiscoveryEvent={setDiscoveryEventId}
            activeProfile={activeProfile}
            profiles={profiles}
            authUserId={authUserId}
            events={events}
            inbox={inbox}
            collaborationRequests={activeProfileRequests}
            profileForm={profileForm}
            hostForm={hostForm}
            requestDrafts={requestDrafts}
            eventFormFeedback={eventFormFeedback}
            eventFeedbackRef={eventFeedbackRef}
            isPublishing={isPublishing}
            onSelectProfile={handleSelectProfile}
            onCreateProfile={handleCreateProfile}
            onProfileFieldChange={handleProfileFieldChange}
            onHostFieldChange={handleHostFieldChange}
            onHostRangeChange={(startDate, endDate) => {
              setEventFormFeedback(null)
              setHostForm((current) => ({ ...current, startDate, endDate }))
            }}
            onHostEvent={handleHostEvent}
            onResetHostForm={() => setEventFormFeedback(null)}
            onUpdateEvent={handleUpdateEvent}
            onDeleteEvent={handleDeleteEvent}
            onDraftChange={handleRequestDraftChange}
            onDatesChange={handleRequestDatesChange}
            onRequest={handleJoinRequest}
            onResolveRequest={(request, status) => handleResolveRequest(request, status)}
            onMarkRead={markNotificationRead}
          />
        ) : (
          <StudentDashboard
            page={page}
            discoveryEventId={discoveryEventId}
            onSelectDiscoveryEvent={setDiscoveryEventId}
            requests={activeProfileRequests}
            activeProfile={activeProfile}
            profiles={profiles}
            authUserId={authUserId}
            events={events}
            inbox={inbox}
            profileForm={profileForm}
            requestDrafts={requestDrafts}
            onSelectProfile={handleSelectProfile}
            onCreateProfile={handleCreateProfile}
            onProfileFieldChange={handleProfileFieldChange}
            onDraftChange={handleRequestDraftChange}
            onDatesChange={handleRequestDatesChange}
            onRequest={handleJoinRequest}
            onMarkRead={markNotificationRead}
          />
        )}
        <footer className="site-footer"><span>CoHost</span><button type="button" onClick={() => {
          window.scrollTo({ top: 0, behavior: 'instant' })
        }}>Back to top</button></footer>
      </main>
    </div>
  )
}

export default App
