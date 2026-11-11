import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import {
  continueWithoutEmail,
  DuplicateEventTitleError,
  resolveEventRequest,
  saveEventItem,
  saveOrganizationProfile,
  saveEventRequest,
  saveUserProfile,
  signInWithGoogle,
  signOutUser,
  subscribeAuthUser,
  subscribeEvents,
  subscribeUserProfiles,
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
  ensureOrganizationAccount: vi.fn().mockResolvedValue(undefined),
  createEventRequestId: vi.fn(
    (eventId: string, ownerId: string, profileId: string, requestType: string) =>
      `${eventId}_${ownerId}_${profileId}_${requestType}`,
  ),
  resolveEventRequest: vi.fn(),
  saveOrganizationProfile: vi.fn(),
  saveUserProfile: vi.fn(),
  signInWithGoogle: vi.fn(),
  signOutUser: vi.fn(),
  saveEventItem: vi.fn(),
  saveEventRequest: vi.fn(),
  subscribeAuthUser: vi.fn(() => vi.fn()),
  subscribeEvents: vi.fn(() => vi.fn()),
  subscribeEventRequests: vi.fn(() => vi.fn()),
  subscribePublicOrganizations: vi.fn(() => vi.fn()),
  subscribeUserProfiles: vi.fn(() => vi.fn()),
}))

beforeEach(() => {
  localStorage.clear()
  vi.clearAllMocks()
})

describe('CoHost app', () => {
  it('opens the correct pages from the redesigned header and welcome links', () => {
    render(<App />)

    fireEvent.click(screen.getByRole('button', { name: /^requests$/i }))
    fireEvent.click(screen.getByRole('link', { name: /find an event/i }))
    expect(screen.getByRole('button', { name: /^events$/i }).getAttribute('aria-current')).toBe('page')
    expect(screen.getByRole('heading', { name: /available community events/i })).toBeTruthy()

    fireEvent.click(screen.getByRole('link', { name: /host an event/i }))
    expect(screen.getByRole('button', { name: /^profile$/i }).getAttribute('aria-current')).toBe('page')
    fireEvent.click(screen.getByRole('link', { name: /browse events/i }))
    expect(screen.getByRole('button', { name: /^events$/i }).getAttribute('aria-current')).toBe('page')
    fireEvent.click(screen.getByRole('button', { name: /^account$/i }))
    expect(screen.getByRole('button', { name: /^profile$/i }).getAttribute('aria-current')).toBe('page')

    fireEvent.click(screen.getByRole('link', { name: /cohost home/i }))
    expect(screen.getByRole('button', { name: /^dashboard$/i }).getAttribute('aria-current')).toBe('page')
    fireEvent.click(screen.getByRole('link', { name: /skip to events/i }))
    expect(screen.getByRole('button', { name: /^events$/i }).getAttribute('aria-current')).toBe('page')
  })

  it('renders an empty event board and continues without email', async () => {
    vi.mocked(continueWithoutEmail).mockResolvedValue({ uid: 'user-123' } as never)

    render(<App />)

    expect(screen.getByRole('heading', { name: /^cohost$/i })).toBeTruthy()
    expect(
      screen.getByRole('navigation', { name: /main navigation/i }).querySelectorAll('button'),
    ).toHaveLength(6)
    fireEvent.click(screen.getByRole('button', { name: /^requests$/i }))
    expect(screen.getByRole('heading', { name: /manage event requests/i })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /discover clubs/i }))
    expect(screen.getByRole('heading', { name: /discover clubs/i })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /^dashboard$/i }))
    expect(screen.getByText(/no events have been posted yet/i)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /^inbox$/i }))
    expect(screen.getByText(/your inbox is empty/i)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /^profile$/i }))
    expect(screen.queryByRole('dialog')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /create new profile/i }))
    expect(screen.getByRole('heading', { name: /create a profile/i })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /^cancel$/i }))
    expect(screen.queryByRole('heading', { name: /create a profile/i })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /continue without email/i }))

    expect(continueWithoutEmail).toHaveBeenCalledTimes(1)
    expect(await screen.findByText(/your device account is ready/i)).toBeTruthy()
  })

  it('navigates without a reload and edits profile details without changing identity', async () => {
    const profile: UserProfile = {
      id: 'existing-profile',
      ownerId: 'owner-1',
      name: 'Jordan Student',
      profileType: 'student',
      focus: 'Campus activities',
      location: 'North campus',
      description: 'Looking for campus events.',
      createdAt: '2026-10-01T10:00:00.000Z',
    }
    localStorage.setItem('cohost.userProfiles', JSON.stringify([profile]))
    localStorage.setItem('cohost.activeProfileId', profile.id)
    vi.mocked(subscribeAuthUser).mockImplementation((onUser) => {
      onUser({ uid: profile.ownerId } as never)
      return vi.fn()
    })
    vi.mocked(saveUserProfile).mockResolvedValue(undefined)

    render(<App />)

    expect(screen.getByText(/student dashboard/i)).toBeTruthy()
    expect(screen.queryByText(/active profile/i)).toBeNull()
    expect(screen.queryByRole('heading', { name: /create a profile/i })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /^profile$/i }))
    expect(screen.getByRole('heading', { name: /jordan student/i })).toBeTruthy()
    expect(screen.getByRole('button', { name: /edit profile/i })).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: /edit profile/i }))
    fireEvent.change(screen.getByRole('textbox', { name: /profile name/i }), {
      target: { value: 'Jordan Updated' },
    })
    fireEvent.change(screen.getByRole('combobox', { name: /profile interests/i }), {
      target: { value: 'STEM and maker projects' },
    })
    fireEvent.change(screen.getByRole('textbox', { name: /profile location/i }), {
      target: { value: 'South campus' },
    })
    fireEvent.change(screen.getByRole('textbox', { name: /profile description/i }), {
      target: { value: 'Building maker projects.' },
    })
    fireEvent.click(screen.getByRole('button', { name: /save changes/i }))

    expect(await screen.findByText(/profile has been updated/i)).toBeTruthy()
    const savedProfile = {
      ...profile,
      name: 'Jordan Updated',
      focus: 'STEM and maker projects',
      location: 'South campus',
      description: 'Building maker projects.',
    }
    expect(saveUserProfile).toHaveBeenCalledWith(savedProfile)
    expect(JSON.parse(localStorage.getItem('cohost.userProfiles') ?? '[]')).toContainEqual(
      savedProfile,
    )
    expect(savedProfile.id).toBe(profile.id)
    expect(savedProfile.ownerId).toBe(profile.ownerId)
    expect(savedProfile.createdAt).toBe(profile.createdAt)

    fireEvent.click(screen.getByRole('button', { name: /^events$/i }))
    expect(screen.getByRole('button', { name: /^events$/i }).getAttribute('aria-current')).toBe(
      'page',
    )
    fireEvent.click(screen.getByRole('button', { name: /^inbox$/i }))
    expect(screen.getByRole('heading', { name: /^inbox$/i })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /^dashboard$/i }))
    expect(screen.getByText(/student dashboard/i)).toBeTruthy()
  })

  it('edits organization discovery details and publishes only through the directory sync', async () => {
    const profile: UserProfile = {
      id: 'public-profile',
      ownerId: 'owner-1',
      name: 'Robotics Club',
      profileType: 'organization',
      focus: 'Technology',
      location: 'North campus',
      description: 'Builds robots.',
      createdAt: '2026-10-01T10:00:00.000Z',
      interests: ['Technology'],
      eventTypes: [],
      availableResources: [],
      collaborationPreferences: [],
      directoryVisible: false,
    }
    localStorage.setItem('cohost.userProfiles', JSON.stringify([profile]))
    localStorage.setItem('cohost.activeProfileId', profile.id)
    vi.mocked(subscribeAuthUser).mockImplementation((onUser) => {
      onUser({ uid: profile.ownerId } as never)
      return vi.fn()
    })
    vi.mocked(saveOrganizationProfile).mockResolvedValue(undefined)

    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: /^profile$/i }))
    fireEvent.click(screen.getByRole('button', { name: /edit profile/i }))
    fireEvent.click(screen.getByRole('checkbox', { name: /arts/i }))
    fireEvent.click(screen.getByRole('checkbox', { name: /workshops/i }))
    fireEvent.click(screen.getByRole('checkbox', { name: /event venue/i }))
    fireEvent.click(screen.getByRole('checkbox', { name: /cross-promotion/i }))
    fireEvent.click(screen.getByRole('checkbox', { name: /show in discover clubs/i }))
    fireEvent.click(screen.getByRole('button', { name: /save changes/i }))

    expect(await screen.findByText(/profile has been updated/i)).toBeTruthy()
    expect(saveOrganizationProfile).toHaveBeenCalledWith(
      expect.objectContaining({
        id: profile.id,
        ownerId: profile.ownerId,
        interests: ['Technology', 'Arts'],
        eventTypes: ['Workshops'],
        availableResources: ['Event Venue'],
        collaborationPreferences: ['Cross-promotion'],
        directoryVisible: true,
      }),
    )
  })

  it('shows only the signed-in user profiles and signs out without deleting cloud cache', async () => {
    const ownProfile: UserProfile = {
      id: 'my-student',
      ownerId: 'owner-current',
      name: 'My Student',
      profileType: 'student',
      focus: 'Campus activities',
      location: 'North campus',
      description: '',
      createdAt: '2026-10-01T10:00:00.000Z',
    }
    const otherProfile: UserProfile = {
      ...ownProfile,
      id: 'other-organization',
      ownerId: 'owner-previous',
      name: 'Private Organization',
      profileType: 'organization',
    }
    localStorage.setItem('cohost.userProfiles', JSON.stringify([ownProfile, otherProfile]))
    localStorage.setItem('cohost.activeProfileId', ownProfile.id)
    let updateAuthState: ((user: never) => void) | undefined
    vi.mocked(subscribeAuthUser).mockImplementation((onUser) => {
      updateAuthState = onUser as (user: never) => void
      onUser({
        uid: ownProfile.ownerId,
        isAnonymous: false,
        displayName: 'Google User',
        photoURL: 'https://example.test/avatar.png',
        email: 'google@example.test',
        providerData: [{ providerId: 'google.com' }],
      } as never)
      return vi.fn()
    })
    vi.mocked(signOutUser).mockImplementation(async () => {
      updateAuthState?.(null as never)
    })

    render(<App />)

    expect(screen.getByText(/student dashboard/i)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /^profile$/i }))
    expect(screen.getByRole('heading', { name: /my student/i })).toBeTruthy()
    expect(screen.getByRole('img', { name: /google user profile/i })).toBeTruthy()
    expect(screen.getByText('Google User')).toBeTruthy()
    expect(screen.getByText('google@example.test')).toBeTruthy()
    expect(screen.getAllByText(/signed in with google as google user/i)).toHaveLength(2)
    fireEvent.click(screen.getByRole('button', { name: /switch profile/i }))
    expect(screen.getByRole('option', { name: /my student student/i })).toBeTruthy()
    expect(screen.queryByRole('option', { name: /private organization/i })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /^sign out$/i }))

    expect(signOutUser).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole('button', { name: /^profile$/i }))
    expect(screen.getByRole('heading', { name: /no profile selected/i })).toBeTruthy()
    expect(localStorage.getItem('cohost.userProfiles')).toContain('Private Organization')
  })

  it('only exposes profiles from the authenticated account in the Profile page switcher', () => {
    const ownProfile: UserProfile = {
      id: 'my-student',
      ownerId: 'owner-current',
      name: 'My Student',
      profileType: 'student',
      focus: 'Campus activities',
      location: 'North campus',
      description: '',
      createdAt: '2026-10-01T10:00:00.000Z',
    }
    const otherProfile: UserProfile = {
      ...ownProfile,
      id: 'other-organization',
      ownerId: 'owner-previous',
      name: 'Private Organization',
      profileType: 'organization',
    }
    localStorage.setItem('cohost.userProfiles', JSON.stringify([ownProfile, otherProfile]))
    localStorage.setItem('cohost.activeProfileId', ownProfile.id)
    vi.mocked(subscribeAuthUser).mockImplementation((onUser) => {
      onUser({ uid: ownProfile.ownerId, isAnonymous: false } as never)
      return vi.fn()
    })

    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: /^profile$/i }))
    fireEvent.click(screen.getByRole('button', { name: /switch profile/i }))
    expect(screen.getByRole('option', { name: /my student student/i })).toBeTruthy()
    expect(screen.queryByRole('option', { name: /private organization/i })).toBeNull()
  })

  it('starts Google authentication from Profile and keeps account sign-in separate from profile switching', async () => {
    let updateAuthState: ((user: never) => void) | undefined
    vi.mocked(subscribeAuthUser).mockImplementation((onUser) => {
      updateAuthState = onUser as (user: never) => void
      onUser(null)
      return vi.fn()
    })
    vi.mocked(signInWithGoogle).mockImplementation(async () => {
      const user = { uid: 'google-account', isAnonymous: false }
      updateAuthState?.(user as never)
      return user as never
    })

    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: /^profile$/i }))
    fireEvent.click(screen.getByRole('button', { name: /sign in with google/i }))

    expect(signInWithGoogle).toHaveBeenCalledTimes(1)
    expect(await screen.findByText(/google account is connected/i)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /^profile$/i }))
    expect(screen.getByRole('heading', { name: /no profile selected/i })).toBeTruthy()
  })

  it('shows separate student and organization dashboards as profiles change', async () => {
    vi.mocked(continueWithoutEmail).mockResolvedValue({ uid: 'user-123' } as never)
    vi.mocked(saveUserProfile).mockResolvedValue(undefined)
    vi.mocked(subscribeAuthUser).mockImplementation((onUser) => {
      onUser({ uid: 'user-123', isAnonymous: true } as never)
      return vi.fn()
    })
    vi.mocked(saveEventItem)
      .mockRejectedValueOnce(new DuplicateEventTitleError())
      .mockRejectedValueOnce(new Error('network unavailable'))
    vi.mocked(saveEventRequest).mockResolvedValue(undefined)

    render(<App />)

    fireEvent.click(screen.getByRole('button', { name: /^profile$/i }))
    expect(screen.getByRole('button', { name: /create new profile/i })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /create new profile/i }))
    fireEvent.change(screen.getByRole('combobox', { name: /profile type/i }), {
      target: { value: 'student' },
    })
    fireEvent.change(screen.getByRole('textbox', { name: /your name/i }), {
      target: { value: 'Alex Morgan' },
    })
    fireEvent.change(screen.getByRole('textbox', { name: /profile location/i }), {
      target: { value: 'North campus' },
    })
    const createProfileButton = screen.getByRole('button', { name: /^save$/i })
    fireEvent.click(createProfileButton)
    fireEvent.click(createProfileButton)

    expect(await screen.findByText(/alex morgan's student profile was created/i)).toBeTruthy()
    expect(localStorage.getItem('cohost.userProfiles')).toContain('"name":"Alex Morgan"')
    expect(localStorage.getItem('cohost.userProfiles')).toContain('"profileType":"student"')
    expect(saveUserProfile).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole('button', { name: /^profile$/i }))
    expect(screen.getByText('Alex Morgan')).toBeTruthy()
    expect(saveUserProfile).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        ownerId: 'user-123',
        profileType: 'student',
      }),
    )
    fireEvent.click(screen.getByRole('button', { name: /^dashboard$/i }))
    expect(screen.getByText(/student dashboard/i)).toBeTruthy()
    expect(screen.queryByRole('button', { name: /create event/i })).toBeNull()
    expect(screen.getByText(/no events have been posted yet/i)).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: /^profile$/i }))
    fireEvent.click(screen.getByRole('button', { name: /create new profile/i }))
    fireEvent.change(screen.getByRole('combobox', { name: /profile type/i }), {
      target: { value: 'organization' },
    })
    fireEvent.change(screen.getByRole('textbox', { name: /organization name/i }), {
      target: { value: 'Campus Volunteers' },
    })
    fireEvent.change(screen.getByRole('textbox', { name: /profile location/i }), {
      target: { value: 'North campus' },
    })
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }))

    expect(await screen.findByText(/campus volunteers's organization profile was created/i)).toBeTruthy()
    expect(localStorage.getItem('cohost.userProfiles')).toContain('"name":"Campus Volunteers"')
    expect(localStorage.getItem('cohost.userProfiles')).toContain('"profileType":"organization"')
    fireEvent.click(screen.getByRole('button', { name: /^profile$/i }))
    expect(screen.getByText('Campus Volunteers')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /^dashboard$/i }))
    expect(screen.getByText(/organization dashboard/i)).toBeTruthy()
    expect((screen.getByRole('button', { name: /create event/i }) as HTMLButtonElement).disabled).toBe(
      false,
    )
    fireEvent.click(screen.getByRole('button', { name: /^profile$/i }))
    expect(screen.getByText(/organization profiles do not establish administrator authorization/i)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /^dashboard$/i }))
    expect(screen.getByRole('heading', { name: /managing events/i })).toBeTruthy()
    expect(screen.queryByRole('heading', { name: /collaboration requests/i })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /^requests$/i }))
    expect(screen.getByRole('tab', { name: /incoming requests/i })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /^dashboard$/i }))

    fireEvent.change(screen.getByRole('textbox', { name: /event title/i }), {
      target: { value: 'Community Workshop' },
    })
    fireEvent.change(screen.getByRole('textbox', { name: /event location/i }), {
      target: { value: 'Campus Center' },
    })
    fireEvent.click(screen.getByRole('checkbox', { name: /we offer venue/i }))
    fireEvent.change(screen.getByRole('textbox', { name: /offer description/i }), {
      target: { value: 'We can provide the venue.' },
    })
    fireEvent.click(screen.getByRole('checkbox', { name: /we need volunteers/i }))
    fireEvent.change(screen.getByRole('textbox', { name: /need description/i }), {
      target: { value: 'We need volunteers to host the event.' },
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
    fireEvent.click(screen.getByRole('button', { name: /create event/i }))

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

    fireEvent.click(screen.getByRole('button', { name: /create event/i }))
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
    const publishButton = screen.getByRole('button', { name: /create event/i })
    fireEvent.click(publishButton)
    fireEvent.click(publishButton)
    expect(saveEventItem).toHaveBeenCalledTimes(3)
    expect(screen.getByRole('button', { name: /saving\.\.\./i }).hasAttribute('disabled')).toBe(
      true,
    )

    await act(async () => {
      resolveEventSave()
      await pendingEventSave
    })

    expect(await screen.findByRole('heading', { name: /community workshop/i })).toBeTruthy()
    const eventSuccessMessage = screen.getByRole('status')
    expect(eventSuccessMessage.textContent).toBe(
      "Event 'Community Workshop' was saved as Draft. Start Collaboration when you are ready to receive co-host requests. It is not visible to students until published.",
    )
    expect(saveEventItem).toHaveBeenLastCalledWith(
      expect.objectContaining({
        publicationStatus: 'draft',
        collaborationRequirementsCompleted: false,
        attendees: 0,
      }),
    )
    expect(eventSuccessMessage.closest('form')).toBeTruthy()
    expect((screen.getByRole('textbox', { name: /event title/i }) as HTMLInputElement).value).toBe('')
    expect((screen.getByRole('textbox', { name: /event location/i }) as HTMLInputElement).value).toBe('')
    expect(screen.getByRole('button', { name: /start date/i }).textContent).toMatch(/select a date/i)
    fireEvent.click(screen.getByRole('checkbox', { name: /we offer venue/i }))
    fireEvent.change(screen.getByRole('textbox', { name: /offer description/i }), {
      target: { value: 'We can provide the venue.' },
    })
    fireEvent.click(screen.getByRole('checkbox', { name: /we need volunteers/i }))
    fireEvent.change(screen.getByRole('textbox', { name: /need description/i }), {
      target: { value: 'We need volunteers to host the event.' },
    })
    fireEvent.click(screen.getByRole('button', { name: /create event/i }))
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
        resourcesOffered: ['Venue'],
        offerDescription: 'We can provide the venue.',
        resourcesNeeded: ['Volunteers'],
        needDescription: 'We need volunteers to host the event.',
      }),
    )

    fireEvent.click(screen.getByRole('button', { name: /^profile$/i }))
    fireEvent.click(screen.getByRole('button', { name: /switch profile/i }))
    fireEvent.click(screen.getByRole('option', { name: /alex morgan student/i }))
    fireEvent.click(screen.getByRole('button', { name: /^dashboard$/i }))
    expect(screen.getByText(/student dashboard/i)).toBeTruthy()
    expect(screen.queryByRole('button', { name: /create event/i })).toBeNull()
    expect(screen.queryByText('Campus Arts Night')).toBeNull()
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
      publicationStatus: 'published',
    }

    vi.mocked(subscribeEvents).mockImplementation((_profileType, _ownerId, onEvents) => {
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
      publicationStatus: 'published',
    }
    vi.mocked(continueWithoutEmail).mockResolvedValue({ uid: 'student-user-id' } as never)
    vi.mocked(saveUserProfile).mockResolvedValue(undefined)
    vi.mocked(saveEventRequest).mockResolvedValue(undefined)
    vi.mocked(subscribeEvents).mockImplementation((_profileType, _ownerId, onEvents) => {
      onEvents([sharedEvent])
      return () => {}
    })

    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: /^profile$/i }))
    fireEvent.click(screen.getByRole('button', { name: /create new profile/i }))
    fireEvent.change(screen.getByRole('textbox', { name: /your name/i }), {
      target: { value: 'Taylor Student' },
    })
    fireEvent.change(screen.getByRole('textbox', { name: /profile location/i }), {
      target: { value: 'North campus' },
    })
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }))

    fireEvent.click(screen.getByRole('button', { name: /^events$/i }))
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
    expect(screen.getByText('Available spots')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /^inbox$/i }))
    expect(screen.getByText(/your inbox is empty/i)).toBeTruthy()
  })

  it('opens a co-host modal and submits selected resources with a trimmed contribution', async () => {
    const requesterProfile: UserProfile = {
      id: 'requester-club',
      ownerId: 'requester-owner',
      name: 'Campus Volunteers',
      profileType: 'organization',
      focus: 'Community Service',
      location: 'North campus',
      description: 'Student volunteers.',
      createdAt: '2026-10-01T10:00:00.000Z',
    }
    const hostEvent: EventItem = {
      id: 'host-event',
      hostId: 'host-profile',
      hostOwnerId: 'host-owner',
      hostName: 'Campus Arts Club',
      hostProfileType: 'organization',
      title: 'Campus Arts Night',
      location: 'Arts Hall',
      description: 'An evening of art.',
      audience: 'organizations',
      dateOptions: ['2026-12-01'],
      capacity: 30,
      attendees: 0,
      createdAt: '2026-11-01T10:00:00.000Z',
      resourcesNeeded: ['Venue', 'Other', 'Volunteers'],
      needDescription: 'Space and event support are needed.',
      needOtherResource: 'Lighting',
      needOtherDescription: 'Stage lights and setup.',
      publicationStatus: 'pending_collaboration',
    }
    localStorage.setItem('cohost.userProfiles', JSON.stringify([requesterProfile]))
    localStorage.setItem('cohost.activeProfileId', requesterProfile.id)
    vi.mocked(subscribeAuthUser).mockImplementation((onUser) => {
      onUser({ uid: requesterProfile.ownerId } as never)
      return vi.fn()
    })
    vi.mocked(subscribeEvents).mockImplementation((_profileType, _ownerId, onEvents) => {
      onEvents([hostEvent])
      return vi.fn()
    })
    vi.mocked(saveEventRequest).mockResolvedValue(undefined)

    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: /request to co-host/i }))
    expect(saveEventRequest).not.toHaveBeenCalled()
    const dialog = screen.getByRole('dialog', { name: /request to co-host/i })
    expect(dialog.textContent).toContain(hostEvent.title)
    expect(dialog.textContent).toContain('Campus Arts Club')
    expect(dialog.textContent).toContain(hostEvent.needDescription)
    expect(dialog.textContent).toContain('Lighting')

    fireEvent.click(screen.getByRole('checkbox', { name: /provide venue/i }))
    fireEvent.click(screen.getByRole('checkbox', { name: /provide other — lighting/i }))
    fireEvent.change(screen.getByRole('textbox', { name: /contribution details/i }), {
      target: {
        value:
          '  We can provide a venue for approximately 30 students and promote the event.  ',
      },
    })
    fireEvent.change(screen.getByRole('spinbutton', { name: /estimated number of attendees/i }), {
      target: { value: '30' },
    })
    fireEvent.change(screen.getByRole('textbox', { name: /co-hosting message for campus arts night/i }), {
      target: { value: '  We would love to collaborate.  ' },
    })
    fireEvent.click(screen.getByRole('button', { name: /submit request/i }))

    expect(await screen.findByText(/co-hosting request for campus arts night has been sent/i)).toBeTruthy()
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(saveEventRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        requestType: 'cohost',
        eventId: hostEvent.id,
        hostProfileId: hostEvent.hostId,
        requesterProfileId: requesterProfile.id,
        resourcesProvided: ['Venue', 'Other'],
        contributionDescription:
          'We can provide a venue for approximately 30 students and promote the event.',
        estimatedAttendees: 30,
        attendeeCount: 0,
        message: 'Co-hosting request: We would love to collaborate.',
        status: 'pending',
      }),
    )
  })

  it('validates co-host resource selection and keeps the modal values after a failed save', async () => {
    const requesterProfile: UserProfile = {
      id: 'requester-club',
      ownerId: 'requester-owner',
      name: 'Campus Volunteers',
      profileType: 'organization',
      focus: 'Community Service',
      location: 'North campus',
      description: 'Student volunteers.',
      createdAt: '2026-10-01T10:00:00.000Z',
    }
    const hostEvent: EventItem = {
      id: 'host-event',
      hostId: 'host-profile',
      hostOwnerId: 'host-owner',
      hostName: 'Campus Arts Club',
      hostProfileType: 'organization',
      title: 'Campus Arts Night',
      location: 'Arts Hall',
      description: 'An evening of art.',
      audience: 'organizations',
      dateOptions: ['2026-12-01'],
      capacity: 30,
      attendees: 0,
      createdAt: '2026-11-01T10:00:00.000Z',
      resourcesNeeded: ['Venue', 'Volunteers'],
      needDescription: 'Venue and volunteer support.',
      publicationStatus: 'pending_collaboration',
    }
    localStorage.setItem('cohost.userProfiles', JSON.stringify([requesterProfile]))
    localStorage.setItem('cohost.activeProfileId', requesterProfile.id)
    vi.mocked(subscribeAuthUser).mockImplementation((onUser) => {
      onUser({ uid: requesterProfile.ownerId } as never)
      return vi.fn()
    })
    vi.mocked(subscribeEvents).mockImplementation((_profileType, _ownerId, onEvents) => {
      onEvents([hostEvent])
      return vi.fn()
    })
    vi.mocked(saveEventRequest).mockRejectedValue(new Error('permission denied'))

    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: /request to co-host/i }))
    fireEvent.click(screen.getByRole('button', { name: /submit request/i }))
    expect(screen.getByRole('alert').textContent).toMatch(/describe what your organization can contribute/i)
    expect(saveEventRequest).not.toHaveBeenCalled()

    fireEvent.change(screen.getByRole('textbox', { name: /contribution details/i }), {
      target: { value: 'Venue support.' },
    })
    fireEvent.click(screen.getByRole('button', { name: /submit request/i }))
    expect(screen.getByRole('alert').textContent).toMatch(/select at least one resource/i)
    expect(saveEventRequest).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('checkbox', { name: /provide venue/i }))
    fireEvent.click(screen.getByRole('button', { name: /submit request/i }))

    expect(
      await screen.findByText(/could not send your co-hosting request.*permission denied/i),
    ).toBeTruthy()
    expect(screen.getByRole('dialog')).toBeTruthy()
    expect((screen.getByRole('textbox', { name: /contribution details/i }) as HTMLTextAreaElement).value).toBe(
      'Venue support.',
    )
    expect((screen.getByRole('checkbox', { name: /provide venue/i }) as HTMLInputElement).checked).toBe(
      true,
    )
    expect(saveEventRequest).toHaveBeenCalledTimes(1)
  })

  it('supports a general contribution for legacy events and prevents duplicate submissions', async () => {
    const requesterProfile: UserProfile = {
      id: 'legacy-requester',
      ownerId: 'legacy-owner',
      name: 'Legacy Partner Club',
      profileType: 'organization',
      focus: 'Community Service',
      location: 'North campus',
      description: 'Student volunteers.',
      createdAt: '2026-10-01T10:00:00.000Z',
    }
    const legacyEvent: EventItem = {
      id: 'legacy-host-event',
      hostId: 'legacy-host-profile',
      hostOwnerId: 'legacy-host-owner',
      hostName: 'Legacy Host Club',
      hostProfileType: 'organization',
      title: 'Legacy Campus Event',
      location: 'Arts Hall',
      description: 'An older event.',
      audience: 'organizations',
      dateOptions: ['2026-12-01'],
      capacity: 30,
      attendees: 0,
      createdAt: '2026-10-01T10:00:00.000Z',
      publicationStatus: 'pending_collaboration',
    }
    localStorage.setItem('cohost.userProfiles', JSON.stringify([requesterProfile]))
    localStorage.setItem('cohost.activeProfileId', requesterProfile.id)
    vi.mocked(subscribeAuthUser).mockImplementation((onUser) => {
      onUser({ uid: requesterProfile.ownerId } as never)
      return vi.fn()
    })
    vi.mocked(subscribeEvents).mockImplementation((_profileType, _ownerId, onEvents) => {
      onEvents([legacyEvent])
      return vi.fn()
    })
    let resolveSave = () => {}
    const pendingSave = new Promise<void>((resolve) => {
      resolveSave = resolve
    })
    vi.mocked(saveEventRequest).mockReturnValue(pendingSave)

    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: /request to co-host/i }))
    expect(
      (screen.getByRole('checkbox', { name: /general contribution/i }) as HTMLInputElement).checked,
    ).toBe(true)
    const estimatedAttendance = screen.getByRole('spinbutton', {
      name: /estimated number of attendees/i,
    }) as HTMLInputElement
    fireEvent.change(estimatedAttendance, { target: { value: '24' } })
    fireEvent.click(screen.getByRole('checkbox', { name: /not sure yet/i }))
    expect(estimatedAttendance.disabled).toBe(true)
    expect(estimatedAttendance.value).toBe('')
    fireEvent.change(screen.getByRole('textbox', { name: /contribution details/i }), {
      target: { value: 'We can provide volunteers.' },
    })
    const submitButton = screen.getByRole('button', { name: /submit request/i })
    fireEvent.click(submitButton)
    fireEvent.click(submitButton)

    expect(saveEventRequest).toHaveBeenCalledTimes(1)
    expect((screen.getByRole('button', { name: /submitting/i }) as HTMLButtonElement).disabled).toBe(
      true,
    )
    expect(saveEventRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        eventId: legacyEvent.id,
        resourcesProvided: ['General contribution'],
        contributionDescription: 'We can provide volunteers.',
        attendeeCount: 0,
      }),
    )

    await act(async () => {
      resolveSave()
      await pendingSave
    })
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('updates an incoming request after Firebase approval and persists the inbox read state', async () => {
    const hostProfile: UserProfile = {
      id: 'host-organization',
      ownerId: 'host-owner',
      name: 'Campus Arts Club',
      profileType: 'organization',
      focus: 'Arts',
      location: 'Arts Hall',
      description: 'Campus arts.',
      createdAt: '2026-10-01T10:00:00.000Z',
    }
    const incomingCoHostRequest: EventRequest = {
      id: 'inbox-cohost-request',
      requestType: 'cohost',
      eventId: 'inbox-event',
      eventTitle: 'Campus Arts Night',
      hostOwnerId: hostProfile.ownerId,
      hostProfileId: hostProfile.id,
      requesterOwnerId: 'requester-owner',
      requesterProfileId: 'requester-profile',
      requesterName: 'Volunteer Club',
      requesterProfileType: 'organization',
      availableDates: ['2026-12-01'],
      attendeeCount: 4,
      message: 'We would like to collaborate.',
      status: 'pending',
      createdAt: '2026-11-02T10:00:00.000Z',
      resourcesProvided: ['Venue'],
      contributionDescription: 'We can provide the venue.',
    }
    localStorage.setItem('cohost.userProfiles', JSON.stringify([hostProfile]))
    localStorage.setItem('cohost.activeProfileId', hostProfile.id)
    vi.mocked(subscribeAuthUser).mockImplementation((onUser) => {
      onUser({ uid: hostProfile.ownerId } as never)
      return vi.fn()
    })
    vi.mocked(subscribeEventRequests).mockImplementation((_ownerId, _profileId, _profileType, onRequests) => {
      onRequests([incomingCoHostRequest])
      return vi.fn()
    })
    vi.mocked(resolveEventRequest).mockResolvedValue(undefined)

    const firstView = render(<App />)
    fireEvent.click(screen.getByRole('button', { name: /^inbox$/i }))
    fireEvent.click(screen.getByRole('button', { name: /view details/i }))
    expect(screen.getByRole('heading', { name: /manage event requests/i })).toBeTruthy()
    expect(within(screen.getByRole('dialog')).getByText(/^pending$/i)).toBeTruthy()
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: /^accept$/i }))

    expect(await within(screen.getByRole('dialog')).findByText(/^accepted$/i)).toBeTruthy()
    expect(resolveEventRequest).toHaveBeenCalledWith(
      incomingCoHostRequest,
      'accepted',
      hostProfile.ownerId,
      hostProfile.id,
    )
    expect(JSON.parse(localStorage.getItem('cohost.readNotificationIds') ?? '[]')).toContain(
      incomingCoHostRequest.id,
    )
    expect(screen.queryByRole('button', { name: /^decline$/i })).toBeNull()

    firstView.unmount()
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: /^inbox$/i }))
    expect(screen.queryByRole('button', { name: /mark read/i })).toBeNull()
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
    fireEvent.click(screen.getByRole('button', { name: /^requests$/i }))
    fireEvent.click(screen.getByRole('tab', { name: /sent requests/i }))
    expect(await screen.findByText('Student Event')).toBeTruthy()
    expect(screen.queryByText('Organization Event')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: /^profile$/i }))
    fireEvent.click(screen.getByRole('button', { name: /switch profile/i }))
    fireEvent.click(screen.getByRole('option', { name: /organization profile organization/i }))
    expect(localStorage.getItem('cohost.activeProfileId')).toBe(organizationProfile.id)
    expect(screen.getByText(/organization dashboard/i)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /^requests$/i }))
    fireEvent.click(screen.getByRole('tab', { name: /sent requests/i }))
    expect(await screen.findByText('Organization Event')).toBeTruthy()
    expect(screen.queryByText('Student Event')).toBeNull()
    expect(unsubscribers[0]).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getByRole('button', { name: /^profile$/i }))
    fireEvent.click(screen.getByRole('button', { name: /switch profile/i }))
    fireEvent.click(screen.getByRole('option', { name: /student profile student/i }))
    expect(localStorage.getItem('cohost.activeProfileId')).toBe(studentProfile.id)
    expect(screen.getByText(/student dashboard/i)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /^requests$/i }))
    fireEvent.click(screen.getByRole('tab', { name: /sent requests/i }))
    expect(await screen.findByText('Student Event')).toBeTruthy()
    expect(screen.queryByText('Organization Event')).toBeNull()
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
    fireEvent.click(screen.getByRole('button', { name: /^requests$/i }))
    fireEvent.click(screen.getByRole('tab', { name: /sent requests/i }))
    expect(screen.getByText('Persisted Event')).toBeTruthy()
    firstView.unmount()
    render(<App />)

    fireEvent.click(screen.getByRole('button', { name: /^requests$/i }))
    fireEvent.click(screen.getByRole('tab', { name: /sent requests/i }))
    expect(screen.getByText('Persisted Event')).toBeTruthy()
  })

  it('restores a locally saved profile after the app reloads', async () => {
    vi.mocked(continueWithoutEmail).mockResolvedValue({ uid: 'user-123' } as never)
    vi.mocked(saveUserProfile).mockResolvedValue(undefined)
    vi.mocked(subscribeAuthUser).mockImplementation((onUser) => {
      onUser({ uid: 'user-123', isAnonymous: true } as never)
      return vi.fn()
    })

    const firstRender = render(<App />)
    fireEvent.click(screen.getByRole('button', { name: /^profile$/i }))
    fireEvent.click(screen.getByRole('button', { name: /create new profile/i }))
    fireEvent.change(screen.getByRole('textbox', { name: /your name/i }), {
      target: { value: 'Taylor Student' },
    })
    fireEvent.change(screen.getByRole('textbox', { name: /profile location/i }), {
      target: { value: 'North campus' },
    })
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }))

    expect(await screen.findByText(/taylor student's student profile was created/i)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /^profile$/i }))
    expect(await screen.findByRole('heading', { name: /taylor student/i })).toBeTruthy()
    firstRender.unmount()

    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: /^profile$/i }))

    expect(screen.getByRole('heading', { name: /taylor student/i })).toBeTruthy()
    expect(localStorage.getItem('cohost.userProfiles')).toContain('Taylor Student')
  })
  it('drops deleted cloud profiles from the device cache without recreating them or clearing account identity', async () => {
    const stale: UserProfile = { id: 'deleted-profile', ownerId: 'reset-owner', name: 'Old Organization', profileType: 'organization',
      focus: 'Sports', location: 'Campus', description: 'Deleted in reset', createdAt: '2026-11-01' }
    localStorage.setItem('cohost.userProfiles', JSON.stringify([stale]))
    localStorage.setItem('cohost.activeProfileId', stale.id)
    localStorage.setItem('cohost.deviceId', 'keep-device-identity')
    vi.mocked(subscribeAuthUser).mockImplementation(onUser => { onUser({ uid: 'reset-owner', isAnonymous: true } as never); return vi.fn() })
    let receive: ((profiles: UserProfile[]) => void) | undefined
    vi.mocked(subscribeUserProfiles).mockImplementation((_uid, onProfiles) => { receive = onProfiles; return vi.fn() })
    try {
      render(<App />)
      await act(async () => { receive?.([]) })
      expect(JSON.parse(localStorage.getItem('cohost.userProfiles') ?? '[]')).toEqual([])
      expect(localStorage.getItem('cohost.deviceId')).toBe('keep-device-identity')
      expect(saveUserProfile).not.toHaveBeenCalled()
      expect(screen.getByText(/cloud profile list has changed/i)).toBeTruthy()
    } finally { vi.mocked(subscribeUserProfiles).mockImplementation(() => vi.fn()) }
  })

})
