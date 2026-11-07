const buildConfirmedCoHosts = (eventId, event, requests, profiles) => {
  const confirmedByProfileId = new Map()

  for (const request of requests) {
    if (request.status !== 'accepted') continue
    if (
      request.eventId !== eventId ||
      request.requestType !== 'cohost' ||
      request.hostOwnerId !== event.hostOwnerId ||
      request.hostProfileId !== event.hostId ||
      request.requesterOwnerId === event.hostOwnerId ||
      request.requesterProfileType !== 'organization' ||
      typeof request.requesterProfileId !== 'string' ||
      request.requesterProfileId === event.hostId ||
      typeof request.requesterOwnerId !== 'string'
    ) {
      throw new Error('An accepted co-host request has invalid event or organization ownership.')
    }

    const profile = profiles.get(request.requesterProfileId)
    if (
      !profile ||
      profile.id !== request.requesterProfileId ||
      profile.ownerId !== request.requesterOwnerId ||
      profile.profileType !== 'organization' ||
      typeof profile.name !== 'string' ||
      profile.name.trim().length === 0
    ) {
      throw new Error('An accepted co-host request does not match a valid organization profile.')
    }

    if (!confirmedByProfileId.has(profile.id)) {
      confirmedByProfileId.set(profile.id, {
        profileId: profile.id,
        name: profile.name.trim(),
      })
    }
  }

  return [...confirmedByProfileId.values()]
}

const assertRequestsResolved = (requests) => {
  if (requests.some((request) => request.status === 'pending')) {
    throw new Error('Resolve pending co-host requests before publishing.')
  }
  if (requests.some((request) => !['accepted', 'declined'].includes(request.status))) {
    throw new Error('A co-host request has an invalid status.')
  }
}

module.exports = { assertRequestsResolved, buildConfirmedCoHosts }
