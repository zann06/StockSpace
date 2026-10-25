import type { FastifyInstance } from 'fastify'

/**
 * Liveness probe only — intentionally does NOT touch the database so process
 * orchestration (docker healthcheck, Playwright webServer readiness) cannot
 * deadlock while a migration/seeding step is still creating the database.
 */
export async function healthRoutes(app: FastifyInstance) {
  app.get('/api/health', async () => ({ status: 'ok' }))
}
