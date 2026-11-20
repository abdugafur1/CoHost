
import { test, expect } from '@playwright/test'

test('CoHost homepage loads successfully', async ({ page }) => {
  // Given the user opens the application
  await page.goto('/')

  // Then the homepage should display CoHost
  await expect(page).toHaveTitle(/CoHost/i)
})
