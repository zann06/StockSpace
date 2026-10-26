import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, PackagePlus, Save, ShieldAlert } from 'lucide-react'
import { z } from 'zod'

import { useCategories, useCreateProduct, useProduct, useUpdateProduct } from '@/api/hooks'
import type { ApiProduct } from '@/api/types'
import { useWorkspace } from '@/api/workspace-context'
import { roleAtLeast } from '@/lib/roles'
import { useI18n } from '@/i18n'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { DemoBadge } from '@/components/common/DemoBadge'
import { EmptyState } from '@/components/common/EmptyState'
import { PageHeader } from '@/components/common/PageHeader'

interface FormState {
  sku: string
  name: string
  categoryId: string
  unit: string
  barcode: string
  costPrice: string
  reorderThreshold: string
  description: string
  active: boolean
}

function initialForm(product?: ApiProduct): FormState {
  return {
    sku: product?.sku ?? '',
    name: product?.name ?? '',
    categoryId: product?.category?.id ?? '',
    unit: product?.unit ?? 'pcs',
    barcode: product?.barcode ?? '',
    costPrice: product ? String(product.costPrice) : '0',
    reorderThreshold: product ? String(product.reorderThreshold) : '0',
    description: product?.description ?? '',
    active: product?.active ?? true,
  }
}

const productSchema = z.object({
  sku: z.string().trim().min(1, 'SKU wajib diisi.').max(64, 'Maksimal 64 karakter.'),
  name: z.string().trim().min(1, 'Nama produk wajib diisi.').max(200, 'Maksimal 200 karakter.'),
  categoryId: z.string(),
  unit: z.string().trim().min(1, 'Satuan wajib diisi.').max(24, 'Maksimal 24 karakter.'),
  barcode: z.string().trim().max(64, 'Maksimal 64 karakter.'),
  costPrice: z.coerce
    .number({ message: 'Harga pokok harus berupa angka.' })
    .min(0, 'Harga pokok tidak boleh negatif.')
    .max(9_999_999_999_999, 'Nilai terlalu besar.'),
  reorderThreshold: z.coerce
    .number({ message: 'Ambang pesan ulang harus berupa angka.' })
    .int('Ambang pesan ulang harus bilangan bulat.')
    .min(0, 'Ambang pesan ulang tidak boleh negatif.'),
  description: z.string().trim().max(2000, 'Maksimal 2.000 karakter.'),
  active: z.boolean(),
})

export function ProductFormPage() {
  const { t } = useI18n()
  const { id } = useParams<{ id: string }>()
  const { workspace } = useWorkspace()
  const productQuery = useProduct(id)
  const canManage = roleAtLeast(workspace?.role, 'ADMIN')
  const isEdit = !!id

  if (!canManage) {
    return (
      <Card>
        <EmptyState
          icon={ShieldAlert}
          title={t('Akses terbatas')}
          description={t('Hanya Owner dan Admin yang dapat menambah atau mengubah produk.')}
          action={
            <Link to="/inventory">
              <Button variant="secondary">{t('Kembali ke Inventaris')}</Button>
            </Link>
          }
        />
      </Card>
    )
  }

  if (isEdit && productQuery.isLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <p className="text-sm font-semibold text-muted">{t('Memuat produk…')}</p>
      </div>
    )
  }

  if (isEdit && (productQuery.error || !productQuery.data)) {
    return (
      <Card>
        <EmptyState
          icon={PackagePlus}
          title={t('Produk tidak ditemukan')}
          description={
            productQuery.error?.message ?? t('Tautan tidak valid atau produk telah dihapus.')
          }
          action={
            <Link to="/inventory">
              <Button variant="secondary">{t('Kembali ke Inventaris')}</Button>
            </Link>
          }
        />
      </Card>
    )
  }

  return (
    <ProductForm
      key={productQuery.data?.data.id ?? 'new'}
      product={isEdit ? productQuery.data?.data : undefined}
    />
  )
}

function ProductForm({ product }: { product?: ApiProduct }) {
  const { t } = useI18n()
  const navigate = useNavigate()
  const categoriesQuery = useCategories()
  const createMutation = useCreateProduct()
  const updateMutation = useUpdateProduct()
  const isEdit = !!product

  const [form, setForm] = useState<FormState>(() => initialForm(product))
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [failure, setFailure] = useState<string | null>(null)

  const setField = <Key extends keyof FormState>(field: Key, value: FormState[Key]) => {
    setForm((previous) => ({ ...previous, [field]: value }))
    setFieldErrors((previous) => ({ ...previous, [field]: '' }))
    setFailure(null)
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setFailure(null)

    const parsed = productSchema.safeParse(form)
    if (!parsed.success) {
      const errors: Record<string, string> = {}
      for (const issue of parsed.error.issues) {
        const field = String(issue.path[0] ?? '')
        if (field && !errors[field]) errors[field] = issue.message
      }
      setFieldErrors(errors)
      return
    }

    const data = parsed.data
    const shared = {
      name: data.name,
      categoryId: data.categoryId || null,
      unit: data.unit,
      barcode: data.barcode || null,
      costPrice: data.costPrice,
      reorderThreshold: data.reorderThreshold,
      description: data.description || null,
      active: data.active,
    }

    try {
      const result = product
        ? await updateMutation.mutateAsync({ id: product.id, input: shared })
        : await createMutation.mutateAsync({ sku: data.sku, ...shared })
      navigate(`/inventory/products/${result.data.id}`)
    } catch (error) {
      setFailure(error instanceof Error ? error.message : t('Gagal menyimpan produk.'))
    }
  }

  const pending = createMutation.isPending || updateMutation.isPending
  const categories = categoriesQuery.data?.data ?? []

  return (
    <div className="flex flex-col gap-5">
      <div>
        <Link
          to={isEdit && product ? `/inventory/products/${product.id}` : '/inventory'}
          className="inline-flex items-center gap-1 text-xs font-bold text-muted hover:text-primary"
        >
          <ArrowLeft aria-hidden className="h-3.5 w-3.5" />
          {isEdit ? t('Kembali ke Detail Produk') : t('Kembali ke Inventaris')}
        </Link>
      </div>

      <PageHeader
        title={isEdit ? t('Edit Produk') : t('Tambah Produk')}
        subtitle={
          isEdit
            ? t('Perbarui data produk. SKU tidak dapat diubah setelah dibuat.')
            : t('Lengkapi data produk baru untuk workspace ini.')
        }
        meta={<DemoBadge />}
      />

      <form onSubmit={handleSubmit} noValidate>
        <Card className="p-5 md:p-6">
          {failure ? (
            <p
              role="alert"
              className="mb-5 rounded-control bg-danger-soft px-3 py-2.5 text-xs font-semibold text-danger-fg"
            >
              {failure}
            </p>
          ) : null}

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <label className="flex flex-col gap-1.5 text-xs font-bold text-ink">
              SKU
              <Input
                value={form.sku}
                onChange={(event) => setField('sku', event.target.value)}
                disabled={isEdit}
                aria-invalid={!!fieldErrors.sku}
                placeholder="SKU-001"
                autoComplete="off"
              />
              {fieldErrors.sku ? (
                <span className="text-[11px] font-semibold text-danger-fg">{fieldErrors.sku}</span>
              ) : isEdit ? (
                <span className="text-[11px] font-medium text-muted">
                  {t('SKU tidak dapat diubah.')}
                </span>
              ) : null}
            </label>

            <label className="flex flex-col gap-1.5 text-xs font-bold text-ink">
              {t('Nama produk')}
              <Input
                value={form.name}
                onChange={(event) => setField('name', event.target.value)}
                aria-invalid={!!fieldErrors.name}
                placeholder={t('Contoh: Laptop ASUS TUF F15')}
                autoFocus={!isEdit}
              />
              {fieldErrors.name ? (
                <span className="text-[11px] font-semibold text-danger-fg">{fieldErrors.name}</span>
              ) : null}
            </label>

            <label className="flex flex-col gap-1.5 text-xs font-bold text-ink">
              {t('Kategori')}
              <select
                value={form.categoryId}
                onChange={(event) => setField('categoryId', event.target.value)}
                className="h-10 w-full rounded-control border border-line bg-surface px-3 text-sm font-semibold text-ink"
              >
                <option value="">{t('Tanpa kategori')}</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1.5 text-xs font-bold text-ink">
              {t('Satuan')}
              <Input
                value={form.unit}
                onChange={(event) => setField('unit', event.target.value)}
                aria-invalid={!!fieldErrors.unit}
                placeholder="pcs"
              />
              {fieldErrors.unit ? (
                <span className="text-[11px] font-semibold text-danger-fg">{fieldErrors.unit}</span>
              ) : null}
            </label>

            <label className="flex flex-col gap-1.5 text-xs font-bold text-ink">
              {t('Barcode')}
              <Input
                value={form.barcode}
                onChange={(event) => setField('barcode', event.target.value)}
                aria-invalid={!!fieldErrors.barcode}
                placeholder={t('Opsional')}
                autoComplete="off"
              />
              {fieldErrors.barcode ? (
                <span className="text-[11px] font-semibold text-danger-fg">
                  {fieldErrors.barcode}
                </span>
              ) : null}
            </label>

            <label className="flex flex-col gap-1.5 text-xs font-bold text-ink">
              {t('Harga Pokok')}
              <Input
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                value={form.costPrice}
                onChange={(event) => setField('costPrice', event.target.value)}
                aria-invalid={!!fieldErrors.costPrice}
              />
              {fieldErrors.costPrice ? (
                <span className="text-[11px] font-semibold text-danger-fg">
                  {fieldErrors.costPrice}
                </span>
              ) : null}
            </label>

            <label className="flex flex-col gap-1.5 text-xs font-bold text-ink">
              {t('Ambang Pesan Ulang')}
              <Input
                type="number"
                min="0"
                step="1"
                inputMode="numeric"
                value={form.reorderThreshold}
                onChange={(event) => setField('reorderThreshold', event.target.value)}
                aria-invalid={!!fieldErrors.reorderThreshold}
              />
              {fieldErrors.reorderThreshold ? (
                <span className="text-[11px] font-semibold text-danger-fg">
                  {fieldErrors.reorderThreshold}
                </span>
              ) : null}
            </label>

            <label className="flex items-center gap-2 self-end pb-2 text-xs font-bold text-ink">
              <input
                type="checkbox"
                checked={form.active}
                onChange={(event) => setField('active', event.target.checked)}
                className="h-4 w-4 rounded border-line text-primary"
              />
              {t('Produk aktif')}
            </label>

            <label className="flex flex-col gap-1.5 text-xs font-bold text-ink md:col-span-2">
              {t('Deskripsi')}
              <textarea
                value={form.description}
                onChange={(event) => setField('description', event.target.value)}
                aria-invalid={!!fieldErrors.description}
                rows={3}
                placeholder={t('Opsional')}
                className="w-full rounded-control border border-line bg-surface px-3.5 py-2.5 text-sm text-ink placeholder:text-muted/70"
              />
              {fieldErrors.description ? (
                <span className="text-[11px] font-semibold text-danger-fg">
                  {fieldErrors.description}
                </span>
              ) : null}
            </label>
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-end gap-2 border-t border-line pt-4">
            <Link to={isEdit && product ? `/inventory/products/${product.id}` : '/inventory'}>
              <Button type="button" variant="ghost">
                {t('Batal')}
              </Button>
            </Link>
            <Button type="submit" disabled={pending}>
              {isEdit ? (
                <Save aria-hidden className="h-4 w-4" />
              ) : (
                <PackagePlus aria-hidden className="h-4 w-4" />
              )}
              {pending ? t('Menyimpan…') : isEdit ? t('Simpan Perubahan') : t('Buat Produk')}
            </Button>
          </div>
        </Card>
      </form>
    </div>
  )
}
