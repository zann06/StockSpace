import { Link } from 'react-router-dom'
import { Compass } from 'lucide-react'

import { Card } from '@/components/ui/Card'

export function NotFoundPage() {
  return (
    <Card className="mx-auto mt-8 max-w-md">
      <div className="flex flex-col items-center px-6 py-12 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-soft">
          <Compass aria-hidden className="h-7 w-7 text-primary" />
        </span>
        <h1 className="mt-4 text-2xl font-extrabold text-ink">404</h1>
        <p className="mt-1 text-sm text-muted">
          Halaman yang Anda cari tidak ditemukan atau telah dipindahkan.
        </p>
        <Link
          to="/dashboard"
          className="mt-5 inline-flex h-10 items-center rounded-control bg-primary px-4 text-sm font-bold text-white hover:bg-primary-hover"
        >
          Kembali ke Dashboard
        </Link>
      </div>
    </Card>
  )
}
