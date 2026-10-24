import { Link } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'

import type { DashboardTopMovedItem } from '@/api/types'
import { Card, CardHeader } from '@/components/ui/Card'
import { formatNumber } from '@/lib/format'

/** Most-moved products over the last 30 days (from the dashboard summary). */
export function TopProductsCard({ items }: { items: DashboardTopMovedItem[] }) {
  const max = items[0]?.moved ?? 1

  return (
    <Card className="flex flex-col">
      <CardHeader
        title="Produk Terlaris"
        subtitle="Unit bergerak — 30 hari terakhir"
        action={
          <Link
            to="/reports"
            className="flex items-center gap-0.5 text-xs font-bold text-primary hover:underline"
          >
            Lihat semua <ChevronRight aria-hidden className="h-3.5 w-3.5" />
          </Link>
        }
      />
      {items.length === 0 ? (
        <p className="flex flex-1 items-center justify-center px-5 py-8 text-xs text-muted">
          Belum ada pergerakan stok dalam 30 hari terakhir.
        </p>
      ) : (
        <ul className="flex flex-1 flex-col justify-center gap-4 px-5 py-4">
          {items.map((item, index) => (
            <li key={item.id} className="flex items-center gap-3">
              <span
                aria-hidden
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-xs font-extrabold text-primary"
              >
                {index + 1}
              </span>
              <div className="min-w-0 flex-1">
                <Link
                  to={`/inventory/products/${item.id}`}
                  className="block truncate text-sm font-semibold text-ink hover:text-primary"
                  title={item.name}
                >
                  {item.name}
                </Link>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-primary-soft">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${(item.moved / max) * 100}%` }}
                  />
                </div>
              </div>
              <span className="shrink-0 text-right">
                <span className="block text-sm font-bold text-ink">{formatNumber(item.moved)}</span>
                <span className="block text-[11px] text-muted">bergerak</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}
