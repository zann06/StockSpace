import { Link } from 'react-router-dom'
import { AlertTriangle, Download, FileBarChart } from 'lucide-react'

import { useDashboardSummary, useMovements, useWarehouseData } from '@/api/hooks'
import { DemoBadge } from '@/components/common/DemoBadge'
import { PageHeader } from '@/components/common/PageHeader'
import { MovementChartCard } from '@/components/dashboard/MovementChartCard'
import { Card, CardHeader } from '@/components/ui/Card'
import { formatNumber } from '@/lib/format'
import { locationQuantity, locationStatus } from '@/lib/stats'

/** Reports — live low-stock and per-location utilization from persisted data.
 * CSV export and date-range filters arrive in Phase 4. */
export function ReportsPage() {
  const summaryQuery = useDashboardSummary()
  const { locations, balances, products, isLoading: layoutLoading } = useWarehouseData()
  const movementsQuery = useMovements({ perPage: 100 })

  const summary = summaryQuery.data?.data
  const movements = movementsQuery.data?.data ?? []
  const totalMovements = movementsQuery.data?.pagination.total ?? 0

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Laporan"
        subtitle="Analisis pergerakan stok, produk menipis, dan sebaran inventaris — dari data tersimpan."
        meta={<DemoBadge />}
        actions={
          <span className="flex items-center gap-1.5 rounded-control border border-dashed border-line px-3 py-2 text-xs font-semibold text-muted">
            <Download aria-hidden className="h-3.5 w-3.5" />
            Ekspor CSV — Fase 4
          </span>
        }
      />

      {summaryQuery.error ? (
        <Card className="p-5">
          <p className="text-sm font-bold text-ink">Gagal memuat laporan</p>
          <p className="mt-1 text-xs leading-relaxed text-muted">{summaryQuery.error.message}</p>
          <button
            type="button"
            onClick={() => void summaryQuery.refetch()}
            className="mt-3 rounded-control bg-primary px-4 py-2 text-xs font-bold text-white hover:bg-primary-hover"
          >
            Coba lagi
          </button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
          <Card className="overflow-hidden">
            <CardHeader
              title="Laporan Stok Menipis"
              subtitle={`${summary?.lowStock.length ?? 0} produk aktif di bawah ambang pesan ulang`}
            />
            <ul className="divide-y divide-line/70">
              {(summary?.lowStock ?? []).map((item) => {
                const ratio = item.reorderThreshold > 0 ? item.quantity / item.reorderThreshold : 1
                return (
                  <li key={item.id} className="flex items-center gap-3 px-5 py-3">
                    <AlertTriangle
                      aria-hidden
                      className={`h-4 w-4 shrink-0 ${ratio < 0.5 ? 'text-danger' : 'text-warning'}`}
                    />
                    <div className="min-w-0 flex-1">
                      <Link
                        to={`/inventory/products/${item.id}`}
                        className="block truncate text-sm font-bold text-ink hover:text-primary"
                      >
                        {item.name}
                      </Link>
                      <p className="text-xs text-muted">
                        Sisa {formatNumber(item.quantity)} · ambang{' '}
                        {formatNumber(item.reorderThreshold)}
                      </p>
                    </div>
                    <span
                      className={`text-sm font-extrabold ${ratio < 0.5 ? 'text-danger' : 'text-warning'}`}
                    >
                      {formatNumber(item.reorderThreshold - item.quantity)}
                    </span>
                  </li>
                )
              })}
              {(summary?.lowStock.length ?? 0) === 0 && !summaryQuery.isLoading ? (
                <li className="px-5 py-6 text-center text-xs text-muted">
                  Semua produk berada di atas ambang stok. 🎉
                </li>
              ) : null}
            </ul>
          </Card>

          <MovementChartCard series={summary?.movementSeries ?? []} />

          <Card className="overflow-hidden xl:col-span-2">
            <CardHeader
              title="Inventaris per Lokasi"
              subtitle="Sebaran kuantitas dan utilisasi kapasitas setiap lokasi"
            />
            {layoutLoading ? (
              <p className="px-5 py-8 text-center text-sm font-semibold text-muted">
                Memuat data lokasi…
              </p>
            ) : (
              <div className="overflow-x-auto scroll-slim">
                <table className="w-full min-w-[640px] text-left">
                  <thead>
                    <tr className="border-b border-line text-[11px] font-bold tracking-wide text-muted uppercase">
                      <th scope="col" className="px-5 py-3">
                        Lokasi
                      </th>
                      <th scope="col" className="px-5 py-3">
                        Zona
                      </th>
                      <th scope="col" className="px-5 py-3">
                        Status
                      </th>
                      <th scope="col" className="px-5 py-3 text-right">
                        Terisi
                      </th>
                      <th scope="col" className="px-5 py-3 text-right">
                        Kapasitas
                      </th>
                      <th scope="col" className="px-5 py-3">
                        Utilisasi
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line/70">
                    {locations.map((location) => {
                      const used = locationQuantity(location.id, balances)
                      const status = locationStatus(location, balances, products)
                      const ratio = location.capacity ? Math.min(1, used / location.capacity) : null
                      return (
                        <tr key={location.id} className="hover:bg-canvas/70">
                          <td className="px-5 py-3 text-sm font-bold text-ink">{location.label}</td>
                          <td className="px-5 py-3 text-sm text-muted">{location.zone}</td>
                          <td className="px-5 py-3">
                            <span
                              className={`text-xs font-bold ${
                                status === 'LOW'
                                  ? 'text-danger'
                                  : status === 'OCCUPIED'
                                    ? 'text-success'
                                    : 'text-muted'
                              }`}
                            >
                              {status === 'LOW'
                                ? 'Menipis'
                                : status === 'OCCUPIED'
                                  ? 'Terisi'
                                  : 'Kosong'}
                            </span>
                          </td>
                          <td className="px-5 py-3 text-right text-sm font-bold text-ink">
                            {formatNumber(used)}
                          </td>
                          <td className="px-5 py-3 text-right text-sm text-muted">
                            {location.capacity ? formatNumber(location.capacity) : '—'}
                          </td>
                          <td className="px-5 py-3">
                            {ratio === null ? (
                              <span className="text-xs text-muted">—</span>
                            ) : (
                              <div className="flex items-center gap-2">
                                <div className="h-1.5 w-28 overflow-hidden rounded-full bg-canvas">
                                  <div
                                    className={`h-full rounded-full ${ratio > 0.85 ? 'bg-warning' : 'bg-primary'}`}
                                    style={{ width: `${ratio * 100}%` }}
                                  />
                                </div>
                                <span className="text-xs font-semibold text-muted">
                                  {Math.round(ratio * 100)}%
                                </span>
                              </div>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      )}

      <Card className="border-dashed bg-transparent shadow-none">
        <div className="flex flex-col items-center gap-1 px-6 py-8 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-soft">
            <FileBarChart aria-hidden className="h-6 w-6 text-primary" />
          </span>
          <p className="mt-2 text-sm font-bold text-ink">
            Filter rentang tanggal, aktor, dan ekspor CSV — Fase 4
          </p>
          <p className="max-w-md text-xs leading-relaxed text-muted">
            Riwayat lengkap ({formatNumber(totalMovements)} transaksi tercatat) sudah tersimpan
            permanen di database — {movements.length} terbaru dapat dilihat di halaman{' '}
            <Link to="/transactions" className="font-bold text-primary hover:underline">
              Transaksi
            </Link>
            . Nilai inventory dihitung sebagai Σ(kuantitas × harga pokok) — lihat docs/database.md.
          </p>
        </div>
      </Card>
    </div>
  )
}
