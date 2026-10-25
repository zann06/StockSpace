import { Component, type ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  error: Error | null
}

/**
 * Last-resort boundary around the whole app: an unexpected render crash must
 * never leave a blank page — the user gets a readable recovery screen
 * (PRD UX rules: explicit error states everywhere).
 */
export class AppErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    console.error('App crashed:', error, info.componentStack)
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-canvas p-6 text-center">
          <h1 className="text-lg font-extrabold text-ink">Terjadi kesalahan tak terduga</h1>
          <p className="mt-2 max-w-md text-sm leading-relaxed text-muted">
            {this.state.error.message || 'Terjadi kesalahan internal pada aplikasi.'}
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-5 rounded-control bg-primary px-4 py-2 text-sm font-bold text-white hover:bg-primary-hover"
          >
            Muat ulang halaman
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
