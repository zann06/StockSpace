import { useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, ChevronLeft, ChevronRight, Download, FileBarChart } from 'lucide-react'

import {
  downloadReportCsv,
  useDashboardSummary,
  useLowStockReport,
  useMovementReport,
  useProductsList,
  useWarehouseData,
  type MovementReportParams,
} from '@/api/hooks'
import { DemoBadge } from '@/components/common/DemoBadge'
import { PageHeader } from '@/components/common/PageHeader'
import { MovementChartCard } from '@/components/dashboard/MovementChartCard'
import { Button } from '@/components/ui/Button'
import { Card, CardHeader } from '@/components/ui/Card'
import { formatCurrency, formatNumber, formatRelativeTime } from '@/lib/format'
import { useI18n } from '@/i18n'

type ReportType = 'ALL' | 'IN' | 'OUT' | 'TRANSFER' | 'ADJUSTMENT'

const REPORT_PAGE_SIZE = 50

/** Reports — low-stock, movement history with filters, and CSV export. */
export function ReportsPage() {
  const { t } = useI18n()
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [type, setType] = useState<ReportType>('ALL')
  const [productId, setProductId] = useState('')
  const [page, setPage] = useState(1)
  const [exportError, setExportError] = useState<string | null>(null)
  const [exporting, setExporting] = useState<string | null>(null)

  const summaryQuery = useDashboardSummary()
  const lowStockQuery = useLowStockReport()
  const productsQuery = useProductsList()
  const { isLoading: layoutLoading } = useWarehouseData()

  const params: MovementReportParams = {
    ...(from ? { from: new Date(`${from}T00:00:00`).toISOString() } : {}),
    ...(to ? { to: new Date(`${to}T23:59:59`).toISOString() } : {}),
    ...(type !== 'ALL' ? { type } : {}),
    ...(productId ? { productId } : {}),
    page,
    perPage: REPORT_PAGE_SIZE,
  }
  const movementsQuery = useMovementReport(params)
  const movements = movementsQuery.data?.data ?? []
  const totalMovements = movementsQuery.data?.pagination.total ?? 0
  const totalPages = Math.max(1, Math.ceil(totalMovements / REPORT_PAGE_SIZE))
  const showPagination = totalMovements > REPORT_PAGE_SIZE

  const exportCsv = async (report: 'low-stock' | 'movements') => {
    setExportError(null)
    setExporting(report)
    try {
      await downloadReportCsv(report, report === 'movements' ? params : {})
    } catch (error) {
      setExportError(error instanceof Error ? error.message : 'Ekspor gagal.')
    } finally {
      setExporting(null)
    }
  }

  const summary = summaryQuery.data?.data

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title={t('Laporan')}
        subtitle="Analisis pergerakan stok, produk menipis, dan sebaran inventaris — dari data tersimpan."
        meta={<DemoBadge />}
        actions={
          <>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => void exportCsv('low-stock')}
              disabled={exporting !== null || lowStockQuery.isLoading}
              title={t('Unduh laporan stok menipis sebagai CSV')}
            >
              <Download aria-hidden className="h-3.5 w-3.5" />
              {exporting === 'low-stock' ? 'Menyiapkan…' : 'CSV Stok Menipis'}
            </Button>
            <Button
              size="sm"
              onClick={() => void exportCsv('movements')}
              disabled={exporting !== null || movementsQuery.isLoading}
              title="Unduh laporan pergerakan (dengan filter aktif) sebagai CSV"
            >
              <Download aria-hidden className="h-3.5 w-3.5" />
              {exporting === 'movements' ? 'Menyiapkan…' : 'CSV Pergerakan'}
            </Button>
          </>
        }
      />

      {exportError ? (
        <p
          role="alert"
          className="rounded-control bg-danger-soft px-4 py-3 text-xs font-semibold text-danger-fg"
        >
          {exportError}
        </p>
      ) : null}

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <Card className="overflow-hidden">
          <CardHeader
            title={t('Laporan Stok Menipis')}
            subtitle={
              lowStockQuery.isLoading
                ? 'Memuat…'
                : `${lowStockQuery.data?.data.length ?? 0} produk aktif di bawah ambang pesan ulang`
            }
          />
          {lowStockQuery.error ? (
            <p className="px-5 py-6 text-xs leading-relaxed text-muted">
              {lowStockQuery.error.message}
            </p>
          ) : (
            <div className="max-h-96 overflow-y-auto scroll-slim">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-line text-[11px] font-bold tracking-wide text-muted uppercase">
                    <th scope="col" className="px-5 py-2.5">
                      Produk
                    </th>
                    <th scope="col" className="px-5 py-2.5 text-right">
                      Stok
                    </th>
                    <th scope="col" className="px-5 py-2.5 text-right">
                      Kekurangan
                    </th>
                    <th scope="col" className="px-5 py-2.5 text-right">
                      {t('Nilai Stok')}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line/70">
                  {(lowStockQuery.data?.data ?? []).map((item) => (
                    <tr key={item.id} className="hover:bg-canvas/70">
                      <td className="px-5 py-2.5">
                        <Link
                          to={`/inventory/products/${item.id}`}
                          className="block truncate text-sm font-bold text-ink hover:text-primary"
                        >
                          {item.name}
                        </Link>
                        <span className="text-xs text-muted">
                          {item.sku}
                          {item.category ? ` · ${item.category}` : ''}
                        </span>
                      </td>
                      <td className="px-5 py-2.5 text-right text-sm font-bold text-ink">
                        {formatNumber(item.quantity)}/{formatNumber(item.reorderThreshold)}
                      </td>
                      <td className="px-5 py-2.5 text-right text-sm font-extrabold text-danger-fg">
                        {formatNumber(item.shortfall)}
                      </td>
                      <td className="px-5 py-2.5 text-right text-xs text-muted">
                        {formatCurrency(item.stockValue)}
                      </td>
                    </tr>
                  ))}
                  {!lowStockQuery.isLoading && (lowStockQuery.data?.data.length ?? 0) === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-5 py-6 text-center text-xs text-muted">
                        {t('Semua produk berada di atas ambang stok.')}
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <MovementChartCard series={summary?.movementSeries ?? []} />

        <Card className="overflow-hidden xl:col-span-2">
          <CardHeader
            title={t('Laporan Pergerakan Stok')}
            subtitle={`${formatNumber(movementsQuery.data?.pagination.total ?? 0)} transaksi cocok dengan filter`}
          />
          <div className="flex flex-wrap items-end gap-2.5 border-b border-line px-5 py-3">
            <label className="flex flex-col gap-1 text-xs font-bold text-ink">
              Dari
              <input
                type="date"
                value={from}
                onChange={(event) => {
                  setFrom(event.target.value)
                  setPage(1)
                }}
                className="h-9 rounded-control border border-line bg-surface px-2.5 text-sm font-semibold text-ink"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs font-bold text-ink">
              {t('Sampai')}
              <input
                type="date"
                value={to}
                onChange={(event) => {
                  setTo(event.target.value)
                  setPage(1)
                }}
                className="h-9 rounded-control border border-line bg-surface px-2.5 text-sm font-semibold text-ink"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs font-bold text-ink">
              {t('Jenis')}
              <select
                value={type}
                onChange={(event) => {
                  setType(event.target.value as ReportType)
                  setPage(1)
                }}
                className="h-9 rounded-control border border-line bg-surface px-2.5 text-sm font-semibold text-ink"
              >
                <option value="ALL">{t('Semua')}</option>
                <option value="IN">{t('Masuk')}</option>
                <option value="OUT">{t('Keluar')}</option>
                <option value="TRANSFER">{t('Transfer')}</option>
                <option value="ADJUSTMENT">{t('Penyesuaian')}</option>
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs font-bold text-ink">
              Produk
              <select
                value={productId}
                onChange={(event) => {
                  setProductId(event.target.value)
                  setPage(1)
                }}
                className="h-9 max-w-52 rounded-control border border-line bg-surface px-2.5 text-sm font-semibold text-ink"
              >
                <option value="">{t('Semua produk')}</option>
                {(productsQuery.data?.data ?? []).map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.name}
                  </option>
                ))}
              </select>
            </label>
            {(from || to || type !== 'ALL' || productId) && (
              <button
                type="button"
                onClick={() => {
                  setFrom('')
                  setTo('')
                  setType('ALL')
                  setProductId('')
                  setPage(1)
                }}
                className="h-9 rounded-control px-3 text-xs font-bold text-primary hover:bg-primary-soft"
              >
                {t('Reset filter')}
              </button>
            )}
          </div>

          {movementsQuery.isLoading ? (
            <p className="px-5 py-8 text-center text-sm font-semibold text-muted">
              {t('Memuat laporan…')}
            </p>
          ) : movementsQuery.error ? (
            <p className="px-5 py-8 text-center text-xs leading-relaxed text-muted">
              {movementsQuery.error.message}
            </p>
          ) : movements.length === 0 ? (
            <p className="px-5 py-8 text-center text-xs text-muted">
              {t('Tidak ada transaksi yang cocok dengan filter.')}
            </p>
          ) : (
            <div className="max-h-96 overflow-auto scroll-slim">
              <table className="w-full min-w-[760px] text-left">
                <thead>
                  <tr className="border-b border-line text-[11px] font-bold tracking-wide text-muted uppercase">
                    <th scope="col" className="px-5 py-2.5">
                      Waktu
                    </th>
                    <th scope="col" className="px-5 py-2.5">
                      Produk
                    </th>
                    <th scope="col" className="px-5 py-2.5">
                      {t('Jenis')}
                    </th>
                    <th scope="col" className="px-5 py-2.5">
                      {t('Dari → Ke')}
                    </th>
                    <th scope="col" className="px-5 py-2.5 text-right">
                      Qty
                    </th>
                    <th scope="col" className="px-5 py-2.5">
                      {t('Aktor')}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line/70">
                  {movements.map((movement) => (
                    <tr key={movement.id} className="hover:bg-canvas/70">
                      <td className="px-5 py-2.5 text-xs text-muted">
                        {formatRelativeTime(movement.createdAt)}
                      </td>
                      <td className="max-w-[220px] px-5 py-2.5">
                        <span className="block truncate text-sm font-bold text-ink">
                          {movement.product.name}
                        </span>
                        <span className="text-xs text-muted">{movement.product.sku}</span>
                      </td>
                      <td className="px-5 py-2.5 text-xs font-bold text-muted">
                        {movement.type === 'IN'
                          ? 'Masuk'
                          : movement.type === 'OUT'
                            ? 'Keluar'
                            : movement.type === 'TRANSFER'
                              ? 'Transfer'
                              : 'Penyesuaian'}
                      </td>
                      <td className="px-5 py-2.5 text-xs text-muted">
                        {movement.sourceLocation?.code ?? '—'} →{' '}
                        {movement.destinationLocation?.code ?? '—'}
                      </td>
                      <td
                        className={`px-5 py-2.5 text-right text-sm font-extrabold ${
                          movement.type === 'IN'
                            ? 'text-success-fg'
                            : movement.type === 'OUT'
                              ? 'text-danger-fg'
                              : movement.type === 'ADJUSTMENT'
                                ? 'text-warning-fg'
                                : 'text-primary'
                        }`}
                      >
                        {movement.type === 'ADJUSTMENT'
                          ? `${movement.quantity > 0 ? '+' : '−'}${Math.abs(movement.quantity)}`
                          : movement.type === 'OUT'
                            ? `−${movement.quantity}`
                            : movement.type === 'IN'
                              ? `+${movement.quantity}`
                              : movement.quantity}
                      </td>
                      <td className="px-5 py-2.5 text-xs text-muted">{movement.actor.name}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {showPagination ? (
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-5 py-3">
              <span className="text-[11px] font-semibold text-muted">
                {t('Halaman {page} dari {total}', {
                  page: Math.min(page, totalPages),
                  total: totalPages,
                })}
              </span>
              <div className="flex items-center gap-1.5">
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={page <= 1 || movementsQuery.isFetching}
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                  aria-label={t('Halaman sebelumnya')}
                  title={t('Halaman sebelumnya')}
                >
                  <ChevronLeft aria-hidden className="h-3.5 w-3.5" />
                  {t('Sebelumnya')}
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={page >= totalPages || movementsQuery.isFetching}
                  onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                  aria-label={t('Halaman berikutnya')}
                  title={t('Halaman berikutnya')}
                >
                  {t('Berikutnya')}
                  <ChevronRight aria-hidden className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ) : null}
        </Card>
      </div>

      <Card className="border-dashed bg-transparent shadow-none">
        <div className="flex flex-col items-center gap-1 px-6 py-8 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-soft">
            <FileBarChart aria-hidden className="h-6 w-6 text-primary" />
          </span>
          <p className="mt-2 flex items-center gap-1.5 text-sm font-bold text-ink">
            <AlertTriangle aria-hidden className="h-4 w-4 text-warning-fg" />
            Nilai stok = Σ(kuantitas × harga pokok) — perhitungan didokumentasikan di
            docs/database.md
          </p>
          <p className="max-w-md text-xs leading-relaxed text-muted">
            Laporan memuat hingga 50 transaksi per halaman{' '}
            {layoutLoading ? '' : 'dan seluruh produk menipis'}; ekspor CSV mengunduh hingga 5.000
            baris dengan filter yang sedang aktif.
          </p>
        </div>
      </Card>
    </div>
  )
}
