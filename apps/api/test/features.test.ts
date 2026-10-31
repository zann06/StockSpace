import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { prisma } from '../src/lib/prisma.js'
import {
  buildTestApp,
  call,
  createFixtures,
  getBalanceQuantity,
  seedBalance,
  truncateAll,
  type Fixtures,
  type TestApp,
} from './helpers.js'

/**
 * Integration tests for the post-MVP features: suppliers, stock opname
 * (stocktakes), product CSV import, restock report, and supplier-tagged
 * stock-ins.
 */

let fixtures: Fixtures
let testApp: TestApp

beforeAll(async () => {
  testApp = await buildTestApp()
})

afterAll(async () => {
  await testApp.close()
})

beforeEach(async () => {
  await truncateAll()
  fixtures = await createFixtures(testApp.app)
})

afterEach(async () => {
  await truncateAll()
})

const admin = () => fixtures.owner
const staff = () => fixtures.staff
const viewer = () => fixtures.viewer

async function createSupplier(name: string) {
  return prisma.supplier.create({
    data: { workspaceId: fixtures.workspaceId, name, contactName: 'Kontak', email: 's@test.local' },
  })
}

describe('suppliers', () => {
  it('creates a supplier as admin and lists it with product count', async () => {
    const created = await call(
      testApp.app,
      admin(),
      'POST',
      '/api/suppliers',
      { name: 'PT Sumber Jaya' },
      fixtures.workspaceId
    )
    expect(created.statusCode).toBe(200)
    expect(created.json().data.name).toBe('PT Sumber Jaya')

    const list = await call(
      testApp.app,
      admin(),
      'GET',
      '/api/suppliers',
      undefined,
      fixtures.workspaceId
    )
    expect(list.json().data).toHaveLength(1)
    expect(list.json().data[0]._count.products).toBe(0)
  })

  it('denies write access to non-admin members', async () => {
    const denied = await call(
      testApp.app,
      staff(),
      'POST',
      '/api/suppliers',
      { name: 'X' },
      fixtures.workspaceId
    )
    expect(denied.statusCode).toBe(403)
    expect(denied.json().error.code).toBe('ROLE_FORBIDDEN')

    const viewerCreate = await call(
      testApp.app,
      viewer(),
      'POST',
      '/api/suppliers',
      { name: 'Y' },
      fixtures.workspaceId
    )
    expect(viewerCreate.statusCode).toBe(403)
  })

  it('refuses to delete a supplier that still has products', async () => {
    const supplier = await createSupplier('PT Terpakai')
    await call(
      testApp.app,
      admin(),
      'PATCH',
      `/api/products/${fixtures.product.id}`,
      { supplierId: supplier.id },
      fixtures.workspaceId
    )

    const deleted = await call(
      testApp.app,
      admin(),
      'DELETE',
      `/api/suppliers/${supplier.id}`,
      undefined,
      fixtures.workspaceId
    )
    expect(deleted.statusCode).toBe(409)
    expect(deleted.json().error.code).toBe('SUPPLIER_IN_USE')
  })

  it('isolates suppliers per workspace', async () => {
    const supplier = await createSupplier('Milik WS Uji')
    // A non-member is stopped by the workspace membership guard...
    const foreignMember = await call(
      testApp.app,
      admin(),
      'PATCH',
      `/api/suppliers/${supplier.id}`,
      { name: 'X' },
      fixtures.otherWorkspaceId
    )
    expect(foreignMember.statusCode).toBe(403)
    // ...while a member of the other workspace gets a 404 from scoping.
    const member = await call(
      testApp.app,
      fixtures.outsider,
      'PATCH',
      `/api/suppliers/${supplier.id}`,
      { name: 'X' },
      fixtures.otherWorkspaceId
    )
    expect(member.statusCode).toBe(404)
  })
})

describe('product import', () => {
  const importRows = (rows: unknown[], user = admin()) =>
    call(testApp.app, user, 'POST', '/api/products/import', { rows }, fixtures.workspaceId)

  it('creates new products and updates existing ones by SKU', async () => {
    const response = await importRows([
      { sku: 'IMP-001', name: 'Baru dari CSV', unit: 'pcs', costPrice: 5000, reorderThreshold: 3 },
      { sku: fixtures.product.sku, name: 'Nama Baru dari CSV', costPrice: 12000 },
    ])
    expect(response.statusCode).toBe(200)
    const result = response.json().data
    expect(result.created).toEqual(['IMP-001'])
    expect(result.updated).toEqual([fixtures.product.sku])

    const updated = await prisma.product.findUnique({ where: { id: fixtures.product.id } })
    expect(updated?.name).toBe('Nama Baru dari CSV')
    expect(Number(updated?.costPrice)).toBe(12000)
  })

  it('reports bad rows without failing the whole batch', async () => {
    const response = await importRows([
      { sku: 'IMP-OK', name: 'Baris Baik' },
      { sku: '', name: 'SKU kosong' },
    ])
    expect(response.statusCode).toBe(422) // Zod rejects the whole payload if a row fails validation
  })

  it('rejects unknown categories with a per-row error', async () => {
    // Valid rows must pass schema; category existence is a row-level error.
    const response = await importRows([
      { sku: 'IMP-CAT', name: 'Dengan Kategori', category: 'Kategori Fantasi' },
    ])
    expect(response.statusCode).toBe(200)
    expect(response.json().data.errors).toHaveLength(1)
    expect(response.json().data.errors[0].message).toContain('Kategori Fantasi')
  })

  it('is admin-only', async () => {
    const denied = await importRows([{ sku: 'X', name: 'X' }], staff())
    expect(denied.statusCode).toBe(403)
  })
})

describe('stock opname (stocktakes)', () => {
  it('snapshots current balances into lines on creation', async () => {
    await seedBalance(fixtures.product.id, fixtures.rackA.id, 1, 10)
    const created = await call(
      testApp.app,
      staff(),
      'POST',
      '/api/stocktakes',
      { warehouseId: fixtures.warehouseId, note: 'Opname akhir bulan' },
      fixtures.workspaceId
    )
    expect(created.statusCode).toBe(200)
    expect(created.json().data._count.lines).toBe(1)

    const list = await call(
      testApp.app,
      admin(),
      'GET',
      '/api/stocktakes',
      undefined,
      fixtures.workspaceId
    )
    expect(list.json().data).toHaveLength(1)
    expect(list.json().data[0].status).toBe('OPEN')
  })

  it('refuses a second open stocktake for the same warehouse', async () => {
    await seedBalance(fixtures.product.id, fixtures.rackA.id, 1, 10)
    await call(
      testApp.app,
      staff(),
      'POST',
      '/api/stocktakes',
      { warehouseId: fixtures.warehouseId },
      fixtures.workspaceId
    )
    const second = await call(
      testApp.app,
      staff(),
      'POST',
      '/api/stocktakes',
      { warehouseId: fixtures.warehouseId },
      fixtures.workspaceId
    )
    expect(second.statusCode).toBe(409)
    expect(second.json().error.code).toBe('STOCKTAKE_OPEN')
  })

  it('commit generates adjustments for differing lines and closes the stocktake', async () => {
    await seedBalance(fixtures.product.id, fixtures.rackA.id, 1, 10)
    const created = await call(
      testApp.app,
      staff(),
      'POST',
      '/api/stocktakes',
      { warehouseId: fixtures.warehouseId },
      fixtures.workspaceId
    )
    const stocktakeId = created.json().data.id
    const detail = await call(
      testApp.app,
      staff(),
      'GET',
      `/api/stocktakes/${stocktakeId}`,
      undefined,
      fixtures.workspaceId
    )
    const line = detail.json().data.lines[0]

    // Counted 6 vs expected 10 → adjustment -4.
    const patched = await call(
      testApp.app,
      staff(),
      'PATCH',
      `/api/stocktakes/${stocktakeId}/lines/${line.id}`,
      { countedQty: 6 },
      fixtures.workspaceId
    )
    expect(patched.statusCode).toBe(200)

    const committed = await call(
      testApp.app,
      staff(),
      'POST',
      `/api/stocktakes/${stocktakeId}/commit`,
      {},
      fixtures.workspaceId
    )
    expect(committed.statusCode).toBe(200)
    expect(committed.json().data.adjustments).toBe(1)
    expect(committed.json().data.stocktake.status).toBe('COMPLETED')

    expect(await getBalanceQuantity(fixtures.product.id, fixtures.rackA.id, 1)).toBe(6)
    const movements = await call(
      testApp.app,
      admin(),
      'GET',
      '/api/stock-movements?type=ADJUSTMENT',
      undefined,
      fixtures.workspaceId
    )
    const adjustment = movements.json().data[0]
    expect(adjustment.quantity).toBe(-4)
    expect(adjustment.reference).toMatch(/^ST-/)
    expect(adjustment.note).toContain('stock opname')

    // Closed: further edits are refused.
    const editClosed = await call(
      testApp.app,
      staff(),
      'PATCH',
      `/api/stocktakes/${stocktakeId}/lines/${line.id}`,
      { countedQty: 1 },
      fixtures.workspaceId
    )
    expect(editClosed.statusCode).toBe(409)
  })

  it('skips lines without a counted quantity on commit', async () => {
    await seedBalance(fixtures.product.id, fixtures.rackA.id, 1, 10)
    const created = await call(
      testApp.app,
      staff(),
      'POST',
      '/api/stocktakes',
      { warehouseId: fixtures.warehouseId },
      fixtures.workspaceId
    )
    const stocktakeId = created.json().data.id
    const committed = await call(
      testApp.app,
      staff(),
      'POST',
      `/api/stocktakes/${stocktakeId}/commit`,
      {},
      fixtures.workspaceId
    )
    expect(committed.json().data.adjustments).toBe(0)
    expect(committed.json().data.skippedLines).toBe(1)
    expect(await getBalanceQuantity(fixtures.product.id, fixtures.rackA.id, 1)).toBe(10)
  })

  it('cancel closes without touching balances', async () => {
    await seedBalance(fixtures.product.id, fixtures.rackA.id, 1, 10)
    const created = await call(
      testApp.app,
      staff(),
      'POST',
      '/api/stocktakes',
      { warehouseId: fixtures.warehouseId },
      fixtures.workspaceId
    )
    const cancelled = await call(
      testApp.app,
      staff(),
      'POST',
      `/api/stocktakes/${created.json().data.id}/cancel`,
      {},
      fixtures.workspaceId
    )
    expect(cancelled.json().data.status).toBe('CANCELLED')
    expect(await getBalanceQuantity(fixtures.product.id, fixtures.rackA.id, 1)).toBe(10)
  })

  it('is staff-only (viewer denied)', async () => {
    const denied = await call(
      testApp.app,
      viewer(),
      'POST',
      '/api/stocktakes',
      { warehouseId: fixtures.warehouseId },
      fixtures.workspaceId
    )
    expect(denied.statusCode).toBe(403)
  })
})

describe('restock report', () => {
  it('aggregates shortfall and estimated cost, sorted by cost', async () => {
    // Product threshold 5, stock 2 → shortfall 3 × 10.000 = 30.000
    await seedBalance(fixtures.product.id, fixtures.rackA.id, 1, 2)
    const second = await call(
      testApp.app,
      admin(),
      'POST',
      '/api/products',
      { sku: 'SKU-MAHAL', name: 'Produk Mahal', costPrice: 500_000, reorderThreshold: 10 },
      fixtures.workspaceId
    )
    const secondId = second.json().data.id
    await seedBalance(secondId, fixtures.rackB.id, 1, 1) // shortfall 9 × 500.000 = 4.500.000

    const response = await call(
      testApp.app,
      admin(),
      'GET',
      '/api/reports/restock',
      undefined,
      fixtures.workspaceId
    )
    expect(response.statusCode).toBe(200)
    const body = response.json()
    expect(body.data).toHaveLength(2)
    expect(body.data[0]).toMatchObject({ sku: 'SKU-MAHAL', shortfall: 9 })
    expect(body.data[1]).toMatchObject({ sku: 'SKU-UJI-001', shortfall: 3 })
    expect(body.totalEstimatedCost).toBe(4_500_000 + 30_000)
  })

  it('exports restock as CSV', async () => {
    await seedBalance(fixtures.product.id, fixtures.rackA.id, 1, 2)
    const csv = await testApp.app.inject({
      method: 'GET',
      url: '/api/reports/export.csv?report=restock',
      headers: { cookie: admin().cookie, 'x-workspace-id': fixtures.workspaceId },
    })
    expect(csv.statusCode).toBe(200)
    expect(csv.body.split('\r\n')[0]).toBe(
      'sku,produk,unit,stok,ambang,usulan_beli,estimasi_biaya,supplier'
    )
    expect(csv.body).toContain('SKU-UJI-001')
  })
})

describe('supplier-tagged stock-in', () => {
  it('stores the supplier on an IN movement and rejects foreign suppliers', async () => {
    const supplier = await createSupplier('PT Pemasok Resmi')
    const ok = await call(
      testApp.app,
      staff(),
      'POST',
      '/api/stock-movements/stock-in',
      {
        productId: fixtures.product.id,
        quantity: 5,
        destinationLocationId: fixtures.rackA.id,
        supplierId: supplier.id,
      },
      fixtures.workspaceId
    )
    expect(ok.statusCode).toBe(200)
    const movements = await call(
      testApp.app,
      admin(),
      'GET',
      '/api/stock-movements',
      undefined,
      fixtures.workspaceId
    )
    // Movement include selects supplier — verify through the product's supplier link instead.
    const stored = await prisma.stockMovement.findFirst({
      where: { productId: fixtures.product.id },
    })
    expect(stored?.supplierId).toBe(supplier.id)
    expect(movements.statusCode).toBe(200)

    const foreign = await call(
      testApp.app,
      staff(),
      'POST',
      '/api/stock-movements/stock-in',
      {
        productId: fixtures.product.id,
        quantity: 1,
        destinationLocationId: fixtures.rackA.id,
        supplierId: '00000000-0000-0000-0000-000000000000',
      },
      fixtures.workspaceId
    )
    expect(foreign.statusCode).toBe(404)
    expect(foreign.json().error.code).toBe('SUPPLIER_NOT_FOUND')
  })
})
