import type { Balance, Movement, Product, SceneProduct, StorageLocation } from '@/types'
import { formatWeekday, isSameDay } from '@/lib/format'

/** Pure inventory computations — unit-tested and shared by every page. */

export function quantityByProduct(balances: Balance[]): Map<string, number> {
  const map = new Map<string, number>()
  for (const balance of balances) {
    map.set(balance.productId, (map.get(balance.productId) ?? 0) + balance.quantity)
  }
  return map
}

export function totalUnitsOnHand(balances: Balance[]): number {
  return balances.reduce((sum, balance) => sum + balance.quantity, 0)
}

/** Active products whose total on-hand quantity is below the reorder threshold. */
export function lowStockProducts(products: Product[], balances: Balance[]): Product[] {
  const quantities = quantityByProduct(balances)
  return products
    .filter(
      (product) => product.active && (quantities.get(product.id) ?? 0) < product.reorderThreshold
    )
    .sort(
      (a, b) =>
        (quantities.get(a.id) ?? 0) / a.reorderThreshold -
        (quantities.get(b.id) ?? 0) / b.reorderThreshold
    )
}

/** Inventory value = Σ(quantity × cost price). Documented in Reports UI. */
export function inventoryValue(products: Product[], balances: Balance[]): number {
  const byId = new Map(products.map((product) => [product.id, product]))
  return balances.reduce((sum, balance) => {
    const product = byId.get(balance.productId)
    return product ? sum + balance.quantity * product.costPrice : sum
  }, 0)
}

export function movementsToday(movements: Movement[], now: Date): number {
  return movements.filter((movement) => isSameDay(new Date(movement.createdAt), now)).length
}

export interface MovementDayPoint {
  label: string
  masuk: number
  keluar: number
}

/** Daily in/out counts for the last `days` days ending today (chart series). */
export function movementSeries(movements: Movement[], now: Date, days = 7): MovementDayPoint[] {
  const points: MovementDayPoint[] = []
  for (let offset = days - 1; offset >= 0; offset--) {
    const date = new Date(now)
    date.setDate(date.getDate() - offset)
    points.push({
      label: offset === 0 ? 'Hari ini' : formatWeekday(date),
      masuk: 0,
      keluar: 0,
    })
  }

  const firstDay = new Date(now)
  firstDay.setDate(firstDay.getDate() - (days - 1))
  firstDay.setHours(0, 0, 0, 0)

  for (const movement of movements) {
    const created = new Date(movement.createdAt)
    if (created < firstDay) continue
    const dayIndex = Math.floor((created.getTime() - firstDay.getTime()) / 86_400_000)
    const point = points[dayIndex]
    if (!point) continue
    if (movement.type === 'IN') point.masuk += 1
    else if (movement.type === 'OUT') point.keluar += 1
  }
  return points
}

export function topMovedProducts(products: Product[], limit = 5): Product[] {
  return [...products]
    .filter((product) => product.active)
    .sort((a, b) => b.totalMoved - a.totalMoved)
    .slice(0, limit)
}

export function locationQuantity(locationId: string, balances: Balance[]): number {
  return balances
    .filter((balance) => balance.locationId === locationId)
    .reduce((sum, balance) => sum + balance.quantity, 0)
}

/**
 * Occupancy for a location. Only RACK locations can report LOW — staging and
 * packing areas hold transient stock, so a low product parked there is not a
 * storage problem.
 */
export function locationStatus(
  location: StorageLocation,
  balances: Balance[],
  products: SceneProduct[]
): 'EMPTY' | 'OCCUPIED' | 'LOW' {
  const locationBalances = balances.filter((balance) => balance.locationId === location.id)
  if (locationBalances.length === 0) return 'EMPTY'
  if (location.type === 'RACK') {
    const byId = new Map(products.map((product) => [product.id, product]))
    const hasLow = locationBalances.some((balance) => {
      const product = byId.get(balance.productId)
      return product ? balance.quantity < product.reorderThreshold : false
    })
    if (hasLow) return 'LOW'
  }
  return 'OCCUPIED'
}

export interface ProductLine {
  product: Product
  quantity: number
  low: boolean
}

export function productLinesForLocation(
  locationId: string,
  balances: Balance[],
  products: Product[]
): ProductLine[] {
  const byId = new Map(products.map((product) => [product.id, product]))
  return balances
    .filter((balance) => balance.locationId === locationId)
    .map((balance) => {
      const product = byId.get(balance.productId)!
      return {
        product,
        quantity: balance.quantity,
        low: balance.quantity < product.reorderThreshold,
      }
    })
    .sort((a, b) => b.quantity - a.quantity)
}

export function movementsForLocation(movements: Movement[], locationId: string): Movement[] {
  return movements
    .filter(
      (movement) =>
        movement.sourceLocationId === locationId || movement.destinationLocationId === locationId
    )
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export function movementsForProduct(movements: Movement[], productId: string): Movement[] {
  return movements
    .filter((movement) => movement.productId === productId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export function locationUtilization(
  location: StorageLocation,
  balances: Balance[]
): { used: number; capacity: number | null; ratio: number | null } {
  const used = locationQuantity(location.id, balances)
  if (location.capacity == null) return { used, capacity: null, ratio: null }
  return { used, capacity: location.capacity, ratio: Math.min(1, used / location.capacity) }
}
