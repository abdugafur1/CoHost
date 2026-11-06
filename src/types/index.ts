export type ProfileType = 'student' | 'organization'
export type EventAudience = 'everyone' | 'organizations'

export interface UserProfile {
  id: string
  ownerId: string
  name: string
  profileType: ProfileType
  focus: string
  location: string
  description: string
  createdAt: string
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
  titleReservationId?: string
  lastAcceptedParticipationRequestId?: string
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
  createdAt: string
  isRead: boolean
}
