import { useState, type FormEvent } from 'react'
import { Check, MailPlus, Trash2, X } from 'lucide-react'

import { useInviteMember, useMembers, useRemoveMember, useUpdateMemberRole } from '@/api/hooks'
import { useSession } from '@/api/auth'
import { useWorkspace } from '@/api/workspace-context'
import type { ApiMember, MemberRole } from '@/api/types'
import { assignableRoles, canManageMembers, roleAtLeast } from '@/lib/roles'
import { useI18n } from '@/i18n'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card, CardHeader } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'

const ROLE_TONE: Record<MemberRole, 'primary' | 'success' | 'warning' | 'neutral'> = {
  OWNER: 'primary',
  ADMIN: 'success',
  STAFF: 'neutral',
  VIEWER: 'neutral',
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.slice(0, 1).toUpperCase())
    .join('')
}

/**
 * Workspace member management (PRD §7.8): invite an existing account, change
 * roles, and remove members. Roles are mirrored from the API — OWNER/ADMIN can
 * manage, and nobody can grant a role above their own.
 */
export function MembersCard() {
  const { t } = useI18n()
  const { workspace } = useWorkspace()
  const actorRole = workspace?.role
  const canManage = canManageMembers(actorRole)
  const session = useSession()
  const sessionUserId = session.data?.user.id

  const membersQuery = useMembers()
  const inviteMutation = useInviteMember()
  const updateMutation = useUpdateMemberRole()
  const removeMutation = useRemoveMember()

  const [inviteOpen, setInviteOpen] = useState(false)
  const [email, setEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<MemberRole>(() => {
    const roles = assignableRoles(actorRole)
    return roles.includes('STAFF') ? 'STAFF' : (roles[0] ?? 'VIEWER')
  })
  const [pendingRemoveId, setPendingRemoveId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const roleLabel = (role: MemberRole) => {
    if (role === 'STAFF') return t('Staf')
    return t(role === 'OWNER' ? 'Owner' : role === 'ADMIN' ? 'Admin' : 'Viewer')
  }

  const members = [...(membersQuery.data?.data ?? [])].sort(
    (a, b) =>
      MEMBER_ROLE_ORDER.indexOf(a.role) - MEMBER_ROLE_ORDER.indexOf(b.role) ||
      a.name.localeCompare(b.name)
  )

  const startInvite = () => {
    setError(null)
    setNotice(null)
    setEmail('')
    const roles = assignableRoles(actorRole)
    setInviteRole(roles.includes('STAFF') ? 'STAFF' : (roles[0] ?? 'VIEWER'))
    setInviteOpen(true)
  }

  const submitInvite = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)
    setNotice(null)
    inviteMutation.mutate(
      { email: email.trim(), role: inviteRole },
      {
        onSuccess: (response) => {
          setNotice(t('{name} berhasil diundang.', { name: response.data.name }))
          setInviteOpen(false)
          setEmail('')
        },
        onError: (mutationError) => setError(mutationError.message),
      }
    )
  }

  const changeRole = (member: ApiMember, role: MemberRole) => {
    setError(null)
    setNotice(null)
    updateMutation.mutate(
      { memberId: member.id, role },
      {
        onSuccess: () => setNotice(t('Peran {name} diperbarui.', { name: member.name })),
        onError: (mutationError) => setError(mutationError.message),
      }
    )
  }

  const confirmRemove = (member: ApiMember) => {
    setError(null)
    setNotice(null)
    removeMutation.mutate(member.id, {
      onSuccess: () => {
        setPendingRemoveId(null)
        setNotice(t('{name} dihapus dari workspace.', { name: member.name }))
      },
      onError: (mutationError) => {
        setPendingRemoveId(null)
        setError(mutationError.message)
      },
    })
  }

  return (
    <Card>
      <CardHeader
        title={t('Pengguna')}
        subtitle={t('Manajemen anggota workspace dan perannya')}
        action={
          canManage ? (
            <Button size="sm" variant="secondary" onClick={startInvite} disabled={inviteOpen}>
              <MailPlus aria-hidden className="h-3.5 w-3.5" />
              {t('+ Undang Pengguna')}
            </Button>
          ) : undefined
        }
      />
      <div className="flex flex-col gap-3 px-5 py-5">
        {inviteOpen ? (
          <form onSubmit={submitInvite} className="rounded-card border border-line bg-canvas p-3.5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <label className="flex flex-1 flex-col gap-1.5 text-xs font-bold text-ink">
                {t('Email pengguna terdaftar')}
                <Input
                  type="email"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="nama@perusahaan.com"
                  autoComplete="off"
                  autoFocus
                />
              </label>
              <label className="flex w-full flex-col gap-1.5 text-xs font-bold text-ink sm:w-40">
                {t('Peran')}
                <select
                  value={inviteRole}
                  onChange={(event) => setInviteRole(event.target.value as MemberRole)}
                  className="h-10 rounded-control border border-line bg-surface px-3 text-sm font-semibold text-ink"
                >
                  {assignableRoles(actorRole).map((role) => (
                    <option key={role} value={role}>
                      {roleLabel(role)}
                    </option>
                  ))}
                </select>
              </label>
              <div className="flex items-center gap-2">
                <Button type="submit" size="sm" disabled={inviteMutation.isPending}>
                  {inviteMutation.isPending ? t('Mengundang…') : t('Kirim undangan')}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => setInviteOpen(false)}
                  aria-label={t('Tutup formulir undangan')}
                >
                  <X aria-hidden className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <p className="mt-2 text-[11px] leading-relaxed text-muted">
              {t('Pengguna harus sudah memiliki akun StockSpace dengan email ini.')}
            </p>
          </form>
        ) : null}

        {error ? (
          <p
            role="alert"
            className="rounded-control bg-danger-soft px-3 py-2 text-xs font-semibold text-danger-fg"
          >
            {error}
          </p>
        ) : null}
        {notice ? (
          <p
            role="status"
            className="rounded-control bg-success-soft px-3 py-2 text-xs font-semibold text-success-fg"
          >
            {notice}
          </p>
        ) : null}

        {membersQuery.isLoading ? (
          <p className="text-sm font-semibold text-muted">{t('Memuat anggota…')}</p>
        ) : membersQuery.error ? (
          <div className="rounded-control bg-danger-soft px-3 py-2 text-xs text-danger-fg">
            <p className="font-semibold">{t('Gagal memuat anggota.')}</p>
            <p className="mt-0.5">{membersQuery.error.message}</p>
          </div>
        ) : members.length === 0 ? (
          <p className="text-sm text-muted">{t('Belum ada anggota.')}</p>
        ) : (
          <ul className="divide-y divide-line">
            {members.map((member) => {
              const isSelf = member.userId === sessionUserId
              const canEditThis = canManage && !isSelf && roleAtLeast(actorRole, member.role)
              const canRemoveThis =
                canManage &&
                !isSelf &&
                roleAtLeast(actorRole, member.role) &&
                !removeMutation.isPending
              return (
                <li
                  key={member.id}
                  className="flex flex-wrap items-center gap-3 py-3 first:pt-0 last:pb-0"
                >
                  <span
                    aria-hidden
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-soft text-xs font-extrabold text-primary"
                  >
                    {initials(member.name)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-1.5 truncate text-sm font-bold text-ink">
                      {member.name}
                      {isSelf ? <Badge tone="neutral">{t('Anda')}</Badge> : null}
                    </p>
                    <p className="truncate text-xs text-muted">{member.email}</p>
                  </div>

                  {canEditThis ? (
                    <select
                      value={member.role}
                      aria-label={t('Peran untuk {name}', { name: member.name })}
                      disabled={updateMutation.isPending}
                      onChange={(event) => changeRole(member, event.target.value as MemberRole)}
                      className="h-8 rounded-control border border-line bg-surface px-2 text-xs font-semibold text-ink disabled:cursor-not-allowed disabled:text-muted"
                    >
                      {assignableRoles(actorRole).map((role) => (
                        <option key={role} value={role}>
                          {roleLabel(role)}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <Badge tone={ROLE_TONE[member.role]}>{roleLabel(member.role)}</Badge>
                  )}

                  {pendingRemoveId === member.id ? (
                    <span className="flex items-center gap-1.5">
                      <span className="text-[11px] font-semibold text-danger-fg">
                        {t('Yakin menghapus {name}?', { name: member.name })}
                      </span>
                      <Button
                        size="sm"
                        variant="danger"
                        disabled={removeMutation.isPending}
                        onClick={() => confirmRemove(member)}
                      >
                        <Check aria-hidden className="h-3.5 w-3.5" />
                        {t('Ya, hapus')}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setPendingRemoveId(null)}>
                        {t('Batal')}
                      </Button>
                    </span>
                  ) : canRemoveThis ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setPendingRemoveId(member.id)}
                      aria-label={t('Hapus {name}', { name: member.name })}
                      title={t('Hapus {name}', { name: member.name })}
                    >
                      <Trash2 aria-hidden className="h-3.5 w-3.5" />
                    </Button>
                  ) : null}
                </li>
              )
            })}
          </ul>
        )}

        {!canManage ? (
          <p className="rounded-control bg-canvas px-3 py-2.5 text-xs leading-relaxed text-muted">
            {t('Hanya Owner dan Admin yang dapat mengelola anggota.')}
          </p>
        ) : null}
      </div>
    </Card>
  )
}

const MEMBER_ROLE_ORDER: MemberRole[] = ['OWNER', 'ADMIN', 'STAFF', 'VIEWER']
