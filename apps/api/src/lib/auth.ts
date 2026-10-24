import { betterAuth } from 'better-auth'
import { prismaAdapter } from 'better-auth/adapters/prisma'

import { config } from './config.js'
import { prisma } from './prisma.js'

/**
 * Single authentication system (docs/architecture.md D6): email/password
 * credentials with HTTP-only cookie sessions, backed by the Prisma models
 * User/Session/Account/Verification.
 */
export const auth = betterAuth({
  baseURL: config.BETTER_AUTH_URL,
  trustedOrigins: config.CORS_ORIGIN.split(','),
  // The adapter resolves our PascalCase Prisma models (User/Session/Account/
  // Verification) automatically from the client's schema.
  database: prismaAdapter(prisma, { provider: 'postgresql' }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // refresh once a day
  },
})
