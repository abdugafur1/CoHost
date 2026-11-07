import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { EventItem, PublicOrganization, UserProfile } from '../types'
import { ClubDiscovery } from './ClubDiscovery'

const organizations: PublicOrganization[] = [
  {
    profileId: 'robotics-club',
    name: 'Robotics Collective',
    description: 'Builds helpful robots and hosts an annual technology showcase.',
    focus: 'Technology',
    location: 'North campus',
    interests: ['Technology', 'Education'],
    eventTypes: ['Workshops', 'Competitions'],
    availableResources: ['Event Venue', 'Technical Support'],
    collaborationPreferences: ['Open to co-hosting'],
  },
  {
    profileId: 'wellness-club',
    name: 'Campus Wellness',
    description: 'Promotes student health and wellbeing.',
    focus: 'Health & Wellness',
    location: 'South campus',
    interests: ['Health & Wellness'],
    eventTypes: ['Seminars', 'Fundraisers'],
    availableResources: ['Volunteers', 'Event Venue'],
    collaborationPreferences: ['Resource sharing'],
  },
]

const roboticsEvent: EventItem = {
  id: 'robotics-showcase',
  hostId: 'robotics-club',
  hostOwnerId: 'another-owner',
  hostName: 'Robotics Collective',
  hostProfileType: 'organization',
  title: 'Robotics Showcase',
  location: 'North campus',
  description: 'A public showcase with campus clubs.',
  audience: 'everyone',
  dateOptions: ['2027-03-10'],
  capacity: 30,
  attendees: 4,
  createdAt: '2027-01-01T10:00:00.000Z',
}

const studentProfile: UserProfile = {
  id: 'student-profile',
  ownerId: 'current-owner',
  name: 'Student',
  profileType: 'student',
  focus: 'Education',
  location: 'North campus',
  description: '',
  createdAt: '2027-01-01T10:00:00.000Z',
}

const organizationProfile: UserProfile = {
  ...studentProfile,
  id: 'current-club',
  profileType: 'organization',
  name: 'Current Club',
}

const renderDirectory = (activeProfile: UserProfile | null = studentProfile) =>
  render(
    <ClubDiscovery
      organizations={organizations}
      events={[roboticsEvent]}
      activeProfile={activeProfile}
      authUserId={activeProfile?.ownerId ?? null}
      requestDrafts={{}}
      isLoading={false}
      error={null}
      onDraftChange={vi.fn()}
      onDatesChange={vi.fn()}
      onRequest={vi.fn()}
    />,
  )

describe('ClubDiscovery', () => {
  it('searches club names and descriptions', () => {
    renderDirectory()
    fireEvent.change(screen.getByRole('searchbox', { name: /search clubs/i }), {
      target: { value: 'helpful robots' },
    })

    expect(screen.getByRole('heading', { name: /robotics collective/i })).toBeTruthy()
    expect(screen.queryByRole('heading', { name: /campus wellness/i })).toBeNull()
    expect(screen.getByRole('status').textContent).toContain('1 matching clubs')
  })

  it('filters by interest, event type, and available resource', () => {
    const { rerender } = renderDirectory()
    fireEvent.change(screen.getByRole('combobox', { name: /filter by interest/i }), {
      target: { value: 'Education' },
    })
    expect(screen.getByRole('heading', { name: /robotics collective/i })).toBeTruthy()
    expect(screen.queryByRole('heading', { name: /campus wellness/i })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /clear filters/i }))

    rerender(
      <ClubDiscovery
        organizations={organizations}
        events={[]}
        activeProfile={studentProfile}
        authUserId={studentProfile.ownerId}
        requestDrafts={{}}
        isLoading={false}
        error={null}
        onDraftChange={vi.fn()}
        onDatesChange={vi.fn()}
        onRequest={vi.fn()}
      />,
    )
    fireEvent.change(screen.getByRole('combobox', { name: /filter by event type/i }), {
      target: { value: 'Fundraisers' },
    })
    expect(screen.getByRole('heading', { name: /campus wellness/i })).toBeTruthy()
    expect(screen.queryByRole('heading', { name: /robotics collective/i })).toBeNull()
    fireEvent.change(screen.getByRole('combobox', { name: /filter by resource/i }), {
      target: { value: 'Volunteers' },
    })
    expect(screen.getByRole('heading', { name: /campus wellness/i })).toBeTruthy()
    expect(screen.queryByRole('heading', { name: /robotics collective/i })).toBeNull()
  })

  it('combines search and all filters and can clear them', () => {
    renderDirectory()
    fireEvent.change(screen.getByRole('searchbox', { name: /search clubs/i }), {
      target: { value: 'robotics' },
    })
    fireEvent.change(screen.getByRole('combobox', { name: /filter by interest/i }), {
      target: { value: 'Technology' },
    })
    fireEvent.change(screen.getByRole('combobox', { name: /filter by event type/i }), {
      target: { value: 'Workshops' },
    })
    fireEvent.change(screen.getByRole('combobox', { name: /filter by resource/i }), {
      target: { value: 'Technical Support' },
    })
    expect(screen.getByRole('status').textContent).toContain('1 matching clubs')

    fireEvent.change(screen.getByRole('combobox', { name: /filter by resource/i }), {
      target: { value: 'Guest Speakers' },
    })
    expect(screen.getByText(/no clubs match those filters/i)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /clear filters/i }))
    expect(screen.getByRole('status').textContent).toContain('2 matching clubs')
  })

  it('shows club details and uses event-based requests appropriate to the active role', () => {
    const onRequest = vi.fn()
    const { rerender } = render(
      <ClubDiscovery
        organizations={organizations}
        events={[roboticsEvent]}
        activeProfile={studentProfile}
        authUserId={studentProfile.ownerId}
        requestDrafts={{}}
        isLoading={false}
        error={null}
        onDraftChange={vi.fn()}
        onDatesChange={vi.fn()}
        onRequest={onRequest}
      />,
    )
    fireEvent.click(screen.getAllByRole('button', { name: /view club/i })[0])
    expect(screen.getByRole('heading', { name: /robotics collective/i })).toBeTruthy()
    expect(screen.getByText(/open to co-hosting/i)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /view collaboration opportunities/i }))
    expect(screen.getByRole('heading', { name: /robotics showcase/i })).toBeTruthy()
    expect(screen.getByRole('button', { name: /send participation request/i })).toBeTruthy()
    expect(screen.queryByRole('button', { name: /request to co-host/i })).toBeNull()

    rerender(
      <ClubDiscovery
        organizations={organizations}
        events={[roboticsEvent]}
        activeProfile={organizationProfile}
        authUserId={organizationProfile.ownerId}
        requestDrafts={{}}
        isLoading={false}
        error={null}
        onDraftChange={vi.fn()}
        onDatesChange={vi.fn()}
        onRequest={onRequest}
      />,
    )
    expect(screen.getByRole('button', { name: /request to co-host/i })).toBeTruthy()
  })

  it('shows directory loading and error states', () => {
    const props = {
      organizations: [],
      events: [],
      activeProfile: null,
      authUserId: null,
      requestDrafts: {},
      onDraftChange: vi.fn(),
      onDatesChange: vi.fn(),
      onRequest: vi.fn(),
    }
    const { rerender } = render(
      <ClubDiscovery {...props} isLoading={true} error={null} />,
    )
    expect(screen.getByText(/loading public organizations/i)).toBeTruthy()
    rerender(<ClubDiscovery {...props} isLoading={false} error="permission denied" />)
    expect(screen.getByRole('alert').textContent).toContain('permission denied')
  })
})
