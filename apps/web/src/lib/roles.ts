import type { MemberRole } from '@/api/types'

/** Shared role ordering — mirrors the API's `roleAtLeast` (apps/api/src/lib/session.ts). */
export const MEMBER_ROLES: readonly MemberRole[] = ['OWNER', 'ADMIN', 'STAFF', 'VIEWER']

const ROLE_RANK: Record<MemberRole, number> = {
  VIEWER: 0,
  STAFF: 1,
  ADMIN: 2,
  OWNER: 3,
}

export function roleAtLeast(role: MemberRole | undefined, minimum: MemberRole): boolean {
  if (!role) return false
  return ROLE_RANK[role] >= ROLE_RANK[minimum]
}

/** OWNER and ADMIN can invite, change roles, and remove members. */
export function canManageMembers(role: MemberRole | undefined): boolean {
  return roleAtLeast(role, 'ADMIN')
}

/** Roles the current actor is allowed to grant (never above their own rank). */
export function assignableRoles(role: MemberRole | undefined): MemberRole[] {
  return MEMBER_ROLES.filter((candidate) => roleAtLeast(role, candidate))
}
