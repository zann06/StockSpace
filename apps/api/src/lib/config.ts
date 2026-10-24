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
})

const parsed = EnvSchema.safeParse(process.env)

if (!parsed.success) {
  throw new Error(
    `Invalid server environment: ${parsed.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ')}`
  )
}

export const config = parsed.data
