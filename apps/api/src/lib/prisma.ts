import { PrismaClient } from '@prisma/client'

import { config } from './config.js'

declare global {
  var prisma: PrismaClient | undefined
}

/** Single PrismaClient per process (hot-reload safe in dev). */
export const prisma =
  globalThis.prisma ?? new PrismaClient({ log: [config.LOG_LEVEL === 'debug' ? 'query' : 'error'] })

if (process.env.NODE_ENV !== 'production') globalThis.prisma = prisma
