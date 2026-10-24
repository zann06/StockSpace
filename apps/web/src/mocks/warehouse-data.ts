/**
 * ⚠️ MOCK DATA — Phase 1 only.
 *
 * Everything in this module is fictional demo data for the fictional business
 * "Toko TechNusa". It exists so the UI shell and 3D prototype can be built and
 * demonstrated before the API lands (Phase 2–3). Pages show a visible
 * "Mode Demo" indicator while this data is in use. Production API modules must
 * never import from this directory (see docs/architecture.md, decision D4).
 *
 * The shapes mirror the planned API payloads so swapping the source later is a
 * data-source change, not a rewrite.
 */

import type { Balance, Movement, MovementType, Product, StorageLocation, Warehouse } from '@/types'

export const warehouse: Warehouse = {
  id: 'wh-01',
  name: 'Gudang Utama',
  code: 'GDG-01',
}

export const locations: StorageLocation[] = [
  {
    id: 'loc-a1',
    warehouseId: 'wh-01',
    code: 'A1',
    label: 'Rak A1',
    type: 'RACK',
    zone: 'Zona Penyimpanan',
    x: -4.8,
    z: -2,
    rotation: 0,
    capacity: 1200,
  },
  {
    id: 'loc-a2',
    warehouseId: 'wh-01',
    code: 'A2',
    label: 'Rak A2',
    type: 'RACK',
    zone: 'Zona Penyimpanan',
    x: -2.4,
    z: -2,
    rotation: 0,
    capacity: 1200,
  },
  {
    id: 'loc-b1',
    warehouseId: 'wh-01',
    code: 'B1',
    label: 'Rak B1',
    type: 'RACK',
    zone: 'Zona Penyimpanan',
    x: 0,
    z: -2,
    rotation: 0,
    capacity: 1200,
  },
  {
    id: 'loc-b2',
    warehouseId: 'wh-01',
    code: 'B2',
    label: 'Rak B2',
    type: 'RACK',
    zone: 'Zona Penyimpanan',
    x: 2.4,
    z: -2,
    rotation: 0,
    capacity: 6000,
  },
  {
    id: 'loc-b3',
    warehouseId: 'wh-01',
    code: 'B3',
    label: 'Rak B3',
    type: 'RACK',
    zone: 'Zona Penyimpanan',
    x: 4.8,
    z: -2,
    rotation: 0,
    capacity: 1200,
  },
  {
    id: 'loc-stg',
    warehouseId: 'wh-01',
    code: 'STG-01',
    label: 'Area Staging',
    type: 'STAGING',
    zone: 'Zona Penerimaan',
    x: -4.4,
    z: 1.9,
    rotation: 0,
    capacity: 300,
  },
  {
    id: 'loc-pck',
    warehouseId: 'wh-01',
    code: 'PCK-01',
    label: 'Area Packing',
    type: 'PACKING',
    zone: 'Zona Pengiriman',
    x: 0.6,
    z: 2,
    rotation: 0,
    capacity: 150,
  },
]

export const products: Product[] = [
  {
    id: 'p-01',
    sku: 'ELK-LAP-001',
    name: 'Laptop ASUS TUF F15',
    category: 'Elektronik',
    unit: 'unit',
    barcode: '8901234500011',
    costPrice: 5_500_000,
    reorderThreshold: 10,
    description: 'Laptop gaming 15,6" i5 RTX 2050 untuk stok toko.',
    active: true,
    totalMoved: 320,
  },
  {
    id: 'p-02',
    sku: 'AKS-MOU-002',
    name: 'Mouse Wireless Ergonomis',
    category: 'Aksesoris',
    unit: 'unit',
    barcode: '8901234500028',
    costPrice: 85_000,
    reorderThreshold: 20,
    description: 'Mouse wireless 2,4 GHz dengan sensor 1600 DPI.',
    active: true,
    totalMoved: 280,
  },
  {
    id: 'p-03',
    sku: 'AKS-KEY-003',
    name: 'Keyboard Mechanical RGB',
    category: 'Aksesoris',
    unit: 'unit',
    barcode: '8901234500035',
    costPrice: 350_000,
    reorderThreshold: 60,
    description: 'Keyboard mechanical switch merah, keycap PBT.',
    active: true,
    totalMoved: 210,
  },
  {
    id: 'p-04',
    sku: 'AKS-HSD-004',
    name: 'Headset Gaming Pro',
    category: 'Aksesoris',
    unit: 'unit',
    barcode: '8901234500042',
    costPrice: 450_000,
    reorderThreshold: 8,
    description: 'Headset 7.1 surround dengan mikrofon noise-canceling.',
    active: true,
    totalMoved: 180,
  },
  {
    id: 'p-05',
    sku: 'ELK-MON-005',
    name: 'Monitor IPS 24"',
    category: 'Elektronik',
    unit: 'unit',
    barcode: '8901234500059',
    costPrice: 1_500_000,
    reorderThreshold: 15,
    description: 'Monitor IPS Full HD 75Hz bezel tipis.',
    active: true,
    totalMoved: 150,
  },
  {
    id: 'p-06',
    sku: 'ELK-WBC-006',
    name: 'Webcam Full HD 1080p',
    category: 'Elektronik',
    unit: 'unit',
    barcode: '8901234500066',
    costPrice: 320_000,
    reorderThreshold: 12,
    description: 'Webcam 1080p dengan mikrofon ganda.',
    active: true,
    totalMoved: 120,
  },
  {
    id: 'p-07',
    sku: 'KOM-SSD-007',
    name: 'SSD NVMe 1TB',
    category: 'Komponen',
    unit: 'unit',
    barcode: '8901234500073',
    costPrice: 550_000,
    reorderThreshold: 15,
    description: 'SSD NVMe Gen3 1TB baca 3500 MB/s.',
    active: true,
    totalMoved: 95,
  },
  {
    id: 'p-08',
    sku: 'KOM-RAM-008',
    name: 'RAM DDR4 16GB',
    category: 'Komponen',
    unit: 'unit',
    barcode: '8901234500080',
    costPrice: 750_000,
    reorderThreshold: 20,
    description: 'RAM DDR4 3200MHz CL16 single module.',
    active: true,
    totalMoved: 88,
  },
  {
    id: 'p-09',
    sku: 'AKS-HDM-009',
    name: 'Kabel HDMI 2m',
    category: 'Aksesoris',
    unit: 'unit',
    barcode: '8901234500097',
    costPrice: 35_000,
    reorderThreshold: 50,
    description: 'Kabel HDMI 2.0 4K@60Hz sepanjang 2 meter.',
    active: true,
    totalMoved: 45,
  },
  {
    id: 'p-10',
    sku: 'ELK-PRN-010',
    name: 'Printer Inkjet Multifungsi',
    category: 'Elektronik',
    unit: 'unit',
    barcode: '8901234500103',
    costPrice: 1_900_000,
    reorderThreshold: 5,
    description: 'Printer inkjet scan/copy Wi-Fi untuk kantor kecil.',
    active: true,
    totalMoved: 42,
  },
  {
    id: 'p-11',
    sku: 'ATK-KRT-011',
    name: 'Kertas HVS A4 80gsm',
    category: 'ATK',
    unit: 'rim',
    barcode: '8901234500110',
    costPrice: 55_000,
    reorderThreshold: 40,
    description: 'Kertas HVS A4 80gsm putih per rim 500 lembar.',
    active: true,
    totalMoved: 35,
  },
  {
    id: 'p-12',
    sku: 'ATK-TIN-012',
    name: 'Tinta Printer Hitam',
    category: 'ATK',
    unit: 'botol',
    barcode: '8901234500127',
    costPrice: 95_000,
    reorderThreshold: 90,
    description: 'Tinta botol hitam untuk printer inkjet.',
    active: true,
    totalMoved: 28,
  },
  {
    id: 'p-13',
    sku: 'ATK-LBL-013',
    name: 'Label Barcode 100 lembar',
    category: 'ATK',
    unit: 'roll',
    barcode: '8901234500134',
    costPrice: 1_500,
    reorderThreshold: 200,
    description: 'Roll label barcode thermal 100 lembar per roll.',
    active: true,
    totalMoved: 24,
  },
]

export const balances: Balance[] = [
  // Rak A1 — elektronik utama
  { productId: 'p-01', locationId: 'loc-a1', level: 1, quantity: 15 },
  { productId: 'p-02', locationId: 'loc-a1', level: 2, quantity: 48 },
  { productId: 'p-03', locationId: 'loc-a1', level: 2, quantity: 32 },
  { productId: 'p-04', locationId: 'loc-a1', level: 3, quantity: 5 },
  // Rak A2 — sehat (indikator hijau "terisi")
  { productId: 'p-05', locationId: 'loc-a2', level: 1, quantity: 16 },
  { productId: 'p-06', locationId: 'loc-a2', level: 2, quantity: 14 },
  { productId: 'p-07', locationId: 'loc-a2', level: 3, quantity: 26 },
  // Rak B1 — beberapa produk menipis
  { productId: 'p-08', locationId: 'loc-b1', level: 1, quantity: 4 },
  { productId: 'p-10', locationId: 'loc-b1', level: 2, quantity: 3 },
  { productId: 'p-12', locationId: 'loc-b1', level: 3, quantity: 60 },
  // Rak B2 — consumable high-volume
  { productId: 'p-09', locationId: 'loc-b2', level: 1, quantity: 38 },
  { productId: 'p-11', locationId: 'loc-b2', level: 2, quantity: 270 },
  { productId: 'p-13', locationId: 'loc-b2', level: 3, quantity: 4278 },
  // Rak B3 — kosong (indikator abu-abu)
  // Area staging & packing — stok transient
  { productId: 'p-03', locationId: 'loc-stg', quantity: 12 },
  { productId: 'p-05', locationId: 'loc-stg', quantity: 4 },
  { productId: 'p-02', locationId: 'loc-pck', quantity: 6 },
]

type MovementSeed = [
  dayOffset: number,
  hour: number,
  minute: number,
  productId: string,
  type: MovementType,
  quantity: number,
  sourceLocationId: string | null,
  destinationLocationId: string | null,
  actor: string,
  reference: string | null,
]

const ACTORS = ['Farid Rizky', 'Dewi Lestari', 'Budi Santoso']

/**
 * Movements are generated relative to `now` so the dashboard always shows a
 * live-looking "Hari ini". Tests pass a fixed date for determinism.
 */
const MOVEMENT_SEEDS: MovementSeed[] = [
  // — Hari ini (24 transaksi) —
  [0, 16, 47, 'p-04', 'OUT', 2, 'loc-a1', null, ACTORS[0], 'SO-1042'],
  [0, 16, 12, 'p-01', 'IN', 10, null, 'loc-a1', ACTORS[1], 'PO-2026-118'],
  [0, 15, 38, 'p-02', 'TRANSFER', 6, 'loc-a1', 'loc-pck', ACTORS[2], 'TRF-231'],
  [0, 15, 4, 'p-09', 'OUT', 12, 'loc-b2', null, ACTORS[0], 'SO-1041'],
  [0, 14, 41, 'p-13', 'IN', 500, null, 'loc-b2', ACTORS[1], 'PO-2026-117'],
  [0, 14, 24, 'p-12', 'TRANSFER', 10, 'loc-b1', 'loc-stg', ACTORS[1], 'TRF-227'],
  [0, 14, 5, 'p-05', 'ADJUSTMENT', -3, 'loc-a2', null, ACTORS[2], 'ADJ-041'],
  [0, 13, 58, 'p-04', 'IN', 8, null, 'loc-a1', ACTORS[1], 'PO-2026-119'],
  [0, 13, 26, 'p-03', 'IN', 24, null, 'loc-stg', ACTORS[1], 'PO-2026-116'],
  [0, 12, 58, 'p-07', 'OUT', 4, 'loc-a2', null, ACTORS[0], 'SO-1040'],
  [0, 12, 31, 'p-11', 'IN', 100, null, 'loc-b2', ACTORS[2], 'PO-2026-115'],
  [0, 11, 47, 'p-12', 'OUT', 15, 'loc-b1', null, ACTORS[1], 'SO-1039'],
  [0, 11, 29, 'p-06', 'OUT', 2, 'loc-a2', null, ACTORS[2], 'SO-1035'],
  [0, 11, 12, 'p-06', 'TRANSFER', 4, 'loc-a2', 'loc-stg', ACTORS[0], 'TRF-230'],
  [0, 10, 47, 'p-01', 'OUT', 3, 'loc-a1', null, ACTORS[1], 'SO-1038'],
  [0, 10, 24, 'p-01', 'IN', 20, null, 'loc-a1', ACTORS[2], 'PO-2026-114'],
  [0, 10, 2, 'p-08', 'IN', 6, null, 'loc-b1', ACTORS[1], 'PO-2026-113'],
  [0, 9, 52, 'p-11', 'OUT', 20, 'loc-b2', null, ACTORS[0], 'SO-1034'],
  [0, 9, 41, 'p-10', 'OUT', 1, 'loc-b1', null, ACTORS[0], 'SO-1037'],
  [0, 9, 18, 'p-13', 'OUT', 250, 'loc-b2', null, ACTORS[2], 'SO-1036'],
  [0, 8, 55, 'p-05', 'TRANSFER', 4, 'loc-a2', 'loc-stg', ACTORS[1], 'TRF-229'],
  [0, 8, 31, 'p-02', 'IN', 30, null, 'loc-a1', ACTORS[2], 'PO-2026-112'],
  [0, 8, 12, 'p-03', 'TRANSFER', 12, 'loc-a1', 'loc-stg', ACTORS[0], 'TRF-228'],
  [0, 8, 5, 'p-09', 'IN', 40, null, 'loc-b2', ACTORS[1], 'PO-2026-111'],
  // — Hari-hari sebelumnya —
  [1, 16, 40, 'p-01', 'OUT', 5, 'loc-a1', null, ACTORS[0], 'SO-1033'],
  [1, 11, 15, 'p-02', 'IN', 20, null, 'loc-a1', ACTORS[2], 'PO-2026-110'],
  [1, 9, 30, 'p-05', 'OUT', 2, 'loc-a2', null, ACTORS[1], 'SO-1032'],
  [2, 15, 22, 'p-03', 'OUT', 6, 'loc-a1', null, ACTORS[0], 'SO-1031'],
  [2, 10, 10, 'p-09', 'IN', 30, null, 'loc-b2', ACTORS[1], 'PO-2026-109'],
  [3, 14, 5, 'p-07', 'IN', 10, null, 'loc-a2', ACTORS[2], 'PO-2026-108'],
  [3, 10, 44, 'p-12', 'OUT', 25, 'loc-b1', null, ACTORS[0], 'SO-1030'],
  [4, 16, 31, 'p-10', 'TRANSFER', 2, 'loc-b1', 'loc-stg', ACTORS[1], 'TRF-226'],
  [4, 9, 58, 'p-13', 'OUT', 400, 'loc-b2', null, ACTORS[2], 'SO-1029'],
  [5, 13, 47, 'p-01', 'IN', 5, null, 'loc-a1', ACTORS[0], 'PO-2026-107'],
  [5, 10, 26, 'p-06', 'IN', 12, null, 'loc-a2', ACTORS[1], 'PO-2026-106'],
  [6, 15, 3, 'p-03', 'IN', 18, null, 'loc-a1', ACTORS[2], 'PO-2026-105'],
  [6, 9, 41, 'p-11', 'OUT', 45, 'loc-b2', null, ACTORS[0], 'SO-1028'],
]

export function buildMovements(now: Date = new Date()): Movement[] {
  return MOVEMENT_SEEDS.map((seed, index) => {
    const [
      dayOffset,
      hour,
      minute,
      productId,
      type,
      quantity,
      source,
      destination,
      actor,
      reference,
    ] = seed
    const created = new Date(now)
    created.setDate(created.getDate() - dayOffset)
    created.setHours(hour, minute, 0, 0)
    return {
      id: `mv-${(index + 1).toString().padStart(3, '0')}`,
      productId,
      type,
      quantity,
      sourceLocationId: source,
      destinationLocationId: destination,
      reference,
      note: type === 'ADJUSTMENT' ? 'Unit rusak saat unboxing' : null,
      actor,
      createdAt: created.toISOString(),
    }
  }).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export const movements = buildMovements()

/** Demo metadata for UI chrome (user, team, KPI deltas). Fictional. */
export const demoMeta = {
  currentUser: {
    name: 'Farid Rizky',
    email: 'farid@technusa.example',
    role: 'ADMIN' as const,
    initials: 'FR',
  },
  team: [
    { name: 'Farid Rizky', email: 'farid@technusa.example', role: 'Admin' },
    { name: 'Dewi Lestari', email: 'dewi@technusa.example', role: 'Staf Gudang' },
    { name: 'Budi Santoso', email: 'budi@technusa.example', role: 'Staf Gudang' },
  ],
  businessName: 'Toko TechNusa',
  kpiDeltas: {
    totalStock: { text: '+3,2%', direction: 'up', sentiment: 'positive', caption: 'vs bulan lalu' },
    lowStock: { text: '+2 item', direction: 'up', sentiment: 'negative', caption: 'minggu ini' },
    inventoryValue: {
      text: '+8,4%',
      direction: 'up',
      sentiment: 'positive',
      caption: 'vs bulan lalu',
    },
    movementsToday: { text: '−5%', direction: 'down', sentiment: 'neutral', caption: 'vs kemarin' },
  } as const,
}
