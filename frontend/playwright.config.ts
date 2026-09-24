import { defineConfig, devices } from '@playwright/test'

const browserChannel = process.env.PLAYWRIGHT_CHANNEL
// Permite usar un Chromium ya instalado cuando no coincide con la versión de Playwright.
const chromiumExecutable = process.env.PW_CHROMIUM_PATH

export default defineConfig({
  testDir: './e2e',
  testIgnore: ['pwa.spec.ts', 'feature-flags.spec.ts'],
  // The three-browser matrix exercises several Web Worker and responsive-board
  // scenarios. Running one browser context at a time keeps CI deterministic on
  // the small instances used by this project instead of turning CPU contention
  // into navigation timeouts.
  workers: 1,
  timeout: 30_000,
  expect: { timeout: 5_000 },
  use: {
    baseURL: 'http://127.0.0.1:5173',
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        ...(browserChannel ? { channel: browserChannel } : {}),
        ...(chromiumExecutable ? { launchOptions: { executablePath: chromiumExecutable } } : {}),
      },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
  ],
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1 --port 5173',
    url: 'http://127.0.0.1:5173',
    reuseExistingServer: true,
  },
})
