export type ProfileType = 'student' | 'organization'
export type EventAudience = 'everyone' | 'organizations'
export type EventPublicationStatus =
  | 'draft'
  | 'pending_collaboration'
  | 'ready_to_publish'
  | 'published'
  | 'cancelled'

export interface UserProfile {
  id: string
  ownerId: string
  name: string
  profileType: ProfileType
  focus: string
  location: string
  description: string
  createdAt: string
  interests?: string[]
  eventTypes?: string[]
  availableResources?: string[]
  collaborationPreferences?: string[]
  directoryVisible?: boolean
}

export interface PublicOrganization {
  profileId: string
  name: string
  description: string
  focus: string
  location: string
  interests: string[]
  eventTypes: string[]
  availableResources: string[]
  collaborationPreferences: string[]
}

export interface EventItem {
  id: string
  hostId: string
  hostOwnerId: string
  hostName: string
  hostProfileType: ProfileType
  title: string
  location: string
  description: string
  audience: EventAudience
  dateOptions: string[]
  capacity: number
  attendees: number
  createdAt: string
  publicationStatus?: EventPublicationStatus
  collaborationRequirementsCompleted?: boolean
  collaborationVersion?: 2
  /** Historical registry: retained on legacy documents, never extended. */
  cohostRequestIds?: string[]
  confirmedCoHosts?: ConfirmedCoHost[]
  resourcesOffered?: string[]
  offerDescription?: string
  offerOtherResource?: string
  offerOtherDescription?: string
  resourcesNeeded?: string[]
  needDescription?: string
  needOtherResource?: string
  needOtherDescription?: string
  titleReservationId?: string
  lastAcceptedParticipationRequestId?: string
}

export interface ConfirmedCoHost {
  profileId: string
  name: string
}

export interface EventRequest {
  id: string
  requestType: 'participation' | 'cohost'
  eventId: string
  eventTitle: string
  hostOwnerId: string
  hostProfileId: string
  requesterOwnerId: string
  requesterProfileId: string
  requesterName: string
  requesterProfileType: ProfileType
  availableDates: string[]
  attendeeCount: number
  message: string
  status: 'pending' | 'accepted' | 'declined'
  createdAt: string
  resourcesProvided?: string[]
  contributionDescription?: string
  estimatedAttendees?: number
  resolvedAt?: string
  resolvedByProfileId?: string
}

export interface InboxNotice {
  id: string
  profileId: string
  title: string
  message: string
  type: 'incoming' | 'outgoing'
  relatedEventId?: string
  requestId?: string
  requestType?: EventRequest['requestType']
  createdAt: string
  isRead: boolean
}
