import { defineConfig } from '@playwright/test'

/** Minimal recorder config — targets the LIVE demo, no local servers needed. */
export default defineConfig({
  testDir: './e2e',
  testMatch: /record-demo|capture-shots/,
  timeout: 180_000,
  use: {
    baseURL: 'https://zann06.github.io/StockSpace/',
    viewport: { width: 1280, height: 800 },
    video: { mode: 'on', size: { width: 1280, height: 800 } },
  },
})
