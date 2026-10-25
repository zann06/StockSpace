import { execSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { E2E_DATABASE_URL } from '../playwright.config'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')

/**
 * Prepares the dedicated e2e database: apply migrations, then load the
 * fictional demo workspace (users + warehouse + stock) so the smoke test has a
 * deterministic starting point.
 */
export default async function globalSetup() {
  // Defensively create the database when the docker volume predates the init
  // script that creates it.
  const admin = new (await import('@prisma/client')).PrismaClient({
    datasources: { db: { url: E2E_DATABASE_URL } },
  })
  try {
    await admin.$executeRawUnsafe('SELECT 1')
    await admin.$disconnect()
  } catch {
    const serverUrl = E2E_DATABASE_URL.replace(/\/[^/]+$/, '/postgres')
    const bootstrap = new (await import('@prisma/client')).PrismaClient({
      datasources: { db: { url: serverUrl } },
    })
    const dbName = new URL('http://x' + E2E_DATABASE_URL.replace(/^[a-z]+:/, '')).pathname.slice(1)
    await bootstrap.$executeRawUnsafe(`CREATE DATABASE "${dbName}"`)
    await bootstrap.$disconnect()
  }

  const env = {
    ...process.env,
    DATABASE_URL: E2E_DATABASE_URL,
    BETTER_AUTH_SECRET: 'e2e-test-secret-0123456789abcdef0123456789abcdef',
    BETTER_AUTH_URL: 'http://localhost:4100',
    CORS_ORIGIN: 'http://localhost:5173',
  }

  execSync('npx prisma migrate deploy', { cwd: repoRoot, env, stdio: 'inherit' })
  execSync('npx tsx prisma/seed.ts', { cwd: repoRoot, env, stdio: 'inherit' })
}
