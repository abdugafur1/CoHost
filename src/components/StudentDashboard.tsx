import type { ChangeEvent, FormEvent } from 'react'
import type { EventItem, InboxNotice, UserProfile } from '../types'
import {
  CreateProfileForm,
  EventList,
  InboxPanel,
  ProfilePanel,
  type ProfileFormValues,
  type RequestDraftValues,
} from './DashboardComponents'

interface StudentDashboardProps {
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
  onRequest: (event: EventItem, requestKind: 'participation' | 'cohost') => void
  onMarkRead: (noticeId: string) => void
}

export const StudentDashboard = ({
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
  <>
    <div className="mb-6">
      <p className="text-sm uppercase tracking-[0.2em] text-blue-600">Student dashboard</p>
      <h2 className="mt-1 text-3xl font-bold text-slate-900">Find your campus community</h2>
      <p className="mt-2 text-slate-600">Browse events and request a place to participate.</p>
    </div>
    <div className="grid gap-6 lg:grid-cols-[0.7fr_1.3fr]">
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
      <EventList
        events={events}
        activeProfile={activeProfile}
        requestDrafts={requestDrafts}
        requestKind="participation"
        onDraftChange={onDraftChange}
        onDatesChange={onDatesChange}
        onRequest={onRequest}
      />
    </div>
  </>
)
