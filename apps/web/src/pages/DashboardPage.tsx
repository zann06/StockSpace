import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeftRight, Package, PackagePlus, Wallet, AlertTriangle } from 'lucide-react'

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
import { inventoryValue, lowStockProducts, movementsToday, totalUnitsOnHand } from '@/lib/stats'
import { balances, demoMeta, movements, products } from '@/mocks/warehouse-data'

export function DashboardPage() {
  const navigate = useNavigate()
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(null)

  // All metrics are derived from the (mock) dataset — never hardcoded strings.
  const totalStock = totalUnitsOnHand(balances)
  const lowCount = lowStockProducts(products, balances).length
  const value = inventoryValue(products, balances)
  const todayCount = movementsToday(movements, new Date())

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-xl font-extrabold tracking-tight text-ink md:text-2xl">
              Selamat datang kembali, {demoMeta.currentUser.name.split(' ')[0]} 👋
            </h1>
            <DemoBadge />
          </div>
          <p className="mt-1 text-sm text-muted">
            Berikut ringkasan aktivitas gudang Anda hari ini.
          </p>
        </div>
        <Button onClick={() => navigate('/transactions/stock-in')}>
          <PackagePlus aria-hidden className="h-4 w-4" />
          Tambah Barang Masuk
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Total Stok"
          value={formatNumber(totalStock)}
          unit="unit"
          icon={Package}
          iconTone="primary"
          delta={demoMeta.kpiDeltas.totalStock}
        />
        <KpiCard
          label="Stok Menipis"
          value={formatNumber(lowCount)}
          unit="produk"
          icon={AlertTriangle}
          iconTone="danger"
          delta={demoMeta.kpiDeltas.lowStock}
        />
        <KpiCard
          label="Nilai Inventory"
          value={formatCompactCurrency(value)}
          title={`Nilai inventory = Σ(qty × harga pokok) = ${formatCurrency(value)}`}
          icon={Wallet}
          iconTone="success"
          delta={demoMeta.kpiDeltas.inventoryValue}
        />
        <KpiCard
          label="Transaksi Hari Ini"
          value={formatNumber(todayCount)}
          unit="transaksi"
          icon={ArrowLeftRight}
          iconTone="warning"
          delta={demoMeta.kpiDeltas.movementsToday}
        />
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <Card className="flex h-[460px] flex-col p-2 md:h-[520px]">
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
        <LowStockCard />
        <TopProductsCard />
        <MovementChartCard />
      </div>
    </div>
  )
}
