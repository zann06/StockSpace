import { execSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { PrismaClient } from '@prisma/client'

import { TEST_DATABASE_URL } from './env.js'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')

/**
 * Global test setup:
 * 1. defensively create the test database (in case the docker volume predates
 *    the init script that creates it),
 * 2. apply all Prisma migrations to it.
 */
export default async function globalSetup() {
  const admin = new PrismaClient({ datasources: { db: { url: TEST_DATABASE_URL } } })
  try {
    await admin.$executeRawUnsafe('SELECT 1')
  } catch {
    // Database missing — create it through the admin (postgres) database.
    const serverUrl = TEST_DATABASE_URL.replace(/\/[^/]+$/, '/postgres')
    const bootstrap = new PrismaClient({ datasources: { db: { url: serverUrl } } })
    await bootstrap.$executeRawUnsafe(`CREATE DATABASE "${new URL(serverUrl).pathname.slice(1)}"`)
    await bootstrap.$disconnect()
  } finally {
    await admin.$disconnect().catch(() => {})
  }

  execSync('npx prisma migrate deploy', {
    cwd: repoRoot,
    env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL },
    stdio: 'inherit',
  })
}
