import { useState } from 'react'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { EventDiscovery } from './EventDiscovery'
import type { RequestDraftValues } from './DashboardComponents'
import type { EventItem, EventRequest, UserProfile } from '../types'

const student: UserProfile = {
  id: 'student', ownerId: 'student-owner', name: 'Alex', profileType: 'student',
  focus: '', location: 'Campus', description: '', createdAt: '2026-11-01',
}
const event: EventItem = {
  id: 'arts', hostId: 'host', hostOwnerId: 'host-owner', hostName: 'Art Club',
  hostProfileType: 'organization', title: 'Arts Night', location: 'Student Center',
  description: 'Make art with us.', audience: 'everyone', dateOptions: ['2027-11-15'],
  capacity: 20, attendees: 3, createdAt: '2026-11-01',
}

interface HarnessProps {
  profile?: UserProfile | null
  events?: EventItem[]
  requests?: EventRequest[]
  onRequest?: (event: EventItem, kind: 'participation' | 'cohost') => Promise<boolean>
}

const Harness = ({ profile = student, events = [event], requests = [],
  onRequest = vi.fn().mockResolvedValue(true) }: HarnessProps) => {
  const [draft, setDraft] = useState<RequestDraftValues>({ dates: [], attendeeCount: '2', message: '' })
  return <EventDiscovery events={events} activeProfile={profile} requestDrafts={{ [event.id]: draft }}
    requestKind={profile?.profileType === 'organization' ? 'cohost' : 'participation'}
    requests={requests} onRequest={onRequest}
    onDraftChange={(_, field, value) => setDraft((current) => ({ ...current, [field]: value }))}
    onDatesChange={(_, dates) => setDraft((current) => ({ ...current, dates }))} />
}

const next = () => fireEvent.click(screen.getByRole('button', { name: /^next$/i }))
const chooseEvent = () => {
  fireEvent.click(screen.getByRole('button', { name: /show events/i }))
  fireEvent.click(screen.getByRole('button', { name: /view arts night/i }))
}
const chooseDate = () => fireEvent.click(screen.getByRole('button', { name: /select nov 15, 2027/i }))
const reviewStudentRequest = () => {
  chooseEvent()
  fireEvent.click(screen.getByRole('button', { name: /join this event/i }))
  chooseDate()
  next()
  next()
}

describe('guided event discovery', () => {
  it('searches by location, handles no matches, and preserves the search on Back', () => {
    render(<Harness />)
    const search = screen.getByRole('searchbox')
    fireEvent.change(search, { target: { value: 'no-such-event' } })
    fireEvent.click(screen.getByRole('button', { name: /show events/i }))
    expect(screen.getByText(/no events match/i)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /back to search/i }))
    expect((screen.getByRole('searchbox') as HTMLInputElement).value).toBe('no-such-event')
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'student center' } })
    chooseEvent()
    expect(screen.getByRole('heading', { name: 'Arts Night' })).toBeTruthy()
    expect(screen.queryByRole('textbox')).toBeNull()
  })

  it('lets guests view details before asking them to create a profile', () => {
    render(<Harness profile={null} />)
    chooseEvent()
    expect(screen.getByText('Make art with us.')).toBeTruthy()
    expect(screen.getByRole('link', { name: /create a profile to join/i }).getAttribute('href')).toBe('#profile')
    expect(screen.queryByRole('button', { name: /join this event/i })).toBeNull()
  })

  it.each([
    ['full', { ...event, attendees: event.capacity }, /this event is full/i],
    ['own', { ...event, hostOwnerId: student.ownerId }, /you are hosting this event/i],
  ])('blocks requests for an %s event', (_name, item, message) => {
    const onRequest = vi.fn().mockResolvedValue(true)
    render(<Harness events={[item as EventItem]} onRequest={onRequest} />)
    chooseEvent()
    expect(screen.getByText(message as RegExp)).toBeTruthy()
    expect(screen.queryByRole('button', { name: /join this event/i })).toBeNull()
    expect(onRequest).not.toHaveBeenCalled()
  })

  it('preserves dates and the message when going back from review', () => {
    render(<Harness />)
    chooseEvent()
    fireEvent.click(screen.getByRole('button', { name: /join this event/i }))
    chooseDate()
    next()
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Can I bring a sketchbook?' } })
    next()
    expect(screen.getByText('Can I bring a sketchbook?')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /^back$/i }))
    expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe('Can I bring a sketchbook?')
    fireEvent.click(screen.getByRole('button', { name: /^back$/i }))
    expect(screen.getByRole('button', { name: /select nov 15, 2027/i }).getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByRole('heading', { name: /when can you make it/i })).toBe(document.activeElement)
  })

  it('validates group size and sends a co-host request only after review', async () => {
    const onRequest = vi.fn().mockResolvedValue(true)
    render(<Harness profile={{ ...student, profileType: 'organization', name: 'Campus Club' }}
      onRequest={onRequest} />)
    chooseEvent()
    fireEvent.click(screen.getByRole('button', { name: /join as a co-host/i }))
    chooseDate()
    next()
    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '0' } })
    next()
    expect(screen.getByRole('alert').textContent).toMatch(/whole number/i)
    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '5' } })
    next()
    next()
    expect(screen.getByText('5')).toBeTruthy()
    expect(onRequest).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: /send co-hosting request/i }))
    await screen.findByRole('heading', { name: /your request is on its way/i })
    expect(onRequest).toHaveBeenCalledWith(event, 'cohost')
  })

  it('prevents duplicate clicks and keeps review available after a failed send', async () => {
    let finish: (success: boolean) => void = () => {}
    const pending = new Promise<boolean>((resolve) => { finish = resolve })
    const onRequest = vi.fn().mockReturnValueOnce(pending).mockResolvedValueOnce(true)
    render(<Harness onRequest={onRequest} />)
    reviewStudentRequest()
    const send = screen.getByRole('button', { name: /send participation request/i })
    fireEvent.click(send)
    fireEvent.click(send)
    expect(onRequest).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('button', { name: /sending/i }).hasAttribute('disabled')).toBe(true)
    await act(async () => { finish(false); await pending })
    expect(screen.getByRole('alert').textContent).toMatch(/could not be sent/i)
    expect(screen.getByText('2027-11-15')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /send participation request/i }))
    await screen.findByRole('heading', { name: /your request is on its way/i })
    expect(onRequest).toHaveBeenCalledTimes(2)
  })

  it('handles an event being removed while its details are open', () => {
    const view = render(<Harness />)
    chooseEvent()
    view.rerender(<Harness events={[]} />)
    expect(screen.getByRole('heading', { name: /no longer available/i })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /back to results/i }))
    expect(screen.getByText(/no events have been posted/i)).toBeTruthy()
  })

  it('requires new availability when the host changes dates before submission', async () => {
    const onRequest = vi.fn().mockResolvedValue(true)
    const view = render(<Harness onRequest={onRequest} />)
    reviewStudentRequest()
    view.rerender(<Harness events={[{ ...event, dateOptions: ['2027-11-16'] }]} onRequest={onRequest} />)
    fireEvent.click(screen.getByRole('button', { name: /send participation request/i }))
    await waitFor(() => expect(screen.getByRole('alert').textContent).toMatch(/event dates changed/i))
    expect(screen.getByRole('heading', { name: /when can you make it/i })).toBeTruthy()
    expect(onRequest).not.toHaveBeenCalled()
  })
})
