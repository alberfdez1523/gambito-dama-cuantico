import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  testMatch: 'feature-flags.spec.ts',
  workers: 1,
  timeout: 30_000,
  expect: { timeout: 5_000 },
  use: {
    baseURL: 'http://127.0.0.1:5174',
    trace: 'retain-on-failure',
    ...devices['Desktop Chrome'],
    // Chromium preinstalado cuando no coincide con la versión de Playwright.
    ...(process.env.PW_CHROMIUM_PATH ? { launchOptions: { executablePath: process.env.PW_CHROMIUM_PATH } } : {}),
  },
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1 --port 5174',
    url: 'http://127.0.0.1:5174',
    reuseExistingServer: false,
    env: {
      VITE_FEATURE_ACADEMY: '0',
      VITE_FEATURE_ACCOUNT_SYNC: '0',
      VITE_FEATURE_DAILY_SPRINT: '0',
    },
  },
})
