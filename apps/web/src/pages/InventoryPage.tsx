import { useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ChevronLeft, ChevronRight, Package, PackagePlus, SearchX } from 'lucide-react'

import { DemoBadge } from '@/components/common/DemoBadge'
import { EmptyState } from '@/components/common/EmptyState'
import { PageHeader } from '@/components/common/PageHeader'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { SearchInput } from '@/components/ui/Input'
import { formatCurrency, formatNumber } from '@/lib/format'
import { quantityByProduct } from '@/lib/stats'
import { balances, locations, products } from '@/mocks/warehouse-data'
import type { Product } from '@/types'

type SortKey = 'name' | 'stock-asc' | 'value-desc'

const PAGE_SIZE = 8

interface LocationChip {
  code: string
  label: string
  quantity: number
}

function locationsForProduct(productId: string): LocationChip[] {
  return balances
    .filter((balance) => balance.productId === productId)
    .map((balance) => {
      const location = locations.find((candidate) => candidate.id === balance.locationId)
      return {
        code: location?.code ?? '?',
        label: location?.label ?? '—',
        quantity: balance.quantity,
      }
    })
    .sort((a, b) => b.quantity - a.quantity)
}

function lowForProduct(product: Product, quantity: number): boolean {
  return quantity < product.reorderThreshold
}

export function InventoryPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [category, setCategory] = useState('ALL')
  const [sort, setSort] = useState<SortKey>('name')
  const [page, setPage] = useState(0)

  // Search text is derived from the URL (?q=) so global search deep links work.
  const query = searchParams.get('q') ?? ''
  const locationFilter = searchParams.get('loc')
  const quantities = useMemo(() => quantityByProduct(balances), [])

  const categories = useMemo(
    () => [...new Set(products.map((product) => product.category))].sort(),
    []
  )

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const locCode = locationFilter?.toLowerCase()
    return products
      .filter((product) => {
        if (category !== 'ALL' && product.category !== category) return false
        if (
          q &&
          !product.name.toLowerCase().includes(q) &&
          !product.sku.toLowerCase().includes(q) &&
          !(product.barcode ?? '').includes(q)
        )
          return false
        if (locCode) {
          const chips = locationsForProduct(product.id)
          if (!chips.some((chip) => chip.code.toLowerCase() === locCode)) return false
        }
        return true
      })
      .sort((a, b) => {
        if (sort === 'stock-asc') {
          return (quantities.get(a.id) ?? 0) - (quantities.get(b.id) ?? 0)
        }
        if (sort === 'value-desc') {
          const valueA = (quantities.get(a.id) ?? 0) * a.costPrice
          const valueB = (quantities.get(b.id) ?? 0) * b.costPrice
          return valueB - valueA
        }
        return a.name.localeCompare(b.name, 'id')
      })
  }, [query, category, sort, locationFilter, quantities])

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage = Math.min(page, pageCount - 1)
  const rows = filtered.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE)

  const applySearch = (value: string) => {
    setPage(0)
    const next = new URLSearchParams(searchParams)
    if (value) next.set('q', value)
    else next.delete('q')
    setSearchParams(next, { replace: true })
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Inventaris"
        subtitle="Daftar produk dan penyebaran stok per lokasi penyimpanan."
        meta={<DemoBadge />}
        actions={
          <Button disabled title="Pembuatan produk (CRUD) tersedia setelah API Fase 2 terhubung.">
            <PackagePlus aria-hidden className="h-4 w-4" />
            Tambah Produk
          </Button>
        }
      />

      {locationFilter ? (
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted">Difilter berdasarkan lokasi</span>
          <Badge tone="primary">{locationFilter.toUpperCase()}</Badge>
          <button
            type="button"
            onClick={() => {
              const next = new URLSearchParams(searchParams)
              next.delete('loc')
              setSearchParams(next, { replace: true })
            }}
            className="text-xs font-bold text-primary hover:underline"
          >
            Hapus filter
          </button>
        </div>
      ) : null}

      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center gap-2.5 border-b border-line px-4 py-3">
          <SearchInput
            value={query}
            onChange={(event) => applySearch(event.target.value)}
            placeholder="Cari nama, SKU, atau barcode…"
            aria-label="Cari produk"
            className="min-w-[220px] flex-1"
          />
          <label className="flex items-center gap-2 text-xs font-semibold text-muted">
            Kategori
            <select
              value={category}
              onChange={(event) => {
                setCategory(event.target.value)
                setPage(0)
              }}
              className="h-10 rounded-control border border-line bg-surface px-3 text-sm font-semibold text-ink"
            >
              <option value="ALL">Semua</option>
              {categories.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2 text-xs font-semibold text-muted">
            Urutkan
            <select
              value={sort}
              onChange={(event) => setSort(event.target.value as SortKey)}
              className="h-10 rounded-control border border-line bg-surface px-3 text-sm font-semibold text-ink"
            >
              <option value="name">Nama A–Z</option>
              <option value="stock-asc">Stok terendah</option>
              <option value="value-desc">Nilai tertinggi</option>
            </select>
          </label>
        </div>

        {rows.length === 0 ? (
          <EmptyState
            icon={SearchX}
            title="Tidak ada produk yang cocok"
            description="Coba ubah kata kunci pencarian, kategori, atau hapus filter lokasi."
            action={
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  applySearch('')
                  setCategory('ALL')
                  const next = new URLSearchParams(searchParams)
                  next.delete('loc')
                  setSearchParams(next, { replace: true })
                }}
              >
                Reset filter
              </Button>
            }
          />
        ) : (
          <div className="overflow-x-auto scroll-slim">
            <table className="w-full min-w-[760px] text-left">
              <thead>
                <tr className="border-b border-line text-[11px] font-bold tracking-wide text-muted uppercase">
                  <th scope="col" className="px-4 py-3">
                    Produk
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Kategori
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Lokasi
                  </th>
                  <th scope="col" className="px-4 py-3 text-right">
                    Stok
                  </th>
                  <th scope="col" className="px-4 py-3 text-right">
                    Harga Pokok
                  </th>
                  <th scope="col" className="px-4 py-3 text-right">
                    Ambang
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line/70">
                {rows.map((product) => {
                  const quantity = quantities.get(product.id) ?? 0
                  const low = lowForProduct(product, quantity)
                  const chips = locationsForProduct(product.id)
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
                      <td className="px-4 py-3 text-sm text-muted">{product.category}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1.5">
                          {chips.slice(0, 3).map((chip) => (
                            <span
                              key={chip.code}
                              title={`${chip.label} · ${formatNumber(chip.quantity)} ${product.unit}`}
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
                        <span className={`text-sm font-bold ${low ? 'text-danger' : 'text-ink'}`}>
                          {formatNumber(quantity)}
                        </span>
                        {low ? (
                          <span className="ml-1.5 text-[11px] font-bold text-danger">Menipis</span>
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
            {filtered.length === 0
              ? '0 produk'
              : `Menampilkan ${safePage * PAGE_SIZE + 1}–${Math.min(filtered.length, (safePage + 1) * PAGE_SIZE)} dari ${formatNumber(filtered.length)} produk`}
          </p>
          <div className="flex items-center gap-1.5">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setPage((value) => Math.max(0, value - 1))}
              disabled={safePage === 0}
              aria-label="Halaman sebelumnya"
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
              aria-label="Halaman berikutnya"
            >
              <ChevronRight aria-hidden className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </Card>

      <p className="flex items-center gap-1.5 text-xs text-muted">
        <Package aria-hidden className="h-3.5 w-3.5" />
        Klik baris produk untuk melihat detail, penyebaran lokasi, dan riwayat pergerakan.
      </p>
    </div>
  )
}
