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
  subscribeUserProfiles,
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
  window.history.replaceState({}, '', '/#home')
  vi.mocked(subscribeAuthUser).mockImplementation(() => vi.fn())
  vi.mocked(subscribeEvents).mockImplementation(() => vi.fn())
  vi.mocked(subscribeEventRequests).mockImplementation(() => vi.fn())
  vi.mocked(subscribeUserProfiles).mockImplementation(() => vi.fn())
})


const openPage = (page: string) => {
  act(() => {
    window.history.pushState({}, '', `/#${page}`)
    window.dispatchEvent(new HashChangeEvent('hashchange'))
  })
}

const nextStep = () => fireEvent.click(screen.getByRole('button', { name: /^next$/i }))

const selectHostDates = () => {
  const start = new Date()
  start.setDate(start.getDate() + 1)
  const end = new Date(start)
  end.setDate(end.getDate() + 1)
  const month = (date: Date) => date.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
  const label = (date: Date) => `Select ${date.toLocaleDateString(undefined, {
    month: 'short', day: 'numeric', year: 'numeric',
  })}`
  fireEvent.click(screen.getByRole('button', { name: /start date/i }))
  if (month(start) !== month(new Date())) fireEvent.click(screen.getByRole('button', { name: /next month/i }))
  fireEvent.click(screen.getByRole('button', { name: label(start) }))
  if (month(end) !== month(start)) fireEvent.click(screen.getByRole('button', { name: /next month/i }))
  fireEvent.click(screen.getByRole('button', { name: label(end) }))
}

describe('CoHost app', () => {
  it('starts with two clear choices and keeps the workspace uncluttered', async () => {
    vi.mocked(continueWithoutEmail).mockResolvedValue({ uid: 'user-123' } as never)
    render(<App />)

    expect(screen.getByRole('heading', { name: /what would you like to do/i })).toBeTruthy()
    expect(screen.getByRole('heading', { name: /find an event/i })).toBeTruthy()
    expect(screen.getByRole('heading', { name: /create an event/i })).toBeTruthy()
    expect(screen.queryByRole('textbox')).toBeNull()
    expect(screen.queryByRole('heading', { name: /^inbox$/i })).toBeNull()
    expect(screen.queryByRole('heading', { name: /collaboration requests/i })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /continue without email/i }))
    expect(await screen.findByText(/your device account is ready/i)).toBeTruthy()

    openPage('events')
    fireEvent.click(screen.getByRole('button', { name: /show events/i }))
    expect(screen.getByText(/no events have been posted yet/i)).toBeTruthy()
  })

  it('guides publishing one detail at a time and preserves answers through errors and Back', async () => {
    const profile: UserProfile = {
      id: 'club-1', ownerId: 'user-123', name: 'Campus Volunteers', profileType: 'organization',
      focus: 'Campus activities', location: 'North campus', description: '', createdAt: '2026-10-01',
    }
    localStorage.setItem('cohost.userProfiles', JSON.stringify([profile]))
    localStorage.setItem('cohost.activeProfileId', profile.id)
    window.history.replaceState({}, '', '/#host')
    vi.mocked(subscribeAuthUser).mockImplementation((onUser) => {
      onUser({ uid: profile.ownerId } as never)
      return vi.fn()
    })
    vi.mocked(saveEventItem)
      .mockRejectedValueOnce(new DuplicateEventTitleError())
      .mockRejectedValueOnce(new Error('network unavailable'))
    render(<App />)

    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('1')
    expect(screen.queryByRole('textbox', { name: /event location/i })).toBeNull()
    expect(screen.queryByRole('heading', { name: /managing hosted events/i })).toBeNull()
    nextStep()
    expect(screen.getByRole('alert').textContent).toMatch(/give your event a title/i)
    fireEvent.change(screen.getByRole('textbox', { name: /event title/i }), {
      target: { value: 'Community Workshop' },
    })
    nextStep()
    expect(screen.queryByRole('textbox', { name: /event title/i })).toBeNull()
    fireEvent.change(screen.getByRole('textbox', { name: /event location/i }), {
      target: { value: 'Campus Center' },
    })
    fireEvent.click(screen.getByRole('button', { name: /^back$/i }))
    expect((screen.getByRole('textbox', { name: /event title/i }) as HTMLInputElement).value)
      .toBe('Community Workshop')
    nextStep()
    expect((screen.getByRole('textbox', { name: /event location/i }) as HTMLInputElement).value)
      .toBe('Campus Center')
    nextStep()
    nextStep()
    expect(screen.getByRole('alert').textContent).toMatch(/complete event date range/i)
    selectHostDates()
    nextStep()
    fireEvent.change(screen.getByRole('spinbutton', { name: /event capacity/i }), { target: { value: '1.5' } })
    nextStep()
    expect(screen.getByRole('alert').textContent).toMatch(/whole number/i)
    fireEvent.change(screen.getByRole('spinbutton', { name: /event capacity/i }), { target: { value: '12' } })
    nextStep()
    nextStep()
    nextStep()
    expect(screen.getByRole('heading', { name: /ready to publish/i })).toBeTruthy()
    expect(screen.getByText('Community Workshop')).toBeTruthy()
    expect(saveEventItem).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: /publish event/i }))
    expect((await screen.findByRole('alert')).textContent).toMatch(/title already exists/i)
    fireEvent.click(screen.getByRole('button', { name: /publish event/i }))
    expect((await screen.findByRole('alert')).textContent).toMatch(/network unavailable/i)
    expect(screen.getByText('Community Workshop')).toBeTruthy()

    let finishSave = () => {}
    const pendingSave = new Promise<void>((resolve) => { finishSave = resolve })
    vi.mocked(saveEventItem).mockImplementation(() => pendingSave)
    const publish = screen.getByRole('button', { name: /publish event/i })
    fireEvent.click(publish)
    fireEvent.click(publish)
    expect(saveEventItem).toHaveBeenCalledTimes(3)
    expect(screen.getByRole('button', { name: /publishing/i }).hasAttribute('disabled')).toBe(true)
    await act(async () => { finishSave(); await pendingSave })
    expect(await screen.findByRole('heading', { name: /your event is published/i })).toBeTruthy()
    expect(saveEventItem).toHaveBeenLastCalledWith(expect.objectContaining({
      title: 'Community Workshop', location: 'Campus Center', capacity: 12,
      hostOwnerId: profile.ownerId, hostProfileType: 'organization',
    }))
    fireEvent.click(screen.getByRole('button', { name: /create another event/i }))
    expect((screen.getByRole('textbox', { name: /event title/i }) as HTMLInputElement).value).toBe('')
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('1')
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

    openPage('events')
    fireEvent.click(screen.getByRole('button', { name: /show events/i }))
    expect(screen.getByRole('heading', { name: /shared community event/i })).toBeTruthy()
  })

  it('guides a participation request and leaves attendance unchanged until approval', async () => {
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
    openPage('profile')
    fireEvent.change(screen.getByRole('textbox', { name: /your name/i }), {
      target: { value: 'Taylor Student' },
    })
    fireEvent.change(screen.getByRole('textbox', { name: /profile location/i }), {
      target: { value: 'North campus' },
    })
    fireEvent.click(screen.getByRole('button', { name: /save profile/i }))

    await screen.findByRole('heading', { name: /taylor student/i })
    openPage('events')
    fireEvent.click(screen.getByRole('button', { name: /show events/i }))
    fireEvent.click(screen.getByRole('button', { name: /view shared community event/i }))
    expect(screen.queryByRole('textbox', { name: /message/i })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /join this event/i }))
    nextStep()
    expect(screen.getByRole('alert').textContent).toMatch(/choose at least one available date/i)
    fireEvent.click(screen.getByRole('button', { name: /select nov 15, 2027/i }))
    nextStep()
    fireEvent.change(screen.getByRole('textbox', { name: /message to the host/i }), {
      target: { value: 'Excited to join!' },
    })
    nextStep()
    expect(saveEventRequest).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: /send participation request/i }))

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
    expect(screen.getByRole('heading', { name: /your request is on its way/i })).toBeTruthy()
    openPage('inbox')
    expect(screen.getByText(/your request for shared community event is pending/i)).toBeTruthy()
    expect(screen.queryByText(/new participation request/i)).toBeNull()
    openPage('events')
    expect(screen.getByText('20 of 20 spots open')).toBeTruthy()
    expect(screen.getByText(/your request is pending/i)).toBeTruthy()
  })

  it('returns to the selected event after a guest creates a profile', async () => {
    const sharedEvent: EventItem = {
      id: 'guest-event', hostId: 'host-profile', hostOwnerId: 'host-owner', hostName: 'Campus Club',
      hostProfileType: 'organization', title: 'Guest Preview Event', location: 'Student Center',
      description: 'Explore before signing up.', audience: 'everyone', dateOptions: ['2027-11-15'],
      capacity: 20, attendees: 0, createdAt: '2026-11-01',
    }
    vi.mocked(subscribeEvents).mockImplementation((onEvents) => {
      onEvents([sharedEvent])
      return vi.fn()
    })
    vi.mocked(continueWithoutEmail).mockResolvedValue({ uid: 'guest-owner' } as never)
    vi.mocked(saveUserProfile).mockResolvedValue(undefined)
    render(<App />)
    openPage('events')
    fireEvent.click(screen.getByRole('button', { name: /show events/i }))
    fireEvent.click(screen.getByRole('button', { name: /view guest preview event/i }))
    expect(screen.getByRole('link', { name: /create a profile to join/i })).toBeTruthy()
    openPage('profile')
    fireEvent.change(screen.getByRole('textbox', { name: /your name/i }), { target: { value: 'New Student' } })
    fireEvent.change(screen.getByRole('textbox', { name: /profile location/i }), { target: { value: 'North campus' } })
    fireEvent.click(screen.getByRole('button', { name: /save profile/i }))
    expect(await screen.findByRole('heading', { name: /guest preview event/i })).toBeTruthy()
    expect(screen.getByRole('button', { name: /join this event/i })).toBeTruthy()
    expect(screen.queryByRole('textbox', { name: /your name/i })).toBeNull()
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
    openPage('inbox')
    expect(await screen.findByText('Your request for Student Event is pending.')).toBeTruthy()
    expect(screen.queryByText('Your request for Organization Event is pending.')).toBeNull()

    openPage('profile')
    fireEvent.change(screen.getByRole('combobox', { name: /active profile/i }), {
      target: { value: organizationProfile.id },
    })
    openPage('inbox')
    expect(await screen.findByText('Your request for Organization Event is pending.')).toBeTruthy()
    expect(screen.queryByText('Your request for Student Event is pending.')).toBeNull()
    expect(screen.getByRole('heading', { name: /co-hosting requests you sent/i })).toBeTruthy()
    expect(unsubscribers[0]).toHaveBeenCalledTimes(1)

    openPage('profile')
    fireEvent.change(screen.getByRole('combobox', { name: /active profile/i }), {
      target: { value: studentProfile.id },
    })
    openPage('inbox')
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

    window.history.replaceState({}, '', '/#inbox')
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
    openPage('profile')
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
