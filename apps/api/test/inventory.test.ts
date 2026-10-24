import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { prisma } from '../src/lib/prisma.js'
import {
  buildTestApp,
  call,
  createFixtures,
  getBalanceQuantity,
  movementCount,
  seedBalance,
  truncateAll,
  type Fixtures,
  type TestApp,
} from './helpers.js'

/**
 * Integration tests: PRD §13 inventory invariants + Phase 4 authentication and
 * authorization, exercised through the real HTTP routes (including the
 * better-auth sign-in handler) against a real PostgreSQL database.
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

const stockIn = (body: Record<string, unknown>, user = fixtures.staff) =>
  call(testApp.app, user, 'POST', '/api/stock-movements/stock-in', body, fixtures.workspaceId)

const stockOut = (body: Record<string, unknown>, user = fixtures.staff) =>
  call(testApp.app, user, 'POST', '/api/stock-movements/stock-out', body, fixtures.workspaceId)

const transfer = (body: Record<string, unknown>, user = fixtures.staff) =>
  call(testApp.app, user, 'POST', '/api/stock-movements/transfer', body, fixtures.workspaceId)

const adjustment = (body: Record<string, unknown>, user = fixtures.staff) =>
  call(testApp.app, user, 'POST', '/api/stock-movements/adjustment', body, fixtures.workspaceId)

describe('authentication', () => {
  it('rejects wrong passwords', async () => {
    const response = await testApp.app.inject({
      method: 'POST',
      url: '/api/auth/sign-in/email',
      headers: { 'content-type': 'application/json' },
      payload: JSON.stringify({ email: fixtures.owner.email, password: 'totally-wrong' }),
    })
    expect(response.statusCode).toBe(401)
  })

  it('rejects data routes without a session', async () => {
    const response = await testApp.app.inject({ method: 'GET', url: '/api/products' })
    expect(response.statusCode).toBe(401)
  })

  it('invalidates the session after sign-out', async () => {
    const before = await call(
      testApp.app,
      fixtures.owner,
      'GET',
      '/api/products',
      undefined,
      fixtures.workspaceId
    )
    expect(before.statusCode).toBe(200)

    const signOut = await testApp.app.inject({
      method: 'POST',
      url: '/api/auth/sign-out',
      headers: { cookie: fixtures.owner.cookie },
    })
    expect(signOut.statusCode).toBe(200)

    const after = await testApp.app.inject({
      method: 'GET',
      url: '/api/products',
      headers: { cookie: fixtures.owner.cookie, 'x-workspace-id': fixtures.workspaceId },
    })
    expect(after.statusCode).toBe(401)
  })
})

describe('authorization (roles & workspace scoping)', () => {
  it('lets every member read, but only STAFF+ record movements', async () => {
    const read = await call(
      testApp.app,
      fixtures.viewer,
      'GET',
      '/api/products',
      undefined,
      fixtures.workspaceId
    )
    expect(read.statusCode).toBe(200)

    const write = await stockIn(
      { productId: fixtures.product.id, quantity: 1, destinationLocationId: fixtures.rackA.id },
      fixtures.viewer
    )
    expect(write.statusCode).toBe(403)
    expect(write.json().error.code).toBe('ROLE_FORBIDDEN')
  })

  it('lets STAFF record movements but not edit products (ADMIN+)', async () => {
    const movement = await stockIn({
      productId: fixtures.product.id,
      quantity: 2,
      destinationLocationId: fixtures.rackA.id,
    })
    expect(movement.statusCode).toBe(200)

    const patch = await call(
      testApp.app,
      fixtures.staff,
      'PATCH',
      `/api/products/${fixtures.product.id}`,
      { reorderThreshold: 9 },
      fixtures.workspaceId
    )
    expect(patch.statusCode).toBe(403)

    const ownerPatch = await call(
      testApp.app,
      fixtures.owner,
      'PATCH',
      `/api/products/${fixtures.product.id}`,
      { reorderThreshold: 9 },
      fixtures.workspaceId
    )
    expect(ownerPatch.statusCode).toBe(200)
  })

  it('records the signed-in user as the actor (client cannot choose it)', async () => {
    await stockIn({
      productId: fixtures.product.id,
      quantity: 4,
      destinationLocationId: fixtures.rackA.id,
    })
    const list = await call(
      testApp.app,
      fixtures.owner,
      'GET',
      '/api/stock-movements',
      undefined,
      fixtures.workspaceId
    )
    expect(list.json().data[0].actor.name).toBe('Staf Uji')
  })

  it('blocks access to workspaces the user does not belong to', async () => {
    const response = await call(
      testApp.app,
      fixtures.owner,
      'GET',
      '/api/products',
      undefined,
      fixtures.otherWorkspaceId
    )
    expect(response.statusCode).toBe(403)
    expect(response.json().error.code).toBe('NOT_A_MEMBER')
  })

  it('a member of another workspace cannot read this workspace data', async () => {
    const response = await call(
      testApp.app,
      fixtures.outsider,
      'GET',
      '/api/products',
      undefined,
      fixtures.workspaceId
    )
    expect(response.statusCode).toBe(403)
  })

  it('lists only the workspaces the user belongs to', async () => {
    const response = await call(testApp.app, fixtures.owner, 'GET', '/api/workspaces')
    const ids = response.json().data.map((item: { id: string }) => item.id)
    expect(ids).toContain(fixtures.workspaceId)
    expect(ids).not.toContain(fixtures.otherWorkspaceId)
  })
})

describe('stock in', () => {
  it('creates a balance row and an IN movement', async () => {
    const response = await stockIn({
      productId: fixtures.product.id,
      quantity: 25,
      destinationLocationId: fixtures.rackA.id,
      destinationLevel: 1,
      reference: 'PO-1',
    })
    expect(response.statusCode).toBe(200)
    expect(await getBalanceQuantity(fixtures.product.id, fixtures.rackA.id, 1)).toBe(25)
    expect(await movementCount(fixtures.product.id)).toBe(1)
  })

  it('accumulates into an existing balance', async () => {
    await seedBalance(fixtures.product.id, fixtures.rackA.id, 1, 10)
    const response = await stockIn({
      productId: fixtures.product.id,
      quantity: 5,
      destinationLocationId: fixtures.rackA.id,
    })
    expect(response.statusCode).toBe(200)
    expect(await getBalanceQuantity(fixtures.product.id, fixtures.rackA.id, 1)).toBe(15)
  })

  it('rejects zero and negative quantities', async () => {
    const response = await stockIn({
      productId: fixtures.product.id,
      quantity: 0,
      destinationLocationId: fixtures.rackA.id,
    })
    expect(response.statusCode).toBe(400)
    expect(response.json().error.code).toBe('INVALID_QUANTITY')
    expect(await movementCount(fixtures.product.id)).toBe(0)
  })
})

describe('stock out (invariant: cannot exceed available stock)', () => {
  beforeEach(async () => {
    await seedBalance(fixtures.product.id, fixtures.rackA.id, 1, 10)
  })

  it('decreases the balance and records an OUT movement', async () => {
    const response = await stockOut({
      productId: fixtures.product.id,
      quantity: 4,
      sourceLocationId: fixtures.rackA.id,
    })
    expect(response.statusCode).toBe(200)
    expect(await getBalanceQuantity(fixtures.product.id, fixtures.rackA.id, 1)).toBe(6)
  })

  it('rejects taking more than available, changing nothing', async () => {
    const response = await stockOut({
      productId: fixtures.product.id,
      quantity: 11,
      sourceLocationId: fixtures.rackA.id,
    })
    expect(response.statusCode).toBe(422)
    expect(response.json().error.code).toBe('INSUFFICIENT_STOCK')
    expect(await getBalanceQuantity(fixtures.product.id, fixtures.rackA.id, 1)).toBe(10)
    expect(await movementCount(fixtures.product.id)).toBe(0)
  })

  it('never oversells under concurrent requests', async () => {
    await prisma.inventoryBalance.updateMany({
      where: { productId: fixtures.product.id, locationId: fixtures.rackA.id, level: 1 },
      data: { quantity: 3 },
    })
    const responses = await Promise.allSettled(
      Array.from({ length: 5 }, () =>
        stockOut({
          productId: fixtures.product.id,
          quantity: 1,
          sourceLocationId: fixtures.rackA.id,
        })
      )
    )
    const results = responses.map(
      (result) => (result as PromiseFulfilledResult<{ statusCode: number }>).value
    )
    const succeeded = results.filter((response) => response.statusCode === 200).length
    const rejected = results.filter((response) => response.statusCode === 422).length
    expect(succeeded).toBe(3)
    expect(rejected).toBe(2)
    expect(await getBalanceQuantity(fixtures.product.id, fixtures.rackA.id, 1)).toBe(0)
  })
})

describe('transfer (invariant: source decreases, destination increases, total conserved)', () => {
  beforeEach(async () => {
    await seedBalance(fixtures.product.id, fixtures.rackA.id, 1, 12)
  })

  it('moves stock between racks atomically', async () => {
    const response = await transfer({
      productId: fixtures.product.id,
      quantity: 7,
      sourceLocationId: fixtures.rackA.id,
      destinationLocationId: fixtures.rackB.id,
      destinationLevel: 2,
    })
    expect(response.statusCode).toBe(200)
    expect(await getBalanceQuantity(fixtures.product.id, fixtures.rackA.id, 1)).toBe(5)
    expect(await getBalanceQuantity(fixtures.product.id, fixtures.rackB.id, 2)).toBe(7)
  })

  it('rejects when the source lacks stock and changes nothing', async () => {
    const response = await transfer({
      productId: fixtures.product.id,
      quantity: 99,
      sourceLocationId: fixtures.rackA.id,
      destinationLocationId: fixtures.rackB.id,
    })
    expect(response.statusCode).toBe(422)
    expect(await getBalanceQuantity(fixtures.product.id, fixtures.rackA.id, 1)).toBe(12)
    expect(await getBalanceQuantity(fixtures.product.id, fixtures.rackB.id, 1)).toBe(0)
    expect(await movementCount(fixtures.product.id)).toBe(0)
  })

  it('rejects same source and destination', async () => {
    const response = await transfer({
      productId: fixtures.product.id,
      quantity: 1,
      sourceLocationId: fixtures.rackA.id,
      destinationLocationId: fixtures.rackA.id,
    })
    expect(response.statusCode).toBe(400)
  })
})

describe('adjustment (invariant: reason recorded, no negative stock)', () => {
  beforeEach(async () => {
    await seedBalance(fixtures.product.id, fixtures.rackA.id, 1, 6)
  })

  it('applies a positive adjustment with a reason', async () => {
    const response = await adjustment({
      productId: fixtures.product.id,
      quantity: 3,
      sourceLocationId: fixtures.rackA.id,
      note: 'Barang ditemukan saat stock opname',
    })
    expect(response.statusCode).toBe(200)
    expect(await getBalanceQuantity(fixtures.product.id, fixtures.rackA.id, 1)).toBe(9)
  })

  it('requires a reason', async () => {
    const response = await adjustment({
      productId: fixtures.product.id,
      quantity: 1,
      sourceLocationId: fixtures.rackA.id,
    })
    expect(response.statusCode).toBe(400)
    expect(response.json().error.code).toBe('REASON_REQUIRED')
    expect(await getBalanceQuantity(fixtures.product.id, fixtures.rackA.id, 1)).toBe(6)
  })

  it('rejects adjustments that would drive stock below zero', async () => {
    const response = await adjustment({
      productId: fixtures.product.id,
      quantity: -10,
      sourceLocationId: fixtures.rackA.id,
      note: 'Salah input',
    })
    expect(response.statusCode).toBe(422)
    expect(await getBalanceQuantity(fixtures.product.id, fixtures.rackA.id, 1)).toBe(6)
  })
})

describe('products API', () => {
  it('creates a product (admin) and rejects duplicate SKUs within the workspace', async () => {
    const first = await call(
      testApp.app,
      fixtures.owner,
      'POST',
      '/api/products',
      { sku: 'SKU-UNIK', name: 'Produk Baru', costPrice: 15000 },
      fixtures.workspaceId
    )
    expect(first.statusCode).toBe(200)

    const duplicate = await call(
      testApp.app,
      fixtures.owner,
      'POST',
      '/api/products',
      { sku: 'SKU-UNIK', name: 'Duplikat' },
      fixtures.workspaceId
    )
    expect(duplicate.statusCode).toBe(409)
    expect(duplicate.json().error.code).toBe('SKU_TAKEN')
  })

  it('lists products with on-hand totals and search', async () => {
    await seedBalance(fixtures.product.id, fixtures.rackA.id, 1, 42)
    const all = await call(
      testApp.app,
      fixtures.owner,
      'GET',
      '/api/products',
      undefined,
      fixtures.workspaceId
    )
    expect(all.statusCode).toBe(200)
    const list = all.json()
    expect(list.pagination.total).toBe(1)
    expect(list.data[0].totalQuantity).toBe(42)

    const miss = await call(
      testApp.app,
      fixtures.owner,
      'GET',
      '/api/products?search=netotada',
      undefined,
      fixtures.workspaceId
    )
    expect(miss.json().pagination.total).toBe(0)

    const hit = await call(
      testApp.app,
      fixtures.owner,
      'GET',
      '/api/products?search=SKU-UJI',
      undefined,
      fixtures.workspaceId
    )
    expect(hit.json().pagination.total).toBe(1)
  })
})

describe('warehouse layout & location inventory (3D data source)', () => {
  it('includes balances and products in the warehouse layout', async () => {
    await seedBalance(fixtures.product.id, fixtures.rackA.id, 2, 9)
    const response = await call(
      testApp.app,
      fixtures.owner,
      'GET',
      `/api/warehouses/${fixtures.warehouseId}/layout`,
      undefined,
      fixtures.workspaceId
    )
    expect(response.statusCode).toBe(200)
    const layout = response.json().data
    expect(layout.balances).toHaveLength(1)
    expect(layout.balances[0]).toMatchObject({ level: 2, quantity: 9 })
    expect(layout.products[0]).toMatchObject({ sku: 'SKU-UJI-001', reorderThreshold: 5 })
  })

  it('returns the inventory stored at a location', async () => {
    await seedBalance(fixtures.product.id, fixtures.rackA.id, 2, 7)
    const response = await call(
      testApp.app,
      fixtures.owner,
      'GET',
      `/api/storage-locations/${fixtures.rackA.id}/inventory`,
      undefined,
      fixtures.workspaceId
    )
    expect(response.statusCode).toBe(200)
    const body = response.json().data
    expect(body.totalQuantity).toBe(7)
    expect(body.balances[0]).toMatchObject({ level: 2, quantity: 7 })
  })
})

describe('dashboard summary derives from persisted data', () => {
  it('computes totals, value, low stock, and movements today', async () => {
    await seedBalance(fixtures.product.id, fixtures.rackA.id, 1, 3) // below threshold 5 → low
    const second = await call(
      testApp.app,
      fixtures.owner,
      'POST',
      '/api/products',
      { sku: 'SKU-2', name: 'Produk Kedua', costPrice: 2000, reorderThreshold: 1 },
      fixtures.workspaceId
    )
    const secondId = second.json().data.id
    await stockIn({ productId: secondId, quantity: 10, destinationLocationId: fixtures.rackB.id })

    const response = await call(
      testApp.app,
      fixtures.owner,
      'GET',
      '/api/dashboard/summary',
      undefined,
      fixtures.workspaceId
    )
    expect(response.statusCode).toBe(200)
    const summary = response.json().data
    expect(summary.totalUnits).toBe(13)
    expect(summary.inventoryValue).toBe(3 * 10_000 + 10 * 2_000)
    expect(summary.lowStockCount).toBe(1)
    expect(summary.movementsToday).toBe(1)
  })
})

describe('low-stock notifications (grouped)', () => {
  it('creates one unread notification when a movement crosses the threshold', async () => {
    // Threshold 5: stock 6 → stock-out 2 leaves 4 (below).
    await seedBalance(fixtures.product.id, fixtures.rackA.id, 1, 6)
    await stockOut({
      productId: fixtures.product.id,
      quantity: 2,
      sourceLocationId: fixtures.rackA.id,
    })

    const response = await call(
      testApp.app,
      fixtures.owner,
      'GET',
      '/api/notifications',
      undefined,
      fixtures.workspaceId
    )
    expect(response.statusCode).toBe(200)
    const notifications = response.json().data
    expect(notifications).toHaveLength(1)
    expect(notifications[0].type).toBe('LOW_STOCK')
    expect(notifications[0].title).toContain('Produk Uji')

    // A second movement below the threshold must not duplicate the alert.
    await stockOut({
      productId: fixtures.product.id,
      quantity: 1,
      sourceLocationId: fixtures.rackA.id,
    })
    const again = await call(
      testApp.app,
      fixtures.owner,
      'GET',
      '/api/notifications',
      undefined,
      fixtures.workspaceId
    )
    expect(again.json().data).toHaveLength(1)
  })

  it('does not notify while stock stays above the threshold', async () => {
    await stockIn({
      productId: fixtures.product.id,
      quantity: 20,
      destinationLocationId: fixtures.rackA.id,
    })
    const response = await call(
      testApp.app,
      fixtures.owner,
      'GET',
      '/api/notifications',
      undefined,
      fixtures.workspaceId
    )
    expect(response.json().data).toHaveLength(0)
  })

  it('marks a notification as read', async () => {
    await seedBalance(fixtures.product.id, fixtures.rackA.id, 1, 6)
    await stockOut({
      productId: fixtures.product.id,
      quantity: 2,
      sourceLocationId: fixtures.rackA.id,
    })
    const list = await call(
      testApp.app,
      fixtures.owner,
      'GET',
      '/api/notifications',
      undefined,
      fixtures.workspaceId
    )
    const notificationId = list.json().data[0].id

    const read = await call(
      testApp.app,
      fixtures.owner,
      'PATCH',
      `/api/notifications/${notificationId}/read`,
      {},
      fixtures.workspaceId
    )
    expect(read.statusCode).toBe(200)
    expect(read.json().data.readAt).not.toBeNull()
  })
})

describe('reports & CSV export', () => {
  it('returns the full low-stock report', async () => {
    await seedBalance(fixtures.product.id, fixtures.rackA.id, 1, 2) // threshold 5
    const response = await call(
      testApp.app,
      fixtures.owner,
      'GET',
      '/api/reports/low-stock',
      undefined,
      fixtures.workspaceId
    )
    expect(response.statusCode).toBe(200)
    const items = response.json().data
    expect(items).toHaveLength(1)
    expect(items[0]).toMatchObject({ sku: 'SKU-UJI-001', quantity: 2, shortfall: 3 })
  })

  it('filters the movement report by type and date', async () => {
    await stockIn({
      productId: fixtures.product.id,
      quantity: 10,
      destinationLocationId: fixtures.rackA.id,
    })
    await stockOut({
      productId: fixtures.product.id,
      quantity: 3,
      sourceLocationId: fixtures.rackA.id,
    })

    const onlyOut = await call(
      testApp.app,
      fixtures.owner,
      'GET',
      '/api/reports/movements?type=OUT',
      undefined,
      fixtures.workspaceId
    )
    expect(onlyOut.json().pagination.total).toBe(1)
    expect(onlyOut.json().data[0].type).toBe('OUT')

    const today = new Date().toISOString().slice(0, 10)
    const fromToday = await call(
      testApp.app,
      fixtures.owner,
      'GET',
      `/api/reports/movements?from=${today}`,
      undefined,
      fixtures.workspaceId
    )
    expect(fromToday.json().pagination.total).toBe(2)
  })

  it('exports movements and low-stock as CSV', async () => {
    await seedBalance(fixtures.product.id, fixtures.rackA.id, 1, 2)
    await stockIn({
      productId: fixtures.product.id,
      quantity: 4,
      destinationLocationId: fixtures.rackB.id,
    })

    const movements = await testApp.app.inject({
      method: 'GET',
      url: '/api/reports/export.csv?report=movements',
      headers: { cookie: fixtures.owner.cookie, 'x-workspace-id': fixtures.workspaceId },
    })
    expect(movements.statusCode).toBe(200)
    expect(movements.headers['content-type']).toContain('text/csv')
    expect(movements.body.split('\r\n')[0]).toBe(
      'waktu,sku,produk,jenis,jumlah,dari,ke,referensi,aktor'
    )
    expect(movements.body).toContain('SKU-UJI-001')

    const lowStock = await testApp.app.inject({
      method: 'GET',
      url: '/api/reports/export.csv?report=low-stock',
      headers: { cookie: fixtures.owner.cookie, 'x-workspace-id': fixtures.workspaceId },
    })
    expect(lowStock.statusCode).toBe(200)
    expect(lowStock.body.split('\r\n')[0]).toBe('sku,produk,kategori,stok,ambang,kekurangan')
    // 2 on hand after the stock-in of 4 (2+4=6 ≥ threshold 5) → empty rows
    expect(lowStock.body.split('\r\n')).toHaveLength(1)
  })

  it('requires authentication for reports', async () => {
    const response = await testApp.app.inject({ method: 'GET', url: '/api/reports/low-stock' })
    expect(response.statusCode).toBe(401)
  })
})
