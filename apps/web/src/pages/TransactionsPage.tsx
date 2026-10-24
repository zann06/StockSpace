import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  ArrowLeftRight,
  PackageMinus,
  PackagePlus,
  Plus,
  SearchX,
  SlidersHorizontal,
} from 'lucide-react'

import { DemoBadge } from '@/components/common/DemoBadge'
import { EmptyState } from '@/components/common/EmptyState'
import { MOVEMENT_TYPE_LABEL } from '@/lib/movement-meta'
import { PageHeader } from '@/components/common/PageHeader'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { SearchInput } from '@/components/ui/Input'
import { formatNumber, formatRelativeTime } from '@/lib/format'
import { locations, movements, products } from '@/mocks/warehouse-data'
import type { MovementType } from '@/types'

const TABS: { key: MovementType | 'ALL'; label: string }[] = [
  { key: 'ALL', label: 'Semua' },
  { key: 'IN', label: 'Barang Masuk' },
  { key: 'OUT', label: 'Barang Keluar' },
  { key: 'TRANSFER', label: 'Transfer' },
  { key: 'ADJUSTMENT', label: 'Penyesuaian' },
]

const TYPE_ICON: Record<MovementType, typeof PackagePlus> = {
  IN: PackagePlus,
  OUT: PackageMinus,
  TRANSFER: ArrowLeftRight,
  ADJUSTMENT: SlidersHorizontal,
}

const TYPE_TONE: Record<MovementType, 'success' | 'danger' | 'primary' | 'warning'> = {
  IN: 'success',
  OUT: 'danger',
  TRANSFER: 'primary',
  ADJUSTMENT: 'warning',
}

function quantityText(type: MovementType, quantity: number): string {
  if (type === 'ADJUSTMENT') return `${quantity > 0 ? '+' : '−'}${Math.abs(quantity)}`
  if (type === 'OUT') return `−${quantity}`
  if (type === 'TRANSFER') return `${quantity}`
  return `+${quantity}`
}

function locationLabel(id: string | null): string {
  if (!id) return '—'
  return locations.find((location) => location.id === id)?.code ?? '?'
}

function movementQuantityClass(type: MovementType): string {
  if (type === 'IN') return 'text-success'
  if (type === 'OUT') return 'text-danger'
  if (type === 'ADJUSTMENT') return 'text-warning'
  return 'text-primary'
}

export function TransactionsPage({ initialTab = 'ALL' }: { initialTab?: MovementType | 'ALL' }) {
  const [searchParams] = useSearchParams()
  const locationFilter = searchParams.get('loc')
  const [tab, setTab] = useState<MovementType | 'ALL'>(initialTab)
  const [query, setQuery] = useState('')

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase()
    const locCode = locationFilter?.toLowerCase()
    return movements
      .filter((movement) => {
        if (tab !== 'ALL' && movement.type !== tab) return false
        if (
          locCode &&
          movement.sourceLocationId !== locationFilter &&
          movement.destinationLocationId !== locationFilter
        )
          return false
        if (q) {
          const product = products.find((candidate) => candidate.id === movement.productId)
          const haystack =
            `${product?.name ?? ''} ${product?.sku ?? ''} ${movement.reference ?? ''} ${movement.actor}`.toLowerCase()
          if (!haystack.includes(q)) return false
        }
        return true
      })
      .slice(0, 60)
  }, [tab, query, locationFilter])

  const tabFromQuery = searchParams.get('tab') as MovementType | null
  const activeTab = tabFromQuery && TABS.some((t) => t.key === tabFromQuery) ? tabFromQuery : tab

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Transaksi"
        subtitle="Riwayat pergerakan stok — barang masuk, keluar, transfer, dan penyesuaian."
        meta={<DemoBadge />}
        actions={
          <>
            <Button
              disabled
              title="Formulir transaksi tersedia setelah API Fase 2 terhubung (stock-in/stock-out/transfer/adjustment)."
            >
              <Plus aria-hidden className="h-4 w-4" />
              Transaksi Baru
            </Button>
            <span className="hidden items-center gap-1.5 rounded-control border border-dashed border-line px-3 text-xs font-semibold text-muted sm:flex">
              Stock In · Stock Out · Transfer — Fase 2
            </span>
          </>
        }
      />

      {locationFilter ? (
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted">Difilter berdasarkan lokasi</span>
          <Badge tone="primary">{locationFilter.toUpperCase()}</Badge>
          <Link to="/transactions" className="text-xs font-bold text-primary hover:underline">
            Hapus filter
          </Link>
        </div>
      ) : null}

      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-3">
          <div
            role="tablist"
            aria-label="Filter jenis transaksi"
            className="flex flex-wrap items-center gap-1.5"
          >
            {TABS.map((item) => (
              <button
                key={item.key}
                type="button"
                role="tab"
                aria-selected={activeTab === item.key}
                onClick={() => setTab(item.key)}
                className={`rounded-full px-3.5 py-1.5 text-xs font-bold transition-colors ${
                  activeTab === item.key
                    ? 'bg-primary-soft text-primary'
                    : 'text-muted hover:bg-canvas hover:text-ink'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
          <SearchInput
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Cari produk, referensi, aktor…"
            aria-label="Cari transaksi"
            className="ml-auto min-w-[220px] w-full sm:w-64"
          />
        </div>

        {rows.length === 0 ? (
          <EmptyState
            icon={SearchX}
            title="Tidak ada transaksi yang cocok"
            description="Coba ubah filter jenis, kata kunci, atau hapus filter lokasi."
          />
        ) : (
          <div className="overflow-x-auto scroll-slim">
            <table className="w-full min-w-[820px] text-left">
              <thead>
                <tr className="border-b border-line text-[11px] font-bold tracking-wide text-muted uppercase">
                  <th scope="col" className="px-4 py-3">
                    Produk
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Jenis
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Dari → Ke
                  </th>
                  <th scope="col" className="px-4 py-3 text-right">
                    Qty
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Referensi
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Aktor
                  </th>
                  <th scope="col" className="px-4 py-3 text-right">
                    Waktu
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line/70">
                {rows.map((movement) => {
                  const product = products.find((candidate) => candidate.id === movement.productId)
                  const Icon = TYPE_ICON[movement.type]
                  return (
                    <tr key={movement.id} className="transition-colors hover:bg-canvas/70">
                      <td className="max-w-[220px] px-4 py-3">
                        <Link
                          to={`/inventory/products/${movement.productId}`}
                          className="block truncate text-sm font-bold text-ink hover:text-primary"
                        >
                          {product?.name ?? 'Produk'}
                        </Link>
                        <span className="block text-xs text-muted">{product?.sku}</span>
                      </td>
                      <td className="px-4 py-3">
                        <Badge tone={TYPE_TONE[movement.type]}>
                          <Icon aria-hidden className="h-3 w-3" />
                          {MOVEMENT_TYPE_LABEL[movement.type]}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-sm text-muted">
                        {locationLabel(movement.sourceLocationId)} →{' '}
                        {locationLabel(movement.destinationLocationId)}
                      </td>
                      <td
                        className={`px-4 py-3 text-right text-sm font-extrabold ${movementQuantityClass(movement.type)}`}
                      >
                        {quantityText(movement.type, movement.quantity)}
                      </td>
                      <td className="px-4 py-3">
                        {movement.reference ? (
                          <span className="font-mono text-xs font-semibold text-muted">
                            {movement.reference}
                          </span>
                        ) : (
                          <span className="text-xs text-muted">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-muted">{movement.actor}</td>
                      <td className="px-4 py-3 text-right text-xs text-muted">
                        {formatRelativeTime(movement.createdAt)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="border-t border-line px-4 py-3">
          <p className="text-xs text-muted">
            Menampilkan {formatNumber(rows.length)} dari {formatNumber(movements.length)} transaksi
            (data contoh). Pencatatan transaksi nyata tersedia setelah backend Fase 2 terhubung.
          </p>
        </div>
      </Card>
    </div>
  )
}
