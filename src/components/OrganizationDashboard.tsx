import type { ChangeEvent, FormEvent, RefObject } from 'react'
import type { EventItem, EventRequest, InboxNotice, UserProfile } from '../types'
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
  onUpdateEvent: (event: EventItem) => Promise<void>
  onDeleteEvent: (event: EventItem) => Promise<void>
  onDraftChange: (eventId: string, field: 'attendeeCount' | 'message', value: string) => void
  onDatesChange: (eventId: string, dates: string[]) => void
  onRequest: (event: EventItem, requestKind: 'participation' | 'cohost') => void
  onResolveRequest: (
    request: EventRequest,
    status: Extract<EventRequest['status'], 'accepted' | 'declined'>,
  ) => Promise<void>
  onMarkRead: (noticeId: string) => void
}

export const OrganizationDashboard = ({
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
    <>
      <div className="mb-6">
        <p className="text-sm uppercase tracking-[0.2em] text-violet-600">Organization dashboard</p>
        <h2 className="mt-1 text-3xl font-bold text-slate-900">Build campus collaborations</h2>
        <p className="mt-2 text-slate-600">
          Publish events and connect with other campus organizations.
        </p>
      </div>
      <div className="grid gap-6 lg:grid-cols-[1.3fr_0.7fr]">
        <div className="space-y-6">
          <HostEventForm
            hostForm={hostForm}
            feedback={eventFormFeedback}
            feedbackRef={eventFeedbackRef}
            isPublishing={isPublishing}
            onFieldChange={onHostFieldChange}
            onRangeChange={onHostRangeChange}
            onSubmit={onHostEvent}
          />
          <HostedEvents
            events={events}
            profile={activeProfile}
            onUpdate={onUpdateEvent}
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
          <CollaborationRequests
            requests={collaborationRequests}
            events={events}
            profile={activeProfile}
            onResolveRequest={onResolveRequest}
          />
        </div>
        <aside className="space-y-6">
          <ProfilePanel
            activeProfile={activeProfile}
            profiles={profiles}
            authUserId={authUserId}
            onSelectProfile={onSelectProfile}
          />
          <CreateProfileForm
            profileForm={profileForm}
            onFieldChange={onProfileFieldChange}
            onSubmit={onCreateProfile}
          />
          <InboxPanel
            inbox={inbox}
            profileId={activeProfile?.id ?? null}
            onMarkRead={onMarkRead}
          />
        </aside>
      </div>
    </>
  )
}
