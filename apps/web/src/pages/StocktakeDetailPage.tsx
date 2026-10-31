import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, CheckCircle2, XCircle } from 'lucide-react'

import {
  useCancelStocktake,
  useCommitStocktake,
  useStocktake,
  useUpdateStocktakeLine,
} from '@/api/features'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { useI18n } from '@/i18n'
import { formatNumber } from '@/lib/format'

const STATUS_BADGE = {
  OPEN: { tone: 'warning' as const, label: 'Berlangsung' },
  COMPLETED: { tone: 'success' as const, label: 'Selesai' },
  CANCELLED: { tone: 'neutral' as const, label: 'Dibatalkan' },
} as const

export function StocktakeDetailPage() {
  const { t } = useI18n()
  const { id } = useParams<{ id: string }>()
  const stocktakeQuery = useStocktake(id)
  const updateLine = useUpdateStocktakeLine(id ?? '')
  const commit = useCommitStocktake()
  const cancel = useCancelStocktake()
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [result, setResult] = useState<{ adjustments: number; skipped: number } | null>(null)

  const stocktake = stocktakeQuery.data?.data

  if (stocktakeQuery.isLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <p className="text-sm font-semibold text-muted">{t('Memuat…')}</p>
      </div>
    )
  }
  if (stocktakeQuery.error || !stocktake) {
    return (
      <Card className="p-8 text-center">
        <p className="text-sm font-bold text-ink">{t('Stock opname tidak ditemukan.')}</p>
        <Link
          to="/stocktakes"
          className="mt-3 inline-block text-xs font-bold text-primary hover:underline"
        >
          {t('Kembali')}
        </Link>
      </Card>
    )
  }

  const badge = STATUS_BADGE[stocktake.status]
  const open = stocktake.status === 'OPEN'
  const counted = stocktake.lines.filter((line) => line.countedQty !== null).length
  const differences = stocktake.lines.filter(
    (line) => line.countedQty !== null && line.countedQty !== line.expectedQty
  ).length

  const commitNow = () => {
    commit.mutate(stocktake.id, {
      onSuccess: (data) =>
        setResult({ adjustments: data.data.adjustments, skipped: data.data.skippedLines }),
    })
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <Link
          to="/stocktakes"
          className="inline-flex items-center gap-1 text-xs font-bold text-muted hover:text-primary"
        >
          <ArrowLeft aria-hidden className="h-3.5 w-3.5" />
          {t('Stock Opname')}
        </Link>
      </div>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-extrabold tracking-tight text-ink md:text-2xl">
              {stocktake.warehouse.name}
            </h1>
            <Badge tone={badge.tone}>{t(badge.label)}</Badge>
          </div>
          <p className="mt-1 text-sm text-muted">
            {t('Terhitung')} {formatNumber(counted)}/{formatNumber(stocktake.lines.length)}{' '}
            {t('baris hitung')}
            {differences > 0 ? ` · ${formatNumber(differences)} ${t('selisih')}` : ''}
            {stocktake.note ? ` · ${stocktake.note}` : ''}
          </p>
        </div>
        {open ? (
          <div className="flex gap-2">
            <Button
              onClick={commitNow}
              disabled={commit.isPending || counted === 0}
              title={
                counted === 0 ? t('Isi minimal satu baris hitung terlebih dahulu.') : undefined
              }
            >
              <CheckCircle2 aria-hidden className="h-4 w-4" />
              {commit.isPending ? t('Memproses…') : t('Selesaikan & Sesuaikan')}
            </Button>
            <Button
              variant="secondary"
              onClick={() => cancel.mutate(stocktake.id)}
              disabled={cancel.isPending}
            >
              <XCircle aria-hidden className="h-4 w-4" />
              {t('Batalkan')}
            </Button>
          </div>
        ) : null}
      </div>

      {result ? (
        <p className="rounded-control bg-success-soft px-4 py-3 text-sm font-semibold text-success-fg">
          {t('Penyesuaian dicatat:')} {formatNumber(result.adjustments)} · {t('baris dilewati')}:{' '}
          {formatNumber(result.skipped)}
        </p>
      ) : null}
      {commit.error ? (
        <p
          role="alert"
          className="rounded-control bg-danger-soft px-4 py-3 text-sm font-semibold text-danger-fg"
        >
          {commit.error.message}
        </p>
      ) : null}

      <Card className="overflow-hidden">
        <div className="overflow-x-auto scroll-slim">
          <table className="w-full min-w-[720px] text-left">
            <thead>
              <tr className="border-b border-line text-[11px] font-bold tracking-wide text-muted uppercase">
                <th scope="col" className="px-5 py-3">
                  {t('Produk')}
                </th>
                <th scope="col" className="px-5 py-3">
                  {t('Lokasi')}
                </th>
                <th scope="col" className="px-5 py-3 text-right">
                  {t('Tercatat')}
                </th>
                <th scope="col" className="px-5 py-3 text-right">
                  {t('Hitungan Fisik')}
                </th>
                <th scope="col" className="px-5 py-3 text-right">
                  {t('Selisih')}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line/70">
              {stocktake.lines.map((line) => {
                const countedQty = line.countedQty
                const diff = countedQty === null ? null : countedQty - line.expectedQty
                return (
                  <tr key={line.id} className="hover:bg-canvas/70">
                    <td className="px-5 py-3">
                      <p className="text-sm font-bold text-ink">{line.product.name}</p>
                      <p className="text-xs text-muted">{line.product.sku}</p>
                    </td>
                    <td className="px-5 py-3 text-sm text-muted">
                      {line.location.code}
                      {line.level > 1 ? ` · L${line.level}` : ''}
                    </td>
                    <td className="px-5 py-3 text-right text-sm font-bold text-ink">
                      {formatNumber(line.expectedQty)}
                    </td>
                    <td className="px-5 py-3 text-right">
                      {open ? (
                        <input
                          type="number"
                          min={0}
                          value={drafts[line.id] ?? (countedQty === null ? '' : String(countedQty))}
                          onChange={(event) =>
                            setDrafts((previous) => ({
                              ...previous,
                              [line.id]: event.target.value,
                            }))
                          }
                          onBlur={() => {
                            const raw = drafts[line.id]
                            if (raw === undefined) return
                            const parsed = raw.trim() === '' ? null : Number.parseInt(raw, 10)
                            const normalized =
                              parsed === null || Number.isNaN(parsed) ? null : Math.max(0, parsed)
                            if (normalized === countedQty) return
                            updateLine.mutate({ lineId: line.id, countedQty: normalized })
                          }}
                          className="h-9 w-24 rounded-control border border-line bg-surface px-2 text-right text-sm font-semibold text-ink"
                          aria-label={`${line.product.name} — ${t('Hitungan Fisik')}`}
                        />
                      ) : (
                        <span className="text-sm font-bold text-ink">
                          {countedQty === null ? '—' : formatNumber(countedQty)}
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-right">
                      {diff === null ? (
                        <span className="text-xs text-muted">—</span>
                      ) : diff === 0 ? (
                        <Badge tone="success">{t('Cocok')}</Badge>
                      ) : (
                        <span
                          className={`text-sm font-extrabold ${diff > 0 ? 'text-success-fg' : 'text-danger-fg'}`}
                        >
                          {diff > 0 ? '+' : '−'}
                          {formatNumber(Math.abs(diff))}
                        </span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <p className="text-xs leading-relaxed text-muted">
        {t(
          'Baris yang tidak diisi akan dilewati — stoknya tidak berubah saat penyesuaian dijalankan.'
        )}
      </p>
    </div>
  )
}
