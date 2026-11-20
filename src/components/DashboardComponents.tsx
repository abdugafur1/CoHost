import { useRef, useState, type ChangeEvent, type FormEvent, type RefObject } from 'react'
import CalendarPicker from './CalendarPicker'
import type { EventItem, EventRequest, InboxNotice, ProfileType, UserProfile } from '../types'

export interface ProfileFormValues {
  name: string
  profileType: ProfileType
  focus: string
  location: string
  description: string
  interests?: string[]
  eventTypes?: string[]
  availableResources?: string[]
  collaborationPreferences?: string[]
  directoryVisible?: boolean
}

export interface HostFormValues {
  title: string
  location: string
  startDate: string
  endDate: string
  capacity: string
  description: string
  audience: 'everyone' | 'organizations'
  resourcesOffered: string[]
  offerDescription: string
  offerOtherResource: string
  offerOtherDescription: string
  resourcesNeeded: string[]
  needDescription: string
  needOtherResource: string
  needOtherDescription: string
}

const eventResourceOptions = [
  'Venue',
  'Equipment',
  'Speakers / Expertise',
  'Volunteers',
  'Promotion',
  'Funding',
  'Partner Organization',
  'Other',
] as const

export type ResourceFormField =
  | 'resourcesOffered'
  | 'offerDescription'
  | 'offerOtherResource'
  | 'offerOtherDescription'
  | 'resourcesNeeded'
  | 'needDescription'
  | 'needOtherResource'
  | 'needOtherDescription'

type ResourceFormValues = Pick<HostFormValues, ResourceFormField>
type ResourceFormErrors = Partial<Record<ResourceFormField, string>>

const validateResourceForm = (values: ResourceFormValues): ResourceFormErrors => {
  const errors: ResourceFormErrors = {}
  if (values.resourcesOffered.length === 0) {
    errors.resourcesOffered = 'Select at least one resource you offer.'
  }
  if (!values.offerDescription.trim()) {
    errors.offerDescription = 'Describe what your organization can offer.'
  }
  if (values.resourcesOffered.indexOf('Other') !== -1) {
    if (!values.offerOtherResource.trim()) {
      errors.offerOtherResource = 'Enter the name of the other resource.'
    }
    if (!values.offerOtherDescription.trim()) {
      errors.offerOtherDescription = 'Describe the other resource.'
    }
  }
  if (values.resourcesNeeded.length === 0) {
    errors.resourcesNeeded = 'Select at least one resource you need.'
  }
  if (!values.needDescription.trim()) {
    errors.needDescription = 'Describe the support or collaboration you need.'
  }
  if (values.resourcesNeeded.indexOf('Other') !== -1) {
    if (!values.needOtherResource.trim()) {
      errors.needOtherResource = 'Enter the name of the other resource.'
    }
    if (!values.needOtherDescription.trim()) {
      errors.needOtherDescription = 'Describe the other resource.'
    }
  }
  return errors
}

interface ResourceSectionFormProps {
  section: 'offer' | 'need'
  selectedResources: string[]
  description: string
  otherResource: string
  otherDescription: string
  errors: ResourceFormErrors
  onChange: (field: ResourceFormField, value: string | string[]) => void
}

const ResourceSectionForm = ({
  section,
  selectedResources,
  description,
  otherResource,
  otherDescription,
  errors,
  onChange,
}: ResourceSectionFormProps) => {
  const isOffer = section === 'offer'
  const title = isOffer ? 'We Offer' : 'We Need'
  const resourcesField = isOffer ? 'resourcesOffered' : 'resourcesNeeded'
  const descriptionField = isOffer ? 'offerDescription' : 'needDescription'
  const otherResourceField = isOffer ? 'offerOtherResource' : 'needOtherResource'
  const otherDescriptionField = isOffer ? 'offerOtherDescription' : 'needOtherDescription'
  const hasOther = selectedResources.indexOf('Other') !== -1
  const errorClass = 'mt-1 text-sm text-rose-700'

  return (
    <fieldset
      className={`space-y-4 rounded-2xl border p-4 ${
        isOffer ? 'border-emerald-200 bg-emerald-50/50' : 'border-violet-200 bg-violet-50/50'
      }`}
    >
      <legend className="px-2 text-lg font-bold text-slate-900">{title}</legend>
      <fieldset>
        <legend className="mb-2 text-sm font-medium text-slate-700">
          Resource categories <span aria-hidden="true">*</span>
        </legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {eventResourceOptions.map((resource) => (
            <label
              key={resource}
              className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
            >
              <input
                type="checkbox"
                aria-label={`${title} ${resource}`}
                checked={selectedResources.indexOf(resource) !== -1}
                onChange={(event) => {
                  const nextResources = event.target.checked
                    ? [...selectedResources, resource]
                    : selectedResources.filter((value) => value !== resource)
                  onChange(resourcesField, nextResources)
                  if (resource === 'Other' && !event.target.checked) {
                    onChange(otherResourceField, '')
                    onChange(otherDescriptionField, '')
                  }
                }}
              />
              {resource}
            </label>
          ))}
        </div>
        {errors[resourcesField] ? (
          <p role="alert" className={errorClass}>
            {errors[resourcesField]}
          </p>
        ) : null}
      </fieldset>
      <label className="block space-y-2 text-sm font-medium text-slate-700">
        <span>
          {isOffer ? 'Offer Description' : 'Need Description'} <span aria-hidden="true">*</span>
        </span>
        <textarea
          aria-label={isOffer ? 'Offer Description' : 'Need Description'}
          value={description}
          onChange={(event) => onChange(descriptionField, event.target.value)}
          aria-invalid={Boolean(errors[descriptionField])}
          aria-required="true"
          className="input min-h-24"
        />
        {errors[descriptionField] ? (
          <span role="alert" className={errorClass}>
            {errors[descriptionField]}
          </span>
        ) : null}
      </label>
      {hasOther ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block space-y-2 text-sm font-medium text-slate-700">
            <span>Other Resource Name <span aria-hidden="true">*</span></span>
            <input
              aria-label={`${title} Other Resource Name`}
              value={otherResource}
              onChange={(event) => onChange(otherResourceField, event.target.value)}
              aria-invalid={Boolean(errors[otherResourceField])}
              aria-required="true"
              className="input"
            />
            {errors[otherResourceField] ? (
              <span role="alert" className={errorClass}>
                {errors[otherResourceField]}
              </span>
            ) : null}
          </label>
          <label className="block space-y-2 text-sm font-medium text-slate-700">
            <span>Other Resource Description <span aria-hidden="true">*</span></span>
            <textarea
              aria-label={`${title} Other Resource Description`}
              value={otherDescription}
              onChange={(event) => onChange(otherDescriptionField, event.target.value)}
              aria-invalid={Boolean(errors[otherDescriptionField])}
              aria-required="true"
              className="input min-h-20"
            />
            {errors[otherDescriptionField] ? (
              <span role="alert" className={errorClass}>
                {errors[otherDescriptionField]}
              </span>
            ) : null}
          </label>
        </div>
      ) : null}
    </fieldset>
  )
}

export interface RequestDraftValues {
  dates: string[]
  attendeeCount: string
  message: string
}

export interface CoHostRequestDetails {
  resourcesProvided: string[]
  contributionDescription: string
  estimatedAttendees?: number
}

interface ProfilePanelProps {
  activeProfile: UserProfile | null
  authUserId: string | null
  authDisplayName: string | null
  authPhotoUrl: string | null
  authEmail: string | null
  isAnonymousSession: boolean
  isGoogleAccount: boolean
}

export const ProfilePanel = ({
  activeProfile,
  authUserId,
  authDisplayName,
  authPhotoUrl,
  authEmail,
  isAnonymousSession,
  isGoogleAccount,
}: ProfilePanelProps) => (
  <section id="profile" className="panel profile-summary-card" aria-labelledby="active-profile-heading">
    {activeProfile ? (
      <>
        <div className="flex flex-col items-center text-center">
          {authPhotoUrl ? (
            <img
              src={authPhotoUrl}
              alt={`${authDisplayName ?? 'Google account'} profile`}
              referrerPolicy="no-referrer"
              className="profile-avatar"
            />
          ) : (
            <div
              aria-label={`${activeProfile.name} profile avatar`}
              className={`profile-avatar profile-avatar-fallback ${
                activeProfile.profileType === 'student'
                  ? 'profile-avatar-student'
                  : 'profile-avatar-organization'
              }`}
            >
              {activeProfile.name.trim().charAt(0).toUpperCase()}
            </div>
          )}
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
            <h2 id="active-profile-heading" className="text-2xl font-bold text-slate-900">
              {activeProfile.name}
            </h2>
            <span
              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                activeProfile.profileType === 'student'
                  ? 'bg-blue-50 text-blue-700'
                  : 'bg-violet-50 text-violet-700'
              }`}
            >
              {activeProfile.profileType === 'student' ? 'Student' : 'Organization'}
            </span>
          </div>
          {authDisplayName ? (
            <p className="mt-2 text-sm font-medium text-slate-700">{authDisplayName}</p>
          ) : null}
          {authEmail ? <p className="mt-1 text-sm text-slate-500">{authEmail}</p> : null}
          <p className="mt-2 text-xs text-slate-500">
            {authUserId
              ? isAnonymousSession
                ? 'Anonymous Firebase account'
                : isGoogleAccount
                  ? 'Google account connected'
                  : 'Firebase account connected'
              : 'Local profile · not signed in'}
          </p>
        </div>
        <dl className="mt-7 divide-y divide-slate-100 border-t border-slate-100 text-sm">
          <div className="grid gap-1 py-3 sm:grid-cols-[9rem_1fr]">
            <dt className="font-medium text-slate-500">Area of interest</dt>
            <dd className="text-slate-800">{activeProfile.focus}</dd>
          </div>
          <div className="grid gap-1 py-3 sm:grid-cols-[9rem_1fr]">
            <dt className="font-medium text-slate-500">Location</dt>
            <dd className="text-slate-800">{activeProfile.location}</dd>
          </div>
          <div className="grid gap-1 py-3 sm:grid-cols-[9rem_1fr]">
            <dt className="font-medium text-slate-500">Description</dt>
            <dd className="whitespace-pre-wrap text-slate-800">
              {activeProfile.description || 'No description added yet.'}
            </dd>
          </div>
          {activeProfile.profileType === 'organization' ? (
            <>
              {[
                { label: 'Interest categories', values: activeProfile.interests },
                { label: 'Preferred event types', values: activeProfile.eventTypes },
                { label: 'Available resources', values: activeProfile.availableResources },
                {
                  label: 'Collaboration preferences',
                  values: activeProfile.collaborationPreferences,
                },
              ].map(({ label, values }) => (
                <div
                  key={label}
                  className="grid gap-1 py-3 sm:grid-cols-[9rem_1fr]"
                >
                  <dt className="font-medium text-slate-500">{label}</dt>
                  <dd className="text-slate-800">
                    {values?.length ? values.join(', ') : 'Not specified'}
                  </dd>
                </div>
              ))}
              <div className="grid gap-1 py-3 sm:grid-cols-[9rem_1fr]">
                <dt className="font-medium text-slate-500">Public directory</dt>
                <dd className="text-slate-800">
                  {activeProfile.directoryVisible ? 'Listed in Discover Clubs' : 'Not listed'}
                </dd>
              </div>
            </>
          ) : null}
          <div className="grid gap-1 py-3 sm:grid-cols-[9rem_1fr]">
            <dt className="font-medium text-slate-500">Authentication</dt>
            <dd className="text-slate-800">
              {authUserId
                ? isAnonymousSession
                  ? 'Signed in anonymously with Firebase'
                  : isGoogleAccount
                    ? `Signed in with Google${authDisplayName ? ` as ${authDisplayName}` : ''}`
                    : `Signed in with Firebase${authDisplayName ? ` as ${authDisplayName}` : ''}`
                : 'Not signed in'}
            </dd>
          </div>
        </dl>
        {activeProfile.profileType === 'organization' ? (
          <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            Organization profiles do not establish administrator authorization.
          </p>
        ) : null}
      </>
    ) : (
      <div className="py-8 text-center">
        <div className="profile-avatar profile-avatar-fallback profile-avatar-student mx-auto">
          ?
        </div>
        <h2 id="active-profile-heading" className="mt-4 text-xl font-bold text-slate-900">
          No profile selected
        </h2>
        <p className="mt-2 text-sm text-slate-500">
          Create or switch to a profile to see its details here.
        </p>
      </div>
    )}
  </section>
)

interface CreateProfileFormProps {
  profileForm: ProfileFormValues
  onFieldChange: (
    event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
  ) => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
  isSubmitting?: boolean
  showHeading?: boolean
}

export const CreateProfileForm = ({
  profileForm,
  onFieldChange,
  onSubmit,
  isSubmitting = false,
  showHeading = true,
}: CreateProfileFormProps) => (
  <section className="panel">
    {showHeading ? (
      <>
        <h2 className="text-2xl font-bold text-stone-900">Create a profile</h2>
        <p className="mt-2 text-sm text-stone-600">
          Identify yourself as a student or an organization. This is included with event requests.
        </p>
      </>
    ) : null}
    <form className="form-stack" onSubmit={onSubmit}>
      <label className="form-field">
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
      <label className="form-field">
        <span>{profileForm.profileType === 'student' ? 'Your name' : 'Organization name'}</span>
        <input
          aria-label={profileForm.profileType === 'student' ? 'Your name' : 'Organization name'}
          name="name"
          value={profileForm.name}
          onChange={onFieldChange}
          className="input"
          placeholder={profileForm.profileType === 'student' ? 'Alex Morgan' : 'Northwind Club'}
          required
        />
      </label>
      <label className="form-field">
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
      <label className="form-field">
        <span>Location</span>
        <input
          aria-label="Profile location"
          name="location"
          value={profileForm.location}
          onChange={onFieldChange}
          className="input"
          placeholder="North campus"
          required
        />
      </label>
      <label className="form-field">
        <span>About you</span>
        <textarea
          aria-label="Profile description"
          name="description"
          value={profileForm.description}
          onChange={onFieldChange}
          className="input"
          placeholder="What are you interested in?"
        />
      </label>
      <button type="submit" className="button-primary" disabled={isSubmitting}>
        {isSubmitting ? 'Saving profile...' : 'Save'}
      </button>
    </form>
  </section>
)

interface InboxPanelProps {
  inbox: InboxNotice[]
  profileId: string | null
  onMarkRead: (noticeId: string) => void
  onViewRequest: (notice: InboxNotice) => void
}

export const InboxPanel = ({
  inbox,
  profileId,
  onMarkRead,
  onViewRequest,
}: InboxPanelProps) => {
  const profileInbox = inbox.filter((notice) => notice.profileId === profileId)

  return (
    <section className="panel">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-2xl font-bold text-stone-900">Inbox</h2>
        <span className="border border-stone-300 bg-stone-50 px-2.5 py-1 text-xs font-medium text-stone-600">
          {profileInbox.filter((entry) => !entry.isRead).length} new
        </span>
      </div>
      <div className="mt-5 space-y-3">
        {profileInbox.length === 0 ? (
          <p className="text-sm text-stone-600">Your inbox is empty.</p>
        ) : (
          profileInbox.map((notice) => (
            <article
              key={notice.id}
              className={`border p-4 ${
                notice.isRead
                  ? 'border-stone-200 bg-stone-50'
                  : 'border-orange-800/25 bg-stone-50'
              }`}
            >
              <div className="flex items-center justify-between gap-4">
                <p className="text-sm font-semibold text-stone-900">{notice.title}</p>
                <span className="border border-stone-300 px-2 py-0.5 text-[10px] uppercase tracking-wide text-stone-600">
                  {notice.type}
                </span>
              </div>
              <p className="mt-2 text-sm text-stone-600">{notice.message}</p>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                <span className="text-[11px] uppercase tracking-wide text-stone-500">
                  {new Date(notice.createdAt).toLocaleDateString()}
                </span>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    aria-label={`View details for ${notice.title}`}
                    onClick={() => {
                      if (!notice.isRead) onMarkRead(notice.id)
                      onViewRequest(notice)
                    }}
                    className="text-xs font-semibold text-orange-800 hover:text-orange-800"
                  >
                    View Details
                  </button>
                  {!notice.isRead ? (
                    <button
                      type="button"
                      onClick={() => onMarkRead(notice.id)}
                      className="text-xs font-medium text-orange-800 hover:text-orange-800"
                    >
                      Mark read
                    </button>
                  ) : null}
                </div>
              </div>
            </article>
          ))
        )}
      </div>
    </section>
  )
}

const ResourceDetails = ({ event }: { event: EventItem }) => {
  const sections = [
    {
      title: 'We Offer',
      resources: event.resourcesOffered ?? [],
      description: event.offerDescription?.trim() ?? '',
      otherResource: event.offerOtherResource?.trim() ?? '',
      otherDescription: event.offerOtherDescription?.trim() ?? '',
      color: 'border-emerald-200 bg-emerald-50 text-emerald-900',
      badge: 'bg-emerald-100 text-emerald-800',
    },
    {
      title: 'We Need',
      resources: event.resourcesNeeded ?? [],
      description: event.needDescription?.trim() ?? '',
      otherResource: event.needOtherResource?.trim() ?? '',
      otherDescription: event.needOtherDescription?.trim() ?? '',
      color: 'border-violet-200 bg-violet-50 text-violet-900',
      badge: 'bg-violet-100 text-violet-800',
    },
  ]

  return (
    <div className="grid gap-3 sm:grid-cols-2" aria-label={`Resources for ${event.title}`}>
      {sections.map((section) => (
        <section
          key={section.title}
          className={`rounded-2xl border p-4 ${section.color}`}
          aria-label={section.title}
        >
          <h4 className="font-bold">{section.title}</h4>
          <div className="mt-2 flex flex-wrap gap-2">
            {section.resources.length > 0 ? (
              section.resources.map((resource) => (
                <span
                  key={resource}
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${section.badge}`}
                >
                  {resource}
                </span>
              ))
            ) : (
              <span className="text-sm">Not specified</span>
            )}
          </div>
          <p className="mt-3 whitespace-pre-wrap text-sm">
            {section.description || 'Not specified'}
          </p>
          {section.resources.indexOf('Other') !== -1 ? (
            <div className="mt-3 border-t border-current/15 pt-3 text-sm">
              <p>
                <span className="font-semibold">Other resource:</span>{' '}
                {section.otherResource || 'Not specified'}
              </p>
              <p className="mt-1 whitespace-pre-wrap">
                {section.otherDescription || 'Not specified'}
              </p>
            </div>
          ) : null}
        </section>
      ))}
    </div>
  )
}

interface EventListProps {
  events: EventItem[]
  activeProfile: UserProfile | null
  requestDrafts: Record<string, RequestDraftValues>
  requestKind: 'participation' | 'cohost'
  canRequest?: boolean
  onDraftChange: (eventId: string, field: 'attendeeCount' | 'message', value: string) => void
  onDatesChange: (eventId: string, dates: string[]) => void
  onRequest: (
    event: EventItem,
    requestKind: 'participation' | 'cohost',
    coHostDetails?: CoHostRequestDetails,
  ) => Promise<boolean>
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
  canRequest = true,
  onDraftChange,
  onDatesChange,
  onRequest,
}: EventListProps) => {
  const [coHostEventId, setCoHostEventId] = useState<string | null>(null)
  const [resourcesProvided, setResourcesProvided] = useState<string[]>([])
  const [contributionDescription, setContributionDescription] = useState('')
  const [estimatedAttendees, setEstimatedAttendees] = useState('')
  const [attendeesNotSure, setAttendeesNotSure] = useState(false)
  const [submissionError, setSubmissionError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const submittingRef = useRef(false)

  const openCoHostModal = (event: EventItem) => {
    setResourcesProvided(
      event.resourcesNeeded?.length ? [] : ['General contribution'],
    )
    setContributionDescription('')
    setEstimatedAttendees('')
    setAttendeesNotSure(false)
    setSubmissionError('')
    setCoHostEventId(event.id)
  }

  const submitCoHostRequest = async (event: EventItem) => {
    if (submittingRef.current) return
    const needs = event.resourcesNeeded ?? []
    const trimmedContribution = contributionDescription.trim()
    if (!trimmedContribution) {
      setSubmissionError('Describe what your organization can contribute.')
      return
    }
    if (
      (needs.length > 0 && resourcesProvided.length === 0) ||
      resourcesProvided.some((resource) =>
        needs.length > 0
          ? needs.indexOf(resource) === -1
          : resource !== 'General contribution',
      )
    ) {
      setSubmissionError('Select at least one resource the host requested.')
      return
    }
    const parsedEstimate = estimatedAttendees.trim() ? Number(estimatedAttendees) : undefined
    if (
      parsedEstimate !== undefined &&
      (!Number.isInteger(parsedEstimate) || parsedEstimate < 1)
    ) {
      setSubmissionError('Estimated attendees must be a positive whole number.')
      return
    }

    submittingRef.current = true
    setIsSubmitting(true)
    setSubmissionError('')
    try {
      const submitted = await onRequest(event, 'cohost', {
        resourcesProvided: [...resourcesProvided],
        contributionDescription: trimmedContribution,
        ...(attendeesNotSure || parsedEstimate === undefined
          ? {}
          : { estimatedAttendees: parsedEstimate }),
      })
      if (submitted) {
        setCoHostEventId(null)
        setResourcesProvided([])
        setContributionDescription('')
        setEstimatedAttendees('')
        setAttendeesNotSure(false)
      } else {
        setSubmissionError('Could not send your request. Review the error and try again.')
      }
    } catch (error) {
      setSubmissionError(
        error instanceof Error ? error.message : 'Could not send your request. Please try again.',
      )
    } finally {
      submittingRef.current = false
      setIsSubmitting(false)
    }
  }

  return (
  <section id="events" className="panel event-board" aria-labelledby="opportunities-heading">
    <div className="mb-6 flex items-center justify-between gap-3">
      <div>
        <p className="text-sm uppercase tracking-[0.2em] text-stone-600">
          {requestKind === 'cohost' ? 'Collaboration opportunities' : 'Opportunities'}
        </p>
        <h2 id="opportunities-heading" className="mt-2 text-2xl font-bold text-stone-900">
          {requestKind === 'cohost' ? 'Request to co-host' : 'Available community events'}
        </h2>
      </div>
      <span className="border border-stone-300 bg-stone-50 px-3 py-1 text-xs font-medium text-stone-600">
        {events.length} opportunities
      </span>
    </div>
    <div className="grid gap-6">
      {events.length === 0 ? (
        <p className="border border-dashed border-stone-300 px-5 py-8 text-sm text-stone-600 lg:col-span-2">
          No events have been posted yet.
        </p>
      ) : null}
      {events.map((event) => {
        const draft = requestDrafts[event.id] ?? {
          dates: [],
          attendeeCount: '2',
          message: '',
        }
        const isStudentView = activeProfile?.profileType === 'student'
        const isOwnEvent =
          activeProfile !== null &&
          (event.hostId === activeProfile.id || event.hostOwnerId === activeProfile.ownerId)
        const isFull = event.capacity <= event.attendees

        return (
          <article
            key={event.id}
            className={isStudentView ? "event-card student-event-card" : "event-card"}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                {!isStudentView ? (
                  <p className="text-xs uppercase tracking-[0.2em] text-orange-800">
                    Hosted by {event.hostName} · {event.hostProfileType}
                  </p>
                ) : null}
                <h3
                  className={
                    isStudentView
                      ? 'mt-2 text-3xl font-extrabold leading-tight text-slate-950'
                      : 'mt-2 text-2xl font-bold text-stone-900'
                  }
                >
                  {event.title}
                </h3>
                {isStudentView ? (
                  <div className="mt-3">
                    <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
                      HOSTED BY
                    </p>
                    <div className="mt-1 flex flex-wrap gap-2" aria-label="Hosted by">
                      {[event.hostName, ...(event.confirmedCoHosts ?? []).map((host) => host.name)]
                        .map((name, index) => (
                          <span
                            key={`${name}-${index}`}
                            className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-sm font-semibold text-blue-900"
                          >
                            {name}
                          </span>
                        ))}
                    </div>
                  </div>
                ) : null}
                {!isStudentView && event.publicationStatus ? (
                  <span
                    className={`mt-2 inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${
                      event.publicationStatus === 'pending_collaboration'
                        ? 'border-[#F5C76E] bg-[#FFF3D6] text-[#92400E]'
                        : 'border-blue-200/30 bg-blue-500/10 text-blue-800'
                    }`}
                  >
                    {event.publicationStatus === 'pending_collaboration'
                      ? 'Pending Collaboration'
                      : event.publicationStatus === 'ready_to_publish'
                        ? 'Ready to Publish'
                        : event.publicationStatus.charAt(0).toUpperCase() +
                          event.publicationStatus.slice(1)}
                  </span>
                ) : null}
              </div>
              {isStudentView ? null : (
                <span className="rounded-full border border-emerald-500/50 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-800">
                  {Math.max(event.capacity - event.attendees, 0)} open
                </span>
              )}
            </div>
            {event.description.trim() ? (
              <p
                className={
                  isStudentView
                    ? 'mt-4 text-base leading-7 text-slate-700'
                    : 'mt-4 text-sm text-stone-600'
                }
              >
                {event.description}
              </p>
            ) : null}
            {isStudentView ? (
              <dl className="student-event-highlights mt-5 grid gap-3 sm:grid-cols-3">
                <div>
                  <dt><span aria-hidden="true">⌖</span> Location</dt>
                  <dd>{event.location}</dd>
                </div>
                <div>
                  <dt><span aria-hidden="true">▦</span> Dates</dt>
                  <dd>
                    {event.dateOptions.length === 1
                      ? formatDateLabel(event.dateOptions[0])
                      : `${formatDateLabel(event.dateOptions[0])} – ${formatDateLabel(event.dateOptions[event.dateOptions.length - 1])}`}
                  </dd>
                </div>
                <div>
                  <dt><span aria-hidden="true">✓</span> Available spots</dt>
                  <dd>{Math.max(event.capacity - event.attendees, 0)}</dd>
                </div>
              </dl>
            ) : (
              <>
                <div className="mt-4">
                  <ResourceDetails event={event} />
                </div>
                <dl className="mt-4 space-y-2 text-sm text-stone-600">
                  <div className="flex items-center justify-between border-b border-stone-200 pb-2">
                    <dt>Location</dt>
                    <dd>{event.location}</dd>
                  </div>
                  <div className="flex items-center justify-between border-b border-stone-200 pb-2">
                    <dt>Capacity</dt>
                    <dd>{event.capacity} total</dd>
                  </div>
                  <div className="flex items-center justify-between border-b border-stone-200 pb-2">
                    <dt>Attendees</dt>
                    <dd>{event.attendees}</dd>
                  </div>
                  <div className="flex items-center justify-between border-b border-stone-200 pb-2">
                    <dt>Open to</dt>
                    <dd>
                      {event.audience === 'everyone' ? 'Students and organizations' : 'Organizations only'}
                    </dd>
                  </div>
                </dl>
                <p className="mt-4 text-sm text-stone-600">
                  Dates: {formatDateLabel(event.dateOptions[0])} –{' '}
                  {formatDateLabel(event.dateOptions[event.dateOptions.length - 1])}
                </p>
              </>
            )}
            {isOwnEvent ? (
              <p className="mt-5 border-t border-stone-200 pt-5 text-sm text-stone-600">
                You are hosting this event and cannot request to join it.
              </p>
            ) : !canRequest ? (
              <p className="mt-5 border-t border-stone-200 pt-5 text-sm text-stone-600">
                Sign in and select a profile you own to request this event.
              </p>
            ) : event.audience === 'organizations' &&
              activeProfile?.profileType === 'student' ? (
              <p className="mt-5 border-t border-stone-200 pt-5 text-sm text-amber-800">
                This event is open to organizations only. Switch to an organization profile to request a
                spot.
              </p>
            ) : requestKind === 'cohost' ? (
              <>
                <p className="mt-5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-[#475569]">
                  Requesting as{' '}
                  <span className="font-semibold text-[#5B21B6]">{activeProfile?.name}</span>
                </p>
                <button
                  type="button"
                  className="button-primary mt-3 w-full"
                  onClick={() => openCoHostModal(event)}
                >
                  Request to Co-Host
                </button>
                {coHostEventId === event.id ? (
                  <div className="profile-modal-backdrop">
                    <section
                      className="panel profile-modal bg-white text-slate-900"
                      role="dialog"
                      aria-modal="true"
                      aria-labelledby={`cohost-request-heading-${event.id}`}
                    >
                      <h2
                        id={`cohost-request-heading-${event.id}`}
                        className="text-2xl font-bold text-slate-900"
                      >
                        Request to Co-Host
                      </h2>
                      <p className="mt-2 text-sm text-slate-600">
                        {event.title} · Hosted by {event.hostName}
                      </p>
                      <form
                        className="mt-5 space-y-5"
                        onSubmit={(submitEvent) => {
                          submitEvent.preventDefault()
                          void submitCoHostRequest(event)
                        }}
                      >
                        <section
                          className="rounded-2xl border border-violet-200 bg-violet-50 p-4"
                          aria-label="Host requested resources"
                        >
                          <h3 className="font-semibold text-slate-900">Host's We Need</h3>
                          <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">
                            {event.needDescription?.trim() || 'No detailed need description provided.'}
                          </p>
                          {event.resourcesNeeded?.length ? (
                            <>
                              <fieldset className="mt-4 space-y-2">
                                <legend className="mb-2 text-sm font-medium text-slate-800">
                                  Select what your organization can provide
                                </legend>
                                {event.resourcesNeeded.map((resource) => {
                                  const label =
                                    resource === 'Other' && event.needOtherResource?.trim()
                                      ? `Other — ${event.needOtherResource.trim()}`
                                      : resource
                                  return (
                                    <label
                                      key={resource}
                                      className="flex items-start gap-3 rounded-xl border border-violet-100 bg-white px-3 py-2 text-sm text-slate-800"
                                    >
                                      <input
                                        type="checkbox"
                                        aria-label={`Provide ${label}`}
                                        checked={resourcesProvided.indexOf(resource) !== -1}
                                        onChange={(inputEvent) =>
                                          setResourcesProvided((current) =>
                                            inputEvent.target.checked
                                              ? [...current, resource]
                                              : current.filter((value) => value !== resource),
                                          )
                                        }
                                      />
                                      <span>
                                        <span className="font-medium">{label}</span>
                                        {resource === 'Other' && event.needOtherDescription?.trim() ? (
                                          <span className="mt-1 block text-slate-600">
                                            {event.needOtherDescription.trim()}
                                          </span>
                                        ) : null}
                                      </span>
                                    </label>
                                  )
                                })}
                              </fieldset>
                              <p className="mt-2 text-xs text-slate-500">
                                You can offer some or all of these resources.
                              </p>
                            </>
                          ) : (
                            <fieldset className="mt-4">
                              <label className="flex items-center gap-3 rounded-xl border border-violet-100 bg-white px-3 py-2 text-sm text-slate-800">
                                <input
                                  type="checkbox"
                                  aria-label="General contribution"
                                  checked={resourcesProvided.indexOf('General contribution') !== -1}
                                  onChange={(inputEvent) =>
                                    setResourcesProvided(
                                      inputEvent.target.checked ? ['General contribution'] : [],
                                    )
                                  }
                                />
                                General contribution
                              </label>
                              <p className="mt-2 text-xs text-slate-600">
                                This event was posted before resource needs were specified. Describe
                                your offer below.
                              </p>
                            </fieldset>
                          )}
                        </section>
                        <label className="block space-y-2 text-sm font-medium text-slate-700">
                          <span>
                            What exactly can your organization contribute? <span aria-hidden="true">*</span>
                          </span>
                          <textarea
                            aria-label="Contribution Details"
                            aria-required="true"
                            value={contributionDescription}
                            onChange={(inputEvent) => {
                              setContributionDescription(inputEvent.target.value)
                              setSubmissionError('')
                            }}
                            className="input min-h-24"
                            placeholder="Describe the resources or support you can provide."
                          />
                        </label>
                        <fieldset>
                          <legend className="mb-2 text-sm font-medium text-slate-700">
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
                        <label className="block max-w-xs space-y-2 text-sm text-slate-700">
                          <span>Estimated Number of Attendees</span>
                          <input
                            aria-label="Estimated Number of Attendees"
                            type="number"
                            min="1"
                            step="1"
                            value={estimatedAttendees}
                            disabled={attendeesNotSure}
                            onChange={(inputEvent) => {
                              setEstimatedAttendees(inputEvent.target.value)
                              setSubmissionError('')
                            }}
                            className="input"
                          />
                          <span className="block text-xs font-normal text-slate-500">
                            Approximately how many people do you expect to attend from your organization?
                          </span>
                        </label>
                        <label className="flex items-center gap-2 text-sm text-slate-700">
                          <input
                            type="checkbox"
                            aria-label="Not sure yet"
                            checked={attendeesNotSure}
                            onChange={(inputEvent) => {
                              setAttendeesNotSure(inputEvent.target.checked)
                              if (inputEvent.target.checked) setEstimatedAttendees('')
                              setSubmissionError('')
                            }}
                          />
                          Not sure yet
                        </label>
                        <label className="block space-y-2 text-sm text-slate-700">
                          <span>Optional message to the host</span>
                          <textarea
                            aria-label={`Co-hosting message for ${event.title}`}
                            value={draft.message}
                            onChange={(inputEvent) =>
                              onDraftChange(event.id, 'message', inputEvent.target.value)
                            }
                            className="input min-h-20"
                          />
                        </label>
                        {submissionError ? (
                          <p role="alert" className="text-sm text-rose-700">
                            {submissionError}
                          </p>
                        ) : null}
                        <div className="flex flex-wrap justify-end gap-3">
                          <button
                            type="button"
                            disabled={isSubmitting}
                            onClick={() => setCoHostEventId(null)}
                            className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 disabled:opacity-50"
                          >
                            Cancel
                          </button>
                          <button
                            type="submit"
                            disabled={isSubmitting}
                            className="button-primary disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {isSubmitting ? 'Submitting...' : 'Submit Request'}
                          </button>
                        </div>
                      </form>
                    </section>
                  </div>
                ) : null}
              </>
            ) : (
              <form
                className={
                  isStudentView
                    ? 'student-participation-form mt-5 space-y-4 border-t border-blue-100 pt-5'
                    : 'mt-5 space-y-4 border-t border-stone-200 pt-5'
                }
                onSubmit={(submitEvent) => {
                  submitEvent.preventDefault()
                  onRequest(event, requestKind)
                }}
              >
                <p className="text-sm text-stone-600">
                  Requesting as{' '}
                  <span className="font-semibold capitalize text-orange-800">
                    {activeProfile?.profileType}
                  </span>
                  {' · '}
                  <span className="font-semibold text-[#5B21B6]">{activeProfile?.name}</span>
                </p>
                <fieldset>
                  <legend className={isStudentView ? 'mb-2 text-sm font-semibold text-slate-800' : 'mb-2 text-sm font-medium text-stone-700'}>
                    {isStudentView ? 'Select available dates' : 'Your availability'}
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
                  <label className="block max-w-xs space-y-2 text-sm text-stone-700">
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
                  <p className="text-sm text-stone-600">Your request is for one student.</p>
                )}
                <label className={isStudentView ? 'block space-y-2 text-sm text-slate-700' : 'block space-y-2 text-sm text-stone-700'}>
                <span>{isStudentView ? 'Optional message' : 'Message'}</span>
                  <textarea
                  aria-label={
                    isStudentView
                      ? `Optional message for ${event.title}`
                      : `Message for ${event.title}`
                  }
                    value={draft.message}
                    onChange={(inputEvent) =>
                      onDraftChange(event.id, 'message', inputEvent.target.value)
                    }
                    className="input"
                    placeholder="Tell the host why you would like to join."
                  />
                </label>
                <button
                  type="submit"
                  disabled={requestKind === 'participation' && isFull}
                  className={`button-primary w-full disabled:cursor-not-allowed disabled:opacity-50 ${
                    isStudentView ? 'student-participation-submit' : ''
                  }`}
                >
                  {isFull
                    ? 'Event full'
                    : isStudentView
                      ? 'Send Participation Request'
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
}

interface HostEventFormProps {
  hostForm: HostFormValues
  feedback: { type: 'success' | 'error'; message: string } | null
  feedbackRef: RefObject<HTMLParagraphElement | null>
  isPublishing: boolean
  onFieldChange: (
    event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
  ) => void
  onResourceFieldChange: (field: ResourceFormField, value: string | string[]) => void
  onRangeChange: (startDate: string, endDate: string) => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
}

export const HostEventForm = ({
  hostForm,
  feedback,
  feedbackRef,
  isPublishing,
  onFieldChange,
  onResourceFieldChange,
  onRangeChange,
  onSubmit,
}: HostEventFormProps) => {
  const [validationErrors, setValidationErrors] = useState<ResourceFormErrors>({})
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const errors = validateResourceForm(hostForm)
    setValidationErrors(errors)
    if (Object.keys(errors).length > 0) return
    onSubmit(event)
  }
  const handleResourceChange = (field: ResourceFormField, value: string | string[]) => {
    setValidationErrors((current) => ({ ...current, [field]: undefined }))
    onResourceFieldChange(field, value)
  }

  return (
  <section id="host" className="panel host-panel">
    <h2 className="text-2xl font-bold text-stone-900">Create an Event</h2>
    <p className="mt-2 text-sm text-stone-600">
      This profile can publish events as an organization. Profile type does not verify administrator
      authorization.
    </p>
    <form className="form-stack" onSubmit={handleSubmit}>
      <div className="grid gap-4 md:grid-cols-2">
        <label className="form-field">
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
        <label className="form-field">
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
      <label className="block max-w-xs space-y-2 text-sm text-stone-700">
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
        <legend className="mb-2 text-sm text-stone-700">Event dates</legend>
        <CalendarPicker
          mode="range"
          startDate={hostForm.startDate}
          endDate={hostForm.endDate}
          onRangeChange={onRangeChange}
        />
      </fieldset>
      <label className="form-field">
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
      <label className="form-field">
        <span>Short description</span>
        <textarea
          aria-label="Event description"
          name="description"
          value={hostForm.description}
          onChange={onFieldChange}
          className="input"
          placeholder="What is the event about?"
        />
      </label>
      <div className="grid gap-5 lg:grid-cols-2">
        <ResourceSectionForm
          section="offer"
          selectedResources={hostForm.resourcesOffered}
          description={hostForm.offerDescription}
          otherResource={hostForm.offerOtherResource}
          otherDescription={hostForm.offerOtherDescription}
          errors={validationErrors}
          onChange={handleResourceChange}
        />
        <ResourceSectionForm
          section="need"
          selectedResources={hostForm.resourcesNeeded}
          description={hostForm.needDescription}
          otherResource={hostForm.needOtherResource}
          otherDescription={hostForm.needOtherDescription}
          errors={validationErrors}
          onChange={handleResourceChange}
        />
      </div>
      <button
        type="submit"
        disabled={isPublishing}
        className="button-primary disabled:cursor-not-allowed"
      >
        {isPublishing ? 'Saving...' : 'Create Event'}
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
}

interface HostedEventsProps {
  events: EventItem[]
  eventRequests?: EventRequest[]
  profile: UserProfile | null
  onUpdate: (event: EventItem) => Promise<void>
  onPublish?: (event: EventItem) => Promise<void>
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
  resourcesOffered: string[]
  offerDescription: string
  offerOtherResource: string
  offerOtherDescription: string
  resourcesNeeded: string[]
  needDescription: string
  needOtherResource: string
  needOtherDescription: string
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
  resourcesOffered: event.resourcesOffered ?? [],
  offerDescription: event.offerDescription ?? '',
  offerOtherResource:
    event.resourcesOffered?.indexOf('Other') !== -1 ? event.offerOtherResource ?? '' : '',
  offerOtherDescription:
    event.resourcesOffered?.indexOf('Other') !== -1 ? event.offerOtherDescription ?? '' : '',
  resourcesNeeded: event.resourcesNeeded ?? [],
  needDescription: event.needDescription ?? '',
  needOtherResource:
    event.resourcesNeeded?.indexOf('Other') !== -1 ? event.needOtherResource ?? '' : '',
  needOtherDescription:
    event.resourcesNeeded?.indexOf('Other') !== -1 ? event.needOtherDescription ?? '' : '',
})

export const HostedEvents = ({
  events,
  eventRequests = [],
  profile,
  onUpdate,
  onPublish,
  onDelete,
}: HostedEventsProps) => {
  const [viewingEventId, setViewingEventId] = useState<string | null>(null)
  const [editingEventId, setEditingEventId] = useState<string | null>(null)
  const [editValues, setEditValues] = useState<EventEditValues | null>(null)
  const [savingEventId, setSavingEventId] = useState<string | null>(null)
  const [deletingEventId, setDeletingEventId] = useState<string | null>(null)
  const [managementNotice, setManagementNotice] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<{ eventId: string; message: string; error: boolean } | null>(
    null,
  )
  const [resourceErrors, setResourceErrors] = useState<ResourceFormErrors>({})
  const [workflowDialog, setWorkflowDialog] = useState<{
    event: EventItem
    action: 'ready' | 'publish' | 'start'
  } | null>(null)
  const [workflowConfirmed, setWorkflowConfirmed] = useState(false)
  const [workflowSubmitting, setWorkflowSubmitting] = useState(false)

  const hostedEvents = profile
    ? events.filter(
        (event) => event.hostId === profile.id || event.hostOwnerId === profile.ownerId,
      )
    : []
  const workflowRequests = workflowDialog
    ? eventRequests.filter(
        (request) =>
          request.eventId === workflowDialog.event.id && request.requestType === 'cohost',
      )
    : []
  const acceptedWorkflowPartners = workflowRequests.filter(
    (request) => request.status === 'accepted',
  )

  const updateEditField = (
    event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
  ) => {
    const { name, value } = event.target
    setEditValues((current) => (current ? { ...current, [name]: value } : current))
  }

  const updateEditResourceField = (field: ResourceFormField, value: string | string[]) => {
    setResourceErrors((current) => ({ ...current, [field]: undefined }))
    setEditValues((current) => {
      if (!current) return current
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

  const handleSave = async (event: EventItem) => {
    if (!editValues) return
    const nextResourceErrors = validateResourceForm(editValues)
    setResourceErrors(nextResourceErrors)
    if (Object.keys(nextResourceErrors).length > 0) {
      setFeedback({
        eventId: event.id,
        message: 'Complete the required We Offer and We Need fields.',
        error: true,
      })
      return
    }

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
        resourcesOffered: [...editValues.resourcesOffered],
        offerDescription: editValues.offerDescription.trim(),
        offerOtherResource:
          editValues.resourcesOffered.indexOf('Other') !== -1
            ? editValues.offerOtherResource.trim()
            : '',
        offerOtherDescription:
          editValues.resourcesOffered.indexOf('Other') !== -1
            ? editValues.offerOtherDescription.trim()
            : '',
        resourcesNeeded: [...editValues.resourcesNeeded],
        needDescription: editValues.needDescription.trim(),
        needOtherResource:
          editValues.resourcesNeeded.indexOf('Other') !== -1
            ? editValues.needOtherResource.trim()
            : '',
        needOtherDescription:
          editValues.resourcesNeeded.indexOf('Other') !== -1
            ? editValues.needOtherDescription.trim()
            : '',
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

  const handleCancel = async (event: EventItem) => {
    if (!window.confirm(`Cancel "${event.title}"? It will no longer be available to students or new co-hosts.`)) return
    setDeletingEventId(event.id)
    setFeedback(null)
    try {
      await onUpdate({ ...event, publicationStatus: 'cancelled' })
      setManagementNotice(`Event '${event.title}' was cancelled.`)
    } catch (error) {
      setFeedback({ eventId: event.id, error: true,
        message: error instanceof Error ? error.message : 'Could not cancel the event.' })
    } finally {
      setDeletingEventId(null)
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

  const handleWorkflowConfirmation = async () => {
    if (!workflowDialog || !workflowConfirmed || workflowSubmitting) return
    const { event, action } = workflowDialog
    setFeedback(null)
    setManagementNotice(null)
    const relatedRequests = eventRequests.filter(
      (request) => request.eventId === event.id && request.requestType === 'cohost',
    )
    if (relatedRequests.some((request) => request.status === 'pending')) {
      setFeedback({
        eventId: event.id,
        message: 'Resolve all pending co-host requests before continuing.',
        error: true,
      })
      return
    }

    setWorkflowSubmitting(true)
    try {
      const publicationStatus =
        action === 'publish'
          ? 'published'
          : action === 'ready'
            ? 'ready_to_publish'
            : 'pending_collaboration'
      if (action === 'publish') {
        if (!onPublish) throw new Error('Secure event publishing is unavailable.')
        await onPublish(event)
      } else {
        await onUpdate({
          ...event,
          publicationStatus,
          collaborationRequirementsCompleted: action === 'ready',
        })
      }
      setWorkflowDialog(null)
      setWorkflowConfirmed(false)
      setFeedback(null)
      setManagementNotice(
        action === 'publish'
          ? `Event '${event.title}' is now published.`
          : action === 'ready'
            ? `Collaboration requirements completed for '${event.title}'.`
            : `Event '${event.title}' is now open for collaboration.`,
      )
    } catch (error) {
      const errorDetails =
        typeof error === 'object' && error !== null
          ? error as { code?: unknown; message?: unknown }
          : null
      const errorCode =
        typeof errorDetails?.code === 'string' ? errorDetails.code : 'unknown'
      const errorMessage =
        typeof errorDetails?.message === 'string'
          ? errorDetails.message
          : error instanceof Error
            ? error.message
            : 'Unknown error'
      const operation =
        action === 'ready'
          ? 'mark event ready to publish (updateEventItem title check or Firestore transaction)'
          : action === 'start'
            ? 'start event collaboration (updateEventItem title check or Firestore transaction)'
            : 'publish event (publishEvent callable)'
      console.error('Event publication workflow operation failed', {
        operation,
        eventId: event.id,
        errorCode,
        errorMessage,
        error,
      })
      setManagementNotice(null)
      setFeedback({
        eventId: event.id,
        message: `Could not ${action === 'ready' ? 'complete collaboration' : action === 'start' ? 'start collaboration' : 'publish the event'}: ${errorMessage}`,
        error: true,
      })
    } finally {
      setWorkflowSubmitting(false)
    }
  }

  return (
    <section className="panel" aria-labelledby="hosted-events-heading">
      <h2 id="hosted-events-heading" className="text-2xl font-bold text-stone-900">
        Managing Events
      </h2>
      {managementNotice ? (
        <p role="status" className="event-feedback event-feedback-success mt-4">
          {managementNotice}
        </p>
      ) : null}
      <div className="mt-4 space-y-3">
        {hostedEvents.length === 0 ? (
          <p className="text-sm text-stone-600">Events created by this profile will appear here.</p>
        ) : (
          hostedEvents.map((event) => {
            const isAuthorizedCreator = profile?.ownerId === event.hostOwnerId
            const isEditing = editingEventId === event.id
            const publicationStatus = event.publicationStatus ?? 'draft'
            const relatedRequests = eventRequests.filter(
              (request) => request.eventId === event.id && request.requestType === 'cohost',
            )
            const pendingRequests = relatedRequests.filter((request) => request.status === 'pending')

            return (
              <article
                key={event.id}
                className="border border-stone-200 bg-stone-50 p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="font-semibold text-stone-900">{event.title}</h3>
                    <p className="mt-1 text-sm text-stone-600">
                      {event.location} · {event.attendees} / {event.capacity} participants
                    </p>
                    <p
                      className={`mt-2 inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${
                        publicationStatus === 'pending_collaboration'
                          ? 'border-[#F5C76E] bg-[#FFF3D6] text-[#92400E]'
                          : 'border-blue-100 bg-blue-50 text-blue-800'
                      }`}
                    >
                      {publicationStatus === 'pending_collaboration'
                        ? 'Pending Collaboration'
                        : publicationStatus === 'ready_to_publish'
                          ? 'Ready to Publish'
                          : publicationStatus.charAt(0).toUpperCase() +
                            publicationStatus.slice(1)}
                      {!event.publicationStatus ? ' · Legacy event' : ''}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      aria-expanded={viewingEventId === event.id}
                      onClick={() =>
                        setViewingEventId((current) => (current === event.id ? null : event.id))
                      }
                      className="border border-stone-300 bg-white px-3 py-1.5 text-sm font-medium text-stone-700 hover:bg-slate-100"
                    >
                      {viewingEventId === event.id ? 'Hide Details' : 'View Details'}
                    </button>
                    {isAuthorizedCreator ? (
                      <>
                        {publicationStatus === 'draft' ? (
                          <button
                            type="button"
                            disabled={workflowSubmitting || deletingEventId === event.id}
                            onClick={() => {
                              setWorkflowConfirmed(false)
                              setWorkflowDialog({ event, action: 'start' })
                            }}
                            className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 text-sm font-medium text-blue-700 hover:bg-blue-100 disabled:opacity-50"
                          >
                            Start Collaboration
                          </button>
                        ) : null}
                        {publicationStatus === 'pending_collaboration' ? (
                          <button
                            type="button"
                            disabled={workflowSubmitting || pendingRequests.length > 0}
                            onClick={() => {
                              setWorkflowConfirmed(false)
                              setWorkflowDialog({ event, action: 'ready' })
                            }}
                            className="rounded-full border border-violet-200 bg-violet-50 px-3 py-1.5 text-sm font-medium text-violet-700 hover:bg-violet-100 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {pendingRequests.length > 0
                              ? `${pendingRequests.length} Pending Request${pendingRequests.length === 1 ? '' : 's'}`
                              : 'Complete Collaboration'}
                          </button>
                        ) : null}
                        {publicationStatus === 'ready_to_publish' ? (
                          <button
                            type="button"
                            disabled={workflowSubmitting || pendingRequests.length > 0}
                            onClick={() => {
                              setWorkflowConfirmed(false)
                              setWorkflowDialog({ event, action: 'publish' })
                            }}
                            className="rounded-full bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            Publish Event
                          </button>
                        ) : null}
                        <button
                          type="button"
                          disabled={savingEventId === event.id || deletingEventId === event.id}
                          onClick={() => {
                            setEditingEventId(event.id)
                            setEditValues(eventToEditValues(event))
                            setFeedback(null)
                          }}
                          className="border border-blue-200 bg-blue-50 px-3 py-1.5 text-sm font-medium text-blue-700 hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Edit
                        </button>
                        {publicationStatus !== 'cancelled' && (event.collaborationVersion !== 2 || eventRequests.some(request => request.eventId === event.id)) ? (
                          <button
                            type="button"
                            disabled={deletingEventId === event.id || savingEventId === event.id}
                            onClick={() => void handleCancel(event)}
                            className="rounded-full border border-rose-200 bg-white px-3 py-1.5 text-sm font-medium text-rose-700 hover:bg-rose-50 disabled:opacity-50"
                          >
                            Cancel Event
                          </button>
                        ) : null}
                        <button
                          type="button"
                          disabled={deletingEventId === event.id || savingEventId === event.id}
                          onClick={() => void handleDelete(event)}
                          className="border border-rose-200 bg-rose-50 px-3 py-1.5 text-sm font-medium text-rose-700 hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {deletingEventId === event.id ? 'Deleting...' : 'Delete'}
                        </button>
                      </>
                    ) : null}
                  </div>
                </div>
                {!isAuthorizedCreator ? (
                  <p className="mt-3 text-xs text-stone-500">
                    Only the account that published this event can edit or delete it.
                  </p>
                ) : null}
                {viewingEventId === event.id ? (
                  <dl
                    role="region"
                    className="mt-4 grid gap-3 border-t border-stone-200 pt-4 text-sm sm:grid-cols-2"
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
                    <div className="sm:col-span-2"><ResourceDetails event={event} /></div>
                    <div><dt className="font-medium text-slate-600">Published</dt><dd className="text-slate-900">{new Date(event.createdAt).toLocaleString()}</dd></div>
                    <div><dt className="font-medium text-slate-600">Event ID</dt><dd className="break-all text-slate-900">{event.id}</dd></div>
                  </dl>
                ) : null}
                {isEditing && editValues ? (
                  <form
                    className="form-stack border-t border-stone-200 pt-4"
                    onSubmit={(submitEvent) => {
                      submitEvent.preventDefault()
                      void handleSave(event)
                    }}
                  >
                    <div className="grid gap-4 sm:grid-cols-2">
                      <label className="form-field">
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
                      <label className="form-field">
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
                      <label className="form-field">
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
                      <label className="form-field">
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
                      <legend className="mb-2 text-sm text-stone-700">Event dates</legend>
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
                    <label className="form-field">
                      <span>Description</span>
                      <textarea
                        aria-label={`Edit description for ${event.title}`}
                        name="description"
                        value={editValues.description}
                        onChange={updateEditField}
                        className="input"
                      />
                    </label>
                    <div className="grid gap-5 lg:grid-cols-2">
                      <ResourceSectionForm
                      section="offer"
                      selectedResources={editValues.resourcesOffered}
                      description={editValues.offerDescription}
                      otherResource={editValues.offerOtherResource}
                      otherDescription={editValues.offerOtherDescription}
                      errors={resourceErrors}
                      onChange={updateEditResourceField}
                      />
                      <ResourceSectionForm
                      section="need"
                      selectedResources={editValues.resourcesNeeded}
                      description={editValues.needDescription}
                      otherResource={editValues.needOtherResource}
                      otherDescription={editValues.needOtherDescription}
                      errors={resourceErrors}
                      onChange={updateEditResourceField}
                      />
                    </div>
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
                        className="border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-700 hover:bg-slate-100"
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
      {workflowDialog ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4"
          role="presentation"
          onMouseDown={(mouseEvent) => {
            if (mouseEvent.target === mouseEvent.currentTarget && !workflowSubmitting) {
              setWorkflowDialog(null)
              setWorkflowConfirmed(false)
            }
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="publication-dialog-title"
            className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 id="publication-dialog-title" className="text-xl font-bold text-slate-950">
                  {workflowDialog.action === 'publish'
                    ? 'Confirm event publication'
                    : workflowDialog.action === 'ready'
                      ? 'Complete collaboration arrangements'
                      : 'Open event for collaboration'}
                </h2>
                <p className="mt-1 text-sm text-slate-600">{workflowDialog.event.title}</p>
              </div>
              <button
                type="button"
                aria-label="Close publication confirmation"
                disabled={workflowSubmitting}
                onClick={() => {
                  setWorkflowDialog(null)
                  setWorkflowConfirmed(false)
                }}
                className="rounded-full border border-slate-300 px-3 py-1 text-sm text-slate-700 disabled:opacity-50"
              >
                Close
              </button>
            </div>
            {workflowDialog.action === 'publish' ? (
              <div className="mt-5 space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm">
                <p><span className="font-semibold text-slate-800">Location:</span> {workflowDialog.event.location}</p>
                <p><span className="font-semibold text-slate-800">Dates:</span> {workflowDialog.event.dateOptions.map(formatDateLabel).join(', ') || 'No dates set'}</p>
                <p><span className="font-semibold text-slate-800">Capacity:</span> {workflowDialog.event.capacity}</p>
                <p className="font-semibold text-slate-800">Confirmed collaboration partners</p>
                {acceptedWorkflowPartners.length > 0 ? (
                  <ul className="list-inside list-disc text-slate-700">
                    {acceptedWorkflowPartners.map((request) => (
                      <li key={request.id}>{request.requesterName}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-slate-600">No co-hosting requests were accepted.</p>
                )}
              </div>
            ) : (
              <p className="mt-5 text-sm leading-6 text-slate-700">
                {workflowDialog.action === 'ready'
                  ? 'Confirm that the necessary resources and partner agreements are satisfied. All pending co-host requests must be accepted or declined first.'
                  : 'This event will become discoverable to eligible organizations for co-hosting. It will remain hidden from students.'}
              </p>
            )}
            <label className="mt-5 flex items-start gap-3 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={workflowConfirmed}
                disabled={workflowSubmitting}
                onChange={(changeEvent) => setWorkflowConfirmed(changeEvent.target.checked)}
                className="mt-1"
              />
              <span>
                {workflowDialog.action === 'publish'
                  ? 'I confirm these event details and want to publish this event.'
                  : workflowDialog.action === 'ready'
                    ? 'I confirm all necessary collaboration arrangements are complete.'
                    : 'I confirm this event is ready to seek co-hosting requests.'}
              </span>
            </label>
            <button
              type="button"
              disabled={!workflowConfirmed || workflowSubmitting}
              onClick={() => void handleWorkflowConfirmation()}
              className="mt-5 w-full rounded-full bg-blue-600 px-5 py-3 font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {workflowSubmitting
                ? 'Saving...'
                : workflowDialog.action === 'publish'
                  ? 'Confirm Publish'
                  : workflowDialog.action === 'ready'
                    ? 'Mark Ready to Publish'
                    : 'Start Collaboration'}
            </button>
          </section>
        </div>
      ) : null}
    </section>
  )
}
