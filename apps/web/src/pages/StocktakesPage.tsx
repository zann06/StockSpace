import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, ClipboardList, Plus } from 'lucide-react'

import { useCreateStocktake, useStocktakes } from '@/api/features'
import { useWarehouseData } from '@/api/hooks'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { useI18n } from '@/i18n'
import { formatNumber } from '@/lib/format'

const STATUS_BADGE = {
  OPEN: { tone: 'warning' as const, label: 'Berlangsung' },
  COMPLETED: { tone: 'success' as const, label: 'Selesai' },
  CANCELLED: { tone: 'neutral' as const, label: 'Dibatalkan' },
}

export function StocktakesPage() {
  const { t } = useI18n()
  const stocktakesQuery = useStocktakes()
  const { warehouse } = useWarehouseData()
  const createStocktake = useCreateStocktake()
  const [creating, setCreating] = useState(false)
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)

  const stocktakes = stocktakesQuery.data?.data ?? []

  const handleCreate = (event: FormEvent) => {
    event.preventDefault()
    setError(null)
    createStocktake.mutate(
      {
        warehouseId: warehouse.id || '00000000-0000-0000-0000-000000000000',
        note: note.trim() || null,
      },
      {
        onSuccess: (result) => {
          setCreating(false)
          setNote('')
          window.location.assign(`#/stocktakes/${result.data.id}`)
        },
        onError: (cause) =>
          setError(cause instanceof Error ? cause.message : 'Gagal membuat stock opname.'),
      }
    )
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-ink md:text-2xl">
            {t('Stock Opname')}
          </h1>
          <p className="mt-1 text-sm text-muted">
            {t('Hitung stok fisik per lokasi, lalu sistem membuat penyesuaian otomatis.')}
          </p>
        </div>
        <Button onClick={() => setCreating((value) => !value)}>
          <Plus aria-hidden className="h-4 w-4" />
          {t('Mulai Stock Opname')}
        </Button>
      </div>

      {creating ? (
        <Card className="p-5">
          <form className="flex flex-col gap-3" onSubmit={(event) => void handleCreate(event)}>
            <label className="flex flex-col gap-1.5 text-xs font-bold text-ink">
              {t('Catatan (opsional)')}
              <input
                type="text"
                value={note}
                onChange={(event) => setNote(event.target.value)}
                className="h-10 rounded-control border border-line bg-surface px-3 text-sm text-ink"
                placeholder={t('mis. Opname akhir bulan')}
              />
            </label>
            <p className="text-xs leading-relaxed text-muted">
              {t('Snapshot stok saat ini akan dibuat sebagai baris hitung untuk gudang aktif.')}
            </p>
            {error ? (
              <p
                role="alert"
                className="rounded-control bg-danger-soft px-3 py-2 text-xs font-semibold text-danger-fg"
              >
                {error}
              </p>
            ) : null}
            <div className="flex gap-2">
              <Button type="submit" disabled={createStocktake.isPending}>
                {createStocktake.isPending ? t('Memproses…') : t('Buat')}
              </Button>
              <Button variant="secondary" type="button" onClick={() => setCreating(false)}>
                {t('Batal')}
              </Button>
            </div>
          </form>
        </Card>
      ) : null}

      <Card className="overflow-hidden">
        {stocktakesQuery.isLoading ? (
          <p className="px-5 py-10 text-center text-sm font-semibold text-muted">{t('Memuat…')}</p>
        ) : stocktakesQuery.error ? (
          <p className="px-5 py-8 text-center text-xs leading-relaxed text-muted">
            {stocktakesQuery.error.message}
          </p>
        ) : stocktakes.length === 0 ? (
          <div className="flex flex-col items-center px-6 py-12 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-soft">
              <ClipboardList aria-hidden className="h-6 w-6 text-primary" />
            </span>
            <p className="mt-3 text-sm font-bold text-ink">{t('Belum ada stock opname')}</p>
            <p className="mt-1 max-w-sm text-xs leading-relaxed text-muted">
              {t('Mulai stock opname pertama untuk mencocokkan stok sistem dengan hitungan fisik.')}
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-line/70">
            {stocktakes.map((stocktake) => {
              const badge = STATUS_BADGE[stocktake.status]
              return (
                <li key={stocktake.id}>
                  <Link
                    to={`/stocktakes/${stocktake.id}`}
                    className="flex items-center gap-3 px-5 py-4 transition-colors hover:bg-canvas/70"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-2 text-sm font-bold text-ink">
                        {stocktake.warehouse.name}
                        <Badge tone={badge.tone}>{t(badge.label)}</Badge>
                      </p>
                      <p className="mt-0.5 text-xs text-muted">
                        {formatNumber(stocktake._count?.lines ?? 0)} {t('baris hitung')}
                        {stocktake.note ? ` · ${stocktake.note}` : ''}
                      </p>
                    </div>
                    <ArrowRight aria-hidden className="h-4 w-4 shrink-0 text-muted" />
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </Card>
    </div>
  )
}
