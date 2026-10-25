import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ArrowLeftRight, PackageMinus, PackagePlus, SearchX, SlidersHorizontal } from 'lucide-react'

import type { MovementType } from '@/types'
import { useMovements, useWarehouseData, type MovementKind } from '@/api/hooks'
import { DemoBadge } from '@/components/common/DemoBadge'
import { EmptyState } from '@/components/common/EmptyState'
import { MOVEMENT_TYPE_LABEL } from '@/lib/movement-meta'
import { PageHeader } from '@/components/common/PageHeader'
import { MovementForm } from '@/components/transactions/MovementForm'
import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import { SearchInput } from '@/components/ui/Input'
import { formatNumber, formatRelativeTime } from '@/lib/format'
import { useI18n } from '@/i18n'

type Tab = MovementType | 'ALL'

const TABS: { key: Tab; label: string; formKind?: MovementKind }[] = [
  { key: 'ALL', label: 'Semua' },
  { key: 'IN', label: 'Barang Masuk', formKind: 'stock-in' },
  { key: 'OUT', label: 'Barang Keluar', formKind: 'stock-out' },
  { key: 'TRANSFER', label: 'Transfer', formKind: 'transfer' },
  { key: 'ADJUSTMENT', label: 'Penyesuaian', formKind: 'adjustment' },
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

function movementQuantityClass(type: MovementType): string {
  if (type === 'IN') return 'text-success-fg'
  if (type === 'OUT') return 'text-danger-fg'
  if (type === 'ADJUSTMENT') return 'text-warning-fg'
  return 'text-primary'
}

export function TransactionsPage({ initialTab = 'ALL' }: { initialTab?: Tab }) {
  const { t } = useI18n()
  const [searchParams] = useSearchParams()
  const locationFilter = searchParams.get('loc')
  const [tab, setTab] = useState<Tab>(initialTab)
  const [query, setQuery] = useState('')

  const { locations } = useWarehouseData()
  const activeLocation = locationFilter
    ? locations.find((location) => location.code.toLowerCase() === locationFilter.toLowerCase())
    : undefined

  const movementsQuery = useMovements(
    tab !== 'ALL'
      ? { type: tab, locationId: activeLocation?.id }
      : { locationId: activeLocation?.id }
  )

  const rows = useMemo(() => {
    const movements = movementsQuery.data?.data ?? []
    const q = query.trim().toLowerCase()
    if (!q) return movements
    return movements.filter((movement) => {
      const haystack =
        `${movement.product.name} ${movement.product.sku} ${movement.reference ?? ''} ${movement.actor.name}`.toLowerCase()
      return haystack.includes(q)
    })
  }, [movementsQuery.data, query])

  const activeFormKind = TABS.find((item) => item.key === tab)?.formKind

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title={t('Transaksi')}
        subtitle={t(
          'Catat dan pantau pergerakan stok — barang masuk, keluar, transfer, dan penyesuaian.'
        )}
        meta={<DemoBadge />}
      />

      {locationFilter ? (
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted">{t('Difilter berdasarkan lokasi')}</span>
          <Badge tone="primary">{locationFilter.toUpperCase()}</Badge>
          <Link to="/transactions" className="text-xs font-bold text-primary hover:underline">
            {t('Hapus filter')}
          </Link>
        </div>
      ) : null}

      {activeFormKind ? <MovementForm kind={activeFormKind} /> : null}

      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-3">
          <div
            role="tablist"
            aria-label={t('Filter jenis transaksi')}
            className="flex flex-wrap items-center gap-1.5"
          >
            {TABS.map((item) => (
              <button
                key={item.key}
                type="button"
                role="tab"
                aria-selected={tab === item.key}
                onClick={() => setTab(item.key)}
                className={`rounded-full px-3.5 py-1.5 text-xs font-bold transition-colors ${
                  tab === item.key
                    ? 'bg-primary-soft text-primary'
                    : 'text-muted hover:bg-canvas hover:text-ink'
                }`}
              >
                {t(item.label)}
              </button>
            ))}
          </div>
          <SearchInput
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t('Cari produk, referensi, aktor…')}
            aria-label={t('Cari transaksi')}
            className="ml-auto min-w-[220px] w-full sm:w-64"
          />
        </div>

        {movementsQuery.isLoading ? (
          <p className="px-5 py-10 text-center text-sm font-semibold text-muted">
            {t('Memuat transaksi…')}
          </p>
        ) : movementsQuery.error ? (
          <div className="px-5 py-8 text-center">
            <p className="text-sm font-bold text-ink">{t('Gagal memuat transaksi')}</p>
            <p className="mt-1 text-xs leading-relaxed text-muted">
              {movementsQuery.error.message}
            </p>
            <button
              type="button"
              onClick={() => void movementsQuery.refetch()}
              className="mt-3 rounded-control bg-primary px-4 py-2 text-xs font-bold text-white hover:bg-primary-hover"
            >
              {t('Coba lagi')}
            </button>
          </div>
        ) : rows.length === 0 ? (
          <EmptyState
            icon={SearchX}
            title={t('Tidak ada transaksi yang cocok')}
            description={
              tab === 'ALL'
                ? t(
                    'Belum ada transaksi tercatat. Gunakan tab di atas untuk mencatat transaksi baru.'
                  )
                : `${t('Belum ada transaksi')} ${t(MOVEMENT_TYPE_LABEL[tab as MovementType])} — ${t('catat lewat formulir di atas.')}`
            }
          />
        ) : (
          <div className="overflow-x-auto scroll-slim">
            <table className="w-full min-w-[820px] text-left">
              <thead>
                <tr className="border-b border-line text-[11px] font-bold tracking-wide text-muted uppercase">
                  <th scope="col" className="px-4 py-3">
                    {t('Produk')}
                  </th>
                  <th scope="col" className="px-4 py-3">
                    {t('Jenis')}
                  </th>
                  <th scope="col" className="px-4 py-3">
                    {t('Dari → Ke')}
                  </th>
                  <th scope="col" className="px-4 py-3 text-right">
                    {t('Qty')}
                  </th>
                  <th scope="col" className="px-4 py-3">
                    {t('Referensi')}
                  </th>
                  <th scope="col" className="px-4 py-3">
                    {t('Aktor')}
                  </th>
                  <th scope="col" className="px-4 py-3 text-right">
                    {t('Waktu')}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line/70">
                {rows.map((movement) => {
                  const Icon = TYPE_ICON[movement.type]
                  const source = movement.sourceLocation
                  const destination = movement.destinationLocation
                  return (
                    <tr key={movement.id} className="transition-colors hover:bg-canvas/70">
                      <td className="max-w-[220px] px-4 py-3">
                        <Link
                          to={`/inventory/products/${movement.productId}`}
                          className="block truncate text-sm font-bold text-ink hover:text-primary"
                        >
                          {movement.product.name}
                        </Link>
                        <span className="block text-xs text-muted">{movement.product.sku}</span>
                      </td>
                      <td className="px-4 py-3">
                        <Badge tone={TYPE_TONE[movement.type]}>
                          <Icon aria-hidden className="h-3 w-3" />
                          {t(MOVEMENT_TYPE_LABEL[movement.type])}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-sm text-muted">
                        {source
                          ? `${source.code}${movement.sourceLevel ? ` L${movement.sourceLevel}` : ''}`
                          : '—'}{' '}
                        →{' '}
                        {destination
                          ? `${destination.code}${movement.destinationLevel ? ` L${movement.destinationLevel}` : ''}`
                          : '—'}
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
                      <td className="px-4 py-3 text-sm text-muted">{movement.actor.name}</td>
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
            {t('Menampilkan')} {formatNumber(rows.length)} {t('transaksi terbaru')}
            {tab !== 'ALL' ? ` (${t(MOVEMENT_TYPE_LABEL[tab as MovementType])})` : ''}.{' '}
            {t(
              'Setiap transaksi tersimpan permanen — koreksi dilakukan lewat penyesuaian, bukan menghapus riwayat.'
            )}
          </p>
        </div>
      </Card>
    </div>
  )
}
