import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vitest/config'

import { TEST_DATABASE_URL } from './test/env'

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    globals: true,
    globalSetup: ['./test/global-setup.ts'],
    env: {
      DATABASE_URL: TEST_DATABASE_URL,
    },
    hookTimeout: 120_000,
    testTimeout: 30_000,
    // All integration tests share one database — run files sequentially.
    fileParallelism: false,
  },
})
