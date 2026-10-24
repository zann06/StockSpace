import type { FastifyInstance } from 'fastify'

import { prisma } from '../lib/prisma.js'

/**
 * Workspace listing. Until authentication lands (Phase 4) the web app uses
 * this to pick which workspace to operate on; with sessions it will list only
 * the workspaces the signed-in user belongs to. Not workspace-scoped itself.
 */
export async function workspaceRoutes(app: FastifyInstance) {
  app.get('/api/workspaces', async () => {
    const workspaces = await prisma.workspace.findMany({
      select: { id: true, name: true, currency: true, timezone: true },
      orderBy: { createdAt: 'asc' },
    })
    return { data: workspaces }
  })
}
