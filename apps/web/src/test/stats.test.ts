import { describe, expect, it } from 'vitest'

import {
  inventoryValue,
  locationQuantity,
  locationStatus,
  lowStockProducts,
  movementSeries,
  movementsToday,
  quantityByProduct,
  topMovedProducts,
  totalUnitsOnHand,
} from '@/lib/stats'
import type { Balance, Movement, Product, StorageLocation } from '@/types'

const product = (overrides: Partial<Product> = {}): Product => ({
  id: 'p1',
  sku: 'SKU-1',
  name: 'Produk Satu',
  category: 'Umum',
  unit: 'pcs',
  barcode: null,
  costPrice: 1000,
  reorderThreshold: 10,
  description: '',
  active: true,
  totalMoved: 0,
  ...overrides,
})

const balance = (overrides: Partial<Balance> = {}): Balance => ({
  productId: 'p1',
  locationId: 'l1',
  quantity: 5,
  ...overrides,
})

const rack = (overrides: Partial<StorageLocation> = {}): StorageLocation => ({
  id: 'l1',
  warehouseId: 'w1',
  code: 'A1',
  label: 'Rak A1',
  type: 'RACK',
  zone: 'Z1',
  x: 0,
  z: 0,
  rotation: 0,
  capacity: null,
  ...overrides,
})

const movement = (overrides: Partial<Movement> = {}): Movement => ({
  id: 'm1',
  productId: 'p1',
  type: 'IN',
  quantity: 1,
  sourceLocationId: null,
  destinationLocationId: 'l1',
  reference: null,
  note: null,
  actor: 'tester',
  createdAt: new Date('2026-10-24T08:00:00+07:00').toISOString(),
  ...overrides,
})

describe('quantityByProduct', () => {
  it('sums balances across locations per product', () => {
    const map = quantityByProduct([
      balance({ productId: 'p1', quantity: 3 }),
      balance({ productId: 'p1', quantity: 4 }),
      balance({ productId: 'p2', quantity: 7 }),
    ])
    expect(map.get('p1')).toBe(7)
    expect(map.get('p2')).toBe(7)
  })

  it('returns empty map for no balances', () => {
    expect(quantityByProduct([]).size).toBe(0)
  })
})

describe('totalUnitsOnHand', () => {
  it('sums every balance quantity', () => {
    expect(totalUnitsOnHand([balance({ quantity: 12 }), balance({ quantity: 8 })])).toBe(20)
    expect(totalUnitsOnHand([])).toBe(0)
  })
})

describe('lowStockProducts', () => {
  it('flags active products below their reorder threshold', () => {
    const products = [
      product({ id: 'low', reorderThreshold: 10 }),
      product({ id: 'ok', reorderThreshold: 5 }),
      product({ id: 'inactive', reorderThreshold: 100, active: false }),
    ]
    const balances = [
      balance({ productId: 'low', quantity: 3 }),
      balance({ productId: 'ok', quantity: 5 }),
      balance({ productId: 'inactive', quantity: 1 }),
    ]
    const result = lowStockProducts(products, balances)
    expect(result.map((p) => p.id)).toEqual(['low'])
  })

  it('treats products without any balance as fully depleted', () => {
    const products = [product({ id: 'ghost', reorderThreshold: 4 })]
    expect(lowStockProducts(products, [])).toHaveLength(1)
  })
})

describe('inventoryValue', () => {
  it('multiplies quantity by cost price and sums', () => {
    const products = [
      product({ id: 'p1', costPrice: 10_000 }),
      product({ id: 'p2', costPrice: 500 }),
    ]
    const balances = [
      balance({ productId: 'p1', quantity: 2 }),
      balance({ productId: 'p2', quantity: 10 }),
    ]
    expect(inventoryValue(products, balances)).toBe(25_000)
  })

  it('ignores balances whose product no longer exists', () => {
    expect(inventoryValue([], [balance({ quantity: 100 })])).toBe(0)
  })
})

describe('movementsToday', () => {
  it('counts only movements created on the reference day', () => {
    const now = new Date('2026-10-24T18:00:00+07:00')
    const movements = [
      movement({ createdAt: '2026-10-24T07:00:00+07:00' }),
      movement({ createdAt: '2026-10-24T23:59:00+07:00' }),
      movement({ createdAt: '2026-10-23T23:59:00+07:00' }),
    ]
    expect(movementsToday(movements, now)).toBe(2)
  })
})

describe('movementSeries', () => {
  it('produces one point per day with separate in/out counts', () => {
    const now = new Date('2026-10-24T18:00:00+07:00')
    const movements = [
      movement({ type: 'IN', createdAt: '2026-10-24T09:00:00+07:00' }),
      movement({ type: 'IN', createdAt: '2026-10-24T10:00:00+07:00' }),
      movement({ type: 'OUT', createdAt: '2026-10-24T11:00:00+07:00' }),
      movement({ type: 'TRANSFER', createdAt: '2026-10-24T12:00:00+07:00' }),
      movement({ type: 'IN', createdAt: '2026-10-18T08:00:00+07:00' }), // outside window
    ]
    const series = movementSeries(movements, now, 7)
    expect(series).toHaveLength(7)
    expect(series.at(-1)).toMatchObject({ masuk: 2, keluar: 1 })
  })
})

describe('topMovedProducts', () => {
  it('sorts by totalMoved descending and respects the limit', () => {
    const products = [
      product({ id: 'a', totalMoved: 10 }),
      product({ id: 'b', totalMoved: 30 }),
      product({ id: 'c', totalMoved: 20, active: false }),
      product({ id: 'd', totalMoved: 5 }),
    ]
    const result = topMovedProducts(products, 2)
    expect(result.map((p) => p.id)).toEqual(['b', 'a'])
  })
})

describe('locationQuantity & locationStatus', () => {
  it('sums quantity for a location only', () => {
    expect(
      locationQuantity('l1', [
        balance({ locationId: 'l1', quantity: 5 }),
        balance({ locationId: 'l2', quantity: 9 }),
      ])
    ).toBe(5)
  })

  it('marks empty racks EMPTY and occupied racks OCCUPIED', () => {
    const location = rack()
    expect(locationStatus(location, [], [product()])).toBe('EMPTY')
    expect(
      locationStatus(location, [balance({ quantity: 50 })], [product({ reorderThreshold: 10 })])
    ).toBe('OCCUPIED')
  })

  it('marks racks LOW when a stored product is under its threshold', () => {
    const location = rack()
    expect(
      locationStatus(location, [balance({ quantity: 3 })], [product({ reorderThreshold: 10 })])
    ).toBe('LOW')
  })

  it('never marks staging/packing areas LOW', () => {
    const area = rack({ type: 'STAGING', code: 'STG-01' })
    expect(
      locationStatus(area, [balance({ quantity: 1 })], [product({ reorderThreshold: 10 })])
    ).toBe('OCCUPIED')
  })
})
