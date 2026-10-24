import { Save } from 'lucide-react'

import { useCategories, useWarehouseData } from '@/api/hooks'
import { useWorkspace } from '@/api/workspace-provider'
import { DemoBadge } from '@/components/common/DemoBadge'
import { PageHeader } from '@/components/common/PageHeader'
import { Badge } from '@/components/ui/Badge'
import { Card, CardHeader } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'

/**
 * Settings — reads live workspace/warehouse/category data from the API.
 * Persistence of settings edits and user management arrive with Phase 4.
 */
export function SettingsPage() {
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
              Workspace aktif
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
                Mata uang
                <Input defaultValue={workspace?.currency ?? 'IDR'} readOnly />
              </label>
              <label className="flex flex-col gap-1.5 text-xs font-bold text-ink">
                Zona waktu
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
              Nama gudang
              <Input defaultValue={warehouse.name || '…'} readOnly />
            </label>
            <label className="flex flex-col gap-1.5 text-xs font-bold text-ink">
              Kode gudang
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
              <span className="text-xs text-muted">Belum ada kategori.</span>
            ) : null}
          </div>
        </Card>

        <Card>
          <CardHeader title="Pengguna" subtitle="Manajemen anggota workspace dan perannya" />
          <div className="px-5 py-5">
            <p className="rounded-control bg-canvas px-3 py-2.5 text-xs leading-relaxed text-muted">
              Manajemen pengguna (mengundang anggota, mengatur peran Owner/Admin/Staf/Viewer)
              tersedia setelah autentikasi diimplementasikan pada Fase 4. Role sudah diterapkan di
              skema database dan siap dipakai API.
            </p>
            <button
              type="button"
              disabled
              title="Manajemen pengguna tersedia setelah autentikasi Fase 4 terhubung."
              className="mt-3 inline-flex h-9 cursor-not-allowed items-center rounded-control border border-line bg-surface px-4 text-xs font-bold text-muted"
            >
              + Undang Pengguna
            </button>
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
