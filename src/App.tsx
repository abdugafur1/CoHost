import { type ChangeEvent, type FormEvent, useEffect, useMemo, useState } from 'react'
import './App.css'
import {
  continueWithoutEmail,
  saveUserProfile,
  saveEventItem,
  saveEventRequest,
  subscribeAuthUser,
  subscribeEvents,
  subscribeUserProfiles,
} from './services/cohost'
import {
  getLocalDeviceId,
  loadActiveProfileId,
  loadLocalProfiles,
  saveActiveProfileId,
  saveLocalProfiles,
} from './services/localPersistence'
import CalendarPicker from './components/CalendarPicker'
import type {
  EventAudience,
  EventItem,
  EventRequest,
  InboxNotice,
  ProfileType,
  UserProfile,
} from './types'

const emptyProfileForm = {
  name: '',
  profileType: 'student' as ProfileType,
  focus: 'General club activities',
  location: '',
  description: '',
}

const emptyHostForm = {
  title: '',
  location: '',
  startDate: '',
  endDate: '',
  capacity: '12',
  description: '',
  audience: 'everyone' as EventAudience,
}

const emptyDraft = {
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

const formatDateLabel = (date: string) => {
  const [year, month, day] = date.split('-').map(Number)
  return new Date(year, month - 1, day).toLocaleDateString(undefined, {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
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
  const [requestDrafts, setRequestDrafts] = useState<Record<string, typeof emptyDraft>>({})
  const [statusMessage, setStatusMessage] = useState('Create a profile to get started.')
  const [errorMessage, setErrorMessage] = useState<string | null>(initialProfileState.error)
  const [eventFormFeedback, setEventFormFeedback] = useState<{
    type: 'success' | 'error'
    message: string
  } | null>(null)

  const totalOpenSpots = useMemo(
    () => events.reduce((sum, event) => sum + Math.max(event.capacity - event.attendees, 0), 0),
    [events],
  )
  const canHostEvents = activeProfile?.profileType === 'organization'

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

    try {
      await saveEventItem(nextEvent)
      setEvents((current) => [nextEvent, ...current.filter((item) => item.id !== nextEvent.id)])
      setHostForm(emptyHostForm)
      setEventFormFeedback({
        type: 'success',
        message: `${nextEvent.title} was posted to the event board.`,
      })
    } catch (error) {
      setEventFormFeedback({
        type: 'error',
        message: `Could not save the event: ${
          error instanceof Error ? error.message : 'unknown Firebase error'
        }`,
      })
    }
  }

  const handleJoinRequest = async (eventItem: EventItem) => {
    if (!activeProfile) {
      setErrorMessage('Create a profile before requesting to join an event.')
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
    const openSpots = eventItem.capacity - eventItem.attendees

    if (selectedDates.length === 0) {
      setErrorMessage('Choose at least one date before sending your request.')
      return
    }

    if (attendeeCount > openSpots) {
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
      message: draft.message.trim() || 'Interested in co-hosting this event.',
      status: 'pending',
      createdAt: new Date().toISOString(),
    }

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

    setInbox((current) => [
      {
        id: crypto.randomUUID(),
        title: `Request sent to ${eventItem.hostName}`,
        message: `${activeProfile.name} (${activeProfile.profileType}) requested ${attendeeCount} ${
          attendeeCount === 1 ? 'spot' : 'spots'
        } on ${selectedDates.join(', ')}.`,
        type: 'outgoing',
        relatedEventId: eventItem.id,
        createdAt: new Date().toISOString(),
        isRead: false,
      },
      {
        id: crypto.randomUUID(),
        title: `New request for ${eventItem.title}`,
        message: `${activeProfile.name} (${activeProfile.profileType}) wants to join on ${selectedDates.join(', ')} with ${attendeeCount} ${
          attendeeCount === 1 ? 'person' : 'people'
        }.`,
        type: 'incoming',
        relatedEventId: eventItem.id,
        createdAt: new Date().toISOString(),
        isRead: false,
      },
      ...current,
    ])

    setRequestDrafts((current) => ({
      ...current,
      [eventItem.id]: { ...emptyDraft },
    }))
    setStatusMessage(`Your request for ${eventItem.title} has been sent.`)
    setErrorMessage(null)

    try {
      await saveEventRequest(newRequest)
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
          <div role="alert" className="mb-6 rounded-2xl border border-rose-500/50 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
            {errorMessage}
          </div>
        ) : null}

        <section className="grid gap-6 lg:grid-cols-[1.35fr_0.65fr]">
          <div className="space-y-6">
            <div className="panel">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm uppercase tracking-[0.2em] text-slate-400">Overview</p>
                  <h2 className="mt-2 text-2xl font-bold text-white">Community event activity</h2>
                </div>
                <span className="rounded-full border border-slate-700 bg-slate-800 px-3 py-1 text-xs font-medium text-slate-200">
                  {events.length} events live
                </span>
              </div>

              <div className="mt-6 grid gap-4 md:grid-cols-3">
                <div className="rounded-2xl border border-slate-700 bg-slate-900 p-4">
                  <p className="text-sm text-slate-400">Open slots</p>
                  <p className="mt-2 text-3xl font-bold text-cyan-300">{totalOpenSpots}</p>
                </div>
                <div className="rounded-2xl border border-slate-700 bg-slate-900 p-4">
                  <p className="text-sm text-slate-400">Profiles created</p>
                  <p className="mt-2 text-3xl font-bold text-violet-300">{profiles.length}</p>
                </div>
                <div className="rounded-2xl border border-slate-700 bg-slate-900 p-4">
                  <p className="text-sm text-slate-400">Inbox</p>
                  <p className="mt-2 text-3xl font-bold text-emerald-300">{inbox.length}</p>
                </div>
              </div>
            </div>

            <div className="panel">
              <h2 className="text-2xl font-bold text-white">Host a co-hosted event</h2>
              {!canHostEvents ? (
                <p className="mt-2 text-sm text-slate-400">
                  {activeProfile
                    ? 'Only student organizations can post events. Switch to an organization profile to host one.'
                    : 'Create a student organization profile to post an event.'}
                </p>
              ) : null}

              <form className="mt-6 space-y-4" onSubmit={handleHostEvent}>
                <fieldset
                  disabled={!canHostEvents}
                  className="space-y-4 disabled:opacity-50"
                >
                <div className="grid gap-4 md:grid-cols-2">
                  <label className="space-y-2 text-sm text-slate-200">
                    <span>Event title</span>
                    <input
                      aria-label="Event title"
                      name="title"
                      value={hostForm.title}
                      onChange={handleHostFieldChange}
                      className="input"
                      placeholder="Campus wellness fair"
                    />
                  </label>

                  <label className="space-y-2 text-sm text-slate-200">
                    <span>Location</span>
                    <input
                      aria-label="Event location"
                      name="location"
                      value={hostForm.location}
                      onChange={handleHostFieldChange}
                      className="input"
                      placeholder="Student activity center"
                    />
                  </label>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <label className="space-y-2 text-sm text-slate-200">
                    <span>Capacity</span>
                    <input
                      aria-label="Event capacity"
                      name="capacity"
                      type="number"
                      min="1"
                      value={hostForm.capacity}
                      onChange={handleHostFieldChange}
                      className="input"
                    />
                  </label>
                </div>

                <fieldset>
                  <legend className="mb-2 text-sm text-slate-200">Event dates</legend>
                  <CalendarPicker
                    mode="range"
                    startDate={hostForm.startDate}
                    endDate={hostForm.endDate}
                    onRangeChange={(startDate, endDate) => {
                      setEventFormFeedback(null)
                      setHostForm((current) => ({ ...current, startDate, endDate }))
                    }}
                  />
                </fieldset>

                <label className="block space-y-2 text-sm text-slate-200">
                  <span>Who can join?</span>
                  <select
                    aria-label="Event audience"
                    name="audience"
                    value={hostForm.audience}
                    onChange={handleHostFieldChange}
                    className="input"
                  >
                    <option value="everyone">Everyone (students and organizations)</option>
                    <option value="organizations">Organizations only</option>
                  </select>
                </label>

                <label className="block space-y-2 text-sm text-slate-200">
                  <span>Short description</span>
                  <textarea
                    aria-label="Event description"
                    name="description"
                    value={hostForm.description}
                    onChange={handleHostFieldChange}
                    className="input min-h-28"
                    placeholder="Tell other clubs how you want to collaborate and what your event needs."
                  />
                </label>

                <button type="submit" className="button-primary disabled:cursor-not-allowed">
                  Post event
                </button>
                {eventFormFeedback ? (
                  <p
                    role={eventFormFeedback.type === 'error' ? 'alert' : 'status'}
                    className={
                      eventFormFeedback.type === 'error'
                        ? 'text-sm text-rose-200'
                        : 'text-sm text-emerald-200'
                    }
                  >
                    {eventFormFeedback.message}
                  </p>
                ) : null}
                </fieldset>
              </form>
            </div>
          </div>

          <aside className="space-y-6">
            <div className="panel">
              <p className="text-sm uppercase tracking-[0.2em] text-slate-400">Active profile</p>
              {activeProfile ? (
                <>
                  {profiles.length > 1 ? (
                    <label className="mt-3 block space-y-2 text-sm text-slate-200">
                      <span>Use CoHost as</span>
                      <select
                        aria-label="Active profile"
                        value={activeProfile.id}
                        onChange={(event) => {
                          const selectedProfile = profiles.find(
                            (profile) => profile.id === event.target.value,
                          )
                          if (selectedProfile) {
                            saveActiveProfileId(selectedProfile.id)
                            setActiveProfile(selectedProfile)
                          }
                        }}
                        className="input"
                      >
                        {profiles.map((profile) => (
                          <option key={profile.id} value={profile.id}>
                            {profile.name} — {profile.profileType}
                          </option>
                        ))}
                      </select>
                    </label>
                  ) : null}
                  <h2 className="mt-4 text-2xl font-bold text-white">{activeProfile.name}</h2>
                  <p className="mt-2 inline-flex rounded-full border border-cyan-500/40 bg-cyan-500/10 px-3 py-1 text-xs font-semibold capitalize text-cyan-200">
                    {activeProfile.profileType}
                  </p>
                  <p className="mt-3 text-sm text-slate-300">{activeProfile.focus}</p>
                  <dl className="mt-4 space-y-2 text-sm text-slate-300">
                    <div className="flex items-center justify-between gap-3 border-b border-slate-800 pb-2">
                      <dt>Location</dt>
                      <dd>{activeProfile.location}</dd>
                    </div>
                    <div className="flex items-center justify-between gap-3 border-b border-slate-800 pb-2">
                      <dt>Profile status</dt>
                      <dd>{authUserId ? 'Saved on this device' : 'Guest mode'}</dd>
                    </div>
                  </dl>
                  <p className="mt-4 text-sm text-slate-300">{activeProfile.description}</p>
                </>
              ) : (
                <p className="mt-3 text-sm text-slate-400">
                  No profile yet. Create one below to get started.
                </p>
              )}
            </div>

            <div className="panel">
              <h2 className="text-2xl font-bold text-white">Create a profile</h2>
              <p className="mt-2 text-sm text-slate-400">
                Identify yourself as a student or an organization. This is included with event requests.
              </p>

              <form className="mt-5 space-y-4" onSubmit={handleCreateProfile}>
                <label className="block space-y-2 text-sm text-slate-200">
                  <span>I am a</span>
                  <select
                    aria-label="Profile type"
                    name="profileType"
                    value={profileForm.profileType}
                    onChange={handleProfileFieldChange}
                    className="input"
                  >
                    <option value="student">Student</option>
                    <option value="organization">Organization or club</option>
                  </select>
                </label>

                <label className="block space-y-2 text-sm text-slate-200">
                  <span>{profileForm.profileType === 'student' ? 'Your name' : 'Organization name'}</span>
                  <input
                    aria-label={profileForm.profileType === 'student' ? 'Your name' : 'Organization name'}
                    name="name"
                    value={profileForm.name}
                    onChange={handleProfileFieldChange}
                    className="input"
                    placeholder={profileForm.profileType === 'student' ? 'Alex Morgan' : 'Northwind Club'}
                  />
                </label>

                <label className="block space-y-2 text-sm text-slate-200">
                  <span>Area of interest</span>
                  <select
                    aria-label="Area of interest"
                    name="focus"
                    value={profileForm.focus}
                    onChange={handleProfileFieldChange}
                    className="input"
                  >
                    <option>General club activities</option>
                    <option>Martial arts and team events</option>
                    <option>Outdoor and recreation</option>
                    <option>STEM and maker projects</option>
                    <option>Arts and cultural programming</option>
                  </select>
                </label>

                <label className="block space-y-2 text-sm text-slate-200">
                  <span>Location</span>
                  <input
                    aria-label="Profile location"
                    name="location"
                    value={profileForm.location}
                    onChange={handleProfileFieldChange}
                    className="input"
                    placeholder="North campus"
                  />
                </label>

                <label className="block space-y-2 text-sm text-slate-200">
                  <span>About you</span>
                  <textarea
                    aria-label="Profile description"
                    name="description"
                    value={profileForm.description}
                    onChange={handleProfileFieldChange}
                    className="input min-h-24"
                    placeholder="Share what kinds of events you want to attend or host."
                  />
                </label>

                <button type="submit" className="button-primary">
                  Save profile
                </button>
              </form>
            </div>

            <div className="panel">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-2xl font-bold text-white">Inbox</h2>
                <span className="rounded-full border border-slate-700 bg-slate-900 px-2.5 py-1 text-xs font-medium text-slate-300">
                  {inbox.filter((entry) => !entry.isRead).length} new
                </span>
              </div>

              <div className="mt-5 space-y-3">
                {inbox.length === 0 ? (
                  <p className="text-sm text-slate-400">Your inbox is empty.</p>
                ) : (
                  inbox.map((notice) => (
                    <article
                      key={notice.id}
                      className={`rounded-2xl border p-4 ${
                        notice.isRead ? 'border-slate-800 bg-slate-900/80' : 'border-cyan-500/40 bg-slate-900'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-4">
                        <p className="text-sm font-semibold text-white">{notice.title}</p>
                        <span className="rounded-full border border-slate-700 px-2 py-0.5 text-[10px] uppercase tracking-wide text-slate-300">
                          {notice.type}
                        </span>
                      </div>
                      <p className="mt-2 text-sm text-slate-300">{notice.message}</p>
                      <div className="mt-3 flex items-center justify-between gap-3">
                        <span className="text-[11px] uppercase tracking-wide text-slate-500">
                          {new Date(notice.createdAt).toLocaleDateString()}
                        </span>
                        {!notice.isRead ? (
                          <button
                            type="button"
                            onClick={() => markNotificationRead(notice.id)}
                            className="text-xs font-medium text-cyan-300 hover:text-cyan-200"
                          >
                            Mark read
                          </button>
                        ) : null}
                      </div>
                    </article>
                  ))
                )}
              </div>
            </div>
          </aside>
        </section>

        <section className="mt-8 panel">
          <div className="mb-6 flex items-center justify-between gap-3">
            <div>
              <p className="text-sm uppercase tracking-[0.2em] text-slate-400">Opportunities</p>
              <h2 className="mt-2 text-2xl font-bold text-white">Available community events</h2>
            </div>
            <span className="rounded-full border border-slate-700 bg-slate-900 px-3 py-1 text-xs font-medium text-slate-300">
              {events.length} opportunities
            </span>
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            {events.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-slate-700 px-5 py-8 text-sm text-slate-400 lg:col-span-2">
                No events have been posted yet.
              </p>
            ) : null}
            {events.map((event) => {
              const draft = requestDrafts[event.id] ?? { ...emptyDraft }

              return (
                <article key={event.id} className="rounded-3xl border border-slate-800 bg-slate-900 p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs uppercase tracking-[0.2em] text-cyan-300">
                        Hosted by {event.hostName} · {event.hostProfileType}
                      </p>
                      <h3 className="mt-2 text-2xl font-bold text-white">{event.title}</h3>
                    </div>
                    <span className="rounded-full border border-emerald-500/50 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-200">
                      {Math.max(event.capacity - event.attendees, 0)} open
                    </span>
                  </div>

                  <p className="mt-4 text-sm text-slate-300">{event.description}</p>

                  <dl className="mt-4 space-y-2 text-sm text-slate-300">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                      <dt>Location</dt>
                      <dd>{event.location}</dd>
                    </div>
                    <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                      <dt>Capacity</dt>
                      <dd>{event.capacity} total</dd>
                    </div>
                    <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                      <dt>Attendees</dt>
                      <dd>{event.attendees}</dd>
                    </div>
                    <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                      <dt>Open to</dt>
                      <dd>{event.audience === 'everyone' ? 'Students and organizations' : 'Organizations only'}</dd>
                    </div>
                  </dl>

                  <p className="mt-4 text-sm text-slate-300">
                    Dates: {formatDateLabel(event.dateOptions[0])} –{' '}
                    {formatDateLabel(event.dateOptions[event.dateOptions.length - 1])}
                  </p>

                  {activeProfile &&
                  (event.hostId === activeProfile.id ||
                    event.hostOwnerId === activeProfile.ownerId) ? (
                    <p className="mt-5 border-t border-slate-800 pt-5 text-sm text-slate-400">
                      You are hosting this event and cannot request to join it.
                    </p>
                  ) : event.audience === 'organizations' &&
                    activeProfile?.profileType === 'student' ? (
                    <p className="mt-5 border-t border-slate-800 pt-5 text-sm text-amber-200">
                      This event is open to organizations only. Switch to an organization profile to request a spot.
                    </p>
                  ) : (
                    <form
                      className="mt-5 space-y-4 border-t border-slate-800 pt-5"
                      onSubmit={(submitEvent) => {
                        submitEvent.preventDefault()
                        void handleJoinRequest(event)
                      }}
                    >
                      <p className="text-sm text-slate-300">
                        Requesting as{' '}
                        <span className="font-semibold capitalize text-cyan-200">
                          {activeProfile?.profileType}
                        </span>{' '}
                        · {activeProfile?.name}
                      </p>
                      <fieldset>
                        <legend className="mb-2 text-sm font-medium text-slate-200">
                          Your availability
                        </legend>
                        <CalendarPicker
                          key={`${event.id}-${event.dateOptions[0]}`}
                          mode="availability"
                          availableDates={event.dateOptions}
                          selectedDates={draft.dates}
                          onDatesChange={(dates) =>
                            setRequestDrafts((current) => ({
                              ...current,
                              [event.id]: {
                                ...(current[event.id] ?? { ...emptyDraft }),
                                dates,
                              },
                            }))
                          }
                        />
                      </fieldset>

                      {activeProfile?.profileType === 'organization' ? (
                        <div className="grid gap-4 md:grid-cols-[130px_1fr]">
                          <label className="space-y-2 text-sm text-slate-200">
                            <span>People attending</span>
                            <input
                              aria-label={`Participant count for ${event.title}`}
                              type="number"
                              min="1"
                              max={Math.max(event.capacity - event.attendees, 1)}
                              value={draft.attendeeCount}
                              onChange={(inputEvent) =>
                                handleRequestDraftChange(
                                  event.id,
                                  'attendeeCount',
                                  inputEvent.target.value,
                                )
                              }
                              className="input"
                            />
                          </label>
                        </div>
                      ) : (
                        <p className="text-sm text-slate-400">Your request is for one student.</p>
                      )}

                      <label className="block space-y-2 text-sm text-slate-200">
                        <span>Message</span>
                        <textarea
                          aria-label={`Message for ${event.title}`}
                          value={draft.message}
                          onChange={(inputEvent) =>
                            handleRequestDraftChange(event.id, 'message', inputEvent.target.value)
                          }
                          className="input min-h-20"
                          placeholder="Tell the host why you or your organization would like to join."
                        />
                      </label>

                      <button
                        type="submit"
                        disabled={event.capacity <= event.attendees}
                        className="button-primary w-full disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {event.capacity <= event.attendees ? 'Event full' : 'Send request'}
                      </button>
                    </form>
                  )}
                </article>
              )
            })}
          </div>
        </section>
      </main>
    </div>
  )
}

export default App
