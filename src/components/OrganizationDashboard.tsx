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

interface OrganizationDashboardProps {
  activeProfile: UserProfile | null
  events: EventItem[]
  eventRequests?: EventRequest[]
  hostForm: HostFormValues
  requestDrafts: Record<string, RequestDraftValues>
  view?: 'dashboard' | 'events'
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
  onDeleteEvent: (event: EventItem) => Promise<void>
  onDraftChange: (eventId: string, field: 'attendeeCount' | 'message', value: string) => void
  onDatesChange: (eventId: string, dates: string[]) => void
  onRequest: (
    event: EventItem,
    requestKind: 'participation' | 'cohost',
    coHostDetails?: CoHostRequestDetails,
  ) => Promise<boolean>
}

export const OrganizationDashboard = ({
  activeProfile,
  events,
  eventRequests = [],
  hostForm,
  requestDrafts,
  view = 'dashboard',
  eventFormFeedback,
  eventFeedbackRef,
  isPublishing,
  onHostFieldChange,
  onHostResourceFieldChange,
  onHostRangeChange,
  onHostEvent,
  onUpdateEvent,
  onPublishEvent,
  onDeleteEvent,
  onDraftChange,
  onDatesChange,
  onRequest,
}: OrganizationDashboardProps) => {
  const opportunities = events.filter(
    (event) =>
      event.hostProfileType === 'organization' &&
      event.publicationStatus === 'pending_collaboration' &&
      event.hostId !== activeProfile?.id &&
      event.hostOwnerId !== activeProfile?.ownerId,
  )

  return (
    <>
      {view === 'dashboard' ? (
        <div className="mb-6">
          <p className="text-sm uppercase tracking-[0.2em] text-violet-600">
            Organization dashboard
          </p>
          <h2 className="mt-1 text-3xl font-bold text-slate-900">Build campus collaborations</h2>
          <p className="mt-2 text-slate-600">
            Create events, find collaborators, and publish when arrangements are complete.
          </p>
        </div>
      ) : null}
      <div className="grid gap-6">
        <div id="events" className="space-y-6">
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
      </div>
    </>
  )
}
