import { Link } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'

import { Card, CardHeader } from '@/components/ui/Card'
import { formatNumber } from '@/lib/format'
import { topMovedProducts } from '@/lib/stats'
import { products } from '@/mocks/warehouse-data'

/** Most-moved products, ranked by all-time moved units (demo aggregate). */
export function TopProductsCard({ limit = 5 }: { limit?: number }) {
  const items = topMovedProducts(products, limit)
  const max = items[0]?.totalMoved ?? 1

  return (
    <Card className="flex flex-col">
      <CardHeader
        title="Produk Terlaris"
        subtitle="Berdasarkan total unit bergerak"
        action={
          <Link
            to="/reports"
            className="flex items-center gap-0.5 text-xs font-bold text-primary hover:underline"
          >
            Lihat semua <ChevronRight aria-hidden className="h-3.5 w-3.5" />
          </Link>
        }
      />
      <ul className="flex flex-1 flex-col justify-center gap-4 px-5 py-4">
        {items.map((product, index) => (
          <li key={product.id} className="flex items-center gap-3">
            <span
              aria-hidden
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-xs font-extrabold text-primary"
            >
              {index + 1}
            </span>
            <div className="min-w-0 flex-1">
              <Link
                to={`/inventory/products/${product.id}`}
                className="block truncate text-sm font-semibold text-ink hover:text-primary"
                title={product.name}
              >
                {product.name}
              </Link>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-primary-soft">
                <div
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${(product.totalMoved / max) * 100}%` }}
                />
              </div>
            </div>
            <span className="shrink-0 text-right">
              <span className="block text-sm font-bold text-ink">
                {formatNumber(product.totalMoved)}
              </span>
              <span className="block text-[11px] text-muted">terjual</span>
            </span>
          </li>
        ))}
      </ul>
    </Card>
  )
}
