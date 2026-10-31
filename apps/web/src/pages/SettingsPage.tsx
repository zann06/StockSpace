import { useState } from 'react'
import { Save } from 'lucide-react'

import { useCategories, useWarehouseData } from '@/api/hooks'
import { useWorkspace } from '@/api/workspace-context'
import { useI18n } from '@/i18n'
import { restartTour } from '@/components/tour/AppTour'
import { useCreateSupplier, useDeleteSupplier, useSuppliers } from '@/api/features'
import { LanguageSwitch } from '@/components/ui/LanguageSwitch'
import { Button } from '@/components/ui/Button'
import { DemoBadge } from '@/components/common/DemoBadge'
import { PageHeader } from '@/components/common/PageHeader'
import { MembersCard } from '@/components/settings/MembersCard'
import { Badge } from '@/components/ui/Badge'
import { Card, CardHeader } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'

/**
 * Settings — reads live workspace/warehouse/category data from the API.
 * Persistence of settings edits and user management arrive with Phase 4.
 */
export function SettingsPage() {
  const { t } = useI18n()
  const { workspace, workspaces, setWorkspaceId } = useWorkspace()
  const categoriesQuery = useCategories()
  const { warehouse, locations } = useWarehouseData()

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Pengaturan"
        subtitle="Konfigurasi workspace, kategori, pengguna, dan tata letak gudang."
        meta={<DemoBadge />}
      />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader title="Workspace" subtitle="Workspace aktif dan tampilan regionalnya" />
          <div className="flex flex-col gap-4 px-5 py-5">
            <label className="flex flex-col gap-1.5 text-xs font-bold text-ink">
              {t('Workspace aktif')}
              <select
                value={workspace?.id ?? ''}
                onChange={(event) => setWorkspaceId(event.target.value)}
                className="h-10 rounded-control border border-line bg-surface px-3 text-sm font-semibold text-ink"
              >
                {workspaces.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="flex flex-col gap-1.5 text-xs font-bold text-ink">
                {t('Mata uang')}
                <Input defaultValue={workspace?.currency ?? 'IDR'} readOnly />
              </label>
              <label className="flex flex-col gap-1.5 text-xs font-bold text-ink">
                {t('Zona waktu')}
                <Input defaultValue={workspace?.timezone ?? 'Asia/Jakarta'} readOnly />
              </label>
            </div>
            <p className="rounded-control bg-canvas px-3 py-2.5 text-xs leading-relaxed text-muted">
              Penggantian nama, locale, dan penyimpanan pengaturan lainnya tersedia setelah sesi &
              otorisasi terhubung (Fase 4).
            </p>
          </div>
        </Card>

        <Card>
          <CardHeader title="Gudang" subtitle="Gudang aktif dan lokasinya" />
          <div className="flex flex-col gap-4 px-5 py-5">
            <label className="flex flex-col gap-1.5 text-xs font-bold text-ink">
              {t('Nama gudang')}
              <Input defaultValue={warehouse.name || '…'} readOnly />
            </label>
            <label className="flex flex-col gap-1.5 text-xs font-bold text-ink">
              {t('Kode gudang')}
              <Input defaultValue={warehouse.code || '…'} readOnly />
            </label>
            <p className="rounded-control bg-canvas px-3 py-2.5 text-xs leading-relaxed text-muted">
              {locations.length} lokasi aktif. Editor tata letak (tambah/geser rak, atur kapasitas
              dan koordinat) menyusul bersama otorisasi admin (Fase 4) — koordinat tersimpan di
              database dan langsung dipakai scene 3D.
            </p>
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Kategori"
            subtitle={
              categoriesQuery.isLoading
                ? 'Memuat…'
                : `${categoriesQuery.data?.data.length ?? 0} kategori terdaftar`
            }
          />
          <div className="flex flex-wrap gap-2 px-5 py-5">
            {(categoriesQuery.data?.data ?? []).map((category) => (
              <Badge key={category.id} tone="primary">
                {category.name}
                <span className="font-medium opacity-70">{category._count.products}</span>
              </Badge>
            ))}
            {!categoriesQuery.isLoading && (categoriesQuery.data?.data.length ?? 0) === 0 ? (
              <span className="text-xs text-muted">{t('Belum ada kategori.')}</span>
            ) : null}
          </div>
        </Card>

        <SuppliersCard />

        <MembersCard />

        <Card>
          <CardHeader title={t('Bahasa / Language')} subtitle={t('Bahasa tampilan aplikasi')} />
          <div className="flex flex-col gap-4 px-5 py-5">
            <LanguageSwitch />
            <p className="rounded-control bg-canvas px-3 py-2.5 text-xs leading-relaxed text-muted">
              {t('Jalankan tur pengenalan aplikasi kembali.')}
            </p>
            <Button variant="secondary" onClick={restartTour} className="w-fit">
              {t('Lihat tutorial')}
            </Button>
          </div>
        </Card>
      </div>

      <p className="flex items-center gap-1.5 text-xs text-muted">
        <Save aria-hidden className="h-3.5 w-3.5" />
        Semua perubahan tersimpan otomatis untuk data yang dapat diubah; field yang masih read-only
        menunggu Fase 4.
      </p>
    </div>
  )
}

/** Suppliers management — ADMIN writes, others view. */
function SuppliersCard() {
  const { t } = useI18n()
  const suppliersQuery = useSuppliers()
  const deleteSupplier = useDeleteSupplier()
  const createSupplier = useCreateSupplier()
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)

  const suppliers = suppliersQuery.data?.data ?? []

  const addSupplier = (event: React.FormEvent) => {
    event.preventDefault()
    setError(null)
    createSupplier.mutate(
      { name: name.trim() },
      {
        onSuccess: () => setName(''),
        onError: (cause) =>
          setError(cause instanceof Error ? cause.message : 'Gagal menambah supplier.'),
      }
    )
  }

  return (
    <Card>
      <CardHeader
        title={t('Kelola Supplier')}
        subtitle={t('Pemasok produk — dipakai pada usulan restock.')}
      />
      <div className="flex flex-col gap-3 px-5 py-5">
        <ul className="flex flex-col gap-2">
          {suppliers.map((supplier) => (
            <li key={supplier.id} className="flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-ink">{supplier.name}</p>
                <p className="truncate text-xs text-muted">
                  {supplier.contactName ?? '—'} · {supplier._count?.products ?? 0} {t('produk')}
                </p>
              </div>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => deleteSupplier.mutate(supplier.id)}
                disabled={deleteSupplier.isPending || (supplier._count?.products ?? 0) > 0}
                title={
                  (supplier._count?.products ?? 0) > 0
                    ? t('Supplier masih dipakai produk — lepas dulu relasinya.')
                    : undefined
                }
              >
                {t('Hapus')}
              </Button>
            </li>
          ))}
          {suppliers.length === 0 ? (
            <li className="text-xs text-muted">{t('Belum ada supplier.')}</li>
          ) : null}
        </ul>

        <form onSubmit={addSupplier} className="flex items-center gap-2">
          <input
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder={t('Nama supplier baru')}
            className="h-10 flex-1 rounded-control border border-line bg-surface px-3 text-sm text-ink"
          />
          <Button type="submit" disabled={createSupplier.isPending || name.trim() === ''}>
            {t('Tambah')}
          </Button>
        </form>
        {error ? <p className="text-xs font-semibold text-danger-fg">{error}</p> : null}
      </div>
    </Card>
  )
}
