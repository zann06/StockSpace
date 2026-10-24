import { Save } from 'lucide-react'

import { DemoBadge } from '@/components/common/DemoBadge'
import { PageHeader } from '@/components/common/PageHeader'
import { Badge } from '@/components/ui/Badge'
import { Card, CardHeader } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { demoMeta, products, warehouse } from '@/mocks/warehouse-data'

const CATEGORIES = [...new Set(products.map((product) => product.category))]

/** Settings — Phase 1 renders the structure read-only; persistence lands with
 * the API (Phase 2) and user management with auth (Phase 4). */
export function SettingsPage() {
  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Pengaturan"
        subtitle="Konfigurasi workspace, unit stok, pengguna, dan tata letak gudang."
        meta={<DemoBadge />}
      />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader title="Workspace" subtitle="Identitas bisnis dan tampilan regional" />
          <div className="flex flex-col gap-4 px-5 py-5">
            <label className="flex flex-col gap-1.5 text-xs font-bold text-ink">
              Nama bisnis
              <Input defaultValue={demoMeta.businessName} readOnly />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="flex flex-col gap-1.5 text-xs font-bold text-ink">
                Mata uang
                <Input defaultValue="IDR (Rp)" readOnly />
              </label>
              <label className="flex flex-col gap-1.5 text-xs font-bold text-ink">
                Zona waktu
                <Input defaultValue="Asia/Jakarta" readOnly />
              </label>
            </div>
            <label className="flex flex-col gap-1.5 text-xs font-bold text-ink">
              Locale
              <Input defaultValue="id-ID" readOnly />
            </label>
            <button
              type="button"
              disabled
              title="Penyimpanan pengaturan tersedia setelah API Fase 2 terhubung."
              className="inline-flex h-10 w-fit cursor-not-allowed items-center gap-2 rounded-control bg-primary/50 px-4 text-sm font-bold text-white"
            >
              <Save aria-hidden className="h-4 w-4" />
              Simpan Perubahan
            </button>
          </div>
        </Card>

        <Card>
          <CardHeader title="Gudang" subtitle="Gudang aktif saat ini" />
          <div className="flex flex-col gap-4 px-5 py-5">
            <label className="flex flex-col gap-1.5 text-xs font-bold text-ink">
              Nama gudang
              <Input defaultValue={warehouse.name} readOnly />
            </label>
            <label className="flex flex-col gap-1.5 text-xs font-bold text-ink">
              Kode gudang
              <Input defaultValue={warehouse.code} readOnly />
            </label>
            <p className="rounded-control bg-canvas px-3 py-2.5 text-xs leading-relaxed text-muted">
              Editor tata letak gudang (tambah/geser rak, atur kapasitas dan koordinat) tersedia
              setelah skema penyimpanan lokasi terimplementasi di Fase 2–3.
            </p>
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Kategori & Unit"
            subtitle="Kategori produk yang terdaftar pada data contoh"
          />
          <div className="flex flex-wrap gap-2 px-5 py-5">
            {CATEGORIES.map((category) => (
              <Badge key={category} tone="primary">
                {category}
              </Badge>
            ))}
            <span className="text-xs text-muted">
              Manajemen kategori dan unit takar (CRUD) tersedia setelah Fase 2.
            </span>
          </div>
        </Card>

        <Card>
          <CardHeader title="Pengguna" subtitle="Kelola anggota workspace dan perannya" />
          <ul className="divide-y divide-line/70">
            {demoMeta.team.map((member) => (
              <li key={member.email} className="flex items-center gap-3 px-5 py-3">
                <span
                  aria-hidden
                  className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary-soft text-xs font-extrabold text-primary"
                >
                  {member.name
                    .split(' ')
                    .map((part) => part[0])
                    .join('')}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-ink">{member.name}</p>
                  <p className="truncate text-xs text-muted">{member.email}</p>
                </div>
                <Badge tone={member.role === 'Admin' ? 'primary' : 'neutral'}>{member.role}</Badge>
              </li>
            ))}
          </ul>
          <div className="px-5 py-4">
            <button
              type="button"
              disabled
              title="Manajemen pengguna tersedia setelah autentikasi Fase 4 terhubung."
              className="inline-flex h-9 cursor-not-allowed items-center rounded-control border border-line bg-surface px-4 text-xs font-bold text-muted"
            >
              + Undang Pengguna
            </button>
          </div>
        </Card>
      </div>
    </div>
  )
}
