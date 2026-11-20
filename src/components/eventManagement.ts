import type { EventPublicationStatus } from '../types'

export const publicationStatusLabels: Record<EventPublicationStatus, string> = {
  draft: 'Draft',
  pending_collaboration: 'Pending Collaboration',
  ready_to_publish: 'Ready to Publish',
  published: 'Published',
  cancelled: 'Cancelled',
}

export const managedEventId = (eventId: string) => `managed-event-${eventId}`

export const formatDateLabel = (date: string) => {
  const [year, month, day] = date.split('-').map(Number)
  return new Date(year, month - 1, day).toLocaleDateString(undefined, {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}
