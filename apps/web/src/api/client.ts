import { env } from '@/lib/env'

/** Error thrown for non-2xx API responses; `message` is user-displayable. */
export class ApiError extends Error {
  readonly status: number
  readonly code: string

  constructor(status: number, code: string, message: string) {
    super(message)
    this.status = status
    this.code = code
  }
}

export interface ApiFetchOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE'
  body?: unknown
  /** Overrides the current workspace header; omit for workspace-less calls. */
  workspaceId?: string | null
  signal?: AbortSignal
}

/**
 * Thin fetch wrapper: JSON in/out, workspace header injection, readable
 * errors. `workspaceId: null` explicitly skips the header (e.g. /api/workspaces).
 */
export async function apiFetch<T>(path: string, options: ApiFetchOptions = {}): Promise<T> {
  const headers: Record<string, string> = { accept: 'application/json' }
  if (options.body !== undefined) headers['content-type'] = 'application/json'
  if (options.workspaceId !== null) {
    const workspaceId = options.workspaceId ?? currentWorkspaceId
    if (workspaceId) headers['x-workspace-id'] = workspaceId
  }

  let response: Response
  try {
    response = await fetch(`${env.VITE_API_URL}${path}`, {
      method: options.method ?? 'GET',
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      signal: options.signal,
      credentials: 'include',
    })
  } catch (cause) {
    if (cause instanceof DOMException && cause.name === 'AbortError') throw cause
    throw new ApiError(
      0,
      'NETWORK',
      'Tidak dapat terhubung ke server API. Pastikan API berjalan (npm run dev:api).'
    )
  }

  if (!response.ok) {
    let code = 'UNKNOWN'
    let message = `Permintaan gagal (${response.status}).`
    try {
      const payload = (await response.json()) as {
        error?: { code?: string; message?: string }
        code?: string
        message?: string
      }
      code = payload.error?.code ?? payload.code ?? code
      message = payload.error?.message ?? payload.message ?? message
    } catch {
      // non-JSON error body — keep the generic message
    }
    throw new ApiError(response.status, code, message)
  }

  if (response.status === 204) return undefined as T
  return (await response.json()) as T
}

/** Module-level workspace id, kept in sync by the WorkspaceProvider. */
let currentWorkspaceId: string | null = null

export function setCurrentWorkspaceId(id: string | null) {
  currentWorkspaceId = id
}
