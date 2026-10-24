import cors from '@fastify/cors'
import Fastify, { type FastifyInstance } from 'fastify'
import { Prisma } from '@prisma/client'
import { ZodError } from 'zod'

import { config } from './lib/config.js'
import { AppError } from './lib/errors.js'
import { prisma } from './lib/prisma.js'
import { resolveWorkspace } from './lib/workspace.js'
import { dashboardRoutes } from './routes/dashboard.js'
import { healthRoutes } from './routes/health.js'
import { movementRoutes } from './routes/movements.js'
import { notificationRoutes } from './routes/notifications.js'
import { productRoutes } from './routes/products.js'
import { categoryRoutes, locationRoutes, warehouseRoutes } from './routes/warehouse.js'
import { workspaceRoutes } from './routes/workspaces.js'

export function buildApp(): FastifyInstance {
  const app = Fastify({
    logger: {
      level: config.LOG_LEVEL,
      redact: {
        // Never log credentials or tokens (PRD §12).
        paths: ['req.headers.authorization', 'req.headers.cookie', 'req.body.password'],
        censor: '[REDACTED]',
      },
    },
  })

  app.register(cors, { origin: config.CORS_ORIGIN.split(',') })

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof AppError) {
      return reply
        .status(error.statusCode)
        .send({ error: { code: error.code, message: error.message } })
    }
    if (error instanceof ZodError) {
      const detail = error.issues
        .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
        .join('; ')
      return reply
        .status(422)
        .send({ error: { code: 'VALIDATION_FAILED', message: `Data tidak valid — ${detail}` } })
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') {
        return reply
          .status(409)
          .send({ error: { code: 'CONFLICT', message: 'Data sudah ada (melanggar keunikan).' } })
      }
      if (error.code === 'P2025') {
        return reply
          .status(404)
          .send({ error: { code: 'NOT_FOUND', message: 'Data tidak ditemukan.' } })
      }
    }
    request.log.error({ err: error }, 'unhandled error')
    return reply
      .status(500)
      .send({ error: { code: 'INTERNAL', message: 'Terjadi kesalahan internal.' } })
  })

  app.setNotFoundHandler((_request, reply) => {
    reply
      .status(404)
      .send({ error: { code: 'ROUTE_NOT_FOUND', message: 'Endpoint tidak ditemukan.' } })
  })

  app.register(healthRoutes)
  // Workspace listing is not workspace-scoped: the web client uses it to pick
  // the workspace to operate on until sessions exist (Phase 4).
  app.register(workspaceRoutes)
  app.register(async (scoped) => {
    // All data routes are workspace-scoped (see lib/workspace.ts).
    scoped.addHook('preHandler', resolveWorkspace)
    await scoped.register(dashboardRoutes)
    await scoped.register(productRoutes)
    await scoped.register(categoryRoutes)
    await scoped.register(warehouseRoutes)
    await scoped.register(locationRoutes)
    await scoped.register(movementRoutes)
    await scoped.register(notificationRoutes)
  })

  app.addHook('onClose', async () => {
    await prisma.$disconnect()
  })

  return app
}
