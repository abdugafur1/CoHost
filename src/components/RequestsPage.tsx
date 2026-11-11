import { useEffect, useState } from 'react'
import type { EventItem, EventRequest, UserProfile } from '../types'

type RequestFilter = 'all' | 'participation' | 'cohost'
type RequestTab = 'incoming' | 'sent'

export interface RequestPageSelection {
  id: string
  requestType: EventRequest['requestType']
}

interface RequestsPageProps {
  requests: EventRequest[]
  events: EventItem[]
  profile: UserProfile | null
  selection: RequestPageSelection | null
  onSelectionHandled: () => void
  onResolveRequest: (
    request: EventRequest,
    status: Extract<EventRequest['status'], 'accepted' | 'declined'>,
  ) => Promise<boolean>
}

const statusClassNames: Record<EventRequest['status'], string> = {
  pending: 'bg-amber-100 text-amber-800',
  accepted: 'bg-emerald-100 text-emerald-800',
  declined: 'bg-rose-100 text-rose-800',
}

const formatDate = (date: string) => {
  const parsedDate = new Date(`${date}T00:00:00`)
  return Number.isNaN(parsedDate.getTime())
    ? date
    : parsedDate.toLocaleDateString(undefined, {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      })
}

export const RequestsPage = ({
  requests,
  events,
  profile,
  selection,
  onSelectionHandled,
  onResolveRequest,
}: RequestsPageProps) => {
  const [activeTab, setActiveTab] = useState<RequestTab>(() =>
    selection &&
    requests.some(
      (request) =>
        request.id === selection.id &&
        request.requestType === selection.requestType &&
        request.requesterOwnerId === profile?.ownerId &&
        request.requesterProfileId === profile?.id,
    )
      ? 'sent'
      : 'incoming',
  )
  const [filter, setFilter] = useState<RequestFilter>('all')
  const [selectedRequestKey, setSelectedRequestKey] = useState<string | null>(() =>
    selection ? `${selection.requestType}:${selection.id}` : null,
  )
  const [resolvingRequestKey, setResolvingRequestKey] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<{ message: string; error: boolean } | null>(null)
  const incomingRequests = profile?.profileType === 'organization'
    ? requests.filter(
        (request) =>
          request.hostOwnerId === profile.ownerId && request.hostProfileId === profile.id,
      )
    : []
  const sentRequests = profile
    ? requests.filter(
        (request) =>
          request.requesterOwnerId === profile.ownerId &&
          request.requesterProfileId === profile.id &&
          (profile.profileType === 'student'
            ? request.requestType === 'participation'
            : request.requestType === 'cohost'),
      )
    : []
  const visibleRequests = (activeTab === 'incoming' ? incomingRequests : sentRequests).filter(
    (request) => filter === 'all' || request.requestType === filter,
  )

  useEffect(() => {
    if (selection) onSelectionHandled()
  }, [selection, onSelectionHandled])

  const selectedRequest = selectedRequestKey
    ? requests.find(
        (request) => `${request.requestType}:${request.id}` === selectedRequestKey,
      ) ?? null
    : null
  const selectedEvent = selectedRequest
    ? events.find((event) => event.id === selectedRequest.eventId) ?? null
    : null
  const isSelectedIncoming = Boolean(
    selectedRequest &&
      profile?.profileType === 'organization' &&
      selectedRequest.hostOwnerId === profile.ownerId &&
      selectedRequest.hostProfileId === profile.id,
  )

  const resolveRequest = async (
    request: EventRequest,
    status: Extract<EventRequest['status'], 'accepted' | 'declined'>,
  ) => {
    const requestKey = `${request.requestType}:${request.id}`
    if (resolvingRequestKey) return
    setResolvingRequestKey(requestKey)
    setFeedback(null)
    try {
      const succeeded = await onResolveRequest(request, status)
      setFeedback({
        message: succeeded
          ? `Request ${status}.`
          : `Could not ${status} this request. Verify your authorization and try again.`,
        error: !succeeded,
      })
    } catch (error) {
      setFeedback({
        message: error instanceof Error ? error.message : `Could not ${status} this request.`,
        error: true,
      })
    } finally {
      setResolvingRequestKey(null)
    }
  }

  const requestCard = (request: EventRequest, incoming: boolean) => {
    const hostEvent = events.find((event) => event.id === request.eventId)
    const requestKey = `${request.requestType}:${request.id}`
    const isResolving = resolvingRequestKey === requestKey

    return (
      <article
        key={requestKey}
        className="requests-surface border p-5"
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="font-semibold text-slate-900">
              {incoming
                ? `${request.requesterName} sent a request`
                : `Request to ${hostEvent?.hostName ?? 'the hosting organization'}`}
            </p>
            <p className="mt-1 text-sm text-slate-600">{request.eventTitle}</p>
          </div>
          <span className={`rounded-full px-3 py-1 text-xs font-bold capitalize ${statusClassNames[request.status]}`}>
            {request.status}
          </span>
        </div>
        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
          <div>
            <dt className="font-medium text-slate-500">Request type</dt>
            <dd className="mt-1 text-slate-800">
              {request.requestType === 'cohost' ? 'Co-Hosting' : 'Participation'}
            </dd>
          </div>
          <div>
            <dt className="font-medium text-slate-500">Submitted</dt>
            <dd className="mt-1 text-slate-800">{new Date(request.createdAt).toLocaleDateString()}</dd>
          </div>
          {request.requestType === 'participation' ? (
            <div>
              <dt className="font-medium text-slate-500">Participants</dt>
              <dd className="mt-1 text-slate-800">{request.attendeeCount}</dd>
            </div>
          ) : null}
        </dl>
        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            className="button-secondary"
            onClick={() => {
              setFeedback(null)
              setSelectedRequestKey(requestKey)
            }}
          >
            View Details
          </button>
          {incoming && request.status === 'pending' ? (
            <>
              <button
                type="button"
                className="button-primary disabled:cursor-not-allowed disabled:opacity-50"
                disabled={Boolean(resolvingRequestKey)}
                onClick={() => void resolveRequest(request, 'accepted')}
              >
                {isResolving ? 'Accepting...' : 'Accept'}
              </button>
              <button
                type="button"
                className="button-secondary disabled:cursor-not-allowed disabled:opacity-50"
                disabled={Boolean(resolvingRequestKey)}
                onClick={() => void resolveRequest(request, 'declined')}
              >
                {isResolving ? 'Declining...' : 'Decline'}
              </button>
            </>
          ) : null}
        </div>
      </article>
    )
  }

  return (
    <section aria-labelledby="requests-heading" className="requests-page space-y-6">
      <header>
        <p className="requests-label text-sm font-semibold uppercase tracking-[0.2em]">Requests</p>
        <h2 id="requests-heading" className="mt-1 text-3xl font-bold text-slate-900">
          Manage event requests
        </h2>
        <p className="mt-2 text-slate-600">
          Review incoming requests and track the requests submitted by this profile.
        </p>
      </header>

      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Request direction">
        {([
          ['incoming', 'Incoming Requests'],
          ['sent', 'Sent Requests'],
        ] as const).map(([tab, label]) => (
          <button
            key={tab}
            id={`requests-tab-${tab}`}
            type="button"
            role="tab"
            aria-selected={activeTab === tab}
            aria-controls="requests-list"
            onClick={() => {
              setActiveTab(tab)
              setFeedback(null)
            }}
            className="requests-tab rounded-full border px-4 py-2 text-sm font-semibold"
          >
            {label}
          </button>
        ))}
      </div>

      <section className="requests-surface border p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap gap-2" aria-label="Filter requests by type">
            {([
              ['all', 'All Requests'],
              ['participation', 'Participation'],
              ['cohost', 'Co-Hosting'],
            ] as const).map(([value, label]) => (
              <button
                key={value}
                type="button"
                aria-pressed={filter === value}
                onClick={() => setFilter(value)}
                className="requests-filter rounded-full border px-3 py-1.5 text-sm font-medium"
              >
                {label}
              </button>
            ))}
          </div>
          <p className="text-sm text-slate-500">{visibleRequests.length} requests</p>
        </div>
        {!selectedRequestKey && feedback ? (
          <p
            role={feedback.error ? 'alert' : 'status'}
            className={`mt-4 text-sm ${feedback.error ? 'text-rose-700' : 'text-emerald-700'}`}
          >
            {feedback.message}
          </p>
        ) : null}

        <div id="requests-list" role="tabpanel" aria-labelledby={`requests-tab-${activeTab}`} className="mt-5 space-y-3">
          {visibleRequests.length ? (
            visibleRequests
              .slice()
              .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
              .map((request) => requestCard(request, activeTab === 'incoming'))
          ) : (
            <p className="requests-empty px-4 py-6 text-center text-sm">
              {activeTab === 'incoming' && profile?.profileType !== 'organization'
                ? 'Student profiles do not receive event approval requests.'
                : `No ${filter === 'all' ? '' : `${filter === 'cohost' ? 'co-hosting' : 'participation'} `}requests to show.`}
            </p>
          )}
        </div>
      </section>

      {selectedRequestKey ? (
        <div
          className="profile-modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !resolvingRequestKey) {
              setSelectedRequestKey(null)
              setFeedback(null)
            }
          }}
        >
          <section
            className="profile-modal requests-surface max-h-[90vh] overflow-y-auto border p-5 sm:p-7"
            role="dialog"
            aria-modal="true"
            aria-labelledby="request-details-heading"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="requests-label text-sm font-bold uppercase tracking-wide">Request details</p>
                <h3 id="request-details-heading" className="mt-1 text-2xl font-extrabold text-slate-950">
                  {selectedRequest?.requestType === 'cohost'
                    ? 'Co-Hosting Request'
                    : selectedRequest?.requestType === 'participation'
                      ? 'Participation Request'
                      : 'Request'}
                </h3>
              </div>
              <button
                type="button"
                aria-label="Close request details"
                disabled={Boolean(resolvingRequestKey)}
                onClick={() => {
                  setSelectedRequestKey(null)
                  setFeedback(null)
                }}
                className="rounded-full border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-800 disabled:opacity-50"
              >
                Close
              </button>
            </div>
            {selectedRequest ? (
              <>
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                  <h4 className="text-xl font-extrabold leading-tight text-slate-950 sm:text-2xl">
                    {selectedRequest.eventTitle}
                  </h4>
                  <span className={`rounded-full px-3 py-1 text-xs font-bold capitalize ${statusClassNames[selectedRequest.status]}`}>
                    {selectedRequest.status}
                  </span>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                  <span className="font-bold text-slate-900">
                    {isSelectedIncoming
                      ? selectedRequest.requesterName
                      : selectedEvent?.hostName ?? 'Not specified'}
                  </span>
                  <span className="text-slate-700">
                    {isSelectedIncoming ? 'Requesting organization' : 'Destination organization'}
                  </span>
                  <span className="text-slate-500" aria-hidden="true">·</span>
                  <span className="font-semibold text-slate-800">
                    {selectedRequest.requestType === 'cohost' ? 'Co-Hosting' : 'Participation'}
                  </span>
                </div>
                {selectedRequest.requestType === 'cohost' ? (
                  <div className="mt-4 space-y-3">
                    <div className="grid gap-3 md:grid-cols-2">
                      {[
                        {
                          label: 'We Request',
                          resources: selectedEvent?.resourcesNeeded ?? [],
                        },
                        {
                          label: 'They Provide',
                          resources: selectedRequest.resourcesProvided ?? [],
                        },
                      ].map(({ label, resources }) => (
                        <section
                          key={label}
                          className="requests-resource border p-4"
                          aria-label={label}
                        >
                          <h5 className="text-base font-extrabold text-slate-950">{label}</h5>
                          {resources.length ? (
                            <ul className="mt-2 flex flex-wrap gap-2">
                              {resources.map((resource) => (
                                <li
                                  key={resource}
                                  className="requests-resource-tag rounded-full border px-3 py-1.5 text-sm font-bold"
                                >
                                  {resource === 'Other' && selectedEvent?.needOtherResource?.trim()
                                    ? `Other — ${selectedEvent.needOtherResource.trim()}`
                                    : resource}
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <p className="mt-2 text-sm font-medium text-slate-700">Not specified</p>
                          )}
                          {label === 'They Provide' ? (
                            <div className="mt-3 border-t border-[var(--line)] pt-3">
                              <h6 className="text-sm font-bold text-slate-900">Contribution details</h6>
                              <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-slate-800">
                                {selectedRequest.contributionDescription?.trim() || 'Not specified'}
                              </p>
                            </div>
                          ) : selectedEvent &&
                            (selectedEvent.resourcesNeeded ?? []).indexOf('Other') !== -1 ? (
                            <div className="mt-3 border-t border-[var(--line)] pt-3 text-sm text-slate-800">
                              <p className="font-bold">Other resource details</p>
                              <p className="mt-1 whitespace-pre-wrap">
                                {[selectedEvent.needOtherResource, selectedEvent.needOtherDescription]
                                  .map((value) => value?.trim())
                                  .filter(Boolean)
                                  .join(' — ') || 'Not specified'}
                              </p>
                            </div>
                          ) : null}
                        </section>
                      ))}
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-100 px-4 py-3 text-sm text-slate-900">
                      <span className="font-extrabold">Resource matching: </span>
                      <span className="font-semibold">
                        {selectedRequest.resourcesProvided && selectedEvent?.resourcesNeeded
                          ? `${selectedRequest.resourcesProvided.filter((resource) => selectedEvent.resourcesNeeded?.indexOf(resource) !== -1).length} of ${selectedRequest.resourcesProvided.length} provided resources match the host's listed needs`
                          : 'Not specified'}
                      </span>
                    </div>
                  </div>
                ) : null}
                <dl className="mt-4 grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm sm:grid-cols-2">
                  <div>
                    <dt className="font-bold text-slate-700">Selected dates</dt>
                    <dd className="mt-1 font-medium text-slate-950">
                      {selectedRequest.availableDates.length
                        ? selectedRequest.availableDates.map(formatDate).join(', ')
                        : 'Not specified'}
                    </dd>
                  </div>
                  <div>
                    <dt className="font-bold text-slate-700">Submitted</dt>
                    <dd className="mt-1 font-medium text-slate-950">
                      {new Date(selectedRequest.createdAt).toLocaleString()}
                    </dd>
                  </div>
                  {selectedRequest.requestType === 'participation' ? (
                    <div>
                      <dt className="font-bold text-slate-700">Requested participants</dt>
                      <dd className="mt-1 font-semibold text-slate-950">{selectedRequest.attendeeCount}</dd>
                    </div>
                  ) : (
                    <div>
                      <dt className="font-bold text-slate-700">Estimated attendees</dt>
                      <dd className="mt-1 font-semibold text-slate-950">
                        {selectedRequest.estimatedAttendees ??
                          (selectedRequest.attendeeCount > 0
                            ? selectedRequest.attendeeCount
                            : 'Not sure yet')}
                      </dd>
                    </div>
                  )}
                  <div className="sm:col-span-2">
                    <dt className="font-bold text-slate-700">Request message</dt>
                    <dd className="mt-1 whitespace-pre-wrap leading-relaxed text-slate-900">
                      {selectedRequest.message || 'Not specified'}
                    </dd>
                  </div>
                </dl>
                {isSelectedIncoming && selectedRequest.status === 'pending' ? (
                  <div className="mt-6 flex flex-wrap gap-3">
                    <button
                      type="button"
                      disabled={Boolean(resolvingRequestKey)}
                      onClick={() => void resolveRequest(selectedRequest, 'accepted')}
                      className="button-primary disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {resolvingRequestKey === `${selectedRequest.requestType}:${selectedRequest.id}` ? 'Accepting...' : 'Accept'}
                    </button>
                    <button
                      type="button"
                      disabled={Boolean(resolvingRequestKey)}
                      onClick={() => void resolveRequest(selectedRequest, 'declined')}
                      className="button-secondary disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {resolvingRequestKey === `${selectedRequest.requestType}:${selectedRequest.id}` ? 'Declining...' : 'Decline'}
                    </button>
                  </div>
                ) : null}
                {feedback ? (
                  <p role={feedback.error ? 'alert' : 'status'} className={`mt-4 text-sm ${feedback.error ? 'text-rose-700' : 'text-emerald-700'}`}>
                    {feedback.message}
                  </p>
                ) : null}
              </>
            ) : (
              <p role="status" className="mt-5 rounded-xl bg-amber-50 p-4 text-sm text-amber-900">
                Request unavailable. It may have been deleted or is no longer accessible.
              </p>
            )}
          </section>
        </div>
      ) : null}
    </section>
  )
}
