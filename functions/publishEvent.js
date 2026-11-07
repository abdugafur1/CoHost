const { HttpsError } = require('firebase-functions/v2/https')
const { assertRequestsResolved, buildConfirmedCoHosts } = require('./confirmedCoHosts')

const publishEventForOwner = async (db, uid, eventId) => {
  if (!uid) throw new HttpsError('unauthenticated', 'Sign in to publish this event.')
  if (typeof eventId !== 'string' || !eventId.trim() || eventId.includes('/')) {
    throw new HttpsError('invalid-argument', 'A valid event ID is required.')
  }

  const eventRef = db.collection('events').doc(eventId)
  const profilesCollection = db.collection('userProfiles')
  const requestQuery = db.collection('cohostRequests').where('eventId', '==', eventId)
  let confirmedCoHosts = []

  await db.runTransaction(async (transaction) => {
    const eventSnapshot = await transaction.get(eventRef)
    if (!eventSnapshot.exists) {
      throw new HttpsError('not-found', 'The event could not be found.')
    }
    const event = eventSnapshot.data()
    if (event.hostOwnerId !== uid) {
      throw new HttpsError(
        'permission-denied',
        'Only the hosting organization owner can publish this event.',
      )
    }

    const hostProfileSnapshot = await transaction.get(profilesCollection.doc(event.hostId))
    if (
      !hostProfileSnapshot.exists ||
      hostProfileSnapshot.data().ownerId !== uid ||
      hostProfileSnapshot.data().id !== event.hostId ||
      hostProfileSnapshot.data().profileType !== 'organization' ||
      event.hostProfileType !== 'organization'
    ) {
      throw new HttpsError(
        'permission-denied',
        'The hosting organization profile could not be verified.',
      )
    }
    if (
      event.publicationStatus !== 'ready_to_publish' ||
      event.collaborationRequirementsCompleted !== true
    ) {
      throw new HttpsError(
        'failed-precondition',
        'Complete collaboration arrangements before publishing.',
      )
    }

    const requestSnapshot = await transaction.get(requestQuery)
    const eventRequests = requestSnapshot.docs.map((request) => request.data())
    try {
      assertRequestsResolved(eventRequests)
    } catch (error) {
      throw new HttpsError(
        'failed-precondition',
        error instanceof Error ? error.message : 'Resolve all co-host requests before publishing.',
      )
    }
    const acceptedRequests = eventRequests.filter((request) => request.status === 'accepted')
    if (
      acceptedRequests.some(
        (request) =>
          typeof request.requesterProfileId !== 'string' ||
          request.requesterProfileId.length === 0 ||
          request.requesterProfileId.includes('/'),
      )
    ) {
      throw new HttpsError(
        'failed-precondition',
        'An accepted co-host request has no valid organization profile.',
      )
    }
    const requesterProfileIds = [
      ...new Set(acceptedRequests.map((request) => request.requesterProfileId)),
    ]
    const profileSnapshots = await Promise.all(
      requesterProfileIds.map((profileId) =>
        transaction.get(profilesCollection.doc(profileId)),
      ),
    )
    const profiles = new Map(
      profileSnapshots
        .filter((snapshot) => snapshot.exists)
        .map((snapshot) => [snapshot.id, snapshot.data()]),
    )

    try {
      confirmedCoHosts = buildConfirmedCoHosts(
        eventId,
        { ...event, id: eventSnapshot.id },
        acceptedRequests,
        profiles,
      )
    } catch (error) {
      throw new HttpsError(
        'failed-precondition',
        error instanceof Error
          ? error.message
          : 'Accepted co-host information could not be verified.',
      )
    }

    transaction.update(eventRef, {
      publicationStatus: 'published',
      collaborationRequirementsCompleted: true,
      confirmedCoHosts,
    })
  })

  return { confirmedCoHosts }
}

module.exports = { publishEventForOwner }
