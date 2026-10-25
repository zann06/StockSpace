import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { apiFetch } from './client'

export interface SessionUser {
  id: string
  name: string
  email: string
  emailVerified: boolean
  image: string | null
}

type SessionResponse = {
  session: { id: string; expiresAt: string; userId: string }
  user: SessionUser
} | null

/** Current better-auth session (null when signed out). */
export function useSession() {
  return useQuery({
    queryKey: ['session'],
    queryFn: async () => {
      const data = await apiFetch<SessionResponse>('/api/auth/get-session', { workspaceId: null })
      return data
    },
    staleTime: 60_000,
    retry: false,
  })
}

/**
 * Email/password sign-in via better-auth.
 *
 * Seeds the session cache optimistically from the response: redirect guards
 * (`RequireAuth`/`GuestOnly`) read the cache synchronously, so invalidating
 * instead would briefly report "signed out" and bounce the user back to
 * /login before the refetch completes.
 */
export function useSignIn() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: { email: string; password: string }) =>
      apiFetch<{ user: SessionUser }>('/api/auth/sign-in/email', {
        method: 'POST',
        body: input,
        workspaceId: null,
      }),
    onSuccess: (result) => {
      queryClient.setQueryData(['session'], {
        session: {
          id: 'optimistic',
          expiresAt: new Date(Date.now() + 7 * 86_400_000).toISOString(),
          userId: result.user.id,
        },
        user: result.user,
      })
      void queryClient.invalidateQueries({ queryKey: ['workspaces'] })
    },
  })
}

/** Sign-out; clears every cached query. */
export function useSignOut() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => apiFetch('/api/auth/sign-out', { method: 'POST', workspaceId: null }),
    onSuccess: () => {
      queryClient.clear()
    },
  })
}
