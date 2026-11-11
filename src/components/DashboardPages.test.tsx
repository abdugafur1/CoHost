import { createRef } from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { OrganizationDashboard } from './OrganizationDashboard'
import { StudentDashboard } from './StudentDashboard'
import { HostedEvents, InboxPanel } from './DashboardComponents'
import { RequestsPage } from './RequestsPage'
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
  publicationStatus: 'published',
}
const collaborationEvent: EventItem = { ...event, publicationStatus: 'pending_collaboration' }

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
}

describe('role-specific dashboards', () => {
  it('does not render non-published events on the student dashboard', () => {
    render(
      <StudentDashboard
        activeProfile={studentProfile}
        {...sharedProps}
        events={[
          event,
          { ...event, id: 'hidden-event', title: 'Negotiating Event', publicationStatus: 'pending_collaboration' },
        ]}
      />,
    )

    expect(screen.getByText(event.title)).toBeTruthy()
    expect(screen.queryByText('Negotiating Event')).toBeNull()
  })

  it('shows student event browsing without profile controls or organization controls', () => {
    const studentFacingEvent: EventItem = {
      ...event,
      confirmedCoHosts: [
        { profileId: 'partner-1', name: 'Volunteer Club' },
        { profileId: 'partner-2', name: 'Arts Society' },
      ],
      resourcesOffered: ['Venue'],
      offerDescription: 'A venue for partners.',
      resourcesNeeded: ['Volunteers'],
      needDescription: 'We need event volunteers.',
    }
    render(
      <StudentDashboard
        activeProfile={studentProfile}
        {...sharedProps}
        events={[studentFacingEvent]}
      />,
    )

    expect(screen.getByText(/student dashboard/i)).toBeTruthy()
    expect(screen.queryByRole('heading', { name: /jordan student/i })).toBeNull()
    expect(screen.queryByRole('heading', { name: /create a profile/i })).toBeNull()
    expect(screen.getByRole('heading', { name: /available community events/i })).toBeTruthy()
    expect(screen.getByRole('heading', { name: studentFacingEvent.title })).toBeTruthy()
    expect(screen.getByText('HOSTED BY')).toBeTruthy()
    expect(screen.getByText('Another Club')).toBeTruthy()
    expect(screen.getByText('Volunteer Club')).toBeTruthy()
    expect(screen.getByText('Arts Society')).toBeTruthy()
    expect(screen.getByText('Student Center')).toBeTruthy()
    expect(
      screen.getByText(
        new Date(2026, 11, 1).toLocaleDateString(undefined, {
          month: 'long',
          day: 'numeric',
          year: 'numeric',
        }),
      ),
    ).toBeTruthy()
    expect(screen.getByText('Available spots').parentElement?.querySelector('dd')?.textContent).toBe(
      '17',
    )
    expect(screen.getByText(studentFacingEvent.description)).toBeTruthy()
    expect(screen.queryByText('We Offer')).toBeNull()
    expect(screen.queryByText('We Need')).toBeNull()
    expect(screen.queryByText('A venue for partners.')).toBeNull()
    expect(screen.queryByText('We need event volunteers.')).toBeNull()
    expect(screen.getByText(/select available dates/i)).toBeTruthy()
    expect(document.querySelector('.calendar-picker-compact')).toBeTruthy()
    expect(screen.getByRole('textbox', { name: /optional message/i })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /send participation request/i }))
    expect(sharedProps.onRequest).toHaveBeenCalledWith(studentFacingEvent, 'participation')
    expect(screen.queryByRole('heading', { name: /publish an event/i })).toBeNull()
    expect(screen.queryByRole('heading', { name: /collaboration requests/i })).toBeNull()
  })

  it('shows organization event publishing and a distinct co-host request action', async () => {
    const onRequest = vi.fn().mockResolvedValue(true)
    render(
      <OrganizationDashboard
        activeProfile={organizationProfile}
        {...sharedProps}
        events={[collaborationEvent]}
        hostForm={{
          title: '',
          location: '',
          startDate: '',
          endDate: '',
          capacity: '12',
          description: '',
          audience: 'everyone',
          resourcesOffered: [],
          offerDescription: '',
          offerOtherResource: '',
          offerOtherDescription: '',
          resourcesNeeded: [],
          needDescription: '',
          needOtherResource: '',
          needOtherDescription: '',
        }}
        eventFormFeedback={null}
        eventFeedbackRef={createRef<HTMLParagraphElement>()}
        isPublishing={false}
        onHostFieldChange={vi.fn()}
        onHostResourceFieldChange={vi.fn()}
        onHostRangeChange={vi.fn()}
        onHostEvent={vi.fn()}
        onUpdateEvent={vi.fn()}
        onDeleteEvent={vi.fn()}
        onRequest={onRequest}
      />,
    )

    expect(screen.getByText(/organization dashboard/i)).toBeTruthy()
    expect(screen.getByRole('heading', { name: /create an event/i })).toBeTruthy()
    expect(screen.getByRole('heading', { name: /managing events/i })).toBeTruthy()
    expect(screen.queryByRole('heading', { name: /collaboration requests/i })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /request to co-host/i }))
    expect(onRequest).not.toHaveBeenCalled()
    expect(screen.getByRole('dialog')).toBeTruthy()
    fireEvent.change(screen.getByRole('textbox', { name: /contribution details/i }), {
      target: { value: 'We can help with setup.' },
    })
    fireEvent.click(screen.getByRole('button', { name: /submit request/i }))
    await waitFor(() =>
      expect(onRequest).toHaveBeenCalledWith(collaborationEvent, 'cohost', {
        resourcesProvided: ['General contribution'],
        contributionDescription: 'We can help with setup.',
      }),
    )
    expect(screen.queryByRole('button', { name: /send participation request/i })).toBeNull()
    expect(screen.queryByText(/not verified administrator authorization/i)).toBeNull()
  })

})

describe('hosted event management', () => {
  const hostedEvent = {
    ...event,
    hostId: organizationProfile.id,
    hostOwnerId: organizationProfile.ownerId,
  }

  it('requires explicit collaboration completion and confirmation before publishing', async () => {
    const pendingEvent = { ...hostedEvent, publicationStatus: 'pending_collaboration' as const }
    const onUpdate = vi.fn().mockResolvedValue(undefined)
    render(
      <HostedEvents
        events={[pendingEvent]}
        profile={organizationProfile}
        onUpdate={onUpdate}
        onDelete={vi.fn()}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: /complete collaboration/i }))
    expect(screen.getByRole('dialog')).toBeTruthy()
    fireEvent.click(screen.getByRole('checkbox', { name: /confirm all necessary collaboration arrangements/i }))
    fireEvent.click(screen.getByRole('button', { name: /mark ready to publish/i }))
    await waitFor(() =>
      expect(onUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          publicationStatus: 'ready_to_publish',
          collaborationRequirementsCompleted: true,
        }),
      ),
    )
    expect(screen.getByText(/collaboration requirements completed/i)).toBeTruthy()
  })

  it('logs original publication errors and clears them after a later successful transition', async () => {
    const pendingEvent = { ...hostedEvent, publicationStatus: 'pending_collaboration' as const }
    const firebaseError = Object.assign(new Error('internal [0]'), {
      code: 'functions/internal',
    })
    const onUpdate = vi.fn().mockRejectedValueOnce(firebaseError).mockResolvedValue(undefined)
    const errorLogger = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    render(
      <HostedEvents
        events={[pendingEvent]}
        profile={organizationProfile}
        onUpdate={onUpdate}
        onDelete={vi.fn()}
      />,
    )

    const openCollaborationConfirmation = () => {
      fireEvent.click(screen.getByRole('button', { name: /complete collaboration/i }))
      fireEvent.click(
        screen.getByRole('checkbox', {
          name: /confirm all necessary collaboration arrangements/i,
        }),
      )
    }
    const confirmReadyToPublish = () => {
      fireEvent.click(screen.getByRole('button', { name: /mark ready to publish/i }))
    }

    openCollaborationConfirmation()
    confirmReadyToPublish()
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('internal [0]'))
    expect(errorLogger).toHaveBeenCalledWith(
      'Event publication workflow operation failed',
      expect.objectContaining({
        operation: expect.stringContaining('updateEventItem'),
        eventId: pendingEvent.id,
        errorCode: 'functions/internal',
        errorMessage: 'internal [0]',
        error: firebaseError,
      }),
    )

    confirmReadyToPublish()
    await waitFor(() =>
      expect(screen.queryByRole('alert')).toBeNull(),
    )
    expect(screen.getByRole('status').textContent).toContain('Collaboration requirements completed')
    errorLogger.mockRestore()
  })

  it('shows a publication confirmation with confirmed partners and saves only after confirmation', async () => {
    const readyEvent = { ...hostedEvent, publicationStatus: 'ready_to_publish' as const }
    const acceptedPartner: EventRequest = {
      ...incomingRequest,
      id: 'partner-request',
      eventId: readyEvent.id,
      requestType: 'cohost',
      requesterProfileType: 'organization',
      requesterName: 'Volunteer Club',
      status: 'accepted',
    }
    const onUpdate = vi.fn().mockResolvedValue(undefined)
    const onPublish = vi.fn().mockResolvedValue(undefined)
    render(
      <HostedEvents
        events={[readyEvent]}
        eventRequests={[acceptedPartner]}
        profile={organizationProfile}
        onUpdate={onUpdate}
        onPublish={onPublish}
        onDelete={vi.fn()}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: /publish event/i }))
    expect(screen.getByText(/volunteer club/i)).toBeTruthy()
    expect(onUpdate).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('checkbox', { name: /i confirm these event details/i }))
    fireEvent.click(screen.getByRole('button', { name: /confirm publish/i }))

    await waitFor(() =>
      expect(onPublish).toHaveBeenCalledWith(readyEvent),
    )
    expect(onUpdate).not.toHaveBeenCalled()
  })

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

  describe('inbox request navigation', () => {
    const inboxNotice = (request: EventRequest, type: 'incoming' | 'outgoing') => ({
      id: request.id,
      profileId: organizationProfile.id,
      title: `${request.requestType} request`,
      message: request.message,
      type,
      relatedEventId: request.eventId,
      requestId: request.id,
      requestType: request.requestType,
      createdAt: request.createdAt,
      isRead: false,
    })

    it('marks a request notification read and navigates to its details', () => {
      const onMarkRead = vi.fn()
      const onViewRequest = vi.fn()
      render(
        <InboxPanel
          inbox={[inboxNotice(incomingRequest, 'incoming')]}
          profileId={organizationProfile.id}
          onMarkRead={onMarkRead}
          onViewRequest={onViewRequest}
        />,
      )

      fireEvent.click(screen.getByRole('button', { name: /view details/i }))
      expect(onMarkRead).toHaveBeenCalledWith(incomingRequest.id)
      expect(screen.queryByRole('dialog')).toBeNull()
      expect(onViewRequest).toHaveBeenCalledWith(inboxNotice(incomingRequest, 'incoming'))
    })
  })

  it('shows legacy resource sections as not specified', () => {
    render(
      <HostedEvents
        events={[hostedEvent]}
        profile={organizationProfile}
        onUpdate={vi.fn()}
        onDelete={vi.fn()}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /view details/i }))
    const details = screen.getByRole('region', { name: /details for campus arts night/i })
    expect(details.querySelectorAll('section[aria-label="We Offer"], section[aria-label="We Need"]')).toHaveLength(2)
    expect(details.textContent?.match(/Not specified/g)).toHaveLength(4)
  })

  it('validates resource details and clears custom fields when Other is deselected', async () => {
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
    fireEvent.click(screen.getByRole('button', { name: /save changes/i }))
    expect(screen.getByText(/select at least one resource you offer/i)).toBeTruthy()
    expect(onUpdate).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('checkbox', { name: /we offer venue/i }))
    fireEvent.click(screen.getByRole('checkbox', { name: /we offer other$/i }))
    fireEvent.click(screen.getByRole('checkbox', { name: /we need equipment/i }))
    fireEvent.click(screen.getByRole('checkbox', { name: /we need other$/i }))
    expect(screen.getByRole('textbox', { name: /we offer other resource name/i })).toBeTruthy()
    expect(screen.getByRole('textbox', { name: /we need other resource name/i })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /save changes/i }))
    expect(screen.getAllByText(/enter the name of the other resource/i)).toHaveLength(2)
    fireEvent.change(screen.getByRole('textbox', { name: /offer description/i }), {
      target: { value: '  Venue is available.  ' },
    })
    fireEvent.change(screen.getByRole('textbox', { name: /need description/i }), {
      target: { value: '  Equipment is needed.  ' },
    })
    fireEvent.change(screen.getByRole('textbox', { name: /we offer other resource name/i }), {
      target: { value: 'Studio' },
    })
    fireEvent.change(
      screen.getByRole('textbox', { name: /we offer other resource description/i }),
      { target: { value: 'A rehearsal studio.' } },
    )
    fireEvent.change(screen.getByRole('textbox', { name: /we need other resource name/i }), {
      target: { value: 'Lighting' },
    })
    fireEvent.change(
      screen.getByRole('textbox', { name: /we need other resource description/i }),
      { target: { value: 'Stage lighting equipment.' } },
    )
    fireEvent.click(screen.getByRole('checkbox', { name: /we offer other$/i }))
    expect(screen.queryByRole('textbox', { name: /we offer other resource name/i })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /save changes/i }))

    await waitFor(() => expect(onUpdate).toHaveBeenCalledTimes(1))
    expect(onUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        resourcesOffered: ['Venue'],
        offerDescription: 'Venue is available.',
        offerOtherResource: '',
        offerOtherDescription: '',
        resourcesNeeded: ['Equipment', 'Other'],
        needDescription: 'Equipment is needed.',
        needOtherResource: 'Lighting',
        needOtherDescription: 'Stage lighting equipment.',
      }),
    )
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
    fireEvent.click(screen.getByRole('checkbox', { name: /we offer venue/i }))
    fireEvent.change(screen.getByRole('textbox', { name: /offer description/i }), {
      target: { value: 'We can provide the venue.' },
    })
    fireEvent.click(screen.getByRole('checkbox', { name: /we need volunteers/i }))
    fireEvent.change(screen.getByRole('textbox', { name: /need description/i }), {
      target: { value: 'We need event volunteers.' },
    })
    fireEvent.click(screen.getByRole('button', { name: /save changes/i }))

    await waitFor(() => expect(onUpdate).toHaveBeenCalledTimes(1))
    expect(onUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Updated Arts Night',
        location: 'Arts Hall',
        hostOwnerId: organizationProfile.ownerId,
        resourcesOffered: ['Venue'],
        offerDescription: 'We can provide the venue.',
        resourcesNeeded: ['Volunteers'],
        needDescription: 'We need event volunteers.',
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
    fireEvent.click(screen.getByRole('checkbox', { name: /we offer venue/i }))
    fireEvent.change(screen.getByRole('textbox', { name: /offer description/i }), {
      target: { value: 'Venue available.' },
    })
    fireEvent.click(screen.getByRole('checkbox', { name: /we need volunteers/i }))
    fireEvent.change(screen.getByRole('textbox', { name: /need description/i }), {
      target: { value: 'Volunteers needed.' },
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

  it('filters incoming request types, shows details, and resolves a pending co-host request', async () => {
    const cohostRequest: EventRequest = {
      ...incomingRequest,
      id: 'cohost-request',
      requestType: 'cohost',
      eventId: hostedEvent.id,
      eventTitle: hostedEvent.title,
      hostOwnerId: organizationProfile.ownerId,
      hostProfileId: organizationProfile.id,
      requesterOwnerId: 'requester-owner',
      requesterProfileId: 'requester-profile',
      requesterName: 'Robotics Club',
      requesterProfileType: 'organization',
      availableDates: hostedEvent.dateOptions,
      attendeeCount: 0,
      resourcesProvided: ['Venue'],
      contributionDescription: 'We can provide the event venue.',
      estimatedAttendees: 18,
      status: 'pending',
    }
    const hostEvent = {
      ...hostedEvent,
      resourcesNeeded: ['Venue', 'Volunteers'],
      needDescription: 'A venue and volunteers are needed.',
    }
    const onResolveRequest = vi.fn().mockResolvedValue(true)
    render(
      <RequestsPage
        requests={[incomingRequest, cohostRequest]}
        events={[hostEvent]}
        profile={organizationProfile}
        selection={null}
        onSelectionHandled={vi.fn()}
        onResolveRequest={onResolveRequest}
      />,
    )

    expect(screen.getByText(/jordan student sent a request/i)).toBeTruthy()
    expect(screen.getByText(/robotics club sent a request/i)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /^co-hosting$/i }))
    expect(screen.queryByText(/jordan student sent a request/i)).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /view details/i }))
    expect(screen.getByRole('heading', { name: 'We Request' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'They Provide' })).toBeTruthy()
    expect(screen.getByText('We can provide the event venue.')).toBeTruthy()
    expect(screen.getByText(/1 of 1 provided resources match/i)).toBeTruthy()
    expect(screen.getByText('18')).toBeTruthy()
    const requestCard = screen.getByRole('region', { name: 'We Request' })
    const detailsSection = screen.getByText('Selected dates').closest('dl')
    expect(requestCard.compareDocumentPosition(detailsSection as Node) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    fireEvent.click(screen.getAllByRole('button', { name: /^accept$/i })[0])
    await waitFor(() => expect(onResolveRequest).toHaveBeenCalledWith(cohostRequest, 'accepted'))
  })

  it('limits student requests to their own participation requests and supports sent requests', () => {
    const studentSentRequest: EventRequest = {
      ...incomingRequest,
      requesterOwnerId: studentProfile.ownerId,
      requesterProfileId: studentProfile.id,
    }
    const legacyRequest: EventRequest = {
      ...incomingRequest,
      id: 'legacy-cohost-request',
      requestType: 'cohost',
      eventId: hostedEvent.id,
      eventTitle: hostedEvent.title,
      hostOwnerId: 'host-owner',
      hostProfileId: 'host-profile',
      requesterProfileType: 'organization',
      requesterOwnerId: 'legacy-requester',
      requesterProfileId: 'legacy-requester-profile',
      requesterName: 'Legacy Club',
    }
    render(
      <RequestsPage
        requests={[studentSentRequest, legacyRequest]}
        events={[hostedEvent]}
        profile={studentProfile}
        selection={null}
        onSelectionHandled={vi.fn()}
        onResolveRequest={vi.fn().mockResolvedValue(undefined)}
      />,
    )

    fireEvent.click(screen.getByRole('tab', { name: /sent requests/i }))
    expect(screen.getByText(/request to another club/i)).toBeTruthy()
    expect(screen.queryByText(/legacy club sent a request/i)).toBeNull()
    expect(screen.queryByRole('button', { name: /^accept$/i })).toBeNull()
    expect(screen.getByText('Campus Arts Night')).toBeTruthy()
  })

  it('shows the same improved resource details for an outgoing co-host request without approval actions', () => {
    const outgoingRequest: EventRequest = {
      ...incomingRequest,
      id: 'outgoing-cohost-request',
      requestType: 'cohost',
      hostOwnerId: 'host-owner',
      hostProfileId: 'host-profile',
      requesterOwnerId: organizationProfile.ownerId,
      requesterProfileId: organizationProfile.id,
      requesterName: organizationProfile.name,
      requesterProfileType: 'organization',
      attendeeCount: 0,
      resourcesProvided: ['Venue'],
      contributionDescription: 'We can provide a venue.',
      status: 'pending',
    }

    render(
      <RequestsPage
        requests={[outgoingRequest]}
        events={[{ ...event, hostOwnerId: 'host-owner', hostId: 'host-profile', resourcesNeeded: ['Venue'] }]}
        profile={organizationProfile}
        selection={null}
        onSelectionHandled={vi.fn()}
        onResolveRequest={vi.fn().mockResolvedValue(true)}
      />,
    )

    fireEvent.click(screen.getByRole('tab', { name: /sent requests/i }))
    fireEvent.click(screen.getByRole('button', { name: /view details/i }))
    expect(screen.getByRole('heading', { name: 'We Request' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'They Provide' })).toBeTruthy()
    expect(screen.getByText('We can provide a venue.')).toBeTruthy()
    expect(screen.queryByRole('button', { name: /^accept$/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /^decline$/i })).toBeNull()
    expect(screen.queryByText(/legacy club sent a request/i)).toBeNull()
  })
})
