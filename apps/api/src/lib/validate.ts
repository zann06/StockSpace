import { z } from 'zod'

import { AppError } from './errors.js'

/**
 * Validate untrusted input with Zod; map failures to 422 with a readable
 * message list instead of leaking internals.
 */
export function parseWith<Schema extends z.ZodType>(
  schema: Schema,
  input: unknown
): z.output<Schema> {
  const result = schema.safeParse(input)
  if (!result.success) {
    const detail = result.error.issues
      .map((issue) => `${issue.path.join('.') || 'body'}: ${issue.message}`)
      .join('; ')
    throw new AppError(422, 'VALIDATION_FAILED', `Data tidak valid — ${detail}`)
  }
  return result.data
}
