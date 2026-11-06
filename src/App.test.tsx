import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import {
  continueWithoutEmail,
  saveEventItem,
  saveEventRequest,
  saveUserProfile,
  subscribeEvents,
} from './services/cohost'
import type { EventItem } from './types'

vi.mock('./services/cohost', () => ({
  continueWithoutEmail: vi.fn(),
  saveUserProfile: vi.fn(),
  saveEventItem: vi.fn(),
  saveEventRequest: vi.fn(),
  subscribeAuthUser: vi.fn(() => vi.fn()),
  subscribeEvents: vi.fn(() => vi.fn()),
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

  it('allows organizations to post events while students can only request to join', async () => {
    vi.mocked(continueWithoutEmail).mockResolvedValue({ uid: 'user-123' } as never)
    vi.mocked(saveUserProfile).mockResolvedValue(undefined)
    vi.mocked(saveEventItem).mockResolvedValue(undefined)
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
    expect(screen.getByText(/only student organizations can post events/i)).toBeTruthy()
    expect(
      screen.getByRole('button', { name: /post event/i }).closest('fieldset')?.hasAttribute('disabled'),
    ).toBe(true)

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
    expect(
      screen.getByRole('button', { name: /post event/i }).closest('fieldset')?.hasAttribute('disabled'),
    ).toBe(false)

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

    expect(await screen.findByRole('heading', { name: /community workshop/i })).toBeTruthy()
    const eventSuccessMessage = screen.getByRole('status')
    expect(eventSuccessMessage.textContent).toMatch(/community workshop was posted to the event board/i)
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
    expect(saveEventItem).toHaveBeenCalledWith(
      expect.objectContaining({
        hostOwnerId: 'user-123',
        hostProfileType: 'organization',
        dateOptions: [dateToIso(startDate), dateToIso(endDate)],
      }),
    )

    const activeProfileSelect = screen.getByRole('combobox', { name: /active profile/i })
    const studentOption = screen.getByRole('option', { name: /alex morgan — student/i })
    fireEvent.change(activeProfileSelect, { target: { value: (studentOption as HTMLOptionElement).value } })
    expect(
      screen.getByRole('button', { name: /post event/i }).closest('fieldset')?.hasAttribute('disabled'),
    ).toBe(true)
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
