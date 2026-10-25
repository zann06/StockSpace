import { execSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { PrismaClient } from '@prisma/client'

import { TEST_DATABASE_URL } from './env.js'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')

/**
 * Global test setup:
 * 1. defensively create the test database (in case the server predates the
 *    init script that creates it),
 * 2. apply all Prisma migrations to it.
 */
export default async function globalSetup() {
  const target = new URL(TEST_DATABASE_URL)
  const databaseName = target.pathname.slice(1)

  try {
    const probe = new PrismaClient({ datasources: { db: { url: TEST_DATABASE_URL } } })
    await probe.$executeRawUnsafe('SELECT 1')
    await probe.$disconnect()
  } catch {
    // Database missing — create it through the admin (postgres) database.
    const adminUrl = new URL(TEST_DATABASE_URL)
    adminUrl.pathname = '/postgres'
    const bootstrap = new PrismaClient({ datasources: { db: { url: adminUrl.toString() } } })
    try {
      await bootstrap.$executeRawUnsafe(`CREATE DATABASE "${databaseName}"`)
    } catch (error) {
      // 42P04 = duplicate_database — a concurrent run already created it.
      if (!String(error).includes('42P04')) throw error
    } finally {
      await bootstrap.$disconnect().catch(() => {})
    }
  }

  execSync('npx prisma migrate deploy', {
    cwd: repoRoot,
    env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL },
    stdio: 'inherit',
  })
}
