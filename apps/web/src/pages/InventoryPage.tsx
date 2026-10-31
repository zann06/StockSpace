import { useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ChevronLeft, ChevronRight, Package, PackagePlus, SearchX, Upload } from 'lucide-react'

import { useCategories, useProductsList, useWarehouseData } from '@/api/hooks'
import { useImportProducts, type ImportRow } from '@/api/features'
import { useWorkspace } from '@/api/workspace-context'
import { roleAtLeast } from '@/lib/roles'
import { DemoBadge } from '@/components/common/DemoBadge'
import { EmptyState } from '@/components/common/EmptyState'
import { PageHeader } from '@/components/common/PageHeader'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { SearchInput } from '@/components/ui/Input'
import { formatCurrency, formatNumber } from '@/lib/format'
import { useI18n } from '@/i18n'

type SortKey = 'name' | 'stock-asc' | 'value-desc'

const PAGE_SIZE = 8

export function InventoryPage() {
  const [importOpen, setImportOpen] = useState(false)
  const { t } = useI18n()
  const navigate = useNavigate()
  const { workspace } = useWorkspace()
  const canManageProducts = roleAtLeast(workspace?.role, 'ADMIN')
  const [searchParams, setSearchParams] = useSearchParams()
  const [category, setCategory] = useState('ALL')
  const [sort, setSort] = useState<SortKey>('name')
  const [page, setPage] = useState(0)

  // Search text is derived from the URL (?q=) so global search deep links work.
  const query = searchParams.get('q') ?? ''
  const locationFilter = searchParams.get('loc')

  const productsQuery = useProductsList(query ? { search: query } : {})
  const categoriesQuery = useCategories()
  const { locations, balances } = useWarehouseData()

  const locationByCode = useMemo(
    () => new Map(locations.map((location) => [location.code.toLowerCase(), location])),
    [locations]
  )
  const filterLocation = locationFilter
    ? locationByCode.get(locationFilter.toLowerCase())
    : undefined

  const rows = useMemo(() => {
    let items = productsQuery.data?.data ?? []
    if (filterLocation) {
      const productIdsAtLocation = new Set(
        balances
          .filter((balance) => balance.locationId === filterLocation.id)
          .map((b) => b.productId)
      )
      items = items.filter((product) => productIdsAtLocation.has(product.id))
    }
    if (category !== 'ALL') {
      items = items.filter(
        (product) => product.category?.id === category || product.category?.name === category
      )
    }
    const sorted = [...items]
    if (sort === 'stock-asc') sorted.sort((a, b) => a.totalQuantity - b.totalQuantity)
    else if (sort === 'value-desc')
      sorted.sort((a, b) => b.totalQuantity * b.costPrice - a.totalQuantity * a.costPrice)
    else sorted.sort((a, b) => a.name.localeCompare(b.name, 'id'))
    return sorted
  }, [productsQuery.data, filterLocation, balances, category, sort])

  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE))
  const safePage = Math.min(page, pageCount - 1)
  const pageRows = rows.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE)

  const balancesByProduct = useMemo(() => {
    const map = new Map<string, { code: string; quantity: number }[]>()
    for (const balance of balances) {
      const location = locations.find((candidate) => candidate.id === balance.locationId)
      if (!location) continue
      const existing = map.get(balance.productId) ?? []
      existing.push({ code: location.code, quantity: balance.quantity })
      map.set(balance.productId, existing)
    }
    for (const list of map.values()) list.sort((a, b) => b.quantity - a.quantity)
    return map
  }, [balances, locations])

  const applySearch = (value: string) => {
    setPage(0)
    const next = new URLSearchParams(searchParams)
    if (value) next.set('q', value)
    else next.delete('q')
    setSearchParams(next, { replace: true })
  }

  const clearLocationFilter = () => {
    const next = new URLSearchParams(searchParams)
    next.delete('loc')
    setSearchParams(next, { replace: true })
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title={t('Inventaris')}
        subtitle={t('Daftar produk dan penyebaran stok per lokasi penyimpanan.')}
        meta={<DemoBadge />}
        actions={
          <>
            {canManageProducts ? (
              <Link to="/inventory/products/new">
                <Button>
                  <PackagePlus aria-hidden className="h-4 w-4" />
                  {t('Tambah Produk')}
                </Button>
              </Link>
            ) : undefined}
            {canManageProducts ? (
              <Button variant="secondary" onClick={() => setImportOpen(true)}>
                <Upload aria-hidden className="h-4 w-4" />
                {t('Import CSV')}
              </Button>
            ) : undefined}
          </>
        }
      />

      {locationFilter ? (
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted">{t('Difilter berdasarkan lokasi')}</span>
          <Badge tone="primary">{locationFilter.toUpperCase()}</Badge>
          <button
            type="button"
            onClick={clearLocationFilter}
            className="text-xs font-bold text-primary hover:underline"
          >
            {t('Hapus filter')}
          </button>
        </div>
      ) : null}

      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center gap-2.5 border-b border-line px-4 py-3">
          <SearchInput
            value={query}
            onChange={(event) => applySearch(event.target.value)}
            placeholder={t('Cari nama, SKU, atau barcode…')}
            aria-label={t('Cari produk')}
            className="min-w-[220px] flex-1"
          />
          <label className="flex items-center gap-2 text-xs font-semibold text-muted">
            {t('Kategori')}
            <select
              value={category}
              onChange={(event) => {
                setCategory(event.target.value)
                setPage(0)
              }}
              className="h-10 rounded-control border border-line bg-surface px-3 text-sm font-semibold text-ink"
            >
              <option value="ALL">{t('Semua')}</option>
              {(categoriesQuery.data?.data ?? []).map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2 text-xs font-semibold text-muted">
            {t('Urutkan')}
            <select
              value={sort}
              onChange={(event) => setSort(event.target.value as SortKey)}
              className="h-10 rounded-control border border-line bg-surface px-3 text-sm font-semibold text-ink"
            >
              <option value="name">{t('Nama A–Z')}</option>
              <option value="stock-asc">{t('Stok terendah')}</option>
              <option value="value-desc">{t('Nilai tertinggi')}</option>
            </select>
          </label>
        </div>

        {productsQuery.isLoading ? (
          <p className="px-5 py-10 text-center text-sm font-semibold text-muted">
            {t('Memuat produk…')}
          </p>
        ) : productsQuery.error ? (
          <div className="px-5 py-8 text-center">
            <p className="text-sm font-bold text-ink">{t('Gagal memuat produk')}</p>
            <p className="mt-1 text-xs leading-relaxed text-muted">{productsQuery.error.message}</p>
            <button
              type="button"
              onClick={() => void productsQuery.refetch()}
              className="mt-3 rounded-control bg-primary px-4 py-2 text-xs font-bold text-white hover:bg-primary-hover"
            >
              {t('Coba lagi')}
            </button>
          </div>
        ) : pageRows.length === 0 ? (
          <EmptyState
            icon={SearchX}
            title={t('Tidak ada produk yang cocok')}
            description={t('Coba ubah kata kunci pencarian, kategori, atau hapus filter lokasi.')}
            action={
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  applySearch('')
                  setCategory('ALL')
                  clearLocationFilter()
                }}
              >
                {t('Reset filter')}
              </Button>
            }
          />
        ) : (
          <div className="overflow-x-auto scroll-slim">
            <table className="w-full min-w-[760px] text-left">
              <thead>
                <tr className="border-b border-line text-[11px] font-bold tracking-wide text-muted uppercase">
                  <th scope="col" className="px-4 py-3">
                    {t('Produk')}
                  </th>
                  <th scope="col" className="px-4 py-3">
                    {t('Kategori')}
                  </th>
                  <th scope="col" className="px-4 py-3">
                    {t('Lokasi')}
                  </th>
                  <th scope="col" className="px-4 py-3 text-right">
                    {t('Stok')}
                  </th>
                  <th scope="col" className="px-4 py-3 text-right">
                    {t('Harga Pokok')}
                  </th>
                  <th scope="col" className="px-4 py-3 text-right">
                    {t('Ambang')}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line/70">
                {pageRows.map((product) => {
                  const low = product.totalQuantity < product.reorderThreshold
                  const chips = balancesByProduct.get(product.id) ?? []
                  return (
                    <tr
                      key={product.id}
                      onClick={() => navigate(`/inventory/products/${product.id}`)}
                      className="cursor-pointer transition-colors hover:bg-canvas/70"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <span
                            aria-hidden
                            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-xs font-extrabold text-primary"
                          >
                            {product.name.slice(0, 2).toUpperCase()}
                          </span>
                          <div className="min-w-0">
                            <Link
                              to={`/inventory/products/${product.id}`}
                              onClick={(event) => event.stopPropagation()}
                              className="block truncate text-sm font-bold text-ink hover:text-primary"
                            >
                              {product.name}
                            </Link>
                            <span className="block text-xs text-muted">{product.sku}</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-muted">
                        {product.category?.name ?? '—'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1.5">
                          {chips.slice(0, 3).map((chip) => (
                            <span
                              key={chip.code}
                              title={`${chip.code} · ${formatNumber(chip.quantity)} ${product.unit}`}
                              className="inline-flex items-center rounded-md bg-canvas px-2 py-0.5 text-[11px] font-bold text-muted"
                            >
                              {chip.code} · {formatNumber(chip.quantity)}
                            </span>
                          ))}
                          {chips.length > 3 ? (
                            <span className="text-[11px] font-bold text-muted">
                              +{chips.length - 3}
                            </span>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span
                          className={`text-sm font-bold ${low ? 'text-danger-fg' : 'text-ink'}`}
                        >
                          {formatNumber(product.totalQuantity)}
                        </span>
                        {low ? (
                          <span className="ml-1.5 text-[11px] font-bold text-danger-fg">
                            {t('Menipis')}
                          </span>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-right text-sm text-muted">
                        {formatCurrency(product.costPrice)}
                      </td>
                      <td className="px-4 py-3 text-right text-sm text-muted">
                        {formatNumber(product.reorderThreshold)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex items-center justify-between border-t border-line px-4 py-3">
          <p className="text-xs text-muted" role="status">
            {rows.length === 0
              ? '0 produk'
              : `Menampilkan ${safePage * PAGE_SIZE + 1}–${Math.min(rows.length, (safePage + 1) * PAGE_SIZE)} dari ${formatNumber(rows.length)} produk`}
          </p>
          <div className="flex items-center gap-1.5">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setPage((value) => Math.max(0, value - 1))}
              disabled={safePage === 0}
              aria-label={t('Halaman sebelumnya')}
            >
              <ChevronLeft aria-hidden className="h-4 w-4" />
            </Button>
            <span className="px-1 text-xs font-semibold text-muted">
              {safePage + 1} / {pageCount}
            </span>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setPage((value) => Math.min(pageCount - 1, value + 1))}
              disabled={safePage >= pageCount - 1}
              aria-label={t('Halaman berikutnya')}
            >
              <ChevronRight aria-hidden className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </Card>

      <p className="flex items-center gap-1.5 text-xs text-muted">
        <Package aria-hidden className="h-3.5 w-3.5" />
        {t('Klik baris produk untuk melihat detail, penyebaran lokasi, dan riwayat pergerakan.')}
      </p>
      {importOpen ? <ImportDialog onClose={() => setImportOpen(false)} /> : null}
    </div>
  )
}

const CSV_TIP =
  'sku,name,unit,cost_price,reorder_threshold,category\nELK-001,"Kabel USB-C",pcs,35000,20,Aksesoris'

function ImportDialog({ onClose }: { onClose: () => void }) {
  const { t } = useI18n()
  const importProducts = useImportProducts()
  const [csvText, setCsvText] = useState('')
  const [result, setResult] = useState<{
    created: string[]
    updated: string[]
    errors: { row: number; message: string }[]
  } | null>(null)
  const [parseError, setParseError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const parseCsv = (text: string): ImportRow[] => {
    const lines = text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
    if (lines.length < 2) throw new Error(t('CSV harus berisi header dan minimal satu baris data.'))
    const delimiter =
      (lines[0].match(/,/g)?.length ?? 0) >= (lines[0].match(/;/g)?.length ?? 0) ? ',' : ';'
    const splitRow = (row: string): string[] => {
      const cells: string[] = []
      let current = ''
      let quoted = false
      for (const char of row) {
        if (char === '"') quoted = !quoted
        else if (char === delimiter && !quoted) {
          cells.push(current.trim())
          current = ''
        } else current += char
      }
      cells.push(current.trim())
      return cells
    }
    const header = splitRow(lines[0]).map((cell) => cell.toLowerCase().replace(/\s+/g, '_'))
    return lines.slice(1).map((line) => {
      const cells = splitRow(line)
      const row: Record<string, string> = {}
      header.forEach((key, index) => {
        row[key] = cells[index] ?? ''
      })
      return {
        sku: row.sku ?? '',
        name: row.name ?? '',
        category: row.category || null,
        unit: row.unit || 'pcs',
        barcode: row.barcode || null,
        costPrice: row.cost_price
          ? Number(row.cost_price.replace(/[\d.,-]/g, '').replace(',', '.')) || 0
          : 0,
        reorderThreshold: row.reorder_threshold
          ? Number.parseInt(row.reorder_threshold, 10) || 0
          : 0,
        description: row.description || null,
      }
    })
  }

  const handleFile = (file: File) => {
    const reader = new FileReader()
    reader.onload = () => setCsvText(String(reader.result ?? ''))
    void reader.readAsText(file)
  }

  const handleSubmit = () => {
    setParseError(null)
    try {
      const rows = parseCsv(csvText)
      importProducts.mutate(rows, { onSuccess: (data) => setResult(data.data) })
    } catch (error) {
      setParseError(error instanceof Error ? error.message : String(error))
    }
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-ink/60 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={t('Import Produk CSV')}
    >
      <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto scroll-slim rounded-card border border-line bg-surface p-5 shadow-xl">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-ink">{t('Import Produk CSV')}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('Tutup')}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted hover:bg-canvas hover:text-ink"
          >
            ✕
          </button>
        </div>

        {result ? (
          <div className="mt-4 flex flex-col gap-3">
            <p className="rounded-control bg-success-soft px-3 py-2 text-sm font-semibold text-success-fg">
              {t('Dibuat')}: {result.created.length} · {t('Diperbarui')}: {result.updated.length} ·{' '}
              {t('Gagal')}: {result.errors.length}
            </p>
            {result.errors.map((error) => (
              <p key={error.row} className="text-xs font-semibold text-danger-fg">
                {t('Baris')} {error.row}: {error.message}
              </p>
            ))}
            <Button onClick={onClose}>{t('Selesai')}</Button>
          </div>
        ) : (
          <div className="mt-4 flex flex-col gap-3">
            <input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0]
                if (file) handleFile(file)
              }}
            />
            <Button variant="secondary" onClick={() => fileRef.current?.click()}>
              {t('Pilih file CSV…')}
            </Button>
            <textarea
              value={csvText}
              onChange={(event) => setCsvText(event.target.value)}
              rows={7}
              placeholder={CSV_TIP}
              className="w-full rounded-control border border-line bg-surface px-3 py-2 font-mono text-xs text-ink"
            />
            <p className="text-[11px] leading-relaxed text-muted">
              Kolom: sku, name, unit, cost_price, reorder_threshold, category (opsional). Baris
              dengan SKU yang sudah ada akan diperbarui. Batas 1.000 baris per impor.
            </p>
            {parseError ? (
              <p
                role="alert"
                className="rounded-control bg-danger-soft px-3 py-2 text-xs font-semibold text-danger-fg"
              >
                {parseError}
              </p>
            ) : null}
            <div className="flex gap-2">
              <Button
                onClick={handleSubmit}
                disabled={importProducts.isPending || csvText.trim() === ''}
              >
                {importProducts.isPending ? t('Mengimpor…') : t('Impor Sekarang')}
              </Button>
              <Button variant="secondary" onClick={onClose}>
                {t('Batal')}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
