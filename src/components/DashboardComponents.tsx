import { useState, type ChangeEvent, type FormEvent, type RefObject } from 'react'
import CalendarPicker from './CalendarPicker'
import type { EventItem, EventRequest, InboxNotice, ProfileType, UserProfile } from '../types'

export interface ProfileFormValues {
  name: string
  profileType: ProfileType
  focus: string
  location: string
  description: string
}

export interface HostFormValues {
  title: string
  location: string
  startDate: string
  endDate: string
  capacity: string
  description: string
  audience: 'everyone' | 'organizations'
}

export interface RequestDraftValues {
  dates: string[]
  attendeeCount: string
  message: string
}

interface ProfilePanelProps {
  activeProfile: UserProfile | null
  profiles: UserProfile[]
  authUserId: string | null
  onSelectProfile: (profileId: string) => void
}

export const ProfilePanel = ({
  activeProfile,
  profiles,
  authUserId,
  onSelectProfile,
}: ProfilePanelProps) => (
  <section className="panel" aria-labelledby="active-profile-heading">
    <p className="text-sm uppercase tracking-[0.2em] text-slate-400">Active profile</p>
    {activeProfile ? (
      <>
        {profiles.length > 1 ? (
          <label className="mt-3 block space-y-2 text-sm text-slate-200">
            <span>Use CoHost as</span>
            <select
              aria-label="Active profile"
              value={activeProfile.id}
              onChange={(event) => onSelectProfile(event.target.value)}
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
        <h2 id="active-profile-heading" className="mt-4 text-2xl font-bold text-white">
          {activeProfile.name}
        </h2>
        <p className="mt-2 inline-flex rounded-full border border-cyan-500/40 bg-cyan-500/10 px-3 py-1 text-xs font-semibold capitalize text-cyan-200">
          {activeProfile.profileType}
        </p>
        {activeProfile.profileType === 'organization' ? (
          <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            Organization profile · not verified administrator authorization
          </p>
        ) : null}
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
  </section>
)

interface CreateProfileFormProps {
  profileForm: ProfileFormValues
  onFieldChange: (
    event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
  ) => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
}

export const CreateProfileForm = ({
  profileForm,
  onFieldChange,
  onSubmit,
}: CreateProfileFormProps) => (
  <section className="panel">
    <h2 className="text-2xl font-bold text-white">Create a profile</h2>
    <p className="mt-2 text-sm text-slate-400">
      Identify yourself as a student or an organization. This is included with event requests.
    </p>
    <form className="mt-5 space-y-4" onSubmit={onSubmit}>
      <label className="block space-y-2 text-sm text-slate-200">
        <span>I am a</span>
        <select
          aria-label="Profile type"
          name="profileType"
          value={profileForm.profileType}
          onChange={onFieldChange}
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
          onChange={onFieldChange}
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
          onChange={onFieldChange}
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
          onChange={onFieldChange}
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
          onChange={onFieldChange}
          className="input min-h-24"
          placeholder="Share what kinds of events you want to attend or host."
        />
      </label>
      <button type="submit" className="button-primary">
        Save profile
      </button>
    </form>
  </section>
)

interface InboxPanelProps {
  inbox: InboxNotice[]
  onMarkRead: (noticeId: string) => void
}

export const InboxPanel = ({ inbox, onMarkRead }: InboxPanelProps) => (
  <section className="panel">
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
                  onClick={() => onMarkRead(notice.id)}
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
  </section>
)

interface EventListProps {
  events: EventItem[]
  activeProfile: UserProfile | null
  requestDrafts: Record<string, RequestDraftValues>
  requestKind: 'participation' | 'cohost'
  onDraftChange: (eventId: string, field: 'attendeeCount' | 'message', value: string) => void
  onDatesChange: (eventId: string, dates: string[]) => void
  onRequest: (event: EventItem, requestKind: 'participation' | 'cohost') => void
}

const formatDateLabel = (date: string) => {
  const [year, month, day] = date.split('-').map(Number)
  return new Date(year, month - 1, day).toLocaleDateString(undefined, {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

export const EventList = ({
  events,
  activeProfile,
  requestDrafts,
  requestKind,
  onDraftChange,
  onDatesChange,
  onRequest,
}: EventListProps) => (
  <section className="panel" aria-labelledby="opportunities-heading">
    <div className="mb-6 flex items-center justify-between gap-3">
      <div>
        <p className="text-sm uppercase tracking-[0.2em] text-slate-400">
          {requestKind === 'cohost' ? 'Collaboration opportunities' : 'Opportunities'}
        </p>
        <h2 id="opportunities-heading" className="mt-2 text-2xl font-bold text-white">
          {requestKind === 'cohost' ? 'Request to co-host' : 'Available community events'}
        </h2>
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
        const draft = requestDrafts[event.id] ?? {
          dates: [],
          attendeeCount: '2',
          message: '',
        }
        const isOwnEvent =
          activeProfile !== null &&
          (event.hostId === activeProfile.id || event.hostOwnerId === activeProfile.ownerId)
        const isFull = event.capacity <= event.attendees

        return (
          <article
            key={event.id}
            className="rounded-3xl border border-slate-800 bg-slate-900 p-5"
          >
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
                <dd>
                  {event.audience === 'everyone' ? 'Students and organizations' : 'Organizations only'}
                </dd>
              </div>
            </dl>
            <p className="mt-4 text-sm text-slate-300">
              Dates: {formatDateLabel(event.dateOptions[0])} –{' '}
              {formatDateLabel(event.dateOptions[event.dateOptions.length - 1])}
            </p>
            {isOwnEvent ? (
              <p className="mt-5 border-t border-slate-800 pt-5 text-sm text-slate-400">
                You are hosting this event and cannot request to join it.
              </p>
            ) : event.audience === 'organizations' &&
              activeProfile?.profileType === 'student' ? (
              <p className="mt-5 border-t border-slate-800 pt-5 text-sm text-amber-200">
                This event is open to organizations only. Switch to an organization profile to request a
                spot.
              </p>
            ) : (
              <form
                className="mt-5 space-y-4 border-t border-slate-800 pt-5"
                onSubmit={(submitEvent) => {
                  submitEvent.preventDefault()
                  onRequest(event, requestKind)
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
                    onDatesChange={(dates) => onDatesChange(event.id, dates)}
                  />
                </fieldset>
                {activeProfile?.profileType === 'organization' ? (
                  <label className="block max-w-xs space-y-2 text-sm text-slate-200">
                    <span>People from your organization</span>
                    <input
                      aria-label={`Participant count for ${event.title}`}
                      type="number"
                      min="1"
                      value={draft.attendeeCount}
                      onChange={(inputEvent) =>
                        onDraftChange(event.id, 'attendeeCount', inputEvent.target.value)
                      }
                      className="input"
                    />
                  </label>
                ) : (
                  <p className="text-sm text-slate-400">Your request is for one student.</p>
                )}
                <label className="block space-y-2 text-sm text-slate-200">
                  <span>{requestKind === 'cohost' ? 'Co-hosting message' : 'Message'}</span>
                  <textarea
                    aria-label={`${requestKind === 'cohost' ? 'Co-hosting message' : 'Message'} for ${event.title}`}
                    value={draft.message}
                    onChange={(inputEvent) =>
                      onDraftChange(event.id, 'message', inputEvent.target.value)
                    }
                    className="input min-h-20"
                    placeholder={
                      requestKind === 'cohost'
                        ? 'Tell the host how your organization would like to collaborate.'
                        : 'Tell the host why you would like to join.'
                    }
                  />
                </label>
                <button
                  type="submit"
                  disabled={requestKind === 'participation' && isFull}
                  className="button-primary w-full disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {requestKind === 'cohost'
                    ? 'Request to Co-Host'
                    : isFull
                      ? 'Event full'
                      : 'Send participation request'}
                </button>
              </form>
            )}
          </article>
        )
      })}
    </div>
  </section>
)

interface HostEventFormProps {
  hostForm: HostFormValues
  feedback: { type: 'success' | 'error'; message: string } | null
  feedbackRef: RefObject<HTMLParagraphElement | null>
  isPublishing: boolean
  onFieldChange: (
    event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
  ) => void
  onRangeChange: (startDate: string, endDate: string) => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
}

export const HostEventForm = ({
  hostForm,
  feedback,
  feedbackRef,
  isPublishing,
  onFieldChange,
  onRangeChange,
  onSubmit,
}: HostEventFormProps) => (
  <section className="panel">
    <h2 className="text-2xl font-bold text-white">Publish an event</h2>
    <p className="mt-2 text-sm text-slate-400">
      This profile can publish events as an organization. Profile type does not verify administrator
      authorization.
    </p>
    <form className="mt-6 space-y-4" onSubmit={onSubmit}>
      <div className="grid gap-4 md:grid-cols-2">
        <label className="space-y-2 text-sm text-slate-200">
          <span>Event title</span>
          <input
            aria-label="Event title"
            name="title"
            value={hostForm.title}
            onChange={onFieldChange}
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
            onChange={onFieldChange}
            className="input"
            placeholder="Student activity center"
          />
        </label>
      </div>
      <label className="block max-w-xs space-y-2 text-sm text-slate-200">
        <span>Capacity</span>
        <input
          aria-label="Event capacity"
          name="capacity"
          type="number"
          min="1"
          value={hostForm.capacity}
          onChange={onFieldChange}
          className="input"
        />
      </label>
      <fieldset>
        <legend className="mb-2 text-sm text-slate-200">Event dates</legend>
        <CalendarPicker
          mode="range"
          startDate={hostForm.startDate}
          endDate={hostForm.endDate}
          onRangeChange={onRangeChange}
        />
      </fieldset>
      <label className="block space-y-2 text-sm text-slate-200">
        <span>Who can join?</span>
        <select
          aria-label="Event audience"
          name="audience"
          value={hostForm.audience}
          onChange={onFieldChange}
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
          onChange={onFieldChange}
          className="input min-h-28"
          placeholder="Tell other clubs how you want to collaborate and what your event needs."
        />
      </label>
      <button
        type="submit"
        disabled={isPublishing}
        className="button-primary disabled:cursor-not-allowed"
      >
        {isPublishing ? 'Publishing...' : 'Post event'}
      </button>
      {feedback ? (
        <p
          ref={feedbackRef}
          role={feedback.type === 'error' ? 'alert' : 'status'}
          className={`event-feedback ${
            feedback.type === 'error' ? 'event-feedback-error' : 'event-feedback-success'
          }`}
        >
          {feedback.message}
        </p>
      ) : null}
    </form>
  </section>
)

interface HostedEventsProps {
  events: EventItem[]
  profile: UserProfile | null
  onUpdate: (event: EventItem) => Promise<void>
  onDelete: (event: EventItem) => Promise<void>
}

interface EventEditValues {
  title: string
  location: string
  startDate: string
  endDate: string
  capacity: string
  description: string
  audience: EventItem['audience']
}

const getDateRange = (startDate: string, endDate: string) => {
  const dates: string[] = []
  const currentDate = new Date(`${startDate}T00:00:00`)
  const finalDate = new Date(`${endDate}T00:00:00`)

  while (currentDate <= finalDate) {
    const monthNumber = currentDate.getMonth() + 1
    const dayNumber = currentDate.getDate()
    const month = monthNumber < 10 ? `0${monthNumber}` : String(monthNumber)
    const day = dayNumber < 10 ? `0${dayNumber}` : String(dayNumber)
    dates.push(`${currentDate.getFullYear()}-${month}-${day}`)
    currentDate.setDate(currentDate.getDate() + 1)
  }

  return dates
}

const eventToEditValues = (event: EventItem): EventEditValues => ({
  title: event.title,
  location: event.location,
  startDate: event.dateOptions[0] ?? '',
  endDate: event.dateOptions[event.dateOptions.length - 1] ?? '',
  capacity: String(event.capacity),
  description: event.description,
  audience: event.audience,
})

export const HostedEvents = ({ events, profile, onUpdate, onDelete }: HostedEventsProps) => {
  const [viewingEventId, setViewingEventId] = useState<string | null>(null)
  const [editingEventId, setEditingEventId] = useState<string | null>(null)
  const [editValues, setEditValues] = useState<EventEditValues | null>(null)
  const [savingEventId, setSavingEventId] = useState<string | null>(null)
  const [deletingEventId, setDeletingEventId] = useState<string | null>(null)
  const [managementNotice, setManagementNotice] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<{ eventId: string; message: string; error: boolean } | null>(
    null,
  )

  const hostedEvents = profile
    ? events.filter(
        (event) => event.hostId === profile.id || event.hostOwnerId === profile.ownerId,
      )
    : []

  const updateEditField = (
    event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
  ) => {
    const { name, value } = event.target
    setEditValues((current) => (current ? { ...current, [name]: value } : current))
  }

  const handleSave = async (event: EventItem) => {
    if (!editValues || !editValues.title.trim() || !editValues.location.trim()) {
      setFeedback({
        eventId: event.id,
        message: 'Event title and location are required.',
        error: true,
      })
      return
    }

    const capacity = Number(editValues.capacity)
    if (!Number.isInteger(capacity) || capacity < event.attendees) {
      setFeedback({
        eventId: event.id,
        message: 'Capacity must be a whole number at least as large as the current participant count.',
        error: true,
      })
      return
    }

    const dateOptions = getDateRange(editValues.startDate, editValues.endDate)
    if (dateOptions.length === 0) {
      setFeedback({
        eventId: event.id,
        message: 'Choose a complete event date range.',
        error: true,
      })
      return
    }

    setSavingEventId(event.id)
    setFeedback(null)
    try {
      await onUpdate({
        ...event,
        title: editValues.title.trim(),
        location: editValues.location.trim(),
        dateOptions,
        capacity,
        description: editValues.description.trim(),
        audience: editValues.audience,
      })
      setEditingEventId(null)
      setEditValues(null)
      setFeedback({ eventId: event.id, message: 'Event changes saved.', error: false })
    } catch (error) {
      setFeedback({
        eventId: event.id,
        message: error instanceof Error ? error.message : 'Could not save event changes.',
        error: true,
      })
    } finally {
      setSavingEventId(null)
    }
  }

  const handleDelete = async (event: EventItem) => {
    const confirmed = window.confirm(
      `Delete "${event.title}"? This will permanently remove the event.`,
    )
    if (!confirmed) return

    setDeletingEventId(event.id)
    setFeedback(null)
    setManagementNotice(null)
    try {
      await onDelete(event)
      setManagementNotice(`Event '${event.title}' was deleted.`)
    } catch (error) {
      setFeedback({
        eventId: event.id,
        message: error instanceof Error ? error.message : 'Could not delete the event.',
        error: true,
      })
    } finally {
      setDeletingEventId(null)
    }
  }

  return (
    <section className="panel" aria-labelledby="hosted-events-heading">
      <h2 id="hosted-events-heading" className="text-2xl font-bold text-white">
        Managing hosted events
      </h2>
      {managementNotice ? (
        <p role="status" className="event-feedback event-feedback-success mt-4">
          {managementNotice}
        </p>
      ) : null}
      <div className="mt-4 space-y-3">
        {hostedEvents.length === 0 ? (
          <p className="text-sm text-slate-400">Events published by this profile will appear here.</p>
        ) : (
          hostedEvents.map((event) => {
            const isAuthorizedCreator = profile?.ownerId === event.hostOwnerId
            const isEditing = editingEventId === event.id

            return (
              <article
                key={event.id}
                className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="font-semibold text-slate-900">{event.title}</h3>
                    <p className="mt-1 text-sm text-slate-600">
                      {event.location} · {event.attendees} / {event.capacity} participants
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      aria-expanded={viewingEventId === event.id}
                      onClick={() =>
                        setViewingEventId((current) => (current === event.id ? null : event.id))
                      }
                      className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100"
                    >
                      {viewingEventId === event.id ? 'Hide Details' : 'View Details'}
                    </button>
                    {isAuthorizedCreator ? (
                      <>
                        <button
                          type="button"
                          disabled={savingEventId === event.id || deletingEventId === event.id}
                          onClick={() => {
                            setEditingEventId(event.id)
                            setEditValues(eventToEditValues(event))
                            setFeedback(null)
                          }}
                          className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 text-sm font-medium text-blue-700 hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          disabled={deletingEventId === event.id || savingEventId === event.id}
                          onClick={() => void handleDelete(event)}
                          className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1.5 text-sm font-medium text-rose-700 hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {deletingEventId === event.id ? 'Deleting...' : 'Delete'}
                        </button>
                      </>
                    ) : null}
                  </div>
                </div>
                {!isAuthorizedCreator ? (
                  <p className="mt-3 text-xs text-slate-500">
                    Only the account that published this event can edit or delete it.
                  </p>
                ) : null}
                {viewingEventId === event.id ? (
                  <dl
                    role="region"
                    className="mt-4 grid gap-3 border-t border-slate-200 pt-4 text-sm sm:grid-cols-2"
                    aria-label={`Details for ${event.title}`}
                  >
                    <div><dt className="font-medium text-slate-600">Host</dt><dd className="text-slate-900">{event.hostName}</dd></div>
                    <div><dt className="font-medium text-slate-600">Host profile type</dt><dd className="capitalize text-slate-900">{event.hostProfileType}</dd></div>
                    <div><dt className="font-medium text-slate-600">Location</dt><dd className="text-slate-900">{event.location}</dd></div>
                    <div><dt className="font-medium text-slate-600">Dates</dt><dd className="text-slate-900">{event.dateOptions.map(formatDateLabel).join(', ') || 'No dates set'}</dd></div>
                    <div><dt className="font-medium text-slate-600">Audience</dt><dd className="text-slate-900">{event.audience === 'everyone' ? 'Everyone' : 'Organizations only'}</dd></div>
                    <div><dt className="font-medium text-slate-600">Capacity</dt><dd className="text-slate-900">{event.capacity}</dd></div>
                    <div><dt className="font-medium text-slate-600">Participants</dt><dd className="text-slate-900">{event.attendees}</dd></div>
                    <div className="sm:col-span-2"><dt className="font-medium text-slate-600">Description</dt><dd className="whitespace-pre-wrap text-slate-900">{event.description}</dd></div>
                    <div><dt className="font-medium text-slate-600">Published</dt><dd className="text-slate-900">{new Date(event.createdAt).toLocaleString()}</dd></div>
                    <div><dt className="font-medium text-slate-600">Event ID</dt><dd className="break-all text-slate-900">{event.id}</dd></div>
                  </dl>
                ) : null}
                {isEditing && editValues ? (
                  <form
                    className="mt-4 space-y-4 border-t border-slate-200 pt-4"
                    onSubmit={(submitEvent) => {
                      submitEvent.preventDefault()
                      void handleSave(event)
                    }}
                  >
                    <div className="grid gap-4 sm:grid-cols-2">
                      <label className="space-y-2 text-sm text-slate-700">
                        <span>Event title</span>
                        <input
                          aria-label={`Edit title for ${event.title}`}
                          name="title"
                          value={editValues.title}
                          onChange={updateEditField}
                          required
                          className="input"
                        />
                      </label>
                      <label className="space-y-2 text-sm text-slate-700">
                        <span>Location</span>
                        <input
                          aria-label={`Edit location for ${event.title}`}
                          name="location"
                          value={editValues.location}
                          onChange={updateEditField}
                          required
                          className="input"
                        />
                      </label>
                      <label className="space-y-2 text-sm text-slate-700">
                        <span>Capacity</span>
                        <input
                          aria-label={`Edit capacity for ${event.title}`}
                          name="capacity"
                          type="number"
                          min={Math.max(event.attendees, 1)}
                          value={editValues.capacity}
                          onChange={updateEditField}
                          required
                          className="input"
                        />
                      </label>
                      <label className="space-y-2 text-sm text-slate-700">
                        <span>Audience</span>
                        <select
                          aria-label={`Edit audience for ${event.title}`}
                          name="audience"
                          value={editValues.audience}
                          onChange={updateEditField}
                          className="input"
                        >
                          <option value="everyone">Everyone</option>
                          <option value="organizations">Organizations only</option>
                        </select>
                      </label>
                    </div>
                    <fieldset>
                      <legend className="mb-2 text-sm text-slate-700">Event dates</legend>
                      <CalendarPicker
                        mode="range"
                        startDate={editValues.startDate}
                        endDate={editValues.endDate}
                        onRangeChange={(startDate, endDate) =>
                          setEditValues((current) =>
                            current ? { ...current, startDate, endDate } : current,
                          )
                        }
                      />
                    </fieldset>
                    <label className="block space-y-2 text-sm text-slate-700">
                      <span>Description</span>
                      <textarea
                        aria-label={`Edit description for ${event.title}`}
                        name="description"
                        value={editValues.description}
                        onChange={updateEditField}
                        className="input min-h-24"
                      />
                    </label>
                    <div className="flex flex-wrap gap-3">
                      <button
                        type="submit"
                        disabled={savingEventId === event.id}
                        className="button-primary disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {savingEventId === event.id ? 'Saving...' : 'Save changes'}
                      </button>
                      <button
                        type="button"
                        disabled={savingEventId === event.id}
                        onClick={() => {
                          setEditingEventId(null)
                          setEditValues(null)
                          setFeedback(null)
                        }}
                        className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                ) : null}
                {feedback?.eventId === event.id ? (
                  <p
                    role={feedback.error ? 'alert' : 'status'}
                    className={`mt-3 text-sm ${feedback.error ? 'text-rose-700' : 'text-emerald-700'}`}
                  >
                    {feedback.message}
                  </p>
                ) : null}
              </article>
            )
          })
        )}
      </div>
    </section>
  )
}

interface CollaborationRequestsProps {
  requests: EventRequest[]
  events: EventItem[]
}

export const CollaborationRequests = ({ requests, events }: CollaborationRequestsProps) => (
  <section className="panel" aria-labelledby="collaboration-requests-heading">
    <h2 id="collaboration-requests-heading" className="text-2xl font-bold text-white">
      Collaboration requests
    </h2>
    <div className="mt-4 space-y-3">
      {requests.length === 0 ? (
        <p className="text-sm text-slate-400">Co-hosting requests you send in this session appear here.</p>
      ) : (
        requests.map((request) => {
          const event = events.find((item) => item.id === request.eventId)
          return (
            <article
              key={request.id}
              className="rounded-2xl border border-violet-200 bg-violet-50 p-4"
            >
              <p className="font-semibold text-slate-900">
                Request to co-host {event?.title ?? 'an event'}
              </p>
              <p className="mt-1 text-sm text-slate-600">
                Sent by {request.requesterName} · {request.status}
              </p>
              <p className="mt-2 text-sm text-slate-700">{request.message}</p>
            </article>
          )
        })
      )}
    </div>
    <div className="mt-5 rounded-xl border border-dashed border-slate-300 px-4 py-3">
      <h3 className="font-semibold text-slate-800">Incoming requests</h3>
      <p className="mt-1 text-sm text-slate-500">
        Incoming request review and response are placeholders until shared request-reading and
        management workflows are added.
      </p>
    </div>
  </section>
)
