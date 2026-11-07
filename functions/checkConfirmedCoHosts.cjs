const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const { assertRequestsResolved, buildConfirmedCoHosts } = require('./confirmedCoHosts')

const event = {
  hostId: 'host-profile',
  hostOwnerId: 'host-owner',
}
const acceptedRequest = (overrides = {}) => ({
  eventId: 'event-1',
  requestType: 'cohost',
  hostProfileId: 'host-profile',
  hostOwnerId: 'host-owner',
  requesterProfileType: 'organization',
  requesterProfileId: 'partner-1',
  requesterOwnerId: 'partner-owner-1',
  status: 'accepted',
  ...overrides,
})
const profile = (id, ownerId, name) => ({
  id,
  ownerId,
  name,
  profileType: 'organization',
})

describe('buildConfirmedCoHosts', () => {
  it('requires pending requests to be explicitly resolved', () => {
    assert.throws(() => assertRequestsResolved([{ status: 'pending' }]), /resolve pending/i)
    assert.throws(() => assertRequestsResolved([{ status: 'unknown' }]), /invalid status/i)
    assert.doesNotThrow(() =>
      assertRequestsResolved([{ status: 'accepted' }, { status: 'declined' }]),
    )
  })

  it('returns an empty list when no co-host requests were accepted', () => {
    assert.deepEqual(buildConfirmedCoHosts('event-1', event, [], new Map()), [])
  })

  it('includes a verified accepted co-host', () => {
    assert.deepEqual(
      buildConfirmedCoHosts(
        'event-1',
        event,
        [acceptedRequest()],
        new Map([['partner-1', profile('partner-1', 'partner-owner-1', 'Volunteer Club')]]),
      ),
      [{ profileId: 'partner-1', name: 'Volunteer Club' }],
    )
  })

  it('includes multiple verified accepted co-hosts and excludes pending or declined requests', () => {
    const requests = [
      acceptedRequest(),
      acceptedRequest({
        requesterProfileId: 'partner-2',
        requesterOwnerId: 'partner-owner-2',
      }),
      acceptedRequest({ status: 'pending', requesterProfileId: 'pending' }),
      acceptedRequest({ status: 'declined', requesterProfileId: 'declined' }),
    ]
    const profiles = new Map([
      ['partner-1', profile('partner-1', 'partner-owner-1', 'Volunteer Club')],
      ['partner-2', profile('partner-2', 'partner-owner-2', 'Arts Society')],
    ])

    assert.deepEqual(
      buildConfirmedCoHosts('event-1', event, requests, profiles),
      [
        { profileId: 'partner-1', name: 'Volunteer Club' },
        { profileId: 'partner-2', name: 'Arts Society' },
      ],
    )
  })

  it('deduplicates accepted requests by profile ID', () => {
    const request = acceptedRequest()
    assert.equal(
      buildConfirmedCoHosts(
        'event-1',
        event,
        [request, { ...request, id: 'duplicate' }],
        new Map([['partner-1', profile('partner-1', 'partner-owner-1', 'Volunteer Club')]]),
      ).length,
      1,
    )
  })

  it('rejects accepted requests with mismatched events or organization ownership', () => {
    assert.throws(
      () =>
        buildConfirmedCoHosts(
          'event-1',
          event,
          [acceptedRequest({ eventId: 'another-event' })],
          new Map(),
        ),
      /invalid event or organization ownership/i,
    )
    assert.throws(
        () =>
          buildConfirmedCoHosts(
            'event-1',
            event,
            [acceptedRequest({ requesterOwnerId: event.hostOwnerId })],
            new Map(),
          ),
        /invalid event or organization ownership/i,
    )
    assert.throws(
      () =>
        buildConfirmedCoHosts(
          'event-1',
          event,
          [acceptedRequest()],
          new Map([['partner-1', profile('partner-1', 'wrong-owner', 'Volunteer Club')]]),
        ),
      /does not match a valid organization profile/i,
    )
  })
})
