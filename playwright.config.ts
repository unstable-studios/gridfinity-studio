import { defineConfig } from '@playwright/test'

// End-to-end smoke tests drive the built Electron app (out/). Build first:
// `pnpm test:e2e` does both.
export default defineConfig({
  testDir: 'e2e',
  outputDir: 'e2e/.results',
  timeout: 60_000,
  workers: 1,
  forbidOnly: !!process.env.CI,
  reporter: process.env.CI ? [['github'], ['list']] : 'list',
  use: {
    trace: 'retain-on-failure'
  }
})
