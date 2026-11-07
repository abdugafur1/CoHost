import { useMemo, useState } from 'react'
import type { CoHostRequestDetails, RequestDraftValues } from './DashboardComponents'
import type { EventItem, PublicOrganization, UserProfile } from '../types'
import { EventList } from './DashboardComponents'
import {
  clubEventTypes,
  clubInterests,
  clubResources,
  filterOrganizations,
  type ClubDirectoryFilters,
} from './clubDiscoveryOptions'

interface ClubDiscoveryProps {
  organizations: PublicOrganization[]
  events: EventItem[]
  activeProfile: UserProfile | null
  authUserId: string | null
  requestDrafts: Record<string, RequestDraftValues>
  isLoading: boolean
  error: string | null
  onDraftChange: (
    eventId: string,
    field: 'attendeeCount' | 'message',
    value: string,
  ) => void
  onDatesChange: (eventId: string, dates: string[]) => void
  onRequest: (
    event: EventItem,
    requestKind: 'participation' | 'cohost',
    coHostDetails?: CoHostRequestDetails,
  ) => Promise<boolean>
}

const emptyFilters: ClubDirectoryFilters = {
  search: '',
  interest: '',
  eventType: '',
  resource: '',
}

const TagList = ({ values }: { values: string[] }) =>
  values.length ? (
    <ul className="mt-2 flex flex-wrap gap-2">
      {values.map((value) => (
        <li
          key={value}
          className="rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700"
        >
          {value}
        </li>
      ))}
    </ul>
  ) : (
    <p className="mt-2 text-sm text-slate-500">Not specified</p>
  )

export const ClubDiscovery = ({
  organizations,
  events,
  activeProfile,
  authUserId,
  requestDrafts,
  isLoading,
  error,
  onDraftChange,
  onDatesChange,
  onRequest,
}: ClubDiscoveryProps) => {
  const [filters, setFilters] = useState(emptyFilters)
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null)
  const [showOpportunities, setShowOpportunities] = useState(false)
  const matchingOrganizations = useMemo(
    () => filterOrganizations(organizations, filters),
    [organizations, filters],
  )
  const selectedOrganization =
    organizations.find((organization) => organization.profileId === selectedProfileId) ?? null
  const clubEvents = selectedOrganization
    ? events.filter(
        (event) =>
          event.hostId === selectedOrganization.profileId &&
          event.hostProfileType === 'organization',
      )
    : []
  const canRequest = Boolean(
    activeProfile && authUserId && activeProfile.ownerId === authUserId,
  )
  const requestKind = activeProfile?.profileType === 'organization' ? 'cohost' : 'participation'

  const setFilter = (field: keyof ClubDirectoryFilters, value: string) => {
    setFilters((current) => ({ ...current, [field]: value }))
  }

  const viewOrganization = (profileId: string) => {
    setSelectedProfileId(profileId)
    setShowOpportunities(false)
  }

  if (selectedOrganization) {
    const interests =
      selectedOrganization.interests.length > 0
        ? selectedOrganization.interests
        : [selectedOrganization.focus]

    return (
      <section
        className="club-discovery-page space-y-6"
        aria-labelledby="club-details-heading"
      >
        <button
          type="button"
          className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-blue-50"
          onClick={() => {
            setSelectedProfileId(null)
            setShowOpportunities(false)
          }}
        >
          Back to Discover Clubs
        </button>
        <article className="panel club-detail-card">
          <div className="flex flex-wrap items-start gap-4">
            <div className="club-avatar" aria-hidden="true">
              {selectedOrganization.name.trim().charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold uppercase tracking-wide text-violet-700">
                Campus organization
              </p>
              <h2 id="club-details-heading" className="mt-1 text-3xl font-bold text-slate-900">
                {selectedOrganization.name}
              </h2>
              <p className="mt-2 text-sm text-slate-600">{selectedOrganization.location}</p>
            </div>
          </div>
          <p className="mt-6 whitespace-pre-wrap text-slate-700">
            {selectedOrganization.description || 'This club has not added a description yet.'}
          </p>
          <div className="mt-6 grid gap-5 sm:grid-cols-2">
            <section>
              <h3 className="font-semibold text-slate-900">Interests</h3>
              <TagList values={interests} />
            </section>
            <section>
              <h3 className="font-semibold text-slate-900">Event types</h3>
              <TagList values={selectedOrganization.eventTypes} />
            </section>
            <section>
              <h3 className="font-semibold text-slate-900">Available resources</h3>
              <TagList values={selectedOrganization.availableResources} />
            </section>
            <section>
              <h3 className="font-semibold text-slate-900">Collaboration preferences</h3>
              <TagList values={selectedOrganization.collaborationPreferences} />
            </section>
          </div>
          <button
            type="button"
            className="button-primary mt-6"
            aria-expanded={showOpportunities}
            onClick={() => setShowOpportunities((current) => !current)}
          >
            {showOpportunities ? 'Hide Collaboration Opportunities' : 'View Collaboration Opportunities'}
          </button>
        </article>
        {showOpportunities ? (
          <EventList
            events={clubEvents}
            activeProfile={activeProfile}
            requestDrafts={requestDrafts}
            requestKind={requestKind}
            canRequest={canRequest}
            onDraftChange={onDraftChange}
            onDatesChange={onDatesChange}
            onRequest={onRequest}
          />
        ) : null}
      </section>
    )
  }

  return (
    <section className="club-discovery-page space-y-6" aria-labelledby="club-discovery-heading">
      <header>
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-blue-700">
          Find your next campus partner
        </p>
        <h2 id="club-discovery-heading" className="mt-1 text-3xl font-bold text-slate-900">
          Discover Clubs
        </h2>
        <p className="mt-2 max-w-2xl text-slate-600">
          Find organizations with shared interests, event ideas, or resources to collaborate.
        </p>
      </header>

      <section className="panel space-y-4" aria-label="Club filters">
        <label className="block space-y-2 text-sm font-medium text-slate-700">
          <span>Search clubs</span>
          <input
            type="search"
            aria-label="Search clubs"
            className="input"
            placeholder="Search names and descriptions"
            value={filters.search}
            onChange={(event) => setFilter('search', event.target.value)}
          />
        </label>
        <div className="grid gap-4 sm:grid-cols-3">
          <label className="block space-y-2 text-sm font-medium text-slate-700">
            <span>Interest</span>
            <select
              aria-label="Filter by interest"
              className="input"
              value={filters.interest}
              onChange={(event) => setFilter('interest', event.target.value)}
            >
              <option value="">All interests</option>
              {clubInterests.map((interest) => (
                <option key={interest}>{interest}</option>
              ))}
            </select>
          </label>
          <label className="block space-y-2 text-sm font-medium text-slate-700">
            <span>Event type</span>
            <select
              aria-label="Filter by event type"
              className="input"
              value={filters.eventType}
              onChange={(event) => setFilter('eventType', event.target.value)}
            >
              <option value="">All event types</option>
              {clubEventTypes.map((eventType) => (
                <option key={eventType}>{eventType}</option>
              ))}
            </select>
          </label>
          <label className="block space-y-2 text-sm font-medium text-slate-700">
            <span>Available resource</span>
            <select
              aria-label="Filter by resource"
              className="input"
              value={filters.resource}
              onChange={(event) => setFilter('resource', event.target.value)}
            >
              <option value="">All resources</option>
              {clubResources.map((resource) => (
                <option key={resource}>{resource}</option>
              ))}
            </select>
          </label>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p role="status" className="text-sm font-medium text-slate-600">
            {matchingOrganizations.length} matching clubs
          </p>
          <button
            type="button"
            className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            onClick={() => setFilters(emptyFilters)}
          >
            Clear Filters
          </button>
        </div>
      </section>

      {isLoading ? (
        <p role="status" className="panel text-slate-600">
          Loading public organizations…
        </p>
      ) : error ? (
        <p role="alert" className="panel text-rose-700">
          Could not load the organization directory: {error}
        </p>
      ) : matchingOrganizations.length === 0 ? (
        <p className="panel text-slate-600">
          {organizations.length === 0
            ? 'No organizations have chosen to appear in the public directory yet.'
            : 'No clubs match those filters. Try changing or clearing your filters.'}
        </p>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {matchingOrganizations.map((organization) => (
            <article key={organization.profileId} className="panel club-card flex flex-col">
              <div className="flex items-start gap-3">
                <div className="club-avatar club-avatar-small" aria-hidden="true">
                  {organization.name.trim().charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <h3 className="text-xl font-bold text-slate-900">{organization.name}</h3>
                  <p className="mt-1 text-sm text-slate-500">{organization.location}</p>
                </div>
              </div>
              <p className="mt-4 line-clamp-3 text-sm text-slate-600">
                {organization.description || 'No description provided.'}
              </p>
              <dl className="mt-4 space-y-3 text-sm">
                <div>
                  <dt className="font-semibold text-slate-800">Area of interest</dt>
                  <dd className="mt-1 text-slate-600">
                    {organization.interests.length
                      ? organization.interests.join(', ')
                      : organization.focus}
                  </dd>
                </div>
                <div>
                  <dt className="font-semibold text-slate-800">Event types</dt>
                  <dd className="mt-1 text-slate-600">
                    {organization.eventTypes.length
                      ? organization.eventTypes.join(', ')
                      : 'Not specified'}
                  </dd>
                </div>
                <div>
                  <dt className="font-semibold text-slate-800">Available resources</dt>
                  <dd className="mt-1 text-slate-600">
                    {organization.availableResources.length
                      ? organization.availableResources.join(', ')
                      : 'Not specified'}
                  </dd>
                </div>
              </dl>
              <button
                type="button"
                className="mt-auto rounded-full border border-blue-200 bg-blue-50 px-4 py-2.5 font-semibold text-blue-700 transition hover:bg-blue-100"
                onClick={() => viewOrganization(organization.profileId)}
              >
                View Club
              </button>
            </article>
          ))}
        </div>
      )}
    </section>
  )
}
