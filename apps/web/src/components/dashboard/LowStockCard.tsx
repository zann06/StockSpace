import { Link } from 'react-router-dom'
import { AlertTriangle, ChevronRight } from 'lucide-react'

import { Card, CardHeader } from '@/components/ui/Card'
import { formatNumber } from '@/lib/format'
import { lowStockProducts, quantityByProduct } from '@/lib/stats'
import { balances, products } from '@/mocks/warehouse-data'

/** Low-stock summary — quantity vs reorder threshold with proportional bars. */
export function LowStockCard({ limit = 6 }: { limit?: number }) {
  const quantities = quantityByProduct(balances)
  const items = lowStockProducts(products, balances).slice(0, limit)

  return (
    <Card className="flex flex-col">
      <CardHeader
        title="Stok Minimum"
        subtitle={`${items.length} produk di bawah ambang pesan ulang`}
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
          Semua produk berada di atas ambang stok. 🎉
        </p>
      ) : (
        <ul className="flex flex-1 flex-col justify-center gap-4 px-5 py-4">
          {items.map((product) => {
            const quantity = quantities.get(product.id) ?? 0
            const ratio = Math.max(0.04, quantity / product.reorderThreshold)
            const critical = ratio < 0.5
            return (
              <li key={product.id}>
                <div className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-2">
                    <AlertTriangle
                      aria-hidden
                      className={`h-3.5 w-3.5 shrink-0 ${critical ? 'text-danger' : 'text-warning'}`}
                    />
                    <Link
                      to={`/inventory/products/${product.id}`}
                      className="truncate text-sm font-semibold text-ink hover:text-primary"
                      title={product.name}
                    >
                      {product.name}
                    </Link>
                  </div>
                  <span
                    className={`shrink-0 text-xs font-bold ${critical ? 'text-danger' : 'text-warning'}`}
                  >
                    {formatNumber(quantity)}/{formatNumber(product.reorderThreshold)}
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
