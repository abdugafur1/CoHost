import type { EventItem, UserProfile } from '../types'
import {
  EventList,
  type CoHostRequestDetails,
  type RequestDraftValues,
} from './DashboardComponents'

interface StudentDashboardProps {
  activeProfile: UserProfile | null
  events: EventItem[]
  requestDrafts: Record<string, RequestDraftValues>
  view?: 'dashboard' | 'events'
  onDraftChange: (eventId: string, field: 'attendeeCount' | 'message', value: string) => void
  onDatesChange: (eventId: string, dates: string[]) => void
  onRequest: (
    event: EventItem,
    requestKind: 'participation' | 'cohost',
    coHostDetails?: CoHostRequestDetails,
  ) => Promise<boolean>
}

export const StudentDashboard = ({
  activeProfile,
  events,
  requestDrafts,
  view = 'dashboard',
  onDraftChange,
  onDatesChange,
  onRequest,
}: StudentDashboardProps) => (
  <>
    {view === 'dashboard' ? (
      <div className="dashboard-heading">
        <p className="text-sm uppercase tracking-[0.2em] text-blue-600">Student dashboard</p>
        <h2 className="mt-1 text-3xl font-bold text-slate-900">Find your campus community</h2>
        <p className="mt-2 text-slate-600">Browse events and request a place to participate.</p>
      </div>
    ) : null}
    <div className="grid gap-6">
      <div>
        <EventList
          events={events.filter((event) => event.publicationStatus === 'published')}
          activeProfile={activeProfile}
          requestDrafts={requestDrafts}
          requestKind="participation"
          onDraftChange={onDraftChange}
          onDatesChange={onDatesChange}
          onRequest={onRequest}
        />
      </div>
    </div>
  </>
)
