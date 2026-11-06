import { createRef } from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { OrganizationDashboard } from './OrganizationDashboard'
import { StudentDashboard } from './StudentDashboard'
import { HostedEvents } from './DashboardComponents'
import type { EventItem, EventRequest, UserProfile } from '../types'

const studentProfile: UserProfile = {
  id: 'student-1',
  ownerId: 'owner-1',
  name: 'Jordan Student',
  profileType: 'student',
  focus: 'Campus activities',
  location: 'North campus',
  description: 'Looking for campus events.',
  createdAt: '2026-10-01T10:00:00.000Z',
}

const organizationProfile: UserProfile = {
  ...studentProfile,
  id: 'organization-1',
  name: 'Campus Club',
  profileType: 'organization',
}

const event: EventItem = {
  id: 'event-1',
  hostId: 'organization-2',
  hostOwnerId: 'owner-2',
  hostName: 'Another Club',
  hostProfileType: 'organization',
  title: 'Campus Arts Night',
  location: 'Student Center',
  description: 'An evening of student art.',
  audience: 'everyone',
  dateOptions: ['2026-12-01'],
  capacity: 20,
  attendees: 3,
  createdAt: '2026-10-10T10:00:00.000Z',
}

const incomingRequest: EventRequest = {
  id: 'event-1_student-owner_participation',
  requestType: 'participation',
  eventId: event.id,
  eventTitle: event.title,
  hostOwnerId: organizationProfile.ownerId,
  hostProfileId: organizationProfile.id,
  requesterOwnerId: 'student-owner',
  requesterProfileId: studentProfile.id,
  requesterName: studentProfile.name,
  requesterProfileType: 'student',
  availableDates: ['2026-12-01'],
  attendeeCount: 1,
  message: 'Interested in joining.',
  status: 'pending',
  createdAt: '2026-10-11T10:00:00.000Z',
}

const profileForm = {
  name: '',
  profileType: 'student' as const,
  focus: 'General club activities',
  location: '',
  description: '',
}

const sharedProps = {
  profiles: [studentProfile],
  authUserId: 'owner-1',
  events: [],
  inbox: [],
  profileForm,
  requestDrafts: {},
  onSelectProfile: vi.fn(),
  onCreateProfile: vi.fn(),
  onProfileFieldChange: vi.fn(),
  onDraftChange: vi.fn(),
  onDatesChange: vi.fn(),
  onRequest: vi.fn(),
  onMarkRead: vi.fn(),
}

describe('role-specific dashboards', () => {
  it('shows student event browsing and profile details without organization controls', () => {
    render(
      <StudentDashboard
        activeProfile={studentProfile}
        {...sharedProps}
        events={[event]}
      />,
    )

    expect(screen.getByText(/student dashboard/i)).toBeTruthy()
    expect(screen.getByRole('heading', { name: /jordan student/i })).toBeTruthy()
    expect(screen.getByRole('heading', { name: /available community events/i })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /send participation request/i }))
    expect(sharedProps.onRequest).toHaveBeenCalledWith(event, 'participation')
    expect(screen.queryByRole('heading', { name: /publish an event/i })).toBeNull()
    expect(screen.queryByRole('heading', { name: /collaboration requests/i })).toBeNull()
  })

  it('shows organization event publishing and a distinct co-host request action', () => {
    const onRequest = vi.fn()
    render(
      <OrganizationDashboard
        activeProfile={organizationProfile}
        {...sharedProps}
        profiles={[organizationProfile]}
        events={[event]}
        collaborationRequests={[]}
        onResolveRequest={vi.fn().mockResolvedValue(undefined)}
        hostForm={{
          title: '',
          location: '',
          startDate: '',
          endDate: '',
          capacity: '12',
          description: '',
          audience: 'everyone',
        }}
        eventFormFeedback={null}
        eventFeedbackRef={createRef<HTMLParagraphElement>()}
        isPublishing={false}
        onHostFieldChange={vi.fn()}
        onHostRangeChange={vi.fn()}
        onHostEvent={vi.fn()}
        onUpdateEvent={vi.fn()}
        onDeleteEvent={vi.fn()}
        onRequest={onRequest}
      />,
    )

    expect(screen.getByText(/organization dashboard/i)).toBeTruthy()
    expect(screen.getByRole('heading', { name: /publish an event/i })).toBeTruthy()
    expect(screen.getByRole('heading', { name: /managing hosted events/i })).toBeTruthy()
    expect(screen.getByRole('heading', { name: /collaboration requests/i })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /request to co-host/i }))
    expect(onRequest).toHaveBeenCalledWith(event, 'cohost')
    expect(screen.queryByRole('button', { name: /send participation request/i })).toBeNull()
    expect(screen.getByText(/not verified administrator authorization/i)).toBeTruthy()
  })

  it('lets the host accept or decline an incoming event request', async () => {
    const onResolveRequest = vi.fn().mockResolvedValue(undefined)
    render(
      <OrganizationDashboard
        activeProfile={organizationProfile}
        {...sharedProps}
        profiles={[organizationProfile]}
        events={[event]}
        collaborationRequests={[incomingRequest]}
        hostForm={{
          title: '',
          location: '',
          startDate: '',
          endDate: '',
          capacity: '12',
          description: '',
          audience: 'everyone',
        }}
        eventFormFeedback={null}
        eventFeedbackRef={createRef<HTMLParagraphElement>()}
        isPublishing={false}
        onHostFieldChange={vi.fn()}
        onHostRangeChange={vi.fn()}
        onHostEvent={vi.fn()}
        onUpdateEvent={vi.fn()}
        onDeleteEvent={vi.fn()}
        onResolveRequest={onResolveRequest}
      />,
    )

    expect(screen.getByText(/jordan student requested participation/i)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /^accept$/i }))

    await waitFor(() =>
      expect(onResolveRequest).toHaveBeenCalledWith(incomingRequest, 'accepted'),
    )
  })
})

describe('hosted event management', () => {
  const hostedEvent = {
    ...event,
    hostId: organizationProfile.id,
    hostOwnerId: organizationProfile.ownerId,
  }

  it('reveals complete event details', () => {
    render(
      <HostedEvents
        events={[hostedEvent]}
        profile={organizationProfile}
        onUpdate={vi.fn()}
        onDelete={vi.fn()}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: /view details/i }))

    expect(screen.getByRole('region', { name: /details for campus arts night/i })).toBeTruthy()
    expect(screen.getByText('An evening of student art.')).toBeTruthy()
    expect(
      screen.getByText(
        new Date(2026, 11, 1).toLocaleDateString(undefined, {
          month: 'long',
          day: 'numeric',
          year: 'numeric',
        }),
      ),
    ).toBeTruthy()
    expect(screen.getByText(hostedEvent.id)).toBeTruthy()
  })

  it('edits event details through the supplied persistence handler', async () => {
    const onUpdate = vi.fn().mockResolvedValue(undefined)
    render(
      <HostedEvents
        events={[hostedEvent]}
        profile={organizationProfile}
        onUpdate={onUpdate}
        onDelete={vi.fn()}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: /^edit$/i }))
    fireEvent.change(screen.getByRole('textbox', { name: /edit title/i }), {
      target: { value: 'Updated Arts Night' },
    })
    fireEvent.change(screen.getByRole('textbox', { name: /edit location/i }), {
      target: { value: 'Arts Hall' },
    })
    fireEvent.click(screen.getByRole('button', { name: /save changes/i }))

    await waitFor(() => expect(onUpdate).toHaveBeenCalledTimes(1))
    expect(onUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Updated Arts Night',
        location: 'Arts Hall',
        hostOwnerId: organizationProfile.ownerId,
      }),
    )
    expect((await screen.findByRole('status')).textContent).toBe('Event changes saved.')
  })

  it('surfaces errors when saving event changes fails', async () => {
    const onUpdate = vi.fn().mockRejectedValue(new Error('permission denied'))
    render(
      <HostedEvents
        events={[hostedEvent]}
        profile={organizationProfile}
        onUpdate={onUpdate}
        onDelete={vi.fn()}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: /^edit$/i }))
    fireEvent.change(screen.getByRole('textbox', { name: /edit title/i }), {
      target: { value: 'Updated Arts Night' },
    })
    fireEvent.click(screen.getByRole('button', { name: /save changes/i }))

    expect((await screen.findByRole('alert')).textContent).toBe('permission denied')
    expect(screen.getByRole('button', { name: /save changes/i })).toBeTruthy()
  })

  it('requires confirmation before deleting an event', async () => {
    const onDelete = vi.fn().mockResolvedValue(undefined)
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false)
    render(
      <HostedEvents
        events={[hostedEvent]}
        profile={organizationProfile}
        onUpdate={vi.fn()}
        onDelete={onDelete}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: /^delete$/i }))
    expect(confirmSpy).toHaveBeenCalledWith(
      'Delete "Campus Arts Night"? This will permanently remove the event.',
    )
    expect(onDelete).not.toHaveBeenCalled()

    confirmSpy.mockReturnValue(true)
    fireEvent.click(screen.getByRole('button', { name: /^delete$/i }))
    await waitFor(() => expect(onDelete).toHaveBeenCalledWith(hostedEvent))
    expect((await screen.findByRole('status')).textContent).toBe(
      "Event 'Campus Arts Night' was deleted.",
    )
    confirmSpy.mockRestore()
  })

  it('does not show edit or delete controls to a non-creator profile', () => {
    render(
      <HostedEvents
        events={[{ ...hostedEvent, hostOwnerId: 'different-account' }]}
        profile={organizationProfile}
        onUpdate={vi.fn()}
        onDelete={vi.fn()}
      />,
    )

    expect(screen.queryByRole('button', { name: /^edit$/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /^delete$/i })).toBeNull()
    expect(screen.getByText(/only the account that published this event/i)).toBeTruthy()
  })
})
