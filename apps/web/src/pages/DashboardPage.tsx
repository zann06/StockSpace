import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, ArrowLeftRight, Package, PackagePlus, Wallet } from 'lucide-react'

import { useDashboardSummary } from '@/api/hooks'
import { useWorkspace } from '@/api/workspace-context'
import { DemoBadge } from '@/components/common/DemoBadge'
import { KpiCard } from '@/components/dashboard/KpiCard'
import { LowStockCard } from '@/components/dashboard/LowStockCard'
import { MovementChartCard } from '@/components/dashboard/MovementChartCard'
import { TopProductsCard } from '@/components/dashboard/TopProductsCard'
import { LocationDetailPanel } from '@/components/warehouse/LocationDetailPanel'
import { WarehouseView } from '@/components/warehouse/WarehouseView'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { formatCompactCurrency, formatCurrency, formatNumber } from '@/lib/format'
import { useI18n } from '@/i18n'

export function DashboardPage() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(null)
  const { workspace, loading: workspaceLoading, error: workspaceError } = useWorkspace()
  const summaryQuery = useDashboardSummary()

  if (workspaceError) {
    return (
      <Card className="mx-auto mt-8 max-w-lg p-8 text-center">
        <h1 className="text-lg font-extrabold text-ink">{t('Tidak dapat terhubung ke server')}</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted">{workspaceError.message}</p>
      </Card>
    )
  }

  if (workspaceLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <p className="text-sm font-semibold text-muted">{t('Memuat workspace…')}</p>
      </div>
    )
  }

  const summary = summaryQuery.data?.data
  const loading = summaryQuery.isLoading

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-xl font-extrabold tracking-tight text-ink md:text-2xl">
              {workspace ? workspace.name : t('Dashboard')}
            </h1>
            <DemoBadge />
          </div>
          <p className="mt-1 text-sm text-muted">
            {t('Berikut ringkasan aktivitas gudang Anda hari ini.')}
          </p>
        </div>
        <Button data-tour="stock-in-cta" onClick={() => navigate('/transactions/stock-in')}>
          <PackagePlus aria-hidden className="h-4 w-4" />
          {t('Tambah Barang Masuk')}
        </Button>
      </div>

      {summaryQuery.error ? (
        <Card className="p-5">
          <p className="text-sm font-bold text-ink">{t('Gagal memuat ringkasan dashboard')}</p>
          <p className="mt-1 text-xs leading-relaxed text-muted">{summaryQuery.error.message}</p>
          <button
            type="button"
            onClick={() => void summaryQuery.refetch()}
            className="mt-3 rounded-control bg-primary px-4 py-2 text-xs font-bold text-white hover:bg-primary-hover"
          >
            {t('Coba lagi')}
          </button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard
            label={t('Total Stok')}
            value={loading ? '…' : formatNumber(summary?.totalUnits ?? 0)}
            unit={t('unit')}
            icon={Package}
            iconTone="primary"
          />
          <KpiCard
            label={t('Stok Menipis')}
            value={loading ? '…' : formatNumber(summary?.lowStockCount ?? 0)}
            unit={t('produk')}
            icon={AlertTriangle}
            iconTone="danger"
          />
          <KpiCard
            label={t('Nilai Inventory')}
            value={loading ? '…' : formatCompactCurrency(summary?.inventoryValue ?? 0)}
            title={`${t('Nilai inventory = Σ(qty × harga pokok) =')} ${formatCurrency(summary?.inventoryValue ?? 0)}`}
            icon={Wallet}
            iconTone="success"
          />
          <KpiCard
            label={t('Transaksi Hari Ini')}
            value={loading ? '…' : formatNumber(summary?.movementsToday ?? 0)}
            unit={t('transaksi')}
            icon={ArrowLeftRight}
            iconTone="warning"
          />
        </div>
      )}

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <Card data-tour="warehouse-card" className="flex h-[460px] flex-col p-2 md:h-[520px]">
          <WarehouseView
            selectedLocationId={selectedLocationId}
            onSelect={setSelectedLocationId}
            className="flex-1"
          />
        </Card>
        <LocationDetailPanel
          locationId={selectedLocationId}
          onClose={() => setSelectedLocationId(null)}
          className="max-h-[520px] overflow-hidden"
        />
      </div>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
        <LowStockCard items={summary?.lowStock ?? []} />
        <TopProductsCard items={summary?.topMoved ?? []} />
        <MovementChartCard series={summary?.movementSeries ?? []} />
      </div>
    </div>
  )
}
