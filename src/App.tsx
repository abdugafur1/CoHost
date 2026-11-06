import { type ChangeEvent, type FormEvent, useEffect, useRef, useState } from 'react'
import './App.css'
import {
  continueWithoutEmail,
  DuplicateEventTitleError,
  deleteEventItem,
  saveUserProfile,
  saveEventItem,
  saveEventRequest,
  subscribeAuthUser,
  subscribeEvents,
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

const App = () => {
  const [initialProfileState] = useState(loadInitialProfileState)
  const [profiles, setProfiles] = useState<UserProfile[]>(initialProfileState.profiles)
  const [activeProfile, setActiveProfile] = useState<UserProfile | null>(
    initialProfileState.activeProfile,
  )
  const [events, setEvents] = useState<EventItem[]>([])
  const [inbox, setInbox] = useState<InboxNotice[]>([])
  const [authUserId, setAuthUserId] = useState<string | null>(null)
  const [profileForm, setProfileForm] = useState(emptyProfileForm)
  const [hostForm, setHostForm] = useState(emptyHostForm)
  const [requestDrafts, setRequestDrafts] = useState<Record<string, RequestDraftValues>>({})
  const [collaborationRequests, setCollaborationRequests] = useState<EventRequest[]>([])
  const [statusMessage, setStatusMessage] = useState('Create a profile to get started.')
  const [errorMessage, setErrorMessage] = useState<string | null>(initialProfileState.error)
  const [eventFormFeedback, setEventFormFeedback] = useState<{
    type: 'success' | 'error'
    message: string
  } | null>(null)
  const [isPublishing, setIsPublishing] = useState(false)
  const publishingRef = useRef(false)
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
          setAuthUserId(nextUserId)
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
    if (!authUserId) return

    return subscribeUserProfiles(
      authUserId,
      (savedProfiles) => {
        try {
          const localProfiles = loadLocalProfiles()
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
      const localProfiles = loadLocalProfiles()
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
    if (!activeProfile) {
      setErrorMessage('Create a profile before requesting to join an event.')
      return
    }

    if (
      (requestKind === 'participation' && activeProfile.profileType !== 'student') ||
      (requestKind === 'cohost' && activeProfile.profileType !== 'organization')
    ) {
      setErrorMessage('Switch to the matching profile type to submit this request.')
      return
    }

    if (
      eventItem.hostId === activeProfile.id ||
      eventItem.hostOwnerId === activeProfile.ownerId
    ) {
      setErrorMessage('You cannot request to join an event hosted by your account.')
      return
    }

    if (eventItem.audience === 'organizations' && activeProfile.profileType !== 'organization') {
      setErrorMessage('This event is open to organizations only.')
      return
    }

    const draft = requestDrafts[eventItem.id] ?? { ...emptyDraft }
    const selectedDates = draft.dates.length > 0 ? draft.dates : eventItem.dateOptions.slice(0, 1)
    const attendeeCount =
      activeProfile.profileType === 'student' ? 1 : Number(draft.attendeeCount) || 1
    if (selectedDates.length === 0) {
      setErrorMessage('Choose at least one date before sending your request.')
      return
    }

    const openSpots = eventItem.capacity - eventItem.attendees
    if (requestKind === 'participation' && attendeeCount > openSpots) {
      setErrorMessage(`Only ${openSpots} spots remain for this event.`)
      return
    }

    const newRequest: EventRequest = {
      id: crypto.randomUUID(),
      eventId: eventItem.id,
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

    if (requestKind === 'participation') {
      setEvents((current) =>
        current.map((item) =>
          item.id === eventItem.id
            ? {
                ...item,
                attendees: Math.min(item.capacity, item.attendees + attendeeCount),
              }
            : item,
        ),
      )
    }

    const newNotices: InboxNotice[] = [
      {
        id: crypto.randomUUID(),
        title:
          requestKind === 'cohost'
            ? `Co-hosting request sent to ${eventItem.hostName}`
            : `Participation request sent to ${eventItem.hostName}`,
        message:
          requestKind === 'cohost'
            ? `${activeProfile.name} asked to co-host ${eventItem.title} on ${selectedDates.join(', ')}.`
            : `${activeProfile.name} requested ${attendeeCount} ${
                attendeeCount === 1 ? 'spot' : 'spots'
              } on ${selectedDates.join(', ')}.`,
        type: 'outgoing',
        relatedEventId: eventItem.id,
        createdAt: new Date().toISOString(),
        isRead: false,
      },
      ...(requestKind === 'participation'
        ? [
            {
              id: crypto.randomUUID(),
              title: `New participation request for ${eventItem.title}`,
              message: `${activeProfile.name} (${activeProfile.profileType}) wants to join on ${selectedDates.join(', ')} with ${attendeeCount} ${
                attendeeCount === 1 ? 'person' : 'people'
              }.`,
              type: 'incoming' as const,
              relatedEventId: eventItem.id,
              createdAt: new Date().toISOString(),
              isRead: false,
            },
          ]
        : []),
    ]
    setInbox((current) => [...newNotices, ...current])

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

    try {
      await saveEventRequest(newRequest)
      if (requestKind === 'cohost') {
        setCollaborationRequests((current) => [newRequest, ...current])
      }
    } catch {
      setErrorMessage('Request saved in the inbox locally, but Firebase write was unavailable.')
    }
  }

  const markNotificationRead = (noticeId: string) => {
    setInbox((current) =>
      current.map((notice) =>
        notice.id === noticeId
          ? {
              ...notice,
              isRead: true,
            }
          : notice,
      ),
    )
  }

  const handleSelectProfile = (profileId: string) => {
    const selectedProfile = profiles.find((profile) => profile.id === profileId)
    if (!selectedProfile) return
    saveActiveProfileId(selectedProfile.id)
    setActiveProfile(selectedProfile)
  }

  const handleRequestDatesChange = (eventId: string, dates: string[]) => {
    setRequestDrafts((current) => ({
      ...current,
      [eventId]: { ...(current[eventId] ?? { ...emptyDraft }), dates },
    }))
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 bg-slate-950/80 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-5">
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-cyan-300">Campus co-hosting</p>
            <h1 className="text-3xl font-black text-white">CoHost</h1>
          </div>
          <button
            type="button"
            onClick={handleContinueWithoutEmail}
            className="rounded-full border border-cyan-400 bg-cyan-500/10 px-4 py-2 text-sm font-semibold text-cyan-200 transition hover:bg-cyan-500/20"
          >
            {authUserId ? 'Account saved on this device' : 'Continue without email'}
          </button>
        </div>
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
        {activeProfile?.profileType === 'organization' ? (
          <OrganizationDashboard
            activeProfile={activeProfile}
            profiles={profiles}
            authUserId={authUserId}
            events={events}
            inbox={inbox}
            collaborationRequests={collaborationRequests.filter(
              (request) => request.requesterProfileId === activeProfile.id,
            )}
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
            onUpdateEvent={handleUpdateEvent}
            onDeleteEvent={handleDeleteEvent}
            onDraftChange={handleRequestDraftChange}
            onDatesChange={handleRequestDatesChange}
            onRequest={(eventItem, requestKind) => void handleJoinRequest(eventItem, requestKind)}
            onMarkRead={markNotificationRead}
          />
        ) : (
          <StudentDashboard
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
            onRequest={(eventItem, requestKind) => void handleJoinRequest(eventItem, requestKind)}
            onMarkRead={markNotificationRead}
          />
        )}
      </main>
    </div>
  )
}

export default App
