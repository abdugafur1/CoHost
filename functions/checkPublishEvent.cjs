const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const { publishEventForOwner } = require('./publishEvent')

const event = {
  id: 'event-1',
  hostId: 'host-profile',
  hostOwnerId: 'host-owner',
  hostProfileType: 'organization',
  publicationStatus: 'ready_to_publish',
  collaborationRequirementsCompleted: true,
}
const acceptedRequest = {
  eventId: event.id,
  requestType: 'cohost',
  hostProfileId: event.hostId,
  hostOwnerId: event.hostOwnerId,
  requesterProfileType: 'organization',
  requesterProfileId: 'partner-profile',
  requesterOwnerId: 'partner-owner',
  status: 'accepted',
}
const profiles = {
  'host-profile': {
    id: 'host-profile',
    ownerId: 'host-owner',
    profileType: 'organization',
  },
  'partner-profile': {
    id: 'partner-profile',
    ownerId: 'partner-owner',
    profileType: 'organization',
    name: 'Volunteer Club',
  },
}

const createDatabase = (options = {}) => {
  const writes = []
  const refs = {
    event: { collection: 'events', id: event.id },
    hostProfile: { collection: 'userProfiles', id: event.hostId },
    partnerProfile: { collection: 'userProfiles', id: 'partner-profile' },
    requests: { collection: 'cohostRequests', eventId: event.id },
  }
  const data = {
    event: options.event ?? event,
    profiles: options.profiles ?? profiles,
    requests: options.requests ?? [acceptedRequest],
  }
  const transaction = {
    get: async (ref) => {
      if (ref === refs.event) {
        return { exists: true, id: event.id, data: () => data.event }
      }
      if (ref === refs.requests) {
        return { docs: data.requests.map((request) => ({ data: () => request })) }
      }
      const profile = data.profiles[ref.id]
      return {
        exists: Boolean(profile),
        id: ref.id,
        data: () => profile,
      }
    },
    update: (ref, value) => writes.push({ ref, value }),
  }
  const db = {
    collection: (name) => ({
      doc: (id) => {
        if (name === 'events') return refs.event
        if (id === event.hostId) return refs.hostProfile
        if (id === 'partner-profile') return refs.partnerProfile
        return { collection: name, id }
      },
      where: () => refs.requests,
    }),
    runTransaction: (callback) => callback(transaction),
  }

  return { db, writes, refs }
}

describe('publishEventForOwner', () => {
  it('stores the verified accepted co-host list as part of publication', async () => {
    const { db, writes, refs } = createDatabase()
    const result = await publishEventForOwner(db, 'host-owner', event.id)

    assert.deepEqual(result.confirmedCoHosts, [
      { profileId: 'partner-profile', name: 'Volunteer Club' },
    ])
    assert.deepEqual(writes, [
      {
        ref: refs.event,
        value: {
          publicationStatus: 'published',
          collaborationRequirementsCompleted: true,
          confirmedCoHosts: [{ profileId: 'partner-profile', name: 'Volunteer Club' }],
        },
      },
    ])
  })

  it('rejects callers who do not own the hosting organization', async () => {
    const { db, writes } = createDatabase()
    await assert.rejects(
      publishEventForOwner(db, 'someone-else', event.id),
      { code: 'permission-denied' },
    )
    assert.equal(writes.length, 0)
  })

  it('rejects publishing when the hosting profile is missing or not owned by the caller', async () => {
    const missingHost = createDatabase({ profiles: {} })
    await assert.rejects(
      publishEventForOwner(missingHost.db, 'host-owner', event.id),
      { code: 'permission-denied' },
    )
    assert.equal(missingHost.writes.length, 0)
  })

  it('rejects pending requests and does not publish', async () => {
    const { db, writes } = createDatabase({
      requests: [{ ...acceptedRequest, status: 'pending' }],
    })
    await assert.rejects(
      publishEventForOwner(db, 'host-owner', event.id),
      { code: 'failed-precondition' },
    )
    assert.equal(writes.length, 0)
  })

  it('requires collaboration to be ready and completed', async () => {
    const { db, writes } = createDatabase({
      event: { ...event, collaborationRequirementsCompleted: false },
    })
    await assert.rejects(
      publishEventForOwner(db, 'host-owner', event.id),
      { code: 'failed-precondition' },
    )
    assert.equal(writes.length, 0)
  })
})
