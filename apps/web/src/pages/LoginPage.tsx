import { useState, type FormEvent } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Boxes, LogIn } from 'lucide-react'

import { useSignIn } from '@/api/auth'

/** Email/password sign-in (better-auth). Demo credentials are shown in dev. */
export function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const signIn = useSignIn()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)

  const from = (location.state as { from?: string } | null)?.from ?? '/dashboard'

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setError(null)
    try {
      await signIn.mutateAsync({ email, password })
      navigate(from, { replace: true })
    } catch (cause) {
      setError(
        cause instanceof Error && cause.message
          ? cause.message
          : 'Gagal masuk — periksa email dan password Anda.'
      )
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas p-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary shadow-sm">
            <Boxes aria-hidden className="h-7 w-7 text-white" />
          </span>
          <div className="text-center">
            <h1 className="text-xl font-extrabold tracking-tight text-ink">StockSpace</h1>
            <p className="mt-0.5 text-sm text-muted">Masuk untuk mengelola inventaris Anda</p>
          </div>
        </div>

        <form
          onSubmit={(event) => void handleSubmit(event)}
          className="rounded-card border border-line bg-surface p-6 shadow-[0_1px_2px_rgba(21,27,74,0.04)]"
          noValidate
        >
          <label className="flex flex-col gap-1.5 text-xs font-bold text-ink">
            Email
            <input
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="h-10 w-full rounded-control border border-line bg-surface px-3 text-sm text-ink"
            />
          </label>
          <label className="mt-4 flex flex-col gap-1.5 text-xs font-bold text-ink">
            Password
            <input
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="h-10 w-full rounded-control border border-line bg-surface px-3 text-sm text-ink"
            />
          </label>

          {error ? (
            <p
              role="alert"
              className="mt-4 rounded-control bg-danger-soft px-3.5 py-2.5 text-xs font-semibold text-danger-fg"
            >
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={signIn.isPending}
            className="mt-5 flex h-10 w-full items-center justify-center gap-2 rounded-control bg-primary text-sm font-bold text-white hover:bg-primary-hover disabled:opacity-60"
          >
            <LogIn aria-hidden className="h-4 w-4" />
            {signIn.isPending ? 'Memproses…' : 'Masuk'}
          </button>
        </form>

        {import.meta.env.DEV ? (
          <div className="mt-4 rounded-card border border-dashed border-line bg-surface px-4 py-3 text-xs leading-relaxed text-muted">
            <p className="font-bold text-ink">Akun demo (development only)</p>
            <p className="mt-1">
              OWNER <code className="rounded bg-canvas px-1">farid@technusa.example</code> · STAFF{' '}
              <code className="rounded bg-canvas px-1">dewi@technusa.example</code> · VIEWER{' '}
              <code className="rounded bg-canvas px-1">viewer@technusa.example</code>
            </p>
            <p className="mt-1">
              Password: <code className="rounded bg-canvas px-1">stockspace-demo</code> (dari{' '}
              <code className="rounded bg-canvas px-1">npm run db:seed</code>)
            </p>
          </div>
        ) : null}
      </div>
    </div>
  )
}
