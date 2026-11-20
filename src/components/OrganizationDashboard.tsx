import type { ChangeEvent, FormEvent, RefObject } from 'react'
import type { EventItem, EventRequest, UserProfile } from '../types'
import {
  EventList,
  HostedEvents,
  HostEventForm,
  type CoHostRequestDetails,
  type HostFormValues,
  type ResourceFormField,
  type RequestDraftValues,
} from './DashboardComponents'
import { formatDateLabel, managedEventId, publicationStatusLabels } from './eventManagement'
import type { RequestPageSelection } from './RequestsPage'

interface OrganizationOverviewProps {
  profile: UserProfile
  events: EventItem[]
  requests: EventRequest[]
  onOpenEvents: (target?: string) => void
  onOpenRequests: (selection?: RequestPageSelection) => void
}

const summaryIcons = {
  events: 'M4 6h16v14H4zM4 10h16M8 4v4m8-4v4',
  requests: 'M4 5h16v11H9l-5 4zM8 9h8m-8 3h5',
  ready: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zm-4-9 3 3 5-6',
}

export const OrganizationDashboard = ({
  profile,
  events,
  requests,
  onOpenEvents,
  onOpenRequests,
}: OrganizationOverviewProps) => {
  const ownedEvents = events.filter(
    (event) => event.hostId === profile.id && event.hostOwnerId === profile.ownerId,
  )
  const incoming = requests.filter(
    (request) => request.hostProfileId === profile.id && request.hostOwnerId === profile.ownerId,
  )
  const pendingRequests = incoming.filter((request) => request.status === 'pending')
  const readyEvents = ownedEvents.filter((event) => event.publicationStatus === 'ready_to_publish')
  const activeEvents = ownedEvents.filter((event) => event.publicationStatus !== 'cancelled')
  const coHostRequests = new Map<string, EventRequest[]>()
  for (const request of incoming) {
    if (request.requestType === 'cohost') {
      const eventRequests = coHostRequests.get(request.eventId) ?? []
      eventRequests.push(request)
      coHostRequests.set(request.eventId, eventRequests)
    }
  }
  const pendingCoHosts = (eventId: string) =>
    (coHostRequests.get(eventId) ?? []).filter((request) => request.status === 'pending')

  const coHostReviews = ownedEvents
    .filter((event) => event.publicationStatus === 'pending_collaboration')
    .map((event) => ({ event, pending: pendingCoHosts(event.id) }))
    .filter(({ pending }) => pending.length > 0)
  const workspaceEventIds = new Set(coHostReviews.map(({ event }) => event.id))
  const otherPending = pendingRequests.filter(
    (request) => request.requestType !== 'cohost' || !workspaceEventIds.has(request.eventId),
  )
  const recentEvents = activeEvents
    .sort((first, second) => second.createdAt.localeCompare(first.createdAt))
    .slice(0, 3)
  const summary = [
    { icon: 'events', label: 'Owned events', value: ownedEvents.length, detail: `${activeEvents.length} active` },
    { icon: 'requests', label: 'Pending requests', value: pendingRequests.length, detail: 'Incoming requests awaiting review' },
    { icon: 'ready', label: 'Ready to publish', value: readyEvents.length, detail: 'Awaiting publication confirmation' },
  ] as const

  const eventLink = (event: EventItem, label: string, className: string, accessibleLabel?: string) => {
    const target = managedEventId(event.id)
    return (
      <a className={className} href={`#${target}`} aria-label={accessibleLabel} onClick={(click) => {
        click.preventDefault()
        onOpenEvents(target)
      }}>
        {label}
      </a>
    )
  }

  return (
    <div className="org-dashboard">
      <section aria-label="Organization dashboard">
        <div className="org-welcome">
          <p className="eyebrow">Organization Dashboard</p>
          <h2>Welcome, {profile.name}</h2>
          <p>Keep track of your events, review incoming requests, and see what’s ready to publish.</p>
        </div>
        <dl className="org-summary" aria-label="Event overview">
          {summary.map(({ icon, label, value, detail }) => (
            <div key={icon} className="org-summary-card">
              <dt>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d={summaryIcons[icon]} />
                </svg>
                {label}
              </dt>
              <dd>{value}</dd>
              <dd className="org-summary-detail">{detail}</dd>
            </div>
          ))}
        </dl>
      </section>

      <nav className="org-shortcuts" aria-labelledby="org-shortcuts-heading">
        <h2 id="org-shortcuts-heading">Quick Actions</h2>
        <button type="button" className="button-primary" onClick={() => onOpenEvents('host')}>Create Event</button>
        <a className="button-secondary" href="#requests" onClick={(click) => {
          click.preventDefault()
          onOpenRequests()
        }}>Review Requests</a>
        <a className="button-secondary" href="#hosted-events-heading" onClick={(click) => {
          click.preventDefault()
          onOpenEvents('hosted-events-heading')
        }}>Manage Events</a>
      </nav>

      <div className="org-dashboard-columns">
        <section aria-labelledby="attention-heading">
          <h2 id="attention-heading" className="org-section-heading">Needs Your Attention</h2>
          {coHostReviews.length + readyEvents.length + otherPending.length > 0 ? (
            <ul className="org-card-list">
              {coHostReviews.map(({ event, pending }) => (
                <li key={event.id} className="org-overview-card org-attention-card">
                  <div>
                    <span className="org-status org-status-action">Pending Collaboration</span>
                    <h3>{event.title}</h3>
                    <p>{pending.length} pending co-host {pending.length === 1 ? 'request' : 'requests'}</p>
                    <p>{[...new Set(pending.map((request) => request.requesterName))].join(', ')}</p>
                  </div>
                  {eventLink(event, 'Review co-host requests', 'button-secondary', `Review co-host requests for ${event.title}`)}
                </li>
              ))}
              {otherPending.map((request) => (
                <li key={`${request.requestType}:${request.id}`} className="org-overview-card org-attention-card">
                  <div>
                    <span className="org-status org-status-action">Pending Review</span>
                    <h3>{ownedEvents.find((event) => event.id === request.eventId)?.title ?? request.eventTitle}</h3>
                    <p>{request.requesterName} · 1 {request.requestType === 'cohost' ? 'co-host' : 'participation'} request</p>
                  </div>
                  <button
                    type="button"
                    className="button-secondary"
                    aria-label={`Review request from ${request.requesterName}`}
                    onClick={() => onOpenRequests({ id: request.id, requestType: request.requestType })}
                  >
                    Review request
                  </button>
                </li>
              ))}
              {readyEvents.map((event) => (
                <li key={event.id} className="org-overview-card org-attention-card">
                  <div>
                    <span className="org-status org-status-action">Ready to Publish</span>
                    <h3>{event.title}</h3>
                    <p>Collaboration complete</p>
                  </div>
                  {eventLink(event, 'Review publication', 'button-secondary', `Review publication for ${event.title}`)}
                </li>
              ))}
            </ul>
          ) : <p className="org-overview-card org-empty">You’re all caught up.</p>}
        </section>

        <section aria-labelledby="recent-events-heading">
          <h2 id="recent-events-heading" className="org-section-heading">Recent Events</h2>
          {recentEvents.length > 0 ? (
            <ul className="org-card-list">
              {recentEvents.map((event) => {
                const status = event.publicationStatus ?? 'draft'
                const pending = pendingCoHosts(event.id).length
                const confirmed = (event.confirmedCoHosts ?? (coHostRequests.get(event.id) ?? [])
                  .filter((request) => request.status === 'accepted')).length
                const progress = [
                  pending > 0 ? `${pending} pending co-host ${pending === 1 ? 'request' : 'requests'}` : '',
                  confirmed > 0 ? `${confirmed} confirmed ${confirmed === 1 ? 'co-host' : 'co-hosts'}` : '',
                ].filter(Boolean).join(' · ')
                const firstDate = event.dateOptions[0]
                const lastDate = event.dateOptions[event.dateOptions.length - 1]
                const dates = !firstDate ? 'Date to be set' : firstDate === lastDate
                  ? formatDateLabel(firstDate)
                  : `${formatDateLabel(firstDate)} – ${formatDateLabel(lastDate ?? firstDate)}`
                return (
                  <li key={event.id} className="org-overview-card org-recent-card">
                    <span className={`org-status org-status-${status}`}>
                      {publicationStatusLabels[status]}
                    </span>
                    <h3>{eventLink(event, event.title, 'text-link')}</h3>
                    <p>{dates}</p>
                    <p>{event.location}</p>
                    {progress ? <p className="org-progress">{progress}</p> : null}
                  </li>
                )
              })}
            </ul>
          ) : <p className="org-overview-card org-empty">No recent active events.</p>}
        </section>
      </div>
    </div>
  )
}

interface OrganizationEventsProps {
  activeProfile: UserProfile | null
  events: EventItem[]
  eventRequests?: EventRequest[]
  hostForm: HostFormValues
  requestDrafts: Record<string, RequestDraftValues>
  eventFormFeedback: { type: 'success' | 'error'; message: string } | null
  eventFeedbackRef: RefObject<HTMLParagraphElement | null>
  isPublishing: boolean
  onHostFieldChange: (
    event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
  ) => void
  onHostResourceFieldChange: (field: ResourceFormField, value: string | string[]) => void
  onHostRangeChange: (startDate: string, endDate: string) => void
  onHostEvent: (event: FormEvent<HTMLFormElement>) => void
  onUpdateEvent: (event: EventItem) => Promise<void>
  onPublishEvent?: (event: EventItem) => Promise<void>
  onResolveRequest?: (
    request: EventRequest,
    status: 'accepted' | 'declined',
  ) => Promise<boolean>
  onDeleteEvent: (event: EventItem) => Promise<void>
  onDraftChange: (eventId: string, field: 'attendeeCount' | 'message', value: string) => void
  onDatesChange: (eventId: string, dates: string[]) => void
  onRequest: (
    event: EventItem,
    requestKind: 'participation' | 'cohost',
    coHostDetails?: CoHostRequestDetails,
  ) => Promise<boolean>
}

export const OrganizationEvents = ({
  activeProfile,
  events,
  eventRequests = [],
  hostForm,
  requestDrafts,
  eventFormFeedback,
  eventFeedbackRef,
  isPublishing,
  onHostFieldChange,
  onHostResourceFieldChange,
  onHostRangeChange,
  onHostEvent,
  onUpdateEvent,
  onPublishEvent,
  onResolveRequest,
  onDeleteEvent,
  onDraftChange,
  onDatesChange,
  onRequest,
}: OrganizationEventsProps) => {
  const opportunities = events.filter(
    (event) =>
      event.hostProfileType === 'organization' &&
      event.publicationStatus === 'pending_collaboration' &&
      event.hostId !== activeProfile?.id &&
      event.hostOwnerId !== activeProfile?.ownerId,
  )

  return (
    <div className="space-y-6">
      <HostEventForm
        hostForm={hostForm}
        feedback={eventFormFeedback}
        feedbackRef={eventFeedbackRef}
        isPublishing={isPublishing}
        onFieldChange={onHostFieldChange}
        onResourceFieldChange={onHostResourceFieldChange}
        onRangeChange={onHostRangeChange}
        onSubmit={onHostEvent}
      />
      <HostedEvents
        events={events}
        eventRequests={eventRequests}
        profile={activeProfile}
        onUpdate={onUpdateEvent}
        onPublish={onPublishEvent}
        onResolveRequest={onResolveRequest}
        onDelete={onDeleteEvent}
      />
      <EventList
        events={opportunities}
        activeProfile={activeProfile}
        requestDrafts={requestDrafts}
        requestKind="cohost"
        onDraftChange={onDraftChange}
        onDatesChange={onDatesChange}
        onRequest={onRequest}
      />
    </div>
  )
}
