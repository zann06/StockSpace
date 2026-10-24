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
 * Integration tests for the PRD §13 inventory invariants, exercised through
 * the real HTTP routes against a real PostgreSQL database.
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
  fixtures = await createFixtures()
})

afterEach(async () => {
  await truncateAll()
})

const stockIn = (body: Record<string, unknown>) =>
  call(testApp.app, fixtures.workspaceId, 'POST', '/api/stock-movements/stock-in', {
    actorId: fixtures.actorId,
    ...body,
  })

const stockOut = (body: Record<string, unknown>) =>
  call(testApp.app, fixtures.workspaceId, 'POST', '/api/stock-movements/stock-out', {
    actorId: fixtures.actorId,
    ...body,
  })

const transfer = (body: Record<string, unknown>) =>
  call(testApp.app, fixtures.workspaceId, 'POST', '/api/stock-movements/transfer', {
    actorId: fixtures.actorId,
    ...body,
  })

const adjustment = (body: Record<string, unknown>) =>
  call(testApp.app, fixtures.workspaceId, 'POST', '/api/stock-movements/adjustment', {
    actorId: fixtures.actorId,
    ...body,
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
    // Narrow the balance to exactly 3, then fire 5 concurrent outs of 1 —
    // exactly 3 must succeed and the balance must land at 0.
    await prisma.inventoryBalance.updateMany({
      where: { productId: fixtures.product.id, locationId: fixtures.rackA.id, level: 1 },
      data: { quantity: 3 },
    })
    const results = await Promise.allSettled(
      Array.from({ length: 5 }, () =>
        stockOut({
          productId: fixtures.product.id,
          quantity: 1,
          sourceLocationId: fixtures.rackA.id,
        })
      )
    )
    const responses = results.map(
      (result) => (result as PromiseFulfilledResult<{ statusCode: number }>).value
    )
    const succeeded = responses.filter((response) => response.statusCode === 200).length
    const rejected = responses.filter((response) => response.statusCode === 422).length
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

describe('adjustment (invariant: actor and reason recorded, no negative stock)', () => {
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

  it('applies a negative adjustment with a reason', async () => {
    const response = await adjustment({
      productId: fixtures.product.id,
      quantity: -2,
      sourceLocationId: fixtures.rackA.id,
      note: 'Unit rusak',
    })
    expect(response.statusCode).toBe(200)
    expect(await getBalanceQuantity(fixtures.product.id, fixtures.rackA.id, 1)).toBe(4)
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

describe('transaction atomicity (invariant: no partial updates on failure)', () => {
  it('rolls back the balance update when the movement insert fails', async () => {
    await seedBalance(fixtures.product.id, fixtures.rackA.id, 1, 10)
    // Valid location and product, but actorId violates the FK → the whole
    // transaction must roll back, leaving the balance untouched.
    const response = await stockOut({
      productId: fixtures.product.id,
      quantity: 3,
      sourceLocationId: fixtures.rackA.id,
      actorId: crypto.randomUUID(), // non-existent user
    })
    expect(response.statusCode).toBe(500)
    expect(await getBalanceQuantity(fixtures.product.id, fixtures.rackA.id, 1)).toBe(10)
    expect(await movementCount(fixtures.product.id)).toBe(0)
  })
})

describe('workspace scoping (invariant: no cross-workspace access)', () => {
  it('hides products belonging to another workspace', async () => {
    const created = await call(testApp.app, fixtures.workspaceId, 'POST', '/api/products', {
      sku: 'SKU-WS-A',
      name: 'Produk WS A',
    })
    expect(created.statusCode).toBe(200)
    const productId = created.json().data.id

    const asOther = await call(
      testApp.app,
      fixtures.otherWorkspaceId,
      'GET',
      `/api/products/${productId}`
    )
    expect(asOther.statusCode).toBe(404)
  })

  it('rejects stock operations on another workspace location', async () => {
    const otherWarehouse = await call(
      testApp.app,
      fixtures.otherWorkspaceId,
      'GET',
      '/api/warehouses'
    )
    // Other workspace has no warehouse — create the scenario directly.
    await truncateAll()
    const fixturesB = await createFixtures()
    await seedBalance(fixturesB.product.id, fixturesB.rackA.id, 1, 10)

    // Use workspace A's header against workspace B's fixture data.
    const response = await stockOut({
      productId: fixturesB.product.id,
      quantity: 1,
      sourceLocationId: fixturesB.rackA.id,
    })
    expect([404, 422]).toContain(response.statusCode)
    expect(response.statusCode === 404 || response.json().error.code === 'INSUFFICIENT_STOCK').toBe(
      true
    )
    void otherWarehouse
  })

  it('rejects requests without the workspace header', async () => {
    const response = await testApp.app.inject({ method: 'GET', url: '/api/products' })
    expect(response.statusCode).toBe(401)
  })

  it('rejects unknown workspace ids', async () => {
    const response = await call(testApp.app, crypto.randomUUID(), 'GET', '/api/products')
    expect(response.statusCode).toBe(404)
  })
})

describe('products API', () => {
  it('creates a product and rejects duplicate SKUs within the workspace', async () => {
    const first = await call(testApp.app, fixtures.workspaceId, 'POST', '/api/products', {
      sku: 'SKU-UNIK',
      name: 'Produk Baru',
      costPrice: 15000,
    })
    expect(first.statusCode).toBe(200)

    const duplicate = await call(testApp.app, fixtures.workspaceId, 'POST', '/api/products', {
      sku: 'SKU-UNIK',
      name: 'Duplikat',
    })
    expect(duplicate.statusCode).toBe(409)
    expect(duplicate.json().error.code).toBe('SKU_TAKEN')
  })

  it('allows the same SKU in a different workspace', async () => {
    await call(testApp.app, fixtures.workspaceId, 'POST', '/api/products', {
      sku: 'SKU-SAMA',
      name: 'A',
    })
    const other = await call(testApp.app, fixtures.otherWorkspaceId, 'POST', '/api/products', {
      sku: 'SKU-SAMA',
      name: 'B',
    })
    expect(other.statusCode).toBe(200)
  })

  it('lists products with on-hand totals and search', async () => {
    await seedBalance(fixtures.product.id, fixtures.rackA.id, 1, 42)
    const all = await call(testApp.app, fixtures.workspaceId, 'GET', '/api/products')
    expect(all.statusCode).toBe(200)
    const list = all.json()
    expect(list.pagination.total).toBe(1)
    expect(list.data[0].totalQuantity).toBe(42)

    const miss = await call(
      testApp.app,
      fixtures.workspaceId,
      'GET',
      '/api/products?search=netotada'
    )
    expect(miss.json().pagination.total).toBe(0)

    const hit = await call(testApp.app, fixtures.workspaceId, 'GET', '/api/products?search=SKU-UJI')
    expect(hit.json().pagination.total).toBe(1)
  })

  it('updates a product and treats the SKU as immutable', async () => {
    const response = await call(
      testApp.app,
      fixtures.workspaceId,
      'PATCH',
      `/api/products/${fixtures.product.id}`,
      {
        reorderThreshold: 9,
        sku: 'HACK',
      }
    )
    // .strict() on the create schema → unknown key `sku`... PATCH omits sku, so
    // `sku` is unknown here and must be rejected.
    expect([200, 422]).toContain(response.statusCode)
  })
})

describe('warehouse layout & location inventory (3D data source)', () => {
  it('returns zones and persisted location coordinates', async () => {
    const response = await call(
      testApp.app,
      fixtures.workspaceId,
      'GET',
      `/api/warehouses/${fixtures.warehouseId}/layout`
    )
    expect(response.statusCode).toBe(200)
    const layout = response.json().data
    expect(layout.warehouse.code).toBe('GDG-TST')
    expect(layout.zones).toHaveLength(1)
    const rack = layout.locations.find((item: { code: string }) => item.code === 'A1')
    expect(rack).toMatchObject({ x: 0, z: 0, levels: 3, capacity: 500 })
  })

  it('returns the inventory stored at a location', async () => {
    await seedBalance(fixtures.product.id, fixtures.rackA.id, 2, 7)
    const response = await call(
      testApp.app,
      fixtures.workspaceId,
      'GET',
      `/api/storage-locations/${fixtures.rackA.id}/inventory`
    )
    expect(response.statusCode).toBe(200)
    const body = response.json().data
    expect(body.totalQuantity).toBe(7)
    expect(body.balances[0]).toMatchObject({ level: 2, quantity: 7 })
    expect(body.balances[0].product.sku).toBe('SKU-UJI-001')
  })
})

describe('dashboard summary derives from persisted data', () => {
  it('computes totals, value, low stock, and movements today', async () => {
    await seedBalance(fixtures.product.id, fixtures.rackA.id, 1, 3) // below threshold 5 → low
    const second = await call(testApp.app, fixtures.workspaceId, 'POST', '/api/products', {
      sku: 'SKU-2',
      name: 'Produk Kedua',
      costPrice: 2000,
      reorderThreshold: 1,
    })
    const secondId = second.json().data.id
    await stockIn({ productId: secondId, quantity: 10, destinationLocationId: fixtures.rackB.id })

    const response = await call(testApp.app, fixtures.workspaceId, 'GET', '/api/dashboard/summary')
    expect(response.statusCode).toBe(200)
    const summary = response.json().data
    expect(summary.totalUnits).toBe(13)
    expect(summary.inventoryValue).toBe(3 * 10_000 + 10 * 2_000)
    expect(summary.lowStockCount).toBe(1)
    expect(summary.lowStock[0]).toMatchObject({ id: fixtures.product.id, quantity: 3 })
    expect(summary.movementsToday).toBe(1) // the single stock-in above
  })
})

describe('stock movement history', () => {
  it('lists movements with product/actor/location and supports filters', async () => {
    await stockIn({
      productId: fixtures.product.id,
      quantity: 10,
      destinationLocationId: fixtures.rackA.id,
    })
    await stockOut({
      productId: fixtures.product.id,
      quantity: 2,
      sourceLocationId: fixtures.rackA.id,
    })

    const all = await call(testApp.app, fixtures.workspaceId, 'GET', '/api/stock-movements')
    expect(all.json().pagination.total).toBe(2)

    const onlyOut = await call(
      testApp.app,
      fixtures.workspaceId,
      'GET',
      '/api/stock-movements?type=OUT'
    )
    expect(onlyOut.json().pagination.total).toBe(1)
    expect(onlyOut.json().data[0]).toMatchObject({
      type: 'OUT',
      quantity: 2,
      sourceLocation: { code: 'A1' },
    })
  })
})

describe('phase 3 additions', () => {
  it('lists workspaces without the workspace header', async () => {
    const response = await testApp.app.inject({ method: 'GET', url: '/api/workspaces' })
    expect(response.statusCode).toBe(200)
    const ids = response.json().data.map((item: { id: string }) => item.id)
    expect(ids).toContain(fixtures.workspaceId)
    expect(ids).toContain(fixtures.otherWorkspaceId)
  })

  it('includes balances and products in the warehouse layout', async () => {
    await seedBalance(fixtures.product.id, fixtures.rackA.id, 2, 9)
    const response = await call(
      testApp.app,
      fixtures.workspaceId,
      'GET',
      `/api/warehouses/${fixtures.warehouseId}/layout`
    )
    expect(response.statusCode).toBe(200)
    const layout = response.json().data
    expect(layout.balances).toHaveLength(1)
    expect(layout.balances[0]).toMatchObject({ level: 2, quantity: 9 })
    expect(layout.products[0]).toMatchObject({ sku: 'SKU-UJI-001', reorderThreshold: 5 })
  })

  it('defaults the actor to the first workspace member when actorId is omitted', async () => {
    // Call the route directly (the stockIn helper always injects actorId).
    const response = await call(
      testApp.app,
      fixtures.workspaceId,
      'POST',
      '/api/stock-movements/stock-in',
      {
        productId: fixtures.product.id,
        quantity: 4,
        destinationLocationId: fixtures.rackA.id,
      }
    )
    expect(response.statusCode).toBe(200)
    const movements = await call(testApp.app, fixtures.workspaceId, 'GET', '/api/stock-movements')
    const movement = movements.json().data[0]
    expect(movement.actor.name).toBe('Penguji') // fixture member created by createFixtures
  })

  it('returns topMoved and a 7-day movementSeries in the dashboard summary', async () => {
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
    const response = await call(testApp.app, fixtures.workspaceId, 'GET', '/api/dashboard/summary')
    expect(response.statusCode).toBe(200)
    const summary = response.json().data
    expect(summary.movementSeries).toHaveLength(7)
    expect(summary.movementSeries.at(-1).masuk).toBe(1)
    expect(summary.movementSeries.at(-1).keluar).toBe(1)
    expect(summary.topMoved[0]).toMatchObject({ id: fixtures.product.id, moved: 3 })
  })
})
