import { defineConfig, devices } from '@playwright/test'

const appUrl = 'http://127.0.0.1:4173'

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.e2e.ts',
  use: {
    baseURL: appUrl,
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
    command: 'npm run dev -- --mode e2e --host 127.0.0.1 --port 4173 --strictPort',
    env: { VITE_PUBLICATION_V2_ENABLED: 'true' },
    url: appUrl,
    reuseExistingServer: false,
  },
})
