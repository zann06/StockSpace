/**
 * Fictional seed data — "Toko TechNusa" (PRD §10: no real business data).
 *
 * Matches the Phase 1 web mock dataset (apps/web/src/mocks/warehouse-data.ts):
 * same warehouse, rack codes, coordinates, products, and balances so the 3D
 * scene looks identical after the Phase 3 switch to the API.
 *
 * Run with: npm run db:seed
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const LOCATIONS = [
  {
    code: 'A1',
    label: 'Rak A1',
    type: 'RACK' as const,
    zone: 'Zona Penyimpanan',
    x: -4.8,
    z: -2,
    capacity: 1200,
    levels: 3,
  },
  {
    code: 'A2',
    label: 'Rak A2',
    type: 'RACK' as const,
    zone: 'Zona Penyimpanan',
    x: -2.4,
    z: -2,
    capacity: 1200,
    levels: 3,
  },
  {
    code: 'B1',
    label: 'Rak B1',
    type: 'RACK' as const,
    zone: 'Zona Penyimpanan',
    x: 0,
    z: -2,
    capacity: 1200,
    levels: 3,
  },
  {
    code: 'B2',
    label: 'Rak B2',
    type: 'RACK' as const,
    zone: 'Zona Penyimpanan',
    x: 2.4,
    z: -2,
    capacity: 6000,
    levels: 3,
  },
  {
    code: 'B3',
    label: 'Rak B3',
    type: 'RACK' as const,
    zone: 'Zona Penyimpanan',
    x: 4.8,
    z: -2,
    capacity: 1200,
    levels: 3,
  },
  {
    code: 'STG-01',
    label: 'Area Staging',
    type: 'STAGING' as const,
    zone: 'Zona Penerimaan',
    x: -4.4,
    z: 1.9,
    capacity: 300,
    levels: 1,
  },
  {
    code: 'PCK-01',
    label: 'Area Packing',
    type: 'PACKING' as const,
    zone: 'Zona Pengiriman',
    x: 0.6,
    z: 2,
    capacity: 150,
    levels: 1,
  },
]

const CATEGORIES = ['Elektronik', 'Aksesoris', 'Komponen', 'ATK']

const PRODUCTS = [
  {
    sku: 'ELK-LAP-001',
    name: 'Laptop ASUS TUF F15',
    category: 'Elektronik',
    unit: 'unit',
    barcode: '8901234500011',
    costPrice: 5_500_000,
    reorderThreshold: 10,
    description: 'Laptop gaming 15,6" i5 RTX 2050 untuk stok toko.',
  },
  {
    sku: 'AKS-MOU-002',
    name: 'Mouse Wireless Ergonomis',
    category: 'Aksesoris',
    unit: 'unit',
    barcode: '8901234500028',
    costPrice: 85_000,
    reorderThreshold: 20,
    description: 'Mouse wireless 2,4 GHz dengan sensor 1600 DPI.',
  },
  {
    sku: 'AKS-KEY-003',
    name: 'Keyboard Mechanical RGB',
    category: 'Aksesoris',
    unit: 'unit',
    barcode: '8901234500035',
    costPrice: 350_000,
    reorderThreshold: 60,
    description: 'Keyboard mechanical switch merah, keycap PBT.',
  },
  {
    sku: 'AKS-HSD-004',
    name: 'Headset Gaming Pro',
    category: 'Aksesoris',
    unit: 'unit',
    barcode: '8901234500042',
    costPrice: 450_000,
    reorderThreshold: 8,
    description: 'Headset 7.1 surround dengan mikrofon noise-canceling.',
  },
  {
    sku: 'ELK-MON-005',
    name: 'Monitor IPS 24"',
    category: 'Elektronik',
    unit: 'unit',
    barcode: '8901234500059',
    costPrice: 1_500_000,
    reorderThreshold: 15,
    description: 'Monitor IPS Full HD 75Hz bezel tipis.',
  },
  {
    sku: 'ELK-WBC-006',
    name: 'Webcam Full HD 1080p',
    category: 'Elektronik',
    unit: 'unit',
    barcode: '8901234500066',
    costPrice: 320_000,
    reorderThreshold: 12,
    description: 'Webcam 1080p dengan mikrofon ganda.',
  },
  {
    sku: 'KOM-SSD-007',
    name: 'SSD NVMe 1TB',
    category: 'Komponen',
    unit: 'unit',
    barcode: '8901234500073',
    costPrice: 550_000,
    reorderThreshold: 15,
    description: 'SSD NVMe Gen3 1TB baca 3500 MB/s.',
  },
  {
    sku: 'KOM-RAM-008',
    name: 'RAM DDR4 16GB',
    category: 'Komponen',
    unit: 'unit',
    barcode: '8901234500080',
    costPrice: 750_000,
    reorderThreshold: 20,
    description: 'RAM DDR4 3200MHz CL16 single module.',
  },
  {
    sku: 'AKS-HDM-009',
    name: 'Kabel HDMI 2m',
    category: 'Aksesoris',
    unit: 'unit',
    barcode: '8901234500097',
    costPrice: 35_000,
    reorderThreshold: 50,
    description: 'Kabel HDMI 2.0 4K@60Hz sepanjang 2 meter.',
  },
  {
    sku: 'ELK-PRN-010',
    name: 'Printer Inkjet Multifungsi',
    category: 'Elektronik',
    unit: 'unit',
    barcode: '8901234500103',
    costPrice: 1_900_000,
    reorderThreshold: 5,
    description: 'Printer inkjet scan/copy Wi-Fi untuk kantor kecil.',
  },
  {
    sku: 'ATK-KRT-011',
    name: 'Kertas HVS A4 80gsm',
    category: 'ATK',
    unit: 'rim',
    barcode: '8901234500110',
    costPrice: 55_000,
    reorderThreshold: 40,
    description: 'Kertas HVS A4 80gsm putih per rim 500 lembar.',
  },
  {
    sku: 'ATK-TIN-012',
    name: 'Tinta Printer Hitam',
    category: 'ATK',
    unit: 'botol',
    barcode: '8901234500127',
    costPrice: 95_000,
    reorderThreshold: 90,
    description: 'Tinta botol hitam untuk printer inkjet.',
  },
  {
    sku: 'ATK-LBL-013',
    name: 'Label Barcode 100 lembar',
    category: 'ATK',
    unit: 'roll',
    barcode: '8901234500134',
    costPrice: 1_500,
    reorderThreshold: 200,
    description: 'Roll label barcode thermal 100 lembar per roll.',
  },
]

// [productSku, locationCode, level, quantity]
const BALANCES: [string, string, number, number][] = [
  ['ELK-LAP-001', 'A1', 1, 15],
  ['AKS-MOU-002', 'A1', 2, 48],
  ['AKS-KEY-003', 'A1', 2, 32],
  ['AKS-HSD-004', 'A1', 3, 5],
  ['ELK-MON-005', 'A2', 1, 16],
  ['ELK-WBC-006', 'A2', 2, 14],
  ['KOM-SSD-007', 'A2', 3, 26],
  ['KOM-RAM-008', 'B1', 1, 4],
  ['ELK-PRN-010', 'B1', 2, 3],
  ['ATK-TIN-012', 'B1', 3, 60],
  ['AKS-HDM-009', 'B2', 1, 38],
  ['ATK-KRT-011', 'B2', 2, 270],
  ['ATK-LBL-013', 'B2', 3, 4278],
  ['AKS-KEY-003', 'STG-01', 1, 12],
  ['ELK-MON-005', 'STG-01', 1, 4],
  ['AKS-MOU-002', 'PCK-01', 1, 6],
]

async function main() {
  console.log('Seeding StockSpace demo workspace (Toko TechNusa — fictional)…')

  await prisma.notification.deleteMany()
  await prisma.stockMovement.deleteMany()
  await prisma.inventoryBalance.deleteMany()
  await prisma.product.deleteMany()
  await prisma.category.deleteMany()
  await prisma.storageLocation.deleteMany()
  await prisma.zone.deleteMany()
  await prisma.warehouse.deleteMany()
  await prisma.workspaceMember.deleteMany()
  await prisma.workspace.deleteMany()
  await prisma.user.deleteMany()

  const workspace = await prisma.workspace.create({
    data: { name: 'Toko TechNusa', currency: 'IDR', timezone: 'Asia/Jakarta' },
  })

  const owner = await prisma.user.create({
    data: { name: 'Farid Rizky', email: 'farid@technusa.example' },
  })
  const staff1 = await prisma.user.create({
    data: { name: 'Dewi Lestari', email: 'dewi@technusa.example' },
  })
  const staff2 = await prisma.user.create({
    data: { name: 'Budi Santoso', email: 'budi@technusa.example' },
  })

  await prisma.workspaceMember.createMany({
    data: [
      { workspaceId: workspace.id, userId: owner.id, role: 'OWNER' },
      { workspaceId: workspace.id, userId: staff1.id, role: 'STAFF' },
      { workspaceId: workspace.id, userId: staff2.id, role: 'STAFF' },
    ],
  })

  const warehouse = await prisma.warehouse.create({
    data: { workspaceId: workspace.id, name: 'Gudang Utama', code: 'GDG-01' },
  })

  const zones = new Map<string, string>()
  const zoneCodes: [string, string][] = [
    ['Zona Penyimpanan', 'ZPS'],
    ['Zona Penerimaan', 'ZPR'],
    ['Zona Pengiriman', 'ZPG'],
  ]
  for (const [zoneName, zoneCode] of zoneCodes) {
    const zone = await prisma.zone.create({
      data: {
        warehouseId: warehouse.id,
        name: zoneName,
        code: zoneCode,
      },
    })
    zones.set(zoneName, zone.id)
  }

  const locationIds = new Map<string, string>()
  for (const location of LOCATIONS) {
    const created = await prisma.storageLocation.create({
      data: {
        warehouseId: warehouse.id,
        zoneId: zones.get(location.zone),
        type: location.type,
        code: location.code,
        label: location.label,
        x: location.x,
        z: location.z,
        capacity: location.capacity,
        levels: location.levels,
      },
    })
    locationIds.set(location.code, created.id)
  }

  const categoryIds = new Map<string, string>()
  for (const name of CATEGORIES) {
    const category = await prisma.category.create({
      data: { workspaceId: workspace.id, name },
    })
    categoryIds.set(name, category.id)
  }

  const productIds = new Map<string, string>()
  for (const product of PRODUCTS) {
    const created = await prisma.product.create({
      data: {
        workspaceId: workspace.id,
        sku: product.sku,
        name: product.name,
        categoryId: categoryIds.get(product.category),
        unit: product.unit,
        barcode: product.barcode,
        costPrice: product.costPrice,
        reorderThreshold: product.reorderThreshold,
        description: product.description,
      },
    })
    productIds.set(product.sku, created.id)
  }

  for (const [sku, locationCode, level, quantity] of BALANCES) {
    await prisma.inventoryBalance.create({
      data: {
        productId: productIds.get(sku)!,
        locationId: locationIds.get(locationCode)!,
        level,
        quantity,
      },
    })
  }

  // A week of movement history so dashboards have something to show.
  const actors = [owner.id, staff1.id, staff2.id]
  const now = new Date()
  const seeds: [
    number,
    number,
    number,
    string,
    'IN' | 'OUT' | 'TRANSFER' | 'ADJUSTMENT',
    number,
    string | null,
    string | null,
    string,
  ][] = [
    [0, 16, 47, 'AKS-HSD-004', 'OUT', 2, 'A1', null, 'SO-1042'],
    [0, 16, 12, 'ELK-LAP-001', 'IN', 10, null, 'A1', 'PO-2026-118'],
    [0, 15, 38, 'AKS-MOU-002', 'TRANSFER', 6, 'A1', 'PCK-01', 'TRF-231'],
    [0, 15, 4, 'AKS-HDM-009', 'OUT', 12, 'B2', null, 'SO-1041'],
    [0, 14, 41, 'ATK-LBL-013', 'IN', 500, null, 'B2', 'PO-2026-117'],
    [0, 14, 24, 'ATK-TIN-012', 'TRANSFER', 10, 'B1', 'STG-01', 'TRF-227'],
    [0, 14, 5, 'ELK-MON-005', 'ADJUSTMENT', -3, 'A2', null, 'ADJ-041'],
    [0, 13, 58, 'AKS-HSD-004', 'IN', 8, null, 'A1', 'PO-2026-119'],
    [0, 13, 26, 'AKS-KEY-003', 'IN', 24, null, 'STG-01', 'PO-2026-116'],
    [0, 12, 58, 'KOM-SSD-007', 'OUT', 4, 'A2', null, 'SO-1040'],
    [0, 12, 31, 'ATK-KRT-011', 'IN', 100, null, 'B2', 'PO-2026-115'],
    [0, 11, 47, 'ATK-TIN-012', 'OUT', 15, 'B1', null, 'SO-1039'],
    [0, 11, 29, 'ELK-WBC-006', 'OUT', 2, 'A2', null, 'SO-1035'],
    [0, 11, 12, 'ELK-WBC-006', 'TRANSFER', 4, 'A2', 'STG-01', 'TRF-230'],
    [0, 10, 47, 'ELK-LAP-001', 'OUT', 3, 'A1', null, 'SO-1038'],
    [0, 10, 24, 'ELK-LAP-001', 'IN', 20, null, 'A1', 'PO-2026-114'],
    [0, 10, 2, 'KOM-RAM-008', 'IN', 6, null, 'B1', 'PO-2026-113'],
    [0, 9, 52, 'ATK-KRT-011', 'OUT', 20, 'B2', null, 'SO-1034'],
    [0, 9, 41, 'ELK-PRN-010', 'OUT', 1, 'B1', null, 'SO-1037'],
    [0, 9, 18, 'ATK-LBL-013', 'OUT', 250, 'B2', null, 'SO-1036'],
    [0, 8, 55, 'ELK-MON-005', 'TRANSFER', 4, 'A2', 'STG-01', 'TRF-229'],
    [0, 8, 31, 'AKS-MOU-002', 'IN', 30, null, 'A1', 'PO-2026-112'],
    [0, 8, 12, 'AKS-KEY-003', 'TRANSFER', 12, 'A1', 'STG-01', 'TRF-228'],
    [0, 8, 5, 'AKS-HDM-009', 'IN', 40, null, 'B2', 'PO-2026-111'],
    [1, 16, 40, 'ELK-LAP-001', 'OUT', 5, 'A1', null, 'SO-1033'],
    [1, 11, 15, 'AKS-MOU-002', 'IN', 20, null, 'A1', 'PO-2026-110'],
    [1, 9, 30, 'ELK-MON-005', 'OUT', 2, 'A2', null, 'SO-1032'],
    [2, 15, 22, 'AKS-KEY-003', 'OUT', 6, 'A1', null, 'SO-1031'],
    [2, 10, 10, 'AKS-HDM-009', 'IN', 30, null, 'B2', 'PO-2026-109'],
    [3, 14, 5, 'KOM-SSD-007', 'IN', 10, null, 'A2', 'PO-2026-108'],
    [3, 10, 44, 'ATK-TIN-012', 'OUT', 25, 'B1', null, 'SO-1030'],
    [4, 16, 31, 'ELK-PRN-010', 'TRANSFER', 2, 'B1', 'STG-01', 'TRF-226'],
    [4, 9, 58, 'ATK-LBL-013', 'OUT', 400, 'B2', null, 'SO-1029'],
    [5, 13, 47, 'ELK-LAP-001', 'IN', 5, null, 'A1', 'PO-2026-107'],
    [5, 10, 26, 'ELK-WBC-006', 'IN', 12, null, 'A2', 'PO-2026-106'],
    [6, 15, 3, 'AKS-KEY-003', 'IN', 18, null, 'A1', 'PO-2026-105'],
    [6, 9, 41, 'ATK-KRT-011', 'OUT', 45, 'B2', null, 'SO-1028'],
  ]

  for (const [
    dayOffset,
    hour,
    minute,
    sku,
    type,
    quantity,
    source,
    destination,
    reference,
  ] of seeds) {
    const created = new Date(now)
    created.setDate(created.getDate() - dayOffset)
    created.setHours(hour, minute, 0, 0)
    await prisma.stockMovement.create({
      data: {
        workspaceId: workspace.id,
        productId: productIds.get(sku)!,
        type,
        quantity,
        sourceLocationId: source ? locationIds.get(source) : null,
        destinationLocationId: destination ? locationIds.get(destination) : null,
        reference,
        note: type === 'ADJUSTMENT' ? 'Unit rusak saat unboxing' : null,
        actorId: actors[dayOffset % actors.length]!,
        createdAt: created,
      },
    })
  }

  await prisma.notification.create({
    data: {
      workspaceId: workspace.id,
      type: 'LOW_STOCK',
      title: 'Beberapa produk di bawah ambang stok',
      body: 'Laptop, RAM, printer, dan tinta printer berada di bawah ambang pesan ulang (data contoh).',
    },
  })

  console.log(`Seed complete:
  workspace  : ${workspace.name} (${workspace.id})
  warehouse  : ${warehouse.name} (${warehouse.id})
  locations  : ${LOCATIONS.length}, products: ${PRODUCTS.length}, balances: ${BALANCES.length}
  movements  : ${seeds.length}
  X-Workspace-Id header for the API: ${workspace.id}`)
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
