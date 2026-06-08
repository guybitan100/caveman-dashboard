import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/playwright',
  timeout: 30_000,
  expect: {
    timeout: 5_000
  },
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ['list'],
    ['html', { open: 'never', outputFolder: 'playwright-report' }]
  ],
  use: {
    browserName: 'chromium',
    colorScheme: 'dark',
    locale: 'en-US',
    timezoneId: 'UTC',
    viewport: {
      width: 1440,
      height: 1600
    }
  }
});