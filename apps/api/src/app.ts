import cors from '@fastify/cors'
import rateLimit from '@fastify/rate-limit'
import Fastify, { type FastifyInstance } from 'fastify'
import { Prisma } from '@prisma/client'
import { ZodError } from 'zod'
import { fromNodeHeaders } from 'better-auth/node'

import { auth } from './lib/auth.js'
import { config } from './lib/config.js'
import { AppError } from './lib/errors.js'
import { prisma } from './lib/prisma.js'
import { requireSession, resolveWorkspace } from './lib/session.js'
import { dashboardRoutes } from './routes/dashboard.js'
import { healthRoutes } from './routes/health.js'
import { memberRoutes } from './routes/members.js'
import { movementRoutes } from './routes/movements.js'
import { notificationRoutes } from './routes/notifications.js'
import { productRoutes } from './routes/products.js'
import { reportRoutes } from './routes/reports.js'
import { categoryRoutes, locationRoutes, warehouseRoutes } from './routes/warehouse.js'
import { workspaceRoutes } from './routes/workspaces.js'

/** Rate limiting is on by default; disabled under `npm test` unless forced. */
export async function buildApp(options: { rateLimit?: boolean } = {}): Promise<FastifyInstance> {
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

  // Cookie sessions require credentialed CORS with explicit origins.
  await app.register(cors, { origin: config.CORS_ORIGIN.split(','), credentials: true })

  if (options.rateLimit ?? process.env.NODE_ENV !== 'test') {
    // Awaited so the plugin's onRoute hook sees every route below.
    await app.register(rateLimit, { global: true, max: 300, timeWindow: '1 minute' })
  }

  app.setErrorHandler((error, request, reply) => {
    // Pass through framework/plugin 4xx errors (rate limit, body parser, …)
    // with their original status instead of collapsing them into 500.
    const pluginStatus = (error as { statusCode?: number }).statusCode
    if (!(error instanceof AppError) && pluginStatus && pluginStatus >= 400 && pluginStatus < 500) {
      return reply.status(pluginStatus).send({
        error: {
          code: pluginStatus === 429 ? 'RATE_LIMITED' : 'BAD_REQUEST',
          message:
            pluginStatus === 429
              ? 'Terlalu banyak permintaan — coba lagi beberapa saat lagi.'
              : (error as Error).message,
        },
      })
    }
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

  // better-auth handlers (sign-in/email, sign-out, get-session, …) — bridged
  // to Fastify per https://www.better-auth.com/docs/integrations/fastify.
  app.route({
    method: ['GET', 'POST'],
    url: '/api/auth/*',
    config: {
      // Stricter budget for credential endpoints (PRD §12).
      rateLimit: { max: 20, timeWindow: '1 minute' },
    },
    async handler(request, reply) {
      try {
        const url = new URL(request.url, `http://${request.headers.host}`)
        const request_ = new Request(url.toString(), {
          method: request.method,
          headers: fromNodeHeaders(request.headers),
          ...(request.body ? { body: JSON.stringify(request.body) } : {}),
        })
        const response = await auth.handler(request_)
        reply.status(response.status)
        response.headers.forEach((value, key) => reply.header(key, value))
        return reply.send(response.body ? await response.text() : null)
      } catch (error) {
        request.log.error({ err: error }, 'auth handler error')
        return reply
          .status(500)
          .send({ error: { code: 'AUTH_FAILURE', message: 'Kesalahan pada modul autentikasi.' } })
      }
    },
  })

  // Authenticated, workspace-scoped data routes (see lib/session.ts).
  app.register(async (scoped) => {
    scoped.addHook('preHandler', requireSession)
    await scoped.register(workspaceRoutes)
    scoped.addHook('preHandler', resolveWorkspace)
    await scoped.register(dashboardRoutes)
    await scoped.register(productRoutes)
    await scoped.register(memberRoutes)
    await scoped.register(categoryRoutes)
    await scoped.register(warehouseRoutes)
    await scoped.register(locationRoutes)
    await scoped.register(movementRoutes)
    await scoped.register(notificationRoutes)
    await scoped.register(reportRoutes)
  })

  app.addHook('onClose', async () => {
    await prisma.$disconnect()
  })

  return app
}
