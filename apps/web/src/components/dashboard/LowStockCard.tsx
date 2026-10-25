import { Link } from 'react-router-dom'
import { AlertTriangle, ChevronRight } from 'lucide-react'

import type { DashboardLowStockItem } from '@/api/types'
import { Card, CardHeader } from '@/components/ui/Card'
import { formatNumber } from '@/lib/format'
import { useI18n } from '@/i18n'

/** Low-stock summary — quantity vs reorder threshold with proportional bars. */
export function LowStockCard({ items }: { items: DashboardLowStockItem[] }) {
  const { t } = useI18n()
  return (
    <Card className="flex flex-col">
      <CardHeader
        title={t('Stok Minimum')}
        subtitle={`${items.length} ${t('produk di bawah ambang pesan ulang')}`}
        action={
          <Link
            to="/reports"
            className="flex items-center gap-0.5 text-xs font-bold text-primary hover:underline"
          >
            {t('Lihat semua')} <ChevronRight aria-hidden className="h-3.5 w-3.5" />
          </Link>
        }
      />
      {items.length === 0 ? (
        <p className="flex flex-1 items-center justify-center px-5 py-8 text-xs text-muted">
          {t('Semua produk berada di atas ambang stok.')}
        </p>
      ) : (
        <ul className="flex flex-1 flex-col justify-center gap-4 px-5 py-4">
          {items.map((item) => {
            const ratio = Math.max(0.04, item.quantity / item.reorderThreshold)
            const critical = ratio < 0.5
            return (
              <li key={item.id}>
                <div className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-2">
                    <AlertTriangle
                      aria-hidden
                      className={`h-3.5 w-3.5 shrink-0 ${critical ? 'text-danger-fg' : 'text-warning-fg'}`}
                    />
                    <Link
                      to={`/inventory/products/${item.id}`}
                      className="truncate text-sm font-semibold text-ink hover:text-primary"
                      title={item.name}
                    >
                      {item.name}
                    </Link>
                  </div>
                  <span
                    className={`shrink-0 text-xs font-bold ${critical ? 'text-danger-fg' : 'text-warning-fg'}`}
                  >
                    {formatNumber(item.quantity)}/{formatNumber(item.reorderThreshold)}
                  </span>
                </div>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-canvas">
                  <div
                    className={`h-full rounded-full ${critical ? 'bg-danger' : 'bg-warning'}`}
                    style={{ width: `${Math.min(100, ratio * 100)}%` }}
                  />
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </Card>
  )
}
