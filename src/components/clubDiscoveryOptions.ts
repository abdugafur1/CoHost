import type { PublicOrganization } from '../types'

export const clubInterests = [
  'Technology',
  'Sports',
  'Arts',
  'Culture',
  'Education',
  'Community Service',
  'Health & Wellness',
  'Business',
] as const

export const clubEventTypes = [
  'Workshops',
  'Seminars',
  'Sports Events',
  'Social Events',
  'Fundraisers',
  'Competitions',
  'Networking Events',
] as const

export const clubResources = [
  'Event Venue',
  'Equipment',
  'Guest Speakers',
  'Volunteers',
  'Promotion',
  'Technical Support',
  'Event Planning Experience',
] as const

export const collaborationOptions = [
  'Open to co-hosting',
  'Looking for co-hosts',
  'Resource sharing',
  'Cross-promotion',
] as const

export interface ClubDirectoryFilters {
  search: string
  interest: string
  eventType: string
  resource: string
}

export const filterOrganizations = (
  organizations: PublicOrganization[],
  filters: ClubDirectoryFilters,
) => {
  const search = filters.search.trim().toLocaleLowerCase()

  return organizations.filter((organization) => {
    const matchesSearch =
      !search ||
      `${organization.name} ${organization.description}`.toLocaleLowerCase().includes(search)
    const matchesInterest =
      !filters.interest ||
      organization.interests.some((interest) =>
        interest.toLocaleLowerCase().includes(filters.interest.toLocaleLowerCase()),
      )
    const matchesEventType =
      !filters.eventType ||
      organization.eventTypes.some((eventType) =>
        eventType.toLocaleLowerCase().includes(filters.eventType.toLocaleLowerCase()),
      )
    const matchesResource =
      !filters.resource ||
      organization.availableResources.some((resource) =>
        resource.toLocaleLowerCase().includes(filters.resource.toLocaleLowerCase()),
      )

    return matchesSearch && matchesInterest && matchesEventType && matchesResource
  })
}
