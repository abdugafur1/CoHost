import { act, fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import {
  continueWithoutEmail,
  DuplicateEventTitleError,
  saveEventItem,
  saveEventRequest,
  saveUserProfile,
  subscribeAuthUser,
  subscribeEvents,
  subscribeEventRequests,
} from './services/cohost'
import type { EventItem, EventRequest, UserProfile } from './types'

vi.mock('./services/cohost', () => ({
  continueWithoutEmail: vi.fn(),
  DuplicateEventTitleError: class DuplicateEventTitleError extends Error {
    constructor() {
      super('An event with this title already exists. Please choose a different title.')
    }
  },
  createEventRequestId: vi.fn(
    (eventId: string, ownerId: string, profileId: string, requestType: string) =>
      `${eventId}_${ownerId}_${profileId}_${requestType}`,
  ),
  resolveEventRequest: vi.fn(),
  saveUserProfile: vi.fn(),
  saveEventItem: vi.fn(),
  saveEventRequest: vi.fn(),
  subscribeAuthUser: vi.fn(() => vi.fn()),
  subscribeEvents: vi.fn(() => vi.fn()),
  subscribeEventRequests: vi.fn(() => vi.fn()),
  subscribeUserProfiles: vi.fn(() => vi.fn()),
}))

beforeEach(() => {
  localStorage.clear()
  vi.clearAllMocks()
})

describe('CoHost app', () => {
  it('renders an empty event board and continues without email', async () => {
    vi.mocked(continueWithoutEmail).mockResolvedValue({ uid: 'user-123' } as never)

    render(<App />)

    expect(screen.getByRole('heading', { name: /^cohost$/i })).toBeTruthy()
    expect(screen.getByText(/no events have been posted yet/i)).toBeTruthy()
    expect(screen.getByText(/your inbox is empty/i)).toBeTruthy()
    expect(screen.getByRole('button', { name: /continue without email/i })).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: /continue without email/i }))

    expect(continueWithoutEmail).toHaveBeenCalledTimes(1)
    expect(await screen.findByText(/your device account is ready/i)).toBeTruthy()
  })

  it('shows separate student and organization dashboards as profiles change', async () => {
    vi.mocked(continueWithoutEmail).mockResolvedValue({ uid: 'user-123' } as never)
    vi.mocked(saveUserProfile).mockResolvedValue(undefined)
    vi.mocked(saveEventItem)
      .mockRejectedValueOnce(new DuplicateEventTitleError())
      .mockRejectedValueOnce(new Error('network unavailable'))
    vi.mocked(saveEventRequest).mockResolvedValue(undefined)

    render(<App />)

    fireEvent.change(screen.getByRole('combobox', { name: /profile type/i }), {
      target: { value: 'student' },
    })
    fireEvent.change(screen.getByRole('textbox', { name: /your name/i }), {
      target: { value: 'Alex Morgan' },
    })
    fireEvent.change(screen.getByRole('textbox', { name: /profile location/i }), {
      target: { value: 'North campus' },
    })
    fireEvent.click(screen.getByRole('button', { name: /save profile/i }))

    expect(await screen.findByRole('heading', { name: /alex morgan/i })).toBeTruthy()
    expect(saveUserProfile).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        ownerId: 'user-123',
        profileType: 'student',
      }),
    )
    expect(screen.getByText(/student dashboard/i)).toBeTruthy()
    expect(screen.queryByRole('button', { name: /post event/i })).toBeNull()
    expect(screen.getByText(/no events have been posted yet/i)).toBeTruthy()

    fireEvent.change(screen.getByRole('combobox', { name: /profile type/i }), {
      target: { value: 'organization' },
    })
    fireEvent.change(screen.getByRole('textbox', { name: /organization name/i }), {
      target: { value: 'Campus Volunteers' },
    })
    fireEvent.change(screen.getByRole('textbox', { name: /profile location/i }), {
      target: { value: 'North campus' },
    })
    fireEvent.click(screen.getByRole('button', { name: /save profile/i }))

    expect(await screen.findByRole('heading', { name: /campus volunteers/i })).toBeTruthy()
    expect(screen.getByText(/organization dashboard/i)).toBeTruthy()
    expect((screen.getByRole('button', { name: /post event/i }) as HTMLButtonElement).disabled).toBe(
      false,
    )
    expect(screen.getByText(/not verified administrator authorization/i)).toBeTruthy()
    expect(screen.getByRole('heading', { name: /managing hosted events/i })).toBeTruthy()
    expect(screen.getByRole('heading', { name: /collaboration requests/i })).toBeTruthy()

    fireEvent.change(screen.getByRole('textbox', { name: /event title/i }), {
      target: { value: 'Community Workshop' },
    })
    fireEvent.change(screen.getByRole('textbox', { name: /event location/i }), {
      target: { value: 'Campus Center' },
    })
    const startDate = new Date()
    startDate.setDate(startDate.getDate() + 1)
    const endDate = new Date(startDate)
    endDate.setDate(endDate.getDate() + 1)
    const monthLabel = (date: Date) =>
      date.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
    const dateButtonLabel = (date: Date) =>
      `Select ${date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`

    fireEvent.click(screen.getByRole('button', { name: /start date/i }))
    expect(screen.getByRole('group', { name: /choose dates/i })).toBeTruthy()
    if (monthLabel(startDate) !== monthLabel(new Date())) {
      fireEvent.click(screen.getByRole('button', { name: /next month/i }))
    }
    fireEvent.click(screen.getByRole('button', { name: dateButtonLabel(startDate) }))
    if (monthLabel(endDate) !== monthLabel(startDate)) {
      fireEvent.click(screen.getByRole('button', { name: /next month/i }))
    }
    fireEvent.click(screen.getByRole('button', { name: dateButtonLabel(endDate) }))
    expect(screen.queryByRole('group', { name: /choose dates/i })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /start date/i }))
    const middleDate = new Date(startDate)
    middleDate.setDate(middleDate.getDate() + 1)
    if (monthLabel(middleDate) !== monthLabel(endDate)) {
      fireEvent.click(screen.getByRole('button', { name: /previous month/i }))
    }
    expect(
      screen.getByRole('button', { name: dateButtonLabel(middleDate) }).getAttribute('aria-pressed'),
    ).toBe('true')
    fireEvent.click(screen.getByRole('button', { name: /start date/i }))
    fireEvent.click(screen.getByRole('button', { name: /post event/i }))

    expect((await screen.findByRole('alert')).textContent).toBe(
      'An event with this title already exists. Please choose a different title.',
    )
    expect(screen.queryByRole('status')).toBeNull()
    expect((screen.getByRole('textbox', { name: /event title/i }) as HTMLInputElement).value).toBe(
      'Community Workshop',
    )
    expect((screen.getByRole('textbox', { name: /event location/i }) as HTMLInputElement).value).toBe(
      'Campus Center',
    )

    fireEvent.click(screen.getByRole('button', { name: /post event/i }))
    expect((await screen.findByRole('alert')).textContent).toBe(
      'Could not save the event: network unavailable',
    )
    expect(screen.queryByRole('status')).toBeNull()
    expect((screen.getByRole('textbox', { name: /event title/i }) as HTMLInputElement).value).toBe(
      'Community Workshop',
    )

    let resolveEventSave = () => {}
    const pendingEventSave = new Promise<void>((resolve) => {
      resolveEventSave = resolve
    })
    vi.mocked(saveEventItem).mockImplementation(() => pendingEventSave)
    const publishButton = screen.getByRole('button', { name: /post event/i })
    fireEvent.click(publishButton)
    fireEvent.click(publishButton)
    expect(saveEventItem).toHaveBeenCalledTimes(3)
    expect(screen.getByRole('button', { name: /publishing\.\.\./i }).hasAttribute('disabled')).toBe(
      true,
    )

    await act(async () => {
      resolveEventSave()
      await pendingEventSave
    })

    expect(await screen.findByRole('heading', { name: /community workshop/i })).toBeTruthy()
    const eventSuccessMessage = screen.getByRole('status')
    expect(eventSuccessMessage.textContent).toBe(
      "Event 'Community Workshop' has been published successfully!",
    )
    expect(eventSuccessMessage.closest('form')).toBeTruthy()
    expect((screen.getByRole('textbox', { name: /event title/i }) as HTMLInputElement).value).toBe('')
    expect((screen.getByRole('textbox', { name: /event location/i }) as HTMLInputElement).value).toBe('')
    expect(screen.getByRole('button', { name: /start date/i }).textContent).toMatch(/select a date/i)
    fireEvent.click(screen.getByRole('button', { name: /post event/i }))
    const eventValidationError = screen.getByRole('alert')
    expect(eventValidationError.textContent).toMatch(/complete date range are required/i)
    expect(eventValidationError.closest('form')).toBeTruthy()
    const dateToIso = (date: Date) => {
      const month = date.getMonth() + 1
      const day = date.getDate()
      return `${date.getFullYear()}-${month < 10 ? `0${month}` : month}-${
        day < 10 ? `0${day}` : day
      }`
    }
    expect(saveEventItem).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({
        hostOwnerId: 'user-123',
        hostProfileType: 'organization',
        dateOptions: [dateToIso(startDate), dateToIso(endDate)],
      }),
    )

    const activeProfileSelect = screen.getByRole('combobox', { name: /active profile/i })
    const studentOption = screen.getByRole('option', { name: /alex morgan — student/i })
    fireEvent.change(activeProfileSelect, { target: { value: (studentOption as HTMLOptionElement).value } })
    expect(screen.getByText(/student dashboard/i)).toBeTruthy()
    expect(screen.queryByRole('button', { name: /post event/i })).toBeNull()
    expect(screen.getByText(/you are hosting this event and cannot request to join it/i)).toBeTruthy()
    expect(screen.queryByRole('button', { name: /send request/i })).toBeNull()
    expect(saveEventRequest).not.toHaveBeenCalled()
  })

  it('shows events delivered by the shared Firestore subscription', () => {
    const sharedEvent: EventItem = {
      id: 'shared-event-id',
      hostId: 'host-profile-id',
      hostOwnerId: 'host-user-id',
      hostName: 'Campus Organization',
      hostProfileType: 'organization',
      title: 'Shared Community Event',
      location: 'Student Center',
      description: 'An event visible to other users.',
      audience: 'everyone',
      dateOptions: ['2026-11-15'],
      capacity: 20,
      attendees: 0,
      createdAt: '2026-11-01T10:00:00.000Z',
    }

    vi.mocked(subscribeEvents).mockImplementation((onEvents) => {
      onEvents([sharedEvent])
      return () => {}
    })

    render(<App />)

    expect(screen.getByRole('heading', { name: /shared community event/i })).toBeTruthy()
  })

  it('sends participation requests without creating incoming notices or reserving attendance', async () => {
    const sharedEvent: EventItem = {
      id: 'shared-event-id',
      hostId: 'host-profile-id',
      hostOwnerId: 'host-user-id',
      hostName: 'Campus Organization',
      hostProfileType: 'organization',
      title: 'Shared Community Event',
      location: 'Student Center',
      description: 'An event visible to other users.',
      audience: 'everyone',
      dateOptions: ['2027-11-15'],
      capacity: 20,
      attendees: 0,
      createdAt: '2026-11-01T10:00:00.000Z',
    }
    vi.mocked(continueWithoutEmail).mockResolvedValue({ uid: 'student-user-id' } as never)
    vi.mocked(saveUserProfile).mockResolvedValue(undefined)
    vi.mocked(saveEventRequest).mockResolvedValue(undefined)
    vi.mocked(subscribeEvents).mockImplementation((onEvents) => {
      onEvents([sharedEvent])
      return () => {}
    })

    render(<App />)
    fireEvent.change(screen.getByRole('textbox', { name: /your name/i }), {
      target: { value: 'Taylor Student' },
    })
    fireEvent.change(screen.getByRole('textbox', { name: /profile location/i }), {
      target: { value: 'North campus' },
    })
    fireEvent.click(screen.getByRole('button', { name: /save profile/i }))

    fireEvent.click(await screen.findByRole('button', { name: /send participation request/i }))

    expect(await screen.findByText(/your participation request for shared community event has been sent/i)).toBeTruthy()
    expect(saveEventRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        requestType: 'participation',
        hostOwnerId: 'host-user-id',
        hostProfileId: 'host-profile-id',
        requesterOwnerId: 'student-user-id',
        requesterProfileId: expect.any(String),
        status: 'pending',
      }),
    )
    expect(screen.getByText('0')).toBeTruthy()
    expect(screen.getByText(/your inbox is empty/i)).toBeTruthy()
  })

  it('switches inbox and request subscriptions by profile even when profiles share one Firebase UID', async () => {
    const ownerId = 'shared-owner'
    const studentProfile: UserProfile = {
      id: 'student-profile',
      ownerId,
      name: 'Student Profile',
      profileType: 'student',
      focus: 'Campus activities',
      location: 'North campus',
      description: '',
      createdAt: '2026-10-01T10:00:00.000Z',
    }
    const organizationProfile: UserProfile = {
      ...studentProfile,
      id: 'organization-profile',
      name: 'Organization Profile',
      profileType: 'organization',
    }
    const studentRequest: EventRequest = {
      id: 'student-request',
      requestType: 'participation',
      eventId: 'student-event',
      eventTitle: 'Student Event',
      hostOwnerId: 'host-owner',
      hostProfileId: 'host-profile',
      requesterOwnerId: ownerId,
      requesterProfileId: studentProfile.id,
      requesterName: studentProfile.name,
      requesterProfileType: 'student',
      availableDates: ['2027-01-01'],
      attendeeCount: 1,
      message: 'Joining.',
      status: 'pending',
      createdAt: '2026-10-02T10:00:00.000Z',
    }
    const organizationRequest: EventRequest = {
      ...studentRequest,
      id: 'organization-request',
      requestType: 'cohost',
      eventId: 'organization-event',
      eventTitle: 'Organization Event',
      requesterProfileId: organizationProfile.id,
      requesterName: organizationProfile.name,
      requesterProfileType: 'organization',
    }
    localStorage.setItem(
      'cohost.userProfiles',
      JSON.stringify([studentProfile, organizationProfile]),
    )
    localStorage.setItem('cohost.activeProfileId', studentProfile.id)

    vi.mocked(subscribeAuthUser).mockImplementation((onUser) => {
      onUser({ uid: ownerId } as never)
      return vi.fn()
    })
    const unsubscribers: ReturnType<typeof vi.fn>[] = []
    vi.mocked(subscribeEventRequests).mockImplementation(
      (_ownerId, profileId, profileType, onRequests) => {
        const stop = vi.fn()
        unsubscribers.push(stop)
        onRequests(profileType === 'student' ? [studentRequest] : [organizationRequest])
        expect(profileId).toBe(
          profileType === 'student' ? studentProfile.id : organizationProfile.id,
        )
        return stop
      },
    )

    const view = render(<App />)
    expect(await screen.findByText('Your request for Student Event is pending.')).toBeTruthy()
    expect(screen.queryByText('Your request for Organization Event is pending.')).toBeNull()

    fireEvent.change(screen.getByRole('combobox', { name: /active profile/i }), {
      target: { value: organizationProfile.id },
    })
    expect(await screen.findByText('Your request for Organization Event is pending.')).toBeTruthy()
    expect(screen.queryByText('Your request for Student Event is pending.')).toBeNull()
    expect(screen.getByRole('heading', { name: /co-hosting requests you sent/i })).toBeTruthy()
    expect(unsubscribers[0]).toHaveBeenCalledTimes(1)

    fireEvent.change(screen.getByRole('combobox', { name: /active profile/i }), {
      target: { value: studentProfile.id },
    })
    expect(await screen.findByText('Your request for Student Event is pending.')).toBeTruthy()
    expect(screen.queryByText('Your request for Organization Event is pending.')).toBeNull()
    expect(unsubscribers[1]).toHaveBeenCalledTimes(1)
    view.unmount()
    expect(unsubscribers[2]).toHaveBeenCalledTimes(1)
  })

  it('restores request status from Firestore-backed subscriptions after remounting', () => {
    const profile: UserProfile = {
      id: 'persisted-student',
      ownerId: 'persisted-owner',
      name: 'Persisted Student',
      profileType: 'student',
      focus: 'Campus activities',
      location: 'North campus',
      description: '',
      createdAt: '2026-10-01T10:00:00.000Z',
    }
    const persistedRequest: EventRequest = {
      id: 'persisted-request',
      requestType: 'participation',
      eventId: 'persisted-event',
      eventTitle: 'Persisted Event',
      hostOwnerId: 'host-owner',
      hostProfileId: 'host-profile',
      requesterOwnerId: profile.ownerId,
      requesterProfileId: profile.id,
      requesterName: profile.name,
      requesterProfileType: 'student',
      availableDates: ['2027-01-01'],
      attendeeCount: 1,
      message: 'Joining.',
      status: 'accepted',
      createdAt: '2026-10-02T10:00:00.000Z',
      resolvedAt: '2026-10-03T10:00:00.000Z',
    }
    localStorage.setItem('cohost.userProfiles', JSON.stringify([profile]))
    localStorage.setItem('cohost.activeProfileId', profile.id)
    vi.mocked(subscribeAuthUser).mockImplementation((onUser) => {
      onUser({ uid: profile.ownerId } as never)
      return vi.fn()
    })
    vi.mocked(subscribeEventRequests).mockImplementation(
      (_ownerId, _profileId, _profileType, onRequests) => {
        onRequests([persistedRequest])
        return vi.fn()
      },
    )

    const firstView = render(<App />)
    expect(screen.getByText('Your request for Persisted Event is accepted.')).toBeTruthy()
    firstView.unmount()
    render(<App />)

    expect(screen.getByText('Your request for Persisted Event is accepted.')).toBeTruthy()
  })

  it('restores a locally saved profile after the app reloads', async () => {
    vi.mocked(continueWithoutEmail).mockResolvedValue({ uid: 'user-123' } as never)
    vi.mocked(saveUserProfile).mockResolvedValue(undefined)

    const firstRender = render(<App />)
    fireEvent.change(screen.getByRole('textbox', { name: /your name/i }), {
      target: { value: 'Taylor Student' },
    })
    fireEvent.change(screen.getByRole('textbox', { name: /profile location/i }), {
      target: { value: 'North campus' },
    })
    fireEvent.click(screen.getByRole('button', { name: /save profile/i }))

    expect(await screen.findByRole('heading', { name: /taylor student/i })).toBeTruthy()
    firstRender.unmount()

    render(<App />)

    expect(screen.getByRole('heading', { name: /taylor student/i })).toBeTruthy()
    expect(localStorage.getItem('cohost.userProfiles')).toContain('Taylor Student')
  })
})
