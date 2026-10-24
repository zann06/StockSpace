import type { FastifyInstance } from 'fastify'

import { prisma } from '../lib/prisma.js'
import { requireSession } from '../lib/session.js'

/** Workspaces the signed-in user belongs to (with their role). Auth-only —
 * the header-based workspace selection is not applied here. */
export async function workspaceRoutes(app: FastifyInstance) {
  app.get('/api/workspaces', { preHandler: requireSession }, async (request) => {
    const memberships = await prisma.workspaceMember.findMany({
      where: { userId: request.user.id },
      select: {
        role: true,
        workspace: { select: { id: true, name: true, currency: true, timezone: true } },
      },
      orderBy: { createdAt: 'asc' },
    })

    return {
      data: memberships.map((membership) => ({
        ...membership.workspace,
        role: membership.role,
      })),
    }
  })
}
