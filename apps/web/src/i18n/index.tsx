import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

import { setActiveLocale } from '@/lib/format'

/**
 * Minimal gettext-style i18n: catalog keys are the Indonesian source strings
 * themselves, so `t('Total Stok')` returns the Indonesian text as-is and the
 * English translation when `lang === 'en'`. Untranslated keys gracefully fall
 * back to Indonesian.
 */

export type Lang = 'id' | 'en'

const STORAGE_KEY = 'stockspace.lang'

const en: Record<string, string> = {
  // Shell / navigation
  'Lompat ke konten utama': 'Skip to main content',
  'Navigasi utama': 'Main navigation',
  Dashboard: 'Dashboard',
  'Warehouse 3D': '3D Warehouse',
  Inventaris: 'Inventory',
  Transaksi: 'Transactions',
  Laporan: 'Reports',
  Pengaturan: 'Settings',
  'Buka menu navigasi': 'Open navigation menu',
  'Tutup menu': 'Close menu',
  'StockSpace — ke Dashboard': 'StockSpace — go to Dashboard',
  'Smarter Inventory, Better Business': 'Smarter Inventory, Better Business',
  'Kelola stok, lokasi, dan laporan gudang Anda dalam satu tempat.':
    'Manage stock, locations, and warehouse reports in one place.',
  Upgrade: 'Upgrade Pro',
  'Fitur opsional — StockSpace adalah MVP open-source dan belum memiliki paket berbayar.':
    'Optional feature — StockSpace is an open-source MVP and has no paid plan yet.',
  // Header / search
  'Cari produk, rak, atau kode barang…': 'Search products, racks, or item codes…',
  'Cari produk, rak, atau kode barang': 'Search products, racks, or item codes',
  Produk: 'Products',
  Lokasi: 'Locations',
  'Tidak ada hasil untuk': 'No results for',
  Notifikasi: 'Notifications',
  'Tandai dibaca': 'Mark as read',
  'Belum ada notifikasi.': 'No notifications yet.',
  'Memuat notifikasi…': 'Loading notifications…',
  'buka menu pengguna': 'open user menu',
  Owner: 'Owner',
  Admin: 'Admin',
  'Staf Gudang': 'Warehouse Staff',
  Viewer: 'Viewer',
  'Workspace aktif': 'Active workspace',
  Keluar: 'Sign out',
  'Keluar…': 'Signing out…',
  // Login
  'Masuk untuk mengelola inventaris Anda': 'Sign in to manage your inventory',
  Email: 'Email',
  Password: 'Password',
  Masuk: 'Sign in',
  'Memproses…': 'Processing…',
  'Gagal masuk — periksa email dan password Anda.':
    'Sign-in failed — check your email and password.',
  'Akun demo (development only)': 'Demo accounts (development only)',
  'Password:': 'Password:',
  dari: 'from',
  // Dashboard
  'Selamat datang kembali': 'Welcome back',
  'Berikut ringkasan aktivitas gudang Anda hari ini.':
    'Here is your warehouse activity summary for today.',
  'Total Stok': 'Total Stock',
  unit: 'units',
  'Stok Menipis': 'Low Stock',
  'Nilai Inventory': 'Inventory Value',
  'Transaksi Hari Ini': "Today's Transactions",
  transaksi: 'transactions',
  'Tambah Barang Masuk': 'Record Stock In',
  'Gagal memuat ringkasan dashboard': 'Failed to load dashboard summary',
  'Coba lagi': 'Retry',
  'Gagal memuat data gudang': 'Failed to load warehouse data',
  'Nilai inventory = Σ(qty × harga pokok) =': 'Inventory value = Σ(qty × cost price) =',
  'Stok Minimum': 'Minimum Stock',
  'produk di bawah ambang pesan ulang': 'products below reorder threshold',
  'Lihat semua': 'View all',
  'Semua produk berada di atas ambang stok.': 'All products are above their stock threshold.',
  'Produk Terlaris': 'Top Products',
  'Unit bergerak — 30 hari terakhir': 'Units moved — last 30 days',
  'Belum ada pergerakan stok dalam 30 hari terakhir.': 'No stock movements in the last 30 days.',
  bergerak: 'moved',
  'Pergerakan Stok': 'Stock Movements',
  '7 hari terakhir': 'last 7 days',
  'Memuat scene 3D…': 'Loading 3D scene…',
  'Memuat data gudang…': 'Loading warehouse data…',
  'Detail Lokasi': 'Location Detail',
  'Detail Rak': 'Rack Detail',
  'Detail Area': 'Area Detail',
  Terisi: 'Occupied',
  Menipis: 'Low',
  Kosong: 'Empty',
  'Stok Menipis!': 'Low Stock!',
  'Belum ada lokasi dipilih': 'No location selected',
  'Klik rak atau area pada scene 3D, atau buka daftar lokasi, untuk melihat detail dan barang yang tersimpan di dalamnya.':
    'Click a rack or area in the 3D scene, or open the location list, to see its details and stored items.',
  'Total Unit': 'Total Units',
  Kapasitas: 'Capacity',
  'Jenis Produk': 'Product Types',
  Tingkat: 'Levels',
  'Daftar Barang': 'Items',
  'Belum ada barang di lokasi ini. Barang yang ditempatkan di sini akan tampil otomatis.':
    'No items at this location yet. Items placed here will appear automatically.',
  'Riwayat Pergerakan': 'Movement History',
  'Memuat riwayat…': 'Loading history…',
  'Belum ada pergerakan tercatat di lokasi ini.': 'No movements recorded at this location yet.',
  'Lihat semua barang di lokasi ini →': 'View all items at this location →',
  'Riwayat lengkap': 'Full history',
  'Tampilkan daftar lokasi (alternatif tanpa 3D)': 'Show location list (3D-free alternative)',
  'Daftar Lokasi': 'Location List',
  'Tutup daftar lokasi': 'Close location list',
  'Tampilan 3D tidak tersedia di perangkat ini — menampilkan daftar lokasi sebagai alternatif.':
    '3D view is unavailable on this device — showing the location list instead.',
  'Mode tampilan warehouse': 'Warehouse view mode',
  'Tampilan 3D': '3D view',
  'Tampilan 2D dari atas': 'Top-down 2D view',
  'Filter tingkat rak': 'Filter rack levels',
  Semua: 'All',
  Perkecil: 'Zoom out',
  Perbesar: 'Zoom in',
  'Reset kamera': 'Reset camera',
  'Reset kamera ke posisi awal': 'Reset camera to its initial position',
  'Layar penuh': 'Fullscreen',
  'Keluar dari layar penuh': 'Exit fullscreen',
  'Tampilan 2D': '2D view',
  // Transactions
  'Catat dan pantau pergerakan stok — barang masuk, keluar, transfer, dan penyesuaian.':
    'Record and track stock movements — in, out, transfer, and adjustment.',
  'Difilter berdasarkan lokasi': 'Filtered by location',
  'Hapus filter': 'Clear filter',
  'Barang Masuk': 'Stock In',
  'Barang Keluar': 'Stock Out',
  Transfer: 'Transfer',
  Penyesuaian: 'Adjustment',
  'Terima stok dari pemasok ke lokasi penyimpanan.': 'Receive stock from a supplier into storage.',
  'Keluarkan stok dari lokasi penyimpanan (penjualan/pemakaian).':
    'Issue stock from storage (sales/usage).',
  'Pindahkan stok antar lokasi/level — jumlah tetap terjaga.':
    'Move stock between locations/levels — quantity is preserved.',
  'Koreksi stok (stock opname, kerusakan) — wajib menyertakan alasan.':
    'Correct stock (stocktake, damage) — a reason is required.',
  'Catat Barang Masuk': 'Record Stock In',
  'Catat Barang Keluar': 'Record Stock Out',
  'Catat Transfer': 'Record Transfer',
  'Catat Penyesuaian': 'Record Adjustment',
  'Pilih produk terlebih dahulu.': 'Select a product first.',
  'Jumlah harus berupa angka.': 'Quantity must be a number.',
  'Jumlah harus bilangan bulat.': 'Quantity must be a whole number.',
  'Penyesuaian tidak boleh 0.': 'Adjustment cannot be 0.',
  'Jumlah harus lebih dari 0.': 'Quantity must be greater than 0.',
  'Pilih lokasi sumber.': 'Select a source location.',
  'Pilih lokasi tujuan.': 'Select a destination location.',
  'Alasan penyesuaian wajib diisi (min. 3 karakter).':
    'An adjustment reason is required (min. 3 characters).',
  'Lokasi Sumber': 'Source Location',
  'Lokasi Tujuan': 'Destination Location',
  '— Pilih produk —': '— Select a product —',
  '— Pilih lokasi —': '— Select a location —',
  Referensi: 'Reference',
  'mis. PO-2026-120': 'e.g. PO-2026-120',
  'Alasan Penyesuaian': 'Adjustment Reason',
  'Catatan (opsional)': 'Note (optional)',
  'mis. Hasil stock opname — 2 unit rusak': 'e.g. Stocktake result — 2 units damaged',
  'mis. Terima dari pemasok A': 'e.g. Received from supplier A',
  'Tujuan tidak boleh sama dengan sumber (lokasi & level).':
    'Destination must differ from source (location & level).',
  'Stok produk ini di sini:': 'This product here:',
  'Transaksi berhasil dicatat': 'Movement recorded successfully',
  'Saldo dan riwayat telah diperbarui.': 'Balances and history have been updated.',
  'Transaksi gagal dicatat.': 'Failed to record the movement.',
  'Menyimpan…': 'Saving…',
  Jenis: 'Type',
  'Dari → Ke': 'From → To',
  Qty: 'Qty',
  Aktor: 'Actor',
  Waktu: 'Time',
  'Cari transaksi': 'Search transactions',
  'Cari produk, referensi, aktor…': 'Search product, reference, actor…',
  'Filter jenis transaksi': 'Filter movement type',
  'Memuat transaksi…': 'Loading transactions…',
  'Gagal memuat transaksi': 'Failed to load transactions',
  'Tidak ada transaksi yang cocok': 'No matching transactions',
  'Belum ada transaksi tercatat. Gunakan tab di atas untuk mencatat transaksi baru.':
    'No transactions yet. Use the tabs above to record one.',
  'transaksi terbaru': 'latest transactions',
  'Setiap transaksi tersimpan permanen — koreksi dilakukan lewat penyesuaian, bukan menghapus riwayat.':
    'Every movement is stored permanently — corrections use adjustments, never deletion.',
  Sesuaikan: 'Adjust',
  // Inventory
  'Daftar produk dan penyebaran stok per lokasi penyimpanan.':
    'Product list and stock spread across storage locations.',
  'Tambah Produk': 'Add Product',
  'Pembuatan produk dari UI tersedia mulai Fase 4 (butuh sesi & otorisasi).':
    'Creating products from the UI arrives in Phase 4 (needs session & authorization).',
  Kategori: 'Category',
  Urutkan: 'Sort by',
  'Nama A–Z': 'Name A–Z',
  'Stok terendah': 'Lowest stock',
  'Nilai tertinggi': 'Highest value',
  'Cari nama, SKU, atau barcode…': 'Search name, SKU, or barcode…',
  'Cari produk': 'Search products',
  'Memuat produk…': 'Loading products…',
  'Gagal memuat produk': 'Failed to load products',
  'Tidak ada produk yang cocok': 'No matching products',
  'Coba ubah kata kunci pencarian, kategori, atau hapus filter lokasi.':
    'Try changing the search keyword, category, or clearing the location filter.',
  'Reset filter': 'Reset filter',
  produk: 'products',
  Menampilkan: 'Showing',
  'Halaman sebelumnya': 'Previous page',
  'Halaman berikutnya': 'Next page',
  'Klik baris produk untuk melihat detail, penyebaran lokasi, dan riwayat pergerakan.':
    'Click a product row to see details, location spread, and movement history.',
  'Harga Pokok': 'Cost Price',
  Ambang: 'Threshold',
  'Stok per Lokasi': 'Stock by Location',
  'lokasi menyimpan produk ini': 'locations store this product',
  'Belum ada stok tersimpan': 'No stock stored yet',
  'Stok akan muncul di sini setelah barang masuk diterima di sebuah lokasi.':
    'Stock appears here once a stock-in is received at a location.',
  'Belum ada pergerakan': 'No movements yet',
  'Transaksi barang masuk/keluar untuk produk ini akan tercatat di sini.':
    'In/out movements for this product will be recorded here.',
  'Kembali ke Inventaris': 'Back to Inventory',
  'Produk tidak ditemukan': 'Product not found',
  'Produk mungkin telah diarsipkan atau tautan tidak valid.':
    'The product may have been archived or the link is invalid.',
  'Gagal memuat produk…': 'Failed to load product…',
  'Memuat produk… ': 'Loading product… ',
  Aktif: 'Active',
  Nonaktif: 'Inactive',
  'Ambang Pesan Ulang': 'Reorder Threshold',
  'Nilai Stok': 'Stock Value',
  Diperbarui: 'Updated',
  'Edit Produk': 'Edit Product',
  'Penyuntingan produk dari UI tersedia mulai Fase 4 (butuh sesi & otorisasi).':
    'Editing products from the UI arrives in Phase 4 (needs session & authorization).',
  'Catat Pergerakan': 'Record Movement',
  Barcode: 'Barcode',
  // Reports
  'Analisis pergerakan stok, produk menipis, dan sebaran inventaris — dari data tersimpan.':
    'Analysis of stock movements, low-stock products, and inventory spread — from stored data.',
  'CSV Stok Menipis': 'Low-stock CSV',
  'CSV Pergerakan': 'Movements CSV',
  'Unduh laporan stok menipis sebagai CSV': 'Download the low-stock report as CSV',
  'Unduh laporan pergerakan (dengan filter aktif) sebagai CSV':
    'Download the movements report (with active filters) as CSV',
  'Menyiapkan…': 'Preparing…',
  'Ekspor gagal.': 'Export failed.',
  'Laporan Stok Menipis': 'Low-Stock Report',
  'produk aktif di bawah ambang pesan ulang': 'active products below reorder threshold',
  Kekurangan: 'Shortfall',
  Sisa: 'Remaining',
  ambang: 'threshold',
  'Laporan Pergerakan Stok': 'Stock Movement Report',
  'transaksi cocok dengan filter': 'transactions match the filters',
  Dari: 'From',
  Sampai: 'To',
  'Semua produk': 'All products',
  'Tidak ada transaksi yang cocok dengan filter.': 'No transactions match the filters.',
  'Memuat laporan…': 'Loading report…',
  'Ekspor CSV': 'CSV export',
  'Nilai stok = Σ(kuantitas × harga pokok) — perhitungan didokumentasikan di docs/database.md':
    'Stock value = Σ(quantity × cost price) — documented in docs/database.md',
  'Laporan memuat hingga 50 transaksi per halaman': 'Reports show up to 50 transactions per page',
  'Halaman {page} dari {total}': 'Page {page} of {total}',
  Sebelumnya: 'Previous',
  Berikutnya: 'Next',
  'ekspor CSV mengunduh hingga 5.000 baris dengan filter yang sedang aktif.':
    'CSV export downloads up to 5,000 rows with the active filters.',
  // Settings
  'Konfigurasi workspace, kategori, pengguna, dan tata letak gudang.':
    'Configure workspace, categories, users, and warehouse layout.',
  Workspace: 'Workspace',
  'Mata uang': 'Currency',
  'Zona waktu': 'Timezone',
  'Penggantian nama, locale, dan penyimpanan pengaturan lainnya tersedia setelah sesi & otorisasi terhubung (Fase 4).':
    'Renaming, locale, and other settings persistence arrive with sessions & authorization (Phase 4).',
  Gudang: 'Warehouse',
  'Nama gudang': 'Warehouse name',
  'Kode gudang': 'Warehouse code',
  'lokasi aktif. Editor tata letak (tambah/geser rak, atur kapasitas dan koordinat) menyusul bersama otorisasi admin (Fase 4) — koordinat tersimpan di database dan langsung dipakai scene 3D.':
    'active locations. The layout editor (add/move racks, set capacity and coordinates) arrives with admin authorization (Phase 4) — coordinates live in the database and drive the 3D scene.',
  'kategori terdaftar': 'categories registered',
  'Belum ada kategori.': 'No categories yet.',
  Pengguna: 'Users',
  'Manajemen anggota workspace dan perannya': 'Workspace members and their roles',
  'Manajemen pengguna (mengundang anggota, mengatur peran Owner/Admin/Staf/Viewer) tersedia setelah autentikasi diimplementasikan pada Fase 4. Role sudah diterapkan di skema database dan siap dipakai API.':
    'User management (inviting members, setting Owner/Admin/Staff/Viewer roles) arrives with authentication in Phase 4. Roles are already enforced in the database schema and API.',
  '+ Undang Pengguna': '+ Invite User',
  'Manajemen pengguna tersedia setelah autentikasi Fase 4 terhubung.':
    'User management arrives with authentication in Phase 4.',
  'Bahasa / Language': 'Bahasa / Language',
  'Bahasa tampilan aplikasi': 'Application display language',
  'Lihat tutorial': 'View tutorial',
  'Jalankan tur pengenalan aplikasi kembali.': 'Replay the app introduction tour.',
  Mulai: 'Start',
  // Tour
  'Selamat datang di StockSpace': 'Welcome to StockSpace',
  'Kelola inventaris Anda dan jelajahi gudang dalam 3D. Tur singkat ini memperkenalkan fitur utamanya — cukup satu menit.':
    'Manage your inventory and explore the warehouse in 3D. This quick tour introduces the key features — just one minute.',
  'Mulai Tur': 'Start Tour',
  Lewati: 'Skip',
  Lanjut: 'Next',
  Selesai: 'Done',
  'Akses cepat': 'Quick access',
  'Semua modul ada di sidebar: dashboard, gudang 3D, inventaris, transaksi, laporan, dan pengaturan.':
    'Every module lives in the sidebar: dashboard, 3D warehouse, inventory, transactions, reports, and settings.',
  'Gudang 3D interaktif': 'Interactive 3D warehouse',
  'Klik rak untuk melihat barang dan riwayatnya. Kamera bisa diputar, di-zoom, dan di-reset; filter L1–L3 menyaring tingkat rak.':
    'Click a rack to see its items and history. Rotate, zoom, and reset the camera; L1–L3 filters shelf levels.',
  'Catat pergerakan stok': 'Record stock movements',
  'Formulir barang masuk/keluar/transfer/penyesuaian menulis langsung ke database — stok tidak pernah bisa minus.':
    'The stock-in/out/transfer/adjustment forms write straight to the database — stock can never go negative.',
  'Pantau & ekspor': 'Monitor & export',
  'Dashboard dan laporan dihitung dari data tersimpan, lengkap dengan ekspor CSV dan notifikasi stok menipis.':
    'The dashboard and reports are computed from stored data, with CSV export and low-stock notifications.',
  'Tur selesai': 'Tour complete',
  'Selamat menggunakan StockSpace! Anda bisa memutar ulang tur ini kapan saja dari Pengaturan.':
    'Enjoy StockSpace! You can replay this tour anytime from Settings.',
  // Misc
  'Mode Demo': 'Demo mode',
  'Data Seed Demo': 'Seeded demo data',
  'Memuat StockSpace…': 'Loading StockSpace…',
  'Memuat workspace…': 'Loading workspace…',
  'Tidak dapat terhubung ke server': 'Cannot reach the server',
  'Hari ini': 'Today',
  Kemarin: 'Yesterday',
  hari: 'days',
  Terlaris: 'bestseller',
  // Workspace members
  Staf: 'Staff',
  Peran: 'Role',
  Anda: 'You',
  'Memuat anggota…': 'Loading members…',
  'Gagal memuat anggota.': 'Failed to load members.',
  'Belum ada anggota.': 'No members yet.',
  'Peran untuk {name}': 'Role for {name}',
  'Hapus {name}': 'Remove {name}',
  'Yakin menghapus {name}?': 'Remove {name}?',
  'Ya, hapus': 'Yes, remove',
  Batal: 'Cancel',
  '{name} berhasil diundang.': '{name} was invited.',
  'Peran {name} diperbarui.': "{name}'s role was updated.",
  '{name} dihapus dari workspace.': '{name} was removed from the workspace.',
  'Email pengguna terdaftar': 'Registered user email',
  'Kirim undangan': 'Send invite',
  'Mengundang…': 'Inviting…',
  'Tutup formulir undangan': 'Close invite form',
  'Pengguna harus sudah memiliki akun StockSpace dengan email ini.':
    'The user must already have a StockSpace account with this email.',
  'Hanya Owner dan Admin yang dapat mengelola anggota.':
    'Only Owners and Admins can manage members.',
  // Product create/edit
  'Akses terbatas': 'Restricted access',
  'Hanya Owner dan Admin yang dapat menambah atau mengubah produk.':
    'Only Owners and Admins can create or edit products.',
  'Tautan tidak valid atau produk telah dihapus.':
    'The link is invalid or the product was removed.',
  'Kembali ke Detail Produk': 'Back to Product Details',
  'Perbarui data produk. SKU tidak dapat diubah setelah dibuat.':
    'Update the product. The SKU cannot be changed after creation.',
  'Lengkapi data produk baru untuk workspace ini.':
    'Fill in the new product details for this workspace.',
  'Nama produk': 'Product name',
  'Tanpa kategori': 'No category',
  Satuan: 'Unit',
  Opsional: 'Optional',
  'Produk aktif': 'Active product',
  Deskripsi: 'Description',
  'Gagal menyimpan produk.': 'Failed to save the product.',
  'Simpan Perubahan': 'Save Changes',
  'Buat Produk': 'Create Product',
  'SKU tidak dapat diubah.': 'The SKU cannot be changed.',
  'Contoh: Laptop ASUS TUF F15': 'Example: Laptop ASUS TUF F15',
  'Nilai terlalu besar.': 'Value is too large.',
}

const CATALOGS: Record<Lang, Record<string, string>> = { id: {}, en }

function detectInitialLang(): Lang {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === 'id' || stored === 'en') return stored
  } catch {
    // storage unavailable
  }
  return 'id'
}

interface I18nContextValue {
  lang: Lang
  locale: string
  setLang: (lang: Lang) => void
  t: (key: string, vars?: Record<string, string | number>) => string
}

const I18nContext = createContext<I18nContextValue | null>(null)

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(detectInitialLang)

  const setLang = (next: Lang) => {
    setLangState(next)
    try {
      localStorage.setItem(STORAGE_KEY, next)
    } catch {
      // storage unavailable — in-memory only
    }
  }

  useEffect(() => {
    document.documentElement.lang = lang
    setActiveLocale(lang === 'en' ? 'en-US' : 'id-ID')
  }, [lang])

  const value = useMemo<I18nContextValue>(() => {
    const t = (key: string, vars?: Record<string, string | number>) => {
      let text = CATALOGS[lang][key] ?? key
      if (vars) {
        for (const [name, replacement] of Object.entries(vars)) {
          text = text.replaceAll(`{${name}}`, String(replacement))
        }
      }
      return text
    }
    return { lang, locale: lang === 'en' ? 'en-US' : 'id-ID', setLang, t }
  }, [lang])

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n(): I18nContextValue {
  const context = useContext(I18nContext)
  if (!context) throw new Error('useI18n must be used within I18nProvider')
  return context
}
