import type { ChangeEvent, FormEvent, RefObject } from 'react'
import type { EventItem, EventRequest, InboxNotice, UserProfile, WorkspacePage } from '../types'
import {
  CollaborationRequests,
  CreateProfileForm,
  EventList,
  HostedEvents,
  HostEventForm,
  InboxPanel,
  ProfilePanel,
  type HostFormValues,
  type ProfileFormValues,
  type RequestDraftValues,
} from './DashboardComponents'

interface OrganizationDashboardProps {
  page: WorkspacePage
  discoveryEventId: string | null
  onSelectDiscoveryEvent: (eventId: string | null) => void
  activeProfile: UserProfile | null
  profiles: UserProfile[]
  authUserId: string | null
  events: EventItem[]
  inbox: InboxNotice[]
  collaborationRequests: EventRequest[]
  profileForm: ProfileFormValues
  hostForm: HostFormValues
  requestDrafts: Record<string, RequestDraftValues>
  eventFormFeedback: { type: 'success' | 'error'; message: string } | null
  eventFeedbackRef: RefObject<HTMLParagraphElement | null>
  isPublishing: boolean
  onSelectProfile: (profileId: string) => void
  onCreateProfile: (event: FormEvent<HTMLFormElement>) => void
  onProfileFieldChange: (
    event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
  ) => void
  onHostFieldChange: (
    event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
  ) => void
  onHostRangeChange: (startDate: string, endDate: string) => void
  onHostEvent: (event: FormEvent<HTMLFormElement>) => void
  onResetHostForm: () => void
  onUpdateEvent: (event: EventItem) => Promise<void>
  onDeleteEvent: (event: EventItem) => Promise<void>
  onDraftChange: (eventId: string, field: 'attendeeCount' | 'message', value: string) => void
  onDatesChange: (eventId: string, dates: string[]) => void
  onRequest: (event: EventItem, requestKind: 'participation' | 'cohost') => Promise<boolean>
  onResolveRequest: (
    request: EventRequest,
    status: Extract<EventRequest['status'], 'accepted' | 'declined'>,
  ) => Promise<void>
  onMarkRead: (noticeId: string) => void
}

export const OrganizationDashboard = ({
  page,
  discoveryEventId,
  onSelectDiscoveryEvent,
  activeProfile,
  profiles,
  authUserId,
  events,
  inbox,
  collaborationRequests,
  profileForm,
  hostForm,
  requestDrafts,
  eventFormFeedback,
  eventFeedbackRef,
  isPublishing,
  onSelectProfile,
  onCreateProfile,
  onProfileFieldChange,
  onHostFieldChange,
  onHostRangeChange,
  onHostEvent,
  onResetHostForm,
  onUpdateEvent,
  onDeleteEvent,
  onDraftChange,
  onDatesChange,
  onRequest,
  onResolveRequest,
  onMarkRead,
}: OrganizationDashboardProps) => {
  const opportunities = events.filter(
    (event) =>
      event.hostProfileType === 'organization' &&
      event.hostId !== activeProfile?.id &&
      event.hostOwnerId !== activeProfile?.ownerId,
  )

  return (
    <div className="focused-workspace">
      {page === 'events' ? (
        <EventList
          key={activeProfile?.id ?? 'guest'}
          events={opportunities}
          activeProfile={activeProfile}
          requestDrafts={requestDrafts}
          requestKind="cohost"
          requests={collaborationRequests}
          initialEventId={discoveryEventId}
          onSelectEvent={onSelectDiscoveryEvent}
          onDraftChange={onDraftChange}
          onDatesChange={onDatesChange}
          onRequest={onRequest}
        />
      ) : null}
      {page === 'host' ? (
        <HostEventForm
          hostForm={hostForm}
          feedback={eventFormFeedback}
          feedbackRef={eventFeedbackRef}
          isPublishing={isPublishing}
          onFieldChange={onHostFieldChange}
          onRangeChange={onHostRangeChange}
          onSubmit={onHostEvent}
          onReset={onResetHostForm}
        />
      ) : null}
      {page === 'manage' ? (
        <HostedEvents events={events} profile={activeProfile}
          onUpdate={onUpdateEvent} onDelete={onDeleteEvent} />
      ) : null}
      {page === 'inbox' ? (
        <div className="space-y-6">
          <CollaborationRequests requests={collaborationRequests} events={events}
            profile={activeProfile} onResolveRequest={onResolveRequest} />
          <InboxPanel inbox={inbox} profileId={activeProfile?.id ?? null} onMarkRead={onMarkRead} />
        </div>
      ) : null}
      {page === 'profile' ? (
        <div className="space-y-6">
          <ProfilePanel activeProfile={activeProfile} profiles={profiles}
            authUserId={authUserId} onSelectProfile={onSelectProfile} />
          <CreateProfileForm profileForm={profileForm}
            onFieldChange={onProfileFieldChange} onSubmit={onCreateProfile} />
        </div>
      ) : null}
    </div>
  )
}
