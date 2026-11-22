import { expect, test } from '@playwright/test'

test('starts an anonymous Firebase session from the profile page', async ({ page }) => {
  await page.goto('/')
  const profileTab = page.getByRole('button', { name: /^profile$/i })
  await profileTab.click()

  const account = page.getByRole('region', { name: 'Account access' })
  await account.getByRole('button', { name: 'Continue without email' }).click()
  await expect(page.getByText('Your device account is ready and profiles are synced.')).toBeVisible()
  await profileTab.click()
  await expect(account.getByText(/You are using Firebase Anonymous Authentication/)).toBeVisible()
  await expect(account.getByRole('button', { name: 'Sign Out' })).toBeVisible()
})

test('creates a student profile and restores it after a reload', async ({ page }) => {
  const profileName = 'Playwright Student'

  await page.goto('/')
  const profileTab = page.getByRole('button', { name: /^profile$/i })
  await profileTab.click()
  await page.getByRole('button', { name: 'Create New Profile' }).click()

  const form = page.getByRole('dialog', { name: 'Create a Profile' })
  await form.getByLabel('Profile type').selectOption('student')
  await form.getByLabel('Your name').fill(profileName)
  await form.getByLabel('Profile location').fill('North campus')
  await form.getByRole('button', { name: 'Save', exact: true }).click()

  await expect(page.getByText(`${profileName}'s student profile was created.`)).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Find your campus community' })).toBeVisible()

  await page.reload()
  const profileCount = page.getByText('Your profiles', { exact: true }).locator('..')
  await expect(profileCount).toContainText('1')
  await profileTab.click()
  await expect(page.getByRole('heading', { name: profileName, exact: true })).toBeVisible()
})
