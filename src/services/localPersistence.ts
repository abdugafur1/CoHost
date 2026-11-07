import type { UserProfile } from '../types'

const profilesStorageKey = 'cohost.userProfiles'
const activeProfileStorageKey = 'cohost.activeProfileId'
const deviceIdStorageKey = 'cohost.deviceId'

const isUserProfile = (value: unknown): value is UserProfile => {
  if (typeof value !== 'object' || value === null) return false

  const profile = value as Record<string, unknown>
  return (
    typeof profile.id === 'string' &&
    typeof profile.ownerId === 'string' &&
    typeof profile.name === 'string' &&
    (profile.profileType === 'student' || profile.profileType === 'organization') &&
    typeof profile.focus === 'string' &&
    typeof profile.location === 'string' &&
    typeof profile.description === 'string' &&
    typeof profile.createdAt === 'string'
  )
}

export const loadLocalProfiles = (): UserProfile[] => {
  const storedProfiles = localStorage.getItem(profilesStorageKey)
  if (!storedProfiles) return []

  try {
    const parsedProfiles: unknown = JSON.parse(storedProfiles)
    if (Array.isArray(parsedProfiles) && parsedProfiles.every(isUserProfile)) return parsedProfiles
  } catch {
    // Repair only CoHost's disposable profile cache, never Firebase Auth state.
  }
  localStorage.removeItem(profilesStorageKey)
  localStorage.removeItem(activeProfileStorageKey)
  return []
}

export const saveLocalProfiles = (profiles: UserProfile[]) => {
  localStorage.setItem(profilesStorageKey, JSON.stringify(profiles))
}

export const loadActiveProfileId = () => localStorage.getItem(activeProfileStorageKey)

export const saveActiveProfileId = (profileId: string) => {
  localStorage.setItem(activeProfileStorageKey, profileId)
}

export const getLocalDeviceId = () => {
  const storedDeviceId = localStorage.getItem(deviceIdStorageKey)
  if (storedDeviceId) return storedDeviceId

  const deviceId = crypto.randomUUID()
  localStorage.setItem(deviceIdStorageKey, deviceId)
  return deviceId
}
