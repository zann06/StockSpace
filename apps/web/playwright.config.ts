import { defineConfig } from '@playwright/test'

/**
 * End-to-end smoke test configuration (PRD §13: login → inventory → stock-in →
 * updated dashboard). Boots the real API (against a dedicated e2e database,
 * seeded with the fictional demo workspace) and the Vite dev server.
 */

const API_PORT = 4100
const WEB_PORT = 5173

export const E2E_DATABASE_URL =
  process.env.DATABASE_URL_E2E ?? 'postgresql://stockspace:stockspace@localhost:5433/stockspace_e2e'

export default defineConfig({
  testDir: './e2e',
  globalSetup: './e2e/global-setup.ts',
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list']],
  use: {
    baseURL: `http://localhost:${WEB_PORT}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: [
    {
      command: 'npm run dev:api',
      cwd: '../..',
      url: `http://localhost:${API_PORT}/api/health`,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: {
        DATABASE_URL: E2E_DATABASE_URL,
        PORT: String(API_PORT),
        BETTER_AUTH_URL: `http://localhost:${API_PORT}`,
        BETTER_AUTH_SECRET: 'e2e-test-secret-0123456789abcdef0123456789abcdef',
        CORS_ORIGIN: `http://localhost:${WEB_PORT}`,
        LOG_LEVEL: 'warn',
      },
    },
    {
      command: 'npm run dev',
      cwd: '../..',
      url: `http://localhost:${WEB_PORT}`,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: {
        VITE_API_URL: `http://localhost:${API_PORT}`,
      },
    },
  ],
})
