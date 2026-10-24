import { useState, type FormEvent } from 'react'
import { CheckCircle2, XCircle } from 'lucide-react'
import { z } from 'zod'

import type { MovementKind } from '@/api/hooks'
import { useCreateMovement, useProductsList, useWarehouseData } from '@/api/hooks'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { formatNumber } from '@/lib/format'

/**
 * Stock movement form (stock-in / stock-out / transfer / adjustment).
 * Controlled components + Zod validation on submit — see docs/architecture.md
 * decision D9 for why react-hook-form is not used yet.
 */

const KIND_META: Record<
  MovementKind,
  {
    title: string
    description: string
    submitLabel: string
    needsSource: boolean
    needsDestination: boolean
    needsReason: boolean
  }
> = {
  'stock-in': {
    title: 'Barang Masuk',
    description: 'Terima stok dari pemasok ke lokasi penyimpanan.',
    submitLabel: 'Catat Barang Masuk',
    needsSource: false,
    needsDestination: true,
    needsReason: false,
  },
  'stock-out': {
    title: 'Barang Keluar',
    description: 'Keluarkan stok dari lokasi penyimpanan (penjualan/pemakaian).',
    submitLabel: 'Catat Barang Keluar',
    needsSource: true,
    needsDestination: false,
    needsReason: false,
  },
  transfer: {
    title: 'Transfer Stok',
    description: 'Pindahkan stok antar lokasi/level — jumlah tetap terjaga.',
    submitLabel: 'Catat Transfer',
    needsSource: true,
    needsDestination: true,
    needsReason: false,
  },
  adjustment: {
    title: 'Penyesuaian Stok',
    description: 'Koreksi stok (stock opname, kerusakan) — wajib menyertakan alasan.',
    submitLabel: 'Catat Penyesuaian',
    needsSource: true,
    needsDestination: false,
    needsReason: true,
  },
}

interface FormState {
  productId: string
  quantity: string
  sourceLocationId: string
  sourceLevel: string
  destinationLocationId: string
  destinationLevel: string
  reference: string
  note: string
}

const EMPTY_STATE: FormState = {
  productId: '',
  quantity: '',
  sourceLocationId: '',
  sourceLevel: '1',
  destinationLocationId: '',
  destinationLevel: '1',
  reference: '',
  note: '',
}

export function MovementForm({ kind }: { kind: MovementKind }) {
  const meta = KIND_META[kind]
  const [form, setForm] = useState<FormState>(EMPTY_STATE)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [success, setSuccess] = useState<string | null>(null)
  const [failure, setFailure] = useState<string | null>(null)

  const productsQuery = useProductsList()
  const { locations, balances } = useWarehouseData()
  const mutation = useCreateMovement(kind)

  const products = productsQuery.data?.data ?? []
  const selectedProduct = products.find((product) => product.id === form.productId)

  const locationById = new Map(locations.map((location) => [location.id, location]))
  const balanceAt = (locationId: string, level: number) =>
    balances.find(
      (balance) =>
        balance.locationId === locationId &&
        balance.level === level &&
        balance.productId === form.productId
    )?.quantity

  const schema = z.object({
    // Required-ness is enforced here; format (UUID) is the API's job.
    productId: z.string().min(1, 'Pilih produk terlebih dahulu.'),
    quantity: z.coerce
      .number({ message: 'Jumlah harus berupa angka.' })
      .int('Jumlah harus bilangan bulat.')
      .refine(
        (value) => (kind === 'adjustment' ? value !== 0 : value > 0),
        kind === 'adjustment' ? 'Penyesuaian tidak boleh 0.' : 'Jumlah harus lebih dari 0.'
      ),
    sourceLocationId: meta.needsSource ? z.string().min(1, 'Pilih lokasi sumber.') : z.literal(''),
    destinationLocationId: meta.needsDestination
      ? z.string().min(1, 'Pilih lokasi tujuan.')
      : z.literal(''),
    sourceLevel: z.string(),
    destinationLevel: z.string(),
    reference: z.string().trim().max(64).optional(),
    note: meta.needsReason
      ? z.string().trim().min(3, 'Alasan penyesuaian wajib diisi (min. 3 karakter).')
      : z.string().trim().max(1000).optional(),
  })

  const setField = (field: keyof FormState, value: string) => {
    setForm((previous) => ({ ...previous, [field]: value }))
    setFieldErrors((previous) => ({ ...previous, [field]: '' }))
    setSuccess(null)
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setFailure(null)
    setSuccess(null)

    const parsed = schema.safeParse(form)
    if (!parsed.success) {
      const errors: Record<string, string> = {}
      for (const issue of parsed.error.issues) {
        const field = String(issue.path[0] ?? '')
        if (field && !errors[field]) errors[field] = issue.message
      }
      setFieldErrors(errors)
      return
    }

    const sourceLocation = form.sourceLocationId
      ? locationById.get(form.sourceLocationId)
      : undefined
    const destinationLocation = form.destinationLocationId
      ? locationById.get(form.destinationLocationId)
      : undefined
    if (
      kind === 'transfer' &&
      sourceLocation &&
      destinationLocation &&
      sourceLocation.id === destinationLocation.id &&
      form.sourceLevel === form.destinationLevel
    ) {
      setFieldErrors({
        destinationLocationId: 'Tujuan tidak boleh sama dengan sumber (lokasi & level).',
      })
      return
    }

    try {
      const result = await mutation.mutateAsync({
        productId: form.productId,
        quantity: parsed.data.quantity,
        sourceLocationId: meta.needsSource ? form.sourceLocationId : null,
        destinationLocationId: meta.needsDestination ? form.destinationLocationId : null,
        sourceLevel: meta.needsSource ? Number(form.sourceLevel) : null,
        destinationLevel: meta.needsDestination ? Number(form.destinationLevel) : null,
        reference: form.reference.trim() || null,
        note: form.note.trim() || null,
      })
      setSuccess(
        `Transaksi berhasil dicatat${result.data.reference ? ` (ref: ${result.data.reference})` : ''}. Saldo dan riwayat telah diperbarui.`
      )
      setForm((previous) => ({ ...previous, quantity: '', reference: '', note: '' }))
    } catch (error) {
      setFailure(error instanceof Error ? error.message : 'Transaksi gagal dicatat.')
    }
  }

  const inputClass = (field: string) =>
    `h-10 w-full rounded-control border bg-surface px-3 text-sm text-ink ${
      fieldErrors[field] ? 'border-danger' : 'border-line'
    }`

  return (
    <Card className="p-5">
      <h2 className="text-sm font-bold text-ink">{meta.title}</h2>
      <p className="mt-0.5 text-xs text-muted">{meta.description}</p>

      <form
        className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2"
        onSubmit={(event) => void handleSubmit(event)}
        noValidate
      >
        {/* Product */}
        <div className="md:col-span-2">
          <label className="flex flex-col gap-1.5 text-xs font-bold text-ink">
            Produk <span className="text-danger">*</span>
            <select
              value={form.productId}
              onChange={(event) => setField('productId', event.target.value)}
              className={inputClass('productId')}
              aria-invalid={!!fieldErrors.productId}
            >
              <option value="">— Pilih produk —</option>
              {products.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.name} ({product.sku}) — stok {formatNumber(product.totalQuantity)}
                </option>
              ))}
            </select>
          </label>
          {fieldErrors.productId ? (
            <p className="mt-1 text-xs font-semibold text-danger">{fieldErrors.productId}</p>
          ) : null}
        </div>

        {/* Source location */}
        {meta.needsSource ? (
          <LocationPicker
            label="Lokasi Sumber"
            required
            value={form.sourceLocationId}
            levelValue={form.sourceLevel}
            locations={locations}
            onValueChange={(value) => setField('sourceLocationId', value)}
            onLevelChange={(value) => setField('sourceLevel', value)}
            balanceHint={
              selectedProduct && form.sourceLocationId
                ? `Stok produk ini di sini: ${formatNumber(
                    balanceAt(form.sourceLocationId, Number(form.sourceLevel)) ?? 0
                  )} ${selectedProduct.unit}`
                : null
            }
            error={fieldErrors.sourceLocationId}
          />
        ) : null}

        {/* Destination location */}
        {meta.needsDestination ? (
          <LocationPicker
            label="Lokasi Tujuan"
            required
            value={form.destinationLocationId}
            levelValue={form.destinationLevel}
            locations={locations}
            onValueChange={(value) => setField('destinationLocationId', value)}
            onLevelChange={(value) => setField('destinationLevel', value)}
            balanceHint={
              selectedProduct && form.destinationLocationId
                ? `Stok produk ini di sini: ${formatNumber(
                    balanceAt(form.destinationLocationId, Number(form.destinationLevel)) ?? 0
                  )} ${selectedProduct.unit}`
                : null
            }
            error={fieldErrors.destinationLocationId}
          />
        ) : null}

        {/* Quantity */}
        <div>
          <label className="flex flex-col gap-1.5 text-xs font-bold text-ink">
            Jumlah {kind === 'adjustment' ? '(± untuk koreksi)' : ''}{' '}
            <span className="text-danger">*</span>
            <input
              type="number"
              value={form.quantity}
              onChange={(event) => setField('quantity', event.target.value)}
              className={inputClass('quantity')}
              placeholder={kind === 'adjustment' ? 'mis. -2 atau 5' : 'mis. 10'}
              aria-invalid={!!fieldErrors.quantity}
            />
          </label>
          {fieldErrors.quantity ? (
            <p className="mt-1 text-xs font-semibold text-danger">{fieldErrors.quantity}</p>
          ) : null}
        </div>

        {/* Reference */}
        <div>
          <label className="flex flex-col gap-1.5 text-xs font-bold text-ink">
            Referensi (opsional)
            <input
              type="text"
              value={form.reference}
              onChange={(event) => setField('reference', event.target.value)}
              className={inputClass('reference')}
              placeholder="mis. PO-2026-120"
            />
          </label>
        </div>

        {/* Note / reason */}
        <div className="md:col-span-2">
          <label className="flex flex-col gap-1.5 text-xs font-bold text-ink">
            {meta.needsReason ? 'Alasan Penyesuaian' : 'Catatan (opsional)'}
            {meta.needsReason ? <span className="text-danger">*</span> : null}
            <textarea
              value={form.note}
              onChange={(event) => setField('note', event.target.value)}
              rows={2}
              className={`w-full rounded-control border bg-surface px-3 py-2 text-sm text-ink ${
                fieldErrors.note ? 'border-danger' : 'border-line'
              }`}
              placeholder={
                meta.needsReason
                  ? 'mis. Hasil stock opname — 2 unit rusak'
                  : 'mis. Terima dari pemasok A'
              }
              aria-invalid={!!fieldErrors.note}
            />
          </label>
          {fieldErrors.note ? (
            <p className="mt-1 text-xs font-semibold text-danger">{fieldErrors.note}</p>
          ) : null}
        </div>

        <div className="md:col-span-2">
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? 'Menyimpan…' : meta.submitLabel}
          </Button>
        </div>
      </form>

      {success ? (
        <p className="mt-4 flex items-start gap-2 rounded-control bg-success-soft px-3.5 py-3 text-xs font-semibold text-success">
          <CheckCircle2 aria-hidden className="mt-0.5 h-4 w-4 shrink-0" />
          {success}
        </p>
      ) : null}
      {failure ? (
        <p className="mt-4 flex items-start gap-2 rounded-control bg-danger-soft px-3.5 py-3 text-xs font-semibold text-danger">
          <XCircle aria-hidden className="mt-0.5 h-4 w-4 shrink-0" />
          {failure}
        </p>
      ) : null}
    </Card>
  )
}

interface LocationPickerProps {
  label: string
  required: boolean
  value: string
  levelValue: string
  locations: { id: string; code: string; label: string; type: string; capacity: number | null }[]
  onValueChange: (value: string) => void
  onLevelChange: (value: string) => void
  balanceHint: string | null
  error?: string
}

function LocationPicker({
  label,
  required,
  value,
  levelValue,
  locations,
  onValueChange,
  onLevelChange,
  balanceHint,
  error,
}: LocationPickerProps) {
  const selected = locations.find((location) => location.id === value)
  const showLevel = selected?.type === 'RACK'

  return (
    <div>
      <label className="flex flex-col gap-1.5 text-xs font-bold text-ink">
        {label} {required ? <span className="text-danger">*</span> : null}
        <select
          value={value}
          onChange={(event) => onValueChange(event.target.value)}
          className={`h-10 w-full rounded-control border bg-surface px-3 text-sm text-ink ${
            error ? 'border-danger' : 'border-line'
          }`}
          aria-invalid={!!error}
        >
          <option value="">— Pilih lokasi —</option>
          {locations.map((location) => (
            <option key={location.id} value={location.id}>
              {location.label} ({location.code})
            </option>
          ))}
        </select>
      </label>
      {showLevel ? (
        <div className="mt-2">
          <label className="flex items-center gap-2 text-xs font-bold text-muted">
            Level
            <select
              value={levelValue}
              onChange={(event) => onLevelChange(event.target.value)}
              className="h-9 rounded-control border border-line bg-surface px-2.5 text-sm font-semibold text-ink"
            >
              <option value="1">L1 (bawah)</option>
              <option value="2">L2 (tengah)</option>
              <option value="3">L3 (atas)</option>
            </select>
          </label>
        </div>
      ) : null}
      {error ? <p className="mt-1 text-xs font-semibold text-danger">{error}</p> : null}
      {balanceHint ? <p className="mt-1 text-[11px] text-muted">{balanceHint}</p> : null}
    </div>
  )
}
