import { describe, expect, it } from 'vitest'
import firestoreRules from '../../firestore.rules?raw'

describe('public organization Firestore rules', () => {
  it('keeps private user profiles owner-only and grants public reads only to the directory collection', () => {
    expect(firestoreRules).toMatch(
      /match \/userProfiles\/\{profileId\}[\s\S]*?allow read, delete: if owns\(resource\.data\.ownerId\)/,
    )
    expect(firestoreRules).toMatch(
      /match \/publicOrganizations\/\{profileId\}[\s\S]*?allow read: if true/,
    )
  })

  it('restricts event reads to published documents, owners, or verified organization accounts', () => {
    const eventRules = firestoreRules.slice(
      firestoreRules.indexOf('match /events/{eventId}'),
      firestoreRules.indexOf('match /eventTitleReservations'),
    )
    expect(eventRules.length).toBeGreaterThan(0)
    expect(eventRules).toContain("resource.data.get('publicationStatus', 'draft') == 'published'")
    expect(eventRules).toContain('owns(resource.data.hostOwnerId)')
    expect(eventRules).toContain('hasOrganizationAccess()')
    expect(eventRules).not.toContain('allow read: if true')
    expect(firestoreRules).toContain("get(eventDoc).data.publicationStatus == 'published'")
    expect(firestoreRules).toContain("get(eventDoc).data.publicationStatus == 'pending_collaboration'")
    expect(firestoreRules).toContain("match /organizationAccounts/{ownerId}")
  })

  it('requires an authenticated owner and a matching private organization profile to publish', () => {
    expect(firestoreRules).toContain('profile.ownerId == request.auth.uid')
    expect(firestoreRules).toContain('profile.id == profileId')
    expect(firestoreRules).toContain("profile.profileType == 'organization'")
    expect(firestoreRules).toContain('profile.directoryVisible == true')
    expect(firestoreRules).toContain('hasOnlyPublicOrganizationFields()')
    expect(firestoreRules).toContain('resource.data.profileId == profileId')
  })

  it('validates confirmed co-host publication through atomic per-request accounting', () => {
    const eventRules = firestoreRules.slice(
      firestoreRules.indexOf('match /events/{eventId}'),
      firestoreRules.indexOf('match /eventTitleReservations'),
    )
    expect(eventRules).toContain("!('confirmedCoHosts' in request.resource.data)")
    expect(eventRules).toContain("'confirmedCoHosts'")
    expect(eventRules).toContain("validPartnerAppend()")
  })

  it('does not allow public listings to carry an owner identifier or private profile fields', () => {
    const publicFieldsRule = firestoreRules.match(
      /function hasOnlyPublicOrganizationFields\(\) \{([\s\S]*?)\n\s{6}\}/,
    )?.[1]
    expect(publicFieldsRule).toBeTruthy()
    expect(publicFieldsRule).toContain("'profileId'")
    expect(publicFieldsRule).not.toContain("'ownerId'")
    expect(publicFieldsRule).not.toContain("'email'")
    expect(publicFieldsRule).not.toContain("'photoURL'")
  })

  it('validates co-host resource contributions against the host event and prevents requester edits', () => {
    const cohostRules = firestoreRules.match(
      /match \/cohostRequests\/\{requestId\} \{([\s\S]*?)\n\s{4}\}/,
    )?.[1]
    expect(cohostRules).toBeTruthy()
    expect(cohostRules).toContain("'resourcesProvided', 'contributionDescription'")
    expect(cohostRules).toContain("'estimatedAttendees'")
    expect(cohostRules).toContain('request.resource.data.resourcesProvided.hasOnly(requestedResources)')
    expect(cohostRules).toContain("request.resource.data.resourcesProvided.hasOnly(['General contribution'])")
    expect(cohostRules).toContain('owns(request.resource.data.requesterOwnerId)')
    expect(cohostRules).toContain('request.resource.data.attendeeCount == 0')
    expect(cohostRules).toContain("exists(requesterProfile)")
    expect(cohostRules).toContain("exists(hostProfile)")
    expect(cohostRules).toContain('get(requesterProfile).data.ownerId == request.auth.uid')
    expect(cohostRules).toContain(
      'get(hostProfile).data.ownerId == request.resource.data.hostOwnerId',
    )
    expect(cohostRules).toContain('request.resource.data.diff(resource.data).affectedKeys().hasOnly')
  })
})
