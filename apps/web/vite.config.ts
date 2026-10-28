/// <reference types="vitest/config" />
import { fileURLToPath, URL } from 'node:url'

import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

export default defineConfig({
  // VITE_BASE_PATH builds the static demo for project pages (/StockSpace/).
  base: process.env.VITE_BASE_PATH ?? '/',
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    globals: true,
    clearMocks: true,
    // Component tests render the full app shell (charts + 3D scene); give slow
    // CI runners room so timing does not turn into flakes.
    testTimeout: 20_000,
    hookTimeout: 20_000,
    // Playwright specs live in e2e/ — never collect them here.
    exclude: ['e2e/**', 'node_modules/**', 'dist/**'],
  },
})
