import { useMemo, useState, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'

import { apiFetch } from './client'
import { WorkspaceContext } from './workspace-context'
import type { WorkspaceSummary } from './types'

const STORAGE_KEY = 'stockspace.workspaceId'

/**
 * Resolves which workspace the app operates on. Until authentication lands
 * (Phase 4) this picks the stored workspace or the first one from
 * `GET /api/workspaces`.
 */
export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [preferredId, setPreferredId] = useState<string | null>(() => {
    try {
      return localStorage.getItem(STORAGE_KEY)
    } catch {
      return null
    }
  })

  const listQuery = useQuery({
    queryKey: ['workspaces'],
    queryFn: () => apiFetch<{ data: WorkspaceSummary[] }>('/api/workspaces', { workspaceId: null }),
    retry: 1,
  })

  const workspaces = useMemo(() => listQuery.data?.data ?? [], [listQuery.data])
  const workspace = useMemo(
    () => workspaces.find((item) => item.id === preferredId) ?? workspaces[0] ?? null,
    [workspaces, preferredId]
  )

  const setWorkspaceId = (id: string) => {
    setPreferredId(id)
    try {
      localStorage.setItem(STORAGE_KEY, id)
    } catch {
      // storage unavailable (private mode) — selection lives in memory only
    }
  }

  const value = useMemo<import('./workspace-context').WorkspaceContextValue>(
    () => ({
      workspace,
      workspaces,
      loading: listQuery.isLoading,
      error: listQuery.error,
      setWorkspaceId,
    }),
    [workspace, workspaces, listQuery.isLoading, listQuery.error]
  )

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>
}
