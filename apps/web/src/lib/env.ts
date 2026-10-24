import { z } from 'zod'

/**
 * Client environment validation. Fails loudly at startup on a malformed
 * configuration instead of producing a half-configured app.
 */
const EnvSchema = z.object({
  VITE_API_URL: z.url().optional().default('http://localhost:4000'),
})

const parsed = EnvSchema.safeParse({
  VITE_API_URL: import.meta.env.VITE_API_URL || undefined,
})

if (!parsed.success) {
  throw new Error(
    `Invalid client environment: ${parsed.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ')}. Check apps/web/.env.`
  )
}

export const env = parsed.data
