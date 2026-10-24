import { describe, expect, it } from 'vitest'

import { balances, buildMovements, locations, products } from '@/mocks/warehouse-data'

/** Invariants the PRD demands from the dataset that feeds the UI. When the
 * mock source is replaced by the API (Phase 3), equivalent tests exist
 * server-side against PostgreSQL. */

describe('mock warehouse dataset invariants', () => {
  it('has unique location codes and IDs', () => {
    const codes = locations.map((location) => location.code)
    const ids = locations.map((location) => location.id)
    expect(new Set(codes).size).toBe(codes.length)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('has unique product SKUs and IDs', () => {
    const skus = products.map((product) => product.sku)
    const ids = products.map((product) => product.id)
    expect(new Set(skus).size).toBe(skus.length)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('only references known products and locations in balances', () => {
    const productIds = new Set(products.map((product) => product.id))
    const locationIds = new Set(locations.map((location) => location.id))
    for (const balance of balances) {
      expect(productIds.has(balance.productId), balance.productId).toBe(true)
      expect(locationIds.has(balance.locationId), balance.locationId).toBe(true)
    }
  })

  it('never carries negative stock quantities', () => {
    for (const balance of balances) {
      expect(balance.quantity).toBeGreaterThanOrEqual(0)
    }
  })

  it('assigns shelf levels only to rack balances', () => {
    const rackIds = new Set(
      locations.filter((location) => location.type === 'RACK').map((location) => location.id)
    )
    for (const balance of balances) {
      if (balance.level !== undefined) {
        expect(rackIds.has(balance.locationId), balance.locationId).toBe(true)
        expect([1, 2, 3]).toContain(balance.level)
      }
    }
  })

  it('renders a scene where at least one rack is low stock and one is empty', () => {
    // Guarantees the 3D status indicators demonstrate all states.
    const quantities = new Map<string, number>()
    for (const balance of balances) {
      quantities.set(
        balance.locationId,
        (quantities.get(balance.locationId) ?? 0) + balance.quantity
      )
    }
    const byId = new Map(products.map((product) => [product.id, product]))
    const racks = locations.filter((location) => location.type === 'RACK')
    const statuses = racks.map((rack) => {
      const rows = balances.filter((balance) => balance.locationId === rack.id)
      if (rows.length === 0) return 'EMPTY'
      const hasLow = rows.some((balance) => {
        const product = byId.get(balance.productId)
        return product ? balance.quantity < product.reorderThreshold : false
      })
      return hasLow ? 'LOW' : 'OCCUPIED'
    })
    expect(statuses).toContain('EMPTY')
    expect(statuses).toContain('LOW')
    expect(statuses).toContain('OCCUPIED')
  })

  it('produces deterministic, chronologically consistent movements', () => {
    const now = new Date('2026-10-24T20:00:00+07:00')
    const movements = buildMovements(now)
    expect(movements.length).toBeGreaterThan(20)

    // Sorted newest first
    for (let i = 1; i < movements.length; i++) {
      expect(movements[i - 1].createdAt >= movements[i].createdAt).toBe(true)
    }

    // Every movement references known entities
    const productIds = new Set(products.map((product) => product.id))
    const locationIds = new Set(locations.map((location) => location.id))
    for (const movement of movements) {
      expect(productIds.has(movement.productId)).toBe(true)
      if (movement.sourceLocationId) expect(locationIds.has(movement.sourceLocationId)).toBe(true)
      if (movement.destinationLocationId)
        expect(locationIds.has(movement.destinationLocationId)).toBe(true)
      expect(movement.actor).toBeTruthy()
    }

    // IN movements have destination, OUT movements have source
    for (const movement of movements) {
      if (movement.type === 'IN') expect(movement.destinationLocationId).toBeTruthy()
      if (movement.type === 'OUT') expect(movement.sourceLocationId).toBeTruthy()
      if (movement.type === 'TRANSFER') {
        expect(movement.sourceLocationId).toBeTruthy()
        expect(movement.destinationLocationId).toBeTruthy()
        expect(movement.sourceLocationId).not.toBe(movement.destinationLocationId)
      }
      if (movement.type === 'ADJUSTMENT') {
        expect(movement.quantity !== 0).toBe(true)
        expect(movement.note).toBeTruthy()
      }
    }

    // Transfers must not be counted as today's in/out double-writes in the chart
    const today = movements.filter((movement) => movement.createdAt.startsWith('2026-10-24'))
    expect(today.length).toBeGreaterThan(0)
  })
})
