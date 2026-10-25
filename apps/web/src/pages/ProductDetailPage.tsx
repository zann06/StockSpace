import { Link, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  ArrowLeftRight,
  PackageMinus,
  PackagePlus,
  SearchX,
  SlidersHorizontal,
} from 'lucide-react'

import type { MovementType } from '@/types'
import { useProduct } from '@/api/hooks'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card, CardHeader } from '@/components/ui/Card'
import { DemoBadge } from '@/components/common/DemoBadge'
import { EmptyState } from '@/components/common/EmptyState'
import { MOVEMENT_TYPE_LABEL } from '@/lib/movement-meta'
import { formatCurrency, formatNumber, formatRelativeTime } from '@/lib/format'
import { useI18n } from '@/i18n'

const TYPE_ICON: Record<MovementType, typeof PackagePlus> = {
  IN: PackagePlus,
  OUT: PackageMinus,
  TRANSFER: ArrowLeftRight,
  ADJUSTMENT: SlidersHorizontal,
}

export function ProductDetailPage() {
  const { t } = useI18n()
  const { id } = useParams<{ id: string }>()
  const productQuery = useProduct(id)

  if (productQuery.isLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <p className="text-sm font-semibold text-muted">{t('Memuat produk…')}</p>
      </div>
    )
  }

  const product = productQuery.data?.data

  if (productQuery.error || !product) {
    return (
      <Card>
        <EmptyState
          icon={SearchX}
          title={productQuery.error ? 'Gagal memuat produk' : 'Produk tidak ditemukan'}
          description={
            productQuery.error
              ? productQuery.error.message
              : 'Produk mungkin telah diarsipkan atau tautan tidak valid.'
          }
          action={
            productQuery.error ? (
              <Button size="sm" onClick={() => void productQuery.refetch()}>
                {t('Coba lagi')}
              </Button>
            ) : (
              <Link
                to="/inventory"
                className="inline-flex h-9 items-center rounded-control bg-primary px-4 text-sm font-semibold text-white hover:bg-primary-hover"
              >
                {t('Kembali ke Inventaris')}
              </Link>
            )
          }
        />
      </Card>
    )
  }

  const quantity = product.totalQuantity
  const low = quantity < product.reorderThreshold
  const stockValue = quantity * product.costPrice

  return (
    <div className="flex flex-col gap-5">
      <div>
        <Link
          to="/inventory"
          className="inline-flex items-center gap-1 text-xs font-bold text-muted hover:text-primary"
        >
          <ArrowLeft aria-hidden className="h-3.5 w-3.5" />
          {t('Kembali ke Inventaris')}
        </Link>
      </div>

      <Card className="p-5 md:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <span
              aria-hidden
              className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-soft text-lg font-extrabold text-primary"
            >
              {product.name.slice(0, 2).toUpperCase()}
            </span>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-extrabold tracking-tight text-ink md:text-2xl">
                  {product.name}
                </h1>
                <DemoBadge />
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <Badge tone="primary">{product.sku}</Badge>
                {product.category ? <Badge>{product.category.name}</Badge> : null}
                {product.active ? (
                  <Badge tone="success">{t('Aktif')}</Badge>
                ) : (
                  <Badge tone="neutral">{t('Nonaktif')}</Badge>
                )}
                {low ? <Badge tone="danger">{t('Stok Menipis')}</Badge> : null}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              disabled
              title="Penyuntingan produk dari UI tersedia mulai Fase 4 (butuh sesi & otorisasi)."
            >
              {t('Edit Produk')}
            </Button>
            <Link to="/transactions">
              <Button>
                <ArrowLeftRight aria-hidden className="h-4 w-4" />
                {t('Catat Pergerakan')}
              </Button>
            </Link>
          </div>
        </div>

        <dl className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <div className="rounded-card bg-canvas px-4 py-3">
            <dt className="text-[11px] font-semibold text-muted">{t('Total Stok')}</dt>
            <dd className={`mt-0.5 text-lg font-extrabold ${low ? 'text-danger-fg' : 'text-ink'}`}>
              {formatNumber(quantity)}{' '}
              <span className="text-xs font-semibold text-muted">{product.unit}</span>
            </dd>
          </div>
          <div className="rounded-card bg-canvas px-4 py-3">
            <dt className="text-[11px] font-semibold text-muted">{t('Nilai Stok')}</dt>
            <dd className="mt-0.5 text-lg font-extrabold text-ink">{formatCurrency(stockValue)}</dd>
          </div>
          <div className="rounded-card bg-canvas px-4 py-3">
            <dt className="text-[11px] font-semibold text-muted">{t('Ambang Pesan Ulang')}</dt>
            <dd className="mt-0.5 text-lg font-extrabold text-ink">
              {formatNumber(product.reorderThreshold)}
            </dd>
          </div>
          <div className="rounded-card bg-canvas px-4 py-3">
            <dt className="text-[11px] font-semibold text-muted">{t('Diperbarui')}</dt>
            <dd className="mt-0.5 text-sm font-extrabold text-ink">
              {formatRelativeTime(product.updatedAt)}
            </dd>
          </div>
        </dl>

        {product.description ? (
          <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted">{product.description}</p>
        ) : null}
        {product.barcode ? (
          <p className="mt-2 text-xs text-muted">
            {t('Barcode')}: <span className="font-semibold text-ink">{product.barcode}</span>
          </p>
        ) : null}
      </Card>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Card className="overflow-hidden">
          <CardHeader
            title={t('Stok per Lokasi')}
            subtitle={`${product.balances.length} lokasi menyimpan produk ini`}
          />
          {product.balances.length === 0 ? (
            <EmptyState
              icon={PackageMinus}
              title={t('Belum ada stok tersimpan')}
              description="Stok akan muncul di sini setelah barang masuk diterima di sebuah lokasi."
            />
          ) : (
            <ul className="divide-y divide-line/70">
              {product.balances.map((balance) => (
                <li key={balance.id} className="flex items-center gap-3 px-5 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-ink">{balance.location.label}</p>
                    <p className="text-xs text-muted">
                      {balance.location.code}
                      {balance.location.zone ? ` · ${balance.location.zone.name}` : ''}
                      {balance.level > 1 || product.balances.length > 0
                        ? ` · Level ${balance.level}`
                        : ''}
                    </p>
                  </div>
                  <span className="text-sm font-extrabold text-ink">
                    {formatNumber(balance.quantity)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="overflow-hidden">
          <CardHeader
            title={t('Riwayat Pergerakan')}
            subtitle="Transaksi terakhir untuk produk ini"
            action={
              <Link to="/transactions" className="text-xs font-bold text-primary hover:underline">
                {t('Lihat semua')}
              </Link>
            }
          />
          {product.movements.length === 0 ? (
            <EmptyState
              icon={PackageMinus}
              title={t('Belum ada pergerakan')}
              description="Transaksi barang masuk/keluar untuk produk ini akan tercatat di sini."
            />
          ) : (
            <ul className="divide-y divide-line/70">
              {product.movements.slice(0, 8).map((movement) => {
                const Icon = TYPE_ICON[movement.type]
                return (
                  <li key={movement.id} className="flex items-center gap-3 px-5 py-3">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-canvas">
                      <Icon aria-hidden className="h-4 w-4 text-muted" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-ink">
                        {t(MOVEMENT_TYPE_LABEL[movement.type])}
                        {movement.reference ? (
                          <span className="ml-2 font-mono text-xs font-semibold text-muted">
                            {movement.reference}
                          </span>
                        ) : null}
                      </p>
                      <p className="text-xs text-muted">
                        {formatRelativeTime(movement.createdAt)} · {movement.actor.name}
                      </p>
                    </div>
                    <span className="text-sm font-extrabold text-ink">
                      {movement.type === 'OUT'
                        ? '−'
                        : movement.type === 'ADJUSTMENT' && movement.quantity < 0
                          ? '−'
                          : movement.type === 'ADJUSTMENT'
                            ? '+'
                            : movement.type === 'IN'
                              ? '+'
                              : ''}
                      {formatNumber(Math.abs(movement.quantity))}
                    </span>
                  </li>
                )
              })}
            </ul>
          )}
        </Card>
      </div>
    </div>
  )
}
