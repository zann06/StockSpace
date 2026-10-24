import type { FastifyInstance } from 'fastify'

import { prisma } from '../lib/prisma.js'

export async function healthRoutes(app: FastifyInstance) {
  app.get('/api/health', async () => {
    await prisma.$queryRaw`SELECT 1`
    return { status: 'ok' }
  })
}
