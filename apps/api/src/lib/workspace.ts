import type { FastifyRequest } from 'fastify'

import { prisma } from './prisma.js'
import { AppError, ERRORS } from './errors.js'

declare module 'fastify' {
  interface FastifyRequest {
    workspace: { id: string; name: string; currency: string; timezone: string }
  }
}

/**
 * Workspace scoping (PRD §7.7): every protected route resolves the workspace
 * from the `X-Workspace-Id` header and only serves records within it. When
 * authentication lands (Phase 4) this is replaced by membership checks; the
 * handler contract stays identical.
 */
export async function resolveWorkspace(request: FastifyRequest) {
  const header = request.headers['x-workspace-id']
  const workspaceId = Array.isArray(header) ? header[0] : header

  if (!workspaceId) {
    throw new AppError(401, ERRORS.WORKSPACE_REQUIRED, 'Header X-Workspace-Id wajib diisi.')
  }

  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { id: true, name: true, currency: true, timezone: true },
  })

  if (!workspace) {
    throw new AppError(404, ERRORS.WORKSPACE_NOT_FOUND, 'Workspace tidak ditemukan.')
  }

  request.workspace = workspace
}
