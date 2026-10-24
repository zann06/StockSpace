import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'

import { apiFetch } from './client'
import type { WorkspaceSummary } from './types'

const STORAGE_KEY = 'stockspace.workspaceId'

interface WorkspaceContextValue {
  workspace: WorkspaceSummary | null
  workspaces: WorkspaceSummary[]
  /** True until the workspace list has been fetched (and one selected). */
  loading: boolean
  error: Error | null
  setWorkspaceId: (id: string) => void
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null)

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

  const value = useMemo<WorkspaceContextValue>(
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

export function useWorkspace(): WorkspaceContextValue {
  const context = useContext(WorkspaceContext)
  if (!context) throw new Error('useWorkspace must be used within WorkspaceProvider')
  return context
}
