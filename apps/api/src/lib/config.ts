import { z } from 'zod'

/**
 * Server environment validation — fails loudly at startup on a malformed
 * configuration (mirrors apps/web/src/lib/env.ts).
 */
const EnvSchema = z.object({
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  PORT: z.coerce.number().int().positive().default(4000),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug']).default('info'),
  // better-auth: a real secret is mandatory in production; the dev default only
  // exists so a fresh clone works before .env is configured (never in prod).
  BETTER_AUTH_SECRET: z.string().min(32).default('stockspace-dev-secret-change-me-please-32'),
  BETTER_AUTH_URL: z.string().default('http://localhost:4000'),
})

const parsed = EnvSchema.safeParse({
  ...process.env,
  BETTER_AUTH_SECRET:
    process.env.BETTER_AUTH_SECRET ??
    (process.env.NODE_ENV === 'production'
      ? undefined
      : 'stockspace-dev-secret-change-me-please-32'),
})

if (!parsed.success) {
  if (process.env.NODE_ENV === 'production' && !process.env.BETTER_AUTH_SECRET) {
    throw new Error('BETTER_AUTH_SECRET wajib diisi di production (minimal 32 karakter).')
  }
  throw new Error(
    `Invalid server environment: ${parsed.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ')}`
  )
}

export const config = parsed.data
