import { useRef, useState, type FormEvent } from 'react'
import type { EventItem, EventRequest, UserProfile } from '../types'
import type { RequestDraftValues } from './DashboardComponents'
import CalendarPicker from './CalendarPicker'
import { StepHeading } from './StepHeading'

interface EventDiscoveryProps {
  events: EventItem[]
  activeProfile: UserProfile | null
  requestDrafts: Record<string, RequestDraftValues>
  requestKind: 'participation' | 'cohost'
  requests?: EventRequest[]
  initialEventId?: string | null
  onSelectEvent?: (eventId: string | null) => void
  onDraftChange: (eventId: string, field: 'attendeeCount' | 'message', value: string) => void
  onDatesChange: (eventId: string, dates: string[]) => void
  onRequest: (event: EventItem, requestKind: 'participation' | 'cohost') => Promise<boolean>
}

type Stage = 'search' | 'results' | 'details' | 'dates' | 'attendees' | 'message' | 'review' | 'sent'

export const EventDiscovery = ({
  events, activeProfile, requestDrafts, requestKind, requests = [], initialEventId,
  onSelectEvent, onDraftChange, onDatesChange, onRequest,
}: EventDiscoveryProps) => {
  const [stage, setStage] = useState<Stage>(initialEventId ? 'details' : 'search')
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(initialEventId ?? null)
  const [error, setError] = useState<string | null>(null)
  const [isSending, setIsSending] = useState(false)
  const sendingRef = useRef(false)
  const isOrganization = activeProfile?.profileType === 'organization'
  const stages: Stage[] = ['search', 'results', 'details', 'dates',
    ...(isOrganization ? ['attendees' as const] : []), 'message', 'review']
  const steps = ['Search', 'Choose an event', 'Event details', 'Availability',
    ...(isOrganization ? ['Your group'] : []), 'Message', 'Review']
  const event = events.find((candidate) => candidate.id === selectedId)
  const draft = requestDrafts[selectedId ?? ''] ?? { dates: [], attendeeCount: '2', message: '' }
  const existingRequest = requests.find((request) => request.eventId === selectedId
    && request.requesterProfileId === activeProfile?.id && request.requestType === requestKind)
  const isOwnEvent = event && activeProfile && (event.hostId === activeProfile.id
    || event.hostOwnerId === activeProfile.ownerId)
  const isFull = event && event.attendees >= event.capacity && requestKind === 'participation'
  const restricted = event?.audience === 'organizations' && activeProfile?.profileType === 'student'
  const matchedEvents = events.filter((candidate) => {
    const query = search.trim().toLowerCase()
    return `${candidate.title} ${candidate.description} ${candidate.location} ${candidate.hostName}`
      .toLowerCase().includes(query)
      && !(activeProfile?.profileType === 'student' && candidate.audience === 'organizations')
  })
  const goTo = (next: Stage) => { setError(null); setStage(next) }
  const chooseEvent = (eventId: string | null) => {
    setSelectedId(eventId)
    onSelectEvent?.(eventId)
  }

  const next = async (submitEvent: FormEvent<HTMLFormElement>) => {
    submitEvent.preventDefault()
    if (sendingRef.current) return
    if (stage === 'dates' && draft.dates.length === 0) {
      setError('Choose at least one available date to continue.')
      return
    }
    if (stage === 'attendees' && (!Number.isInteger(Number(draft.attendeeCount))
      || Number(draft.attendeeCount) < 1)) {
      setError('Enter a whole number of at least one person.')
      return
    }
    if (stage !== 'review') {
      goTo(stages[stages.indexOf(stage) + 1])
      return
    }
    if (!event || !activeProfile || isOwnEvent || isFull || restricted || existingRequest) return
    if (!draft.dates.length || !draft.dates.every((date) => event.dateOptions.indexOf(date) !== -1)) {
      goTo('dates')
      setError('The event dates changed. Please choose your availability again.')
      return
    }
    sendingRef.current = true
    setIsSending(true)
    setError(null)
    try {
      const sent = await onRequest(event, requestKind)
      if (sent) goTo('sent')
      else setError('Your request could not be sent. Check the message above and try again.')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Your request could not be sent. Try again.')
    } finally {
      sendingRef.current = false
      setIsSending(false)
    }
  }

  if (stage === 'sent') {
    return (
      <section id="events" className="panel guided-panel completion-panel">
        <p className="eyebrow">All done</p>
        <h2>Your request is on its way</h2>
        <p role="status">Your {requestKind === 'cohost' ? 'co-hosting' : 'participation'} request
          {event ? ` for ${event.title}` : ''} has been sent.</p>
        <p>The host will review your request. Check your inbox for their response.</p>
        <div className="wizard-actions">
          <a className="button-primary" href="#inbox">Go to inbox</a>
          <button type="button" className="button-secondary" onClick={() => {
            chooseEvent(null); goTo('results')
          }}>Find another event</button>
        </div>
      </section>
    )
  }

  if (stage !== 'search' && stage !== 'results' && !event) {
    return (
      <section id="events" className="panel guided-panel">
        <h2>This event is no longer available</h2>
        <p className="step-description">It may have been removed by the host.</p>
        <button className="button-primary mt-5" type="button" onClick={() => {
          chooseEvent(null); goTo('results')
        }}>Back to results</button>
      </section>
    )
  }

  const titles: Record<Exclude<Stage, 'sent'>, string> = {
    search: requestKind === 'cohost' ? 'Find an event to co-host' : 'What would you like to find?',
    results: 'Choose an event',
    details: event?.title ?? 'Event details',
    dates: 'When can you make it?',
    attendees: 'How many people are coming?',
    message: 'Anything you would like the host to know?',
    review: 'Ready to send your request?',
  }

  return (
    <section id="events" className="panel guided-panel">
      <StepHeading steps={steps} current={stages.indexOf(stage)} title={titles[stage]}
        description={stage === 'search'
          ? 'Search by event, club, or campus location. Leave it blank to explore everything.'
          : stage === 'results' ? `${matchedEvents.length} ${matchedEvents.length === 1 ? 'event' : 'events'} to explore.`
          : stage === 'dates' ? 'Select the dates that work for you.' : undefined} />
      {stage === 'results' ? (
        <div className="form-stack">
          {matchedEvents.length === 0 ? (
            <p className="empty-state">{events.length === 0
              ? 'No events have been posted yet.' : 'No events match your search. Try another name or location.'}</p>
          ) : matchedEvents.map((candidate) => (
            <article key={candidate.id} className="event-result">
              <div>
                <p className="eyebrow">{candidate.hostName}</p>
                <h3>{candidate.title}</h3>
                <p>{candidate.location} · {candidate.dateOptions[0]}</p>
              </div>
              <button type="button" className="button-secondary" aria-label={`View ${candidate.title}`}
                onClick={() => { chooseEvent(candidate.id); goTo('details') }}>View event</button>
            </article>
          ))}
          <button type="button" className="button-secondary self-start" onClick={() => goTo('search')}>Back to search</button>
        </div>
      ) : stage === 'details' && event ? (
        <div className="form-stack">
          <p className="step-description">Hosted by {event.hostName}</p>
          <p>{event.description}</p>
          <dl className="review-details">
            <div><dt>Location</dt><dd>{event.location}</dd></div>
            <div><dt>Dates</dt><dd>{event.dateOptions.join(', ')}</dd></div>
            <div><dt>Availability</dt><dd>{Math.max(event.capacity - event.attendees, 0)} of {event.capacity} spots open</dd></div>
            <div><dt>Open to</dt><dd>{event.audience === 'everyone' ? 'Students and organizations' : 'Organizations only'}</dd></div>
          </dl>
          {isOwnEvent ? <p>You are hosting this event and cannot request to join it.</p>
            : restricted ? <p>This event is open to organizations only. Switch to an organization profile to join.</p>
              : existingRequest ? <p role="status">Your request is {existingRequest.status}. Check your inbox for updates.</p>
                : isFull ? <p>This event is full. Explore another event with open places.</p>
                  : !activeProfile ? <p>Create a profile so the host knows who is joining.</p> : null}
          <div className="wizard-actions">
            <button type="button" className="button-secondary" onClick={() => goTo('results')}>Back to results</button>
            {!activeProfile ? <a href="#profile" className="button-primary">Create a profile to join</a>
              : restricted ? <a href="#profile" className="button-primary">Switch profile</a>
                : existingRequest ? <a href="#inbox" className="button-primary">Go to inbox</a>
                  : !isOwnEvent && !isFull ? (
                    <button type="button" className="button-primary" onClick={() => goTo('dates')}>
                      {requestKind === 'cohost' ? 'Join as a co-host' : 'Join this event'}
                    </button>
                  ) : null}
          </div>
        </div>
      ) : (
        <form className="form-stack" onSubmit={(submitEvent) => void next(submitEvent)} noValidate>
          <fieldset disabled={isSending} className="wizard-fields">
            {stage === 'search' ? (
              <label className="form-field">
                <span>Search events (optional)</span>
                <input type="search" value={search} onChange={(change) => setSearch(change.target.value)}
                  className="input" placeholder="Art, food, student center..." />
              </label>
            ) : null}
            {stage === 'dates' && event ? (
              <CalendarPicker mode="availability" availableDates={event.dateOptions}
                selectedDates={draft.dates} onDatesChange={(dates) => onDatesChange(event.id, dates)} />
            ) : null}
            {stage === 'attendees' && event ? (
              <label className="form-field">
                <span>People from your organization</span>
                <input type="number" min="1" step="1" value={draft.attendeeCount} className="input"
                  onChange={(change) => onDraftChange(event.id, 'attendeeCount', change.target.value)} />
              </label>
            ) : null}
            {stage === 'message' && event ? (
              <label className="form-field">
                <span>Message to the host (optional)</span>
                <textarea value={draft.message} className="input"
                  placeholder={requestKind === 'cohost' ? 'How would your club like to collaborate?' : 'Introduce yourself or ask a question.'}
                  onChange={(change) => onDraftChange(event.id, 'message', change.target.value)} />
              </label>
            ) : null}
            {stage === 'review' && event ? (
              <dl className="review-details">
                <div><dt>Event</dt><dd>{event.title}</dd></div>
                <div><dt>Requesting as</dt><dd>{activeProfile?.name} · {activeProfile?.profileType}</dd></div>
                <div><dt>Available dates</dt><dd>{draft.dates.join(', ')}</dd></div>
                <div><dt>People</dt><dd>{isOrganization ? draft.attendeeCount : '1 student'}</dd></div>
                <div><dt>Message</dt><dd>{draft.message.trim() || 'No additional message.'}</dd></div>
              </dl>
            ) : null}
          </fieldset>
          {error ? <p role="alert" className="event-feedback event-feedback-error">{error}</p> : null}
          {stage === 'review' && (isFull || restricted || isOwnEvent || existingRequest) ? (
            <p role="alert">This event can no longer accept your request. Go back to its details.</p>
          ) : null}
          <div className="wizard-actions">
            {stage === 'search' ? <a href="#home" className="button-secondary">Cancel</a> : (
              <button type="button" className="button-secondary" disabled={isSending}
                onClick={() => goTo(stages[stages.indexOf(stage) - 1])}>Back</button>
            )}
            <button key={stage} type="submit" className="button-primary"
              disabled={isSending || (stage === 'review' && Boolean(isFull || restricted || isOwnEvent || existingRequest))}>
              {isSending ? 'Sending...' : stage === 'search' ? 'Show events' : stage === 'review'
                ? requestKind === 'cohost' ? 'Send co-hosting request' : 'Send participation request' : 'Next'}
            </button>
          </div>
        </form>
      )}
    </section>
  )
}
