import { createContext, useContext } from 'react'

import type { WorkspaceSummary } from './types'

export interface WorkspaceContextValue {
  workspace: WorkspaceSummary | null
  workspaces: WorkspaceSummary[]
  /** True until the workspace list has been fetched (and one selected). */
  loading: boolean
  error: Error | null
  setWorkspaceId: (id: string) => void
}

export const WorkspaceContext = createContext<WorkspaceContextValue | null>(null)

export function useWorkspace(): WorkspaceContextValue {
  const context = useContext(WorkspaceContext)
  if (!context) throw new Error('useWorkspace must be used within WorkspaceProvider')
  return context
}
