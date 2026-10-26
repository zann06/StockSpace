import type { FastifyInstance, FastifyRequest } from 'fastify'
import { z } from 'zod'

import { AppError, ERRORS } from '../lib/errors.js'
import { prisma } from '../lib/prisma.js'
import { requireRole, roleAtLeast } from '../lib/session.js'
import { parseWith } from '../lib/validate.js'

const memberRoleSchema = z.enum(['OWNER', 'ADMIN', 'STAFF', 'VIEWER'])

const inviteMemberSchema = z.object({
  email: z.string().trim().email('Format email tidak valid.').max(200),
  role: memberRoleSchema.default('STAFF'),
})

const updateRoleSchema = z.object({
  role: memberRoleSchema,
})

const memberIdSchema = z.object({ memberId: z.string().uuid() })

const MEMBER_SELECT = {
  id: true,
  userId: true,
  role: true,
  createdAt: true,
  user: { select: { name: true, email: true } },
} as const

type MemberRow = {
  id: string
  userId: string
  role: 'OWNER' | 'ADMIN' | 'STAFF' | 'VIEWER'
  createdAt: Date
  user: { name: string; email: string }
}

function serializeMember(member: MemberRow) {
  return {
    id: member.id,
    userId: member.userId,
    name: member.user.name,
    email: member.user.email,
    role: member.role,
    createdAt: member.createdAt,
  }
}

/** Prevents the workspace from losing its only owner (also guards self-demotion). */
async function assertOwnerRemains(workspaceId: string, excludingMemberId?: string) {
  const remaining = await prisma.workspaceMember.count({
    where: {
      workspaceId,
      role: 'OWNER',
      ...(excludingMemberId ? { id: { not: excludingMemberId } } : {}),
    },
  })
  if (remaining === 0) {
    throw AppError.conflict(
      ERRORS.LAST_OWNER,
      'Workspace harus memiliki minimal satu Owner. Angkat Owner lain terlebih dahulu.'
    )
  }
}

/** An actor may only manage members at or below their own role. */
function assertCanManage(
  request: FastifyRequest,
  targetRole: MemberRow['role'],
  action: 'ubah' | 'hapus'
) {
  if (!roleAtLeast(request.role, targetRole)) {
    throw new AppError(
      403,
      ERRORS.ROLE_FORBIDDEN,
      `Peran Anda (${request.role}) tidak berhak ${action} anggota dengan peran ${targetRole}.`
    )
  }
}

async function findMemberOrThrow(workspaceId: string, memberId: string): Promise<MemberRow> {
  const member = await prisma.workspaceMember.findFirst({
    where: { id: memberId, workspaceId },
    select: MEMBER_SELECT,
  })
  if (!member) throw AppError.notFound(ERRORS.MEMBER_NOT_FOUND, 'Anggota tidak ditemukan.')
  return member
}

/**
 * Workspace membership management (PRD §7.8). The workspace comes from the
 * `X-Workspace-Id` header, so every query is scoped by `request.workspace.id`.
 * Invitations require an existing StockSpace account — there is no mail
 * provider configured, so a pending-invite flow would need a new model.
 */
export async function memberRoutes(app: FastifyInstance) {
  app.get('/api/members', async (request) => {
    const members = await prisma.workspaceMember.findMany({
      where: { workspaceId: request.workspace.id },
      select: MEMBER_SELECT,
      orderBy: { createdAt: 'asc' },
    })
    return { data: members.map(serializeMember) }
  })

  app.post('/api/members', { preHandler: requireRole('ADMIN') }, async (request) => {
    const body = parseWith(inviteMemberSchema, request.body)

    if (!roleAtLeast(request.role, body.role)) {
      throw new AppError(
        403,
        ERRORS.ROLE_FORBIDDEN,
        `Peran Anda (${request.role}) tidak berhak mengundang anggota sebagai ${body.role}.`
      )
    }

    const user = await prisma.user.findFirst({
      where: { email: { equals: body.email, mode: 'insensitive' } },
      select: { id: true, name: true, email: true },
    })
    if (!user) {
      throw AppError.notFound(
        ERRORS.USER_NOT_FOUND,
        `Belum ada akun StockSpace dengan email "${body.email}". Minta pengguna mendaftar terlebih dahulu.`
      )
    }

    const existing = await prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId: request.workspace.id, userId: user.id } },
      select: { id: true },
    })
    if (existing) {
      throw AppError.conflict(ERRORS.MEMBER_EXISTS, 'Pengguna ini sudah menjadi anggota workspace.')
    }

    const member = await prisma.workspaceMember.create({
      data: { workspaceId: request.workspace.id, userId: user.id, role: body.role },
      select: MEMBER_SELECT,
    })

    request.log.info({ memberId: member.id, userId: user.id }, 'workspace member invited')
    return { data: serializeMember(member) }
  })

  app.patch('/api/members/:memberId', { preHandler: requireRole('ADMIN') }, async (request) => {
    const { memberId } = parseWith(memberIdSchema, request.params)
    const { role } = parseWith(updateRoleSchema, request.body)
    const member = await findMemberOrThrow(request.workspace.id, memberId)

    if (member.userId === request.user.id) {
      throw AppError.badRequest(
        ERRORS.SELF_ROLE_CHANGE,
        'Anda tidak dapat mengubah peran sendiri. Minta Owner lain melakukannya.'
      )
    }
    assertCanManage(request, member.role, 'ubah')
    if (!roleAtLeast(request.role, role)) {
      throw new AppError(
        403,
        ERRORS.ROLE_FORBIDDEN,
        `Peran Anda (${request.role}) tidak berhak mengangkat anggota menjadi ${role}.`
      )
    }
    if (member.role === 'OWNER' && role !== 'OWNER') {
      await assertOwnerRemains(request.workspace.id, member.id)
    }

    const updated = await prisma.workspaceMember.update({
      where: { id: member.id },
      data: { role },
      select: MEMBER_SELECT,
    })

    request.log.info({ memberId: member.id, role }, 'workspace member role updated')
    return { data: serializeMember(updated) }
  })

  app.delete('/api/members/:memberId', { preHandler: requireRole('ADMIN') }, async (request) => {
    const { memberId } = parseWith(memberIdSchema, request.params)
    const member = await findMemberOrThrow(request.workspace.id, memberId)

    if (member.userId === request.user.id) {
      throw AppError.badRequest(
        ERRORS.SELF_REMOVE,
        'Anda tidak dapat menghapus keanggotaan sendiri.'
      )
    }
    assertCanManage(request, member.role, 'hapus')
    if (member.role === 'OWNER') {
      await assertOwnerRemains(request.workspace.id, member.id)
    }

    await prisma.workspaceMember.delete({ where: { id: member.id } })
    request.log.info({ memberId: member.id }, 'workspace member removed')
    return { data: { id: member.id } }
  })
}
