import type { ChangeEvent, FormEvent } from 'react'
import type { EventItem, EventRequest, InboxNotice, UserProfile, WorkspacePage } from '../types'
import {
  CreateProfileForm,
  EventList,
  InboxPanel,
  ProfilePanel,
  type ProfileFormValues,
  type RequestDraftValues,
} from './DashboardComponents'

interface StudentDashboardProps {
  page: WorkspacePage
  discoveryEventId: string | null
  onSelectDiscoveryEvent: (eventId: string | null) => void
  requests: EventRequest[]
  activeProfile: UserProfile | null
  profiles: UserProfile[]
  authUserId: string | null
  events: EventItem[]
  inbox: InboxNotice[]
  profileForm: ProfileFormValues
  requestDrafts: Record<string, RequestDraftValues>
  onSelectProfile: (profileId: string) => void
  onCreateProfile: (event: FormEvent<HTMLFormElement>) => void
  onProfileFieldChange: (
    event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
  ) => void
  onDraftChange: (eventId: string, field: 'attendeeCount' | 'message', value: string) => void
  onDatesChange: (eventId: string, dates: string[]) => void
  onRequest: (event: EventItem, requestKind: 'participation' | 'cohost') => Promise<boolean>
  onMarkRead: (noticeId: string) => void
}

export const StudentDashboard = ({
  page,
  discoveryEventId,
  onSelectDiscoveryEvent,
  requests,
  activeProfile,
  profiles,
  authUserId,
  events,
  inbox,
  profileForm,
  requestDrafts,
  onSelectProfile,
  onCreateProfile,
  onProfileFieldChange,
  onDraftChange,
  onDatesChange,
  onRequest,
  onMarkRead,
}: StudentDashboardProps) => (
  <div className="focused-workspace">
    {page === 'events' ? (
      <EventList key={activeProfile?.id ?? 'guest'} events={events} activeProfile={activeProfile}
        requestDrafts={requestDrafts} requestKind="participation" requests={requests}
        initialEventId={discoveryEventId} onSelectEvent={onSelectDiscoveryEvent}
        onDraftChange={onDraftChange} onDatesChange={onDatesChange} onRequest={onRequest} />
    ) : null}
    {page === 'inbox' ? (
      <InboxPanel inbox={inbox} profileId={activeProfile?.id ?? null} onMarkRead={onMarkRead} />
    ) : null}
    {page === 'host' || page === 'manage' ? (
      <div className="space-y-6">
        <section className="panel guided-panel">
          <h2>First, tell us about your club</h2>
          <p className="step-description">Events are hosted by organizations. Create a club profile below,
            or <a href="#profile" className="text-link">switch to an existing organization profile</a>.</p>
        </section>
        <CreateProfileForm profileForm={profileForm}
          onFieldChange={onProfileFieldChange} onSubmit={onCreateProfile} />
      </div>
    ) : null}
    {page === 'profile' ? (
      <div className="space-y-6">
        {activeProfile ? (
          <ProfilePanel activeProfile={activeProfile} profiles={profiles}
            authUserId={authUserId} onSelectProfile={onSelectProfile} />
        ) : null}
        <CreateProfileForm profileForm={profileForm}
          onFieldChange={onProfileFieldChange} onSubmit={onCreateProfile} />
      </div>
    ) : null}
  </div>
)
