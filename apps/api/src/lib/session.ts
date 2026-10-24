import type { FastifyRequest } from 'fastify'
import type { MemberRole } from '@prisma/client'
import { fromNodeHeaders } from 'better-auth/node'

import { auth } from './auth.js'
import { AppError, ERRORS } from './errors.js'
import { prisma } from './prisma.js'

declare module 'fastify' {
  interface FastifyRequest {
    user: { id: string; name: string; email: string }
    workspace: { id: string; name: string; currency: string; timezone: string }
    role: MemberRole
  }
}

/** Role hierarchy for permission checks. */
const ROLE_RANK: Record<MemberRole, number> = {
  VIEWER: 0,
  STAFF: 1,
  ADMIN: 2,
  OWNER: 3,
}

export function roleAtLeast(role: MemberRole, minimum: MemberRole): boolean {
  return ROLE_RANK[role] >= ROLE_RANK[minimum]
}

/** Resolves the better-auth session; 401 when absent. */
export async function requireSession(request: FastifyRequest) {
  const session = await auth.api.getSession({ headers: fromNodeHeaders(request.headers) })
  if (!session) {
    throw new AppError(401, 'UNAUTHORIZED', 'Sesi tidak ditemukan — silakan masuk kembali.')
  }
  request.user = {
    id: session.user.id,
    name: session.user.name,
    email: session.user.email,
  }
}

/**
 * Workspace scoping (PRD §7.7/§12): resolves the active workspace from the
 * `X-Workspace-Id` header (defaulting to the user's first membership) and
 * verifies the signed-in user is a member. Role is attached for route guards.
 */
export async function resolveWorkspace(request: FastifyRequest) {
  const header = request.headers['x-workspace-id']
  const requestedId = Array.isArray(header) ? header[0] : header

  const membership = requestedId
    ? await prisma.workspaceMember.findFirst({
        where: { workspaceId: requestedId, userId: request.user.id },
        include: {
          workspace: { select: { id: true, name: true, currency: true, timezone: true } },
        },
      })
    : await prisma.workspaceMember.findFirst({
        where: { userId: request.user.id },
        include: {
          workspace: { select: { id: true, name: true, currency: true, timezone: true } },
        },
        orderBy: { createdAt: 'asc' },
      })

  if (!membership) {
    if (requestedId) {
      throw new AppError(403, ERRORS.NOT_A_MEMBER, 'Anda bukan anggota workspace ini.')
    }
    throw new AppError(403, ERRORS.NOT_A_MEMBER, 'Akun Anda belum terdaftar di workspace mana pun.')
  }

  request.workspace = membership.workspace
  request.role = membership.role
}

/** Route guard: require at least `minimum` in the active workspace. */
export function requireRole(minimum: MemberRole) {
  return async (request: FastifyRequest) => {
    if (!roleAtLeast(request.role, minimum)) {
      throw new AppError(
        403,
        ERRORS.ROLE_FORBIDDEN,
        `Peran Anda (${request.role}) tidak berhak melakukan aksi ini (butuh ${minimum}+).`
      )
    }
  }
}
