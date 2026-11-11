import { beforeEach, expect, it } from 'vitest'
import { loadLocalProfiles } from './localPersistence'
beforeEach(() => localStorage.clear())
it.each(['{broken JSON', '[{"ownerId":"incomplete"}]'])('repairs malformed profile cache while preserving account/device storage', cache => {
  localStorage.setItem('cohost.userProfiles', cache)
  localStorage.setItem('cohost.activeProfileId', 'stale')
  localStorage.setItem('cohost.deviceId', 'keep-device')
  localStorage.setItem('firebase-auth-placeholder', 'keep-session')
  expect(loadLocalProfiles()).toEqual([])
  expect(localStorage.getItem('cohost.activeProfileId')).toBeNull()
  expect(localStorage.getItem('cohost.deviceId')).toBe('keep-device')
  expect(localStorage.getItem('firebase-auth-placeholder')).toBe('keep-session')
})
