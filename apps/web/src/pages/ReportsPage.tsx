import { Download, FileBarChart } from 'lucide-react'

import { DemoBadge } from '@/components/common/DemoBadge'
import { PageHeader } from '@/components/common/PageHeader'
import { Card } from '@/components/ui/Card'

const REPORTS = [
  {
    id: 'movements',
    title: 'Laporan Pergerakan Stok',
    description:
      'Riwayat barang masuk/keluar/transfer dengan filter rentang tanggal, produk, jenis transaksi, dan aktor. Tersedia ekspor CSV.',
  },
  {
    id: 'low-stock',
    title: 'Laporan Stok Menipis',
    description:
      'Produk aktif dengan total stok di bawah ambang pesan ulang, diurutkan dari yang paling kritis.',
  },
  {
    id: 'by-location',
    title: 'Inventaris per Lokasi',
    description: 'Sebaran kuantitas setiap produk di seluruh rak, area staging, dan area packing.',
  },
] as const

/** Reports placeholder — honest disabled state until the API lands (Phase 4). */
export function ReportsPage() {
  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Laporan"
        subtitle="Analisis pergerakan stok, produk menipis, dan sebaran inventaris."
        meta={<DemoBadge />}
        actions={
          <span className="flex items-center gap-1.5 rounded-control border border-dashed border-line px-3 py-2 text-xs font-semibold text-muted">
            Ekspor CSV — Fase 4
          </span>
        }
      />

      <Card className="border-dashed bg-transparent shadow-none">
        <div className="flex flex-col items-center gap-1 px-6 py-10 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-soft">
            <FileBarChart aria-hidden className="h-6 w-6 text-primary" />
          </span>
          <p className="mt-2 text-sm font-bold text-ink">
            Laporan akan aktif setelah data tersimpan di database
          </p>
          <p className="max-w-md text-xs leading-relaxed text-muted">
            Laporan membutuhkan riwayat transaksi yang tersimpan di PostgreSQL. Implementasi backend
            direncanakan pada Fase 2, laporan dan ekspor CSV pada Fase 4 sesuai roadmap PRD.
          </p>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {REPORTS.map((report) => (
          <Card key={report.id} className="flex flex-col p-5">
            <h2 className="text-sm font-bold text-ink">{report.title}</h2>
            <p className="mt-1.5 flex-1 text-xs leading-relaxed text-muted">{report.description}</p>
            <div className="mt-4 flex items-center gap-2">
              <button
                type="button"
                disabled
                title="Tersedia setelah Fase 4 (laporan + ekspor CSV terhubung ke API)."
                className="inline-flex h-8 flex-1 cursor-not-allowed items-center justify-center gap-1.5 rounded-control bg-primary/50 text-xs font-bold text-white"
              >
                <Download aria-hidden className="h-3.5 w-3.5" />
                Unduh CSV
              </button>
              <span className="rounded-full bg-canvas px-2 py-0.5 text-[11px] font-bold text-muted">
                Fase 4
              </span>
            </div>
          </Card>
        ))}
      </div>

      <p className="text-xs text-muted">
        Catatan metode: nilai inventory dihitung sebagai Σ(kuantitas × harga pokok / cost price) dan
        didokumentasikan di <code className="rounded bg-canvas px-1 py-0.5">docs/database.md</code>{' '}
        setelah skema final.
      </p>
    </div>
  )
}
