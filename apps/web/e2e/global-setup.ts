import { execSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { E2E_DATABASE_URL } from '../playwright.config'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')

/**
 * Prepares the dedicated e2e database: create it if missing, apply
 * migrations, then load the fictional demo workspace so the smoke test has a
 * deterministic starting point.
 */
export default async function globalSetup() {
  const databaseName = new URL(E2E_DATABASE_URL).pathname.slice(1)

  try {
    const probe = new (await import('@prisma/client')).PrismaClient({
      datasources: { db: { url: E2E_DATABASE_URL } },
    })
    await probe.$executeRawUnsafe('SELECT 1')
    await probe.$disconnect()
  } catch {
    const adminUrl = new URL(E2E_DATABASE_URL)
    adminUrl.pathname = '/postgres'
    const bootstrap = new (await import('@prisma/client')).PrismaClient({
      datasources: { db: { url: adminUrl.toString() } },
    })
    try {
      await bootstrap.$executeRawUnsafe(`CREATE DATABASE "${databaseName}"`)
    } catch (error) {
      if (!String(error).includes('42P04')) throw error
    } finally {
      await bootstrap.$disconnect().catch(() => {})
    }
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
