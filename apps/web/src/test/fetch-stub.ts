/**
 * Test fixtures + fetch stub — builds API-shaped responses from the legacy
 * Phase 1 mock dataset so component tests exercise the real data flow
 * (WorkspaceProvider → TanStack Query → apiFetch → fetch) without a server.
 */

import { vi } from 'vitest'

import { balances, buildMovements, locations, products, warehouse } from '@/mocks/warehouse-data'
import { lowStockProducts, quantityByProduct } from '@/lib/stats'

const NOW = new Date()

const workspace = { id: 'ws-1', name: 'Toko TechNusa', currency: 'IDR', timezone: 'Asia/Jakarta' }
const movements = buildMovements(NOW)
const quantities = quantityByProduct(balances)
const zoneIds = new Map(
  [...new Set(locations.map((location) => location.zone))].map((zone, index) => [
    zone,
    `zone-${index}`,
  ])
)
const categoryIds = new Map(
  [...new Set(products.map((product) => product.category))].map((name, index) => [
    name,
    `cat-${index}`,
  ])
)

const apiLocations = locations.map((location) => ({
  id: location.id,
  zoneId: zoneIds.get(location.zone) ?? null,
  type: location.type,
  code: location.code,
  label: location.label,
  x: location.x,
  z: location.z,
  rotation: location.rotation,
  capacity: location.capacity,
  levels: 3,
}))

const apiProducts = products.map((product) => ({
  id: product.id,
  sku: product.sku,
  name: product.name,
  category: { id: categoryIds.get(product.category)!, name: product.category },
  unit: product.unit,
  barcode: product.barcode,
  costPrice: product.costPrice,
  reorderThreshold: product.reorderThreshold,
  description: product.description,
  active: product.active,
  totalQuantity: quantities.get(product.id) ?? 0,
  createdAt: NOW.toISOString(),
  updatedAt: NOW.toISOString(),
}))

const apiMovements = movements.map((movement, index) => ({
  ...movement,
  product: products.find((product) => product.id === movement.productId)!,
  actor: { id: 'user-1', name: movement.actor },
  sourceLocation: locations.find((location) => location.id === movement.sourceLocationId) ?? null,
  destinationLocation:
    locations.find((location) => location.id === movement.destinationLocationId) ?? null,
  reference: movement.reference,
  note: movement.note,
  createdAt: movement.createdAt,
  id: movement.id ?? `mv-${index}`,
}))

function series() {
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(NOW)
    date.setDate(date.getDate() - (6 - index))
    const dayMovements = movements.filter(
      (movement) => new Date(movement.createdAt).toDateString() === date.toDateString()
    )
    return {
      date: date.toISOString().slice(0, 10),
      masuk: dayMovements.filter((movement) => movement.type === 'IN').length,
      keluar: dayMovements.filter((movement) => movement.type === 'OUT').length,
    }
  })
}

function summary() {
  const low = lowStockProducts(products, balances).map((product) => ({
    id: product.id,
    name: product.name,
    quantity: quantities.get(product.id) ?? 0,
    reorderThreshold: product.reorderThreshold,
  }))
  const moved = [...products]
    .map((product) => ({
      id: product.id,
      name: product.name,
      moved: product.totalMoved,
    }))
    .sort((a, b) => b.moved - a.moved)
    .slice(0, 5)
  return {
    totalUnits: 4831,
    inventoryValue: 190_517_000,
    lowStockCount: low.length,
    lowStock: low,
    movementsToday: movements.filter(
      (movement) => new Date(movement.createdAt).toDateString() === NOW.toDateString()
    ).length,
    topMoved: moved,
    movementSeries: series(),
  }
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

/** Installs a fetch stub serving fixture data for the API endpoints the UI uses. */
export function installFetchStub() {
  const stub = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input instanceof URL ? input : input)
    const method = init?.method ?? 'GET'

    if (url.endsWith('/api/workspaces')) return jsonResponse({ data: [workspace] })

    if (url.includes('/api/warehouses/') && url.endsWith('/layout')) {
      return jsonResponse({
        data: {
          warehouse,
          zones: [...zoneIds.entries()].map(([name, id]) => ({ id, name, code: id })),
          locations: apiLocations,
          balances,
          products: products.map((product) => ({
            id: product.id,
            sku: product.sku,
            name: product.name,
            unit: product.unit,
            reorderThreshold: product.reorderThreshold,
          })),
        },
      })
    }

    if (url.includes('/api/warehouses')) {
      return jsonResponse({
        data: [{ id: warehouse.id, name: warehouse.name, code: warehouse.code }],
      })
    }

    if (url.includes('/api/dashboard/summary')) return jsonResponse({ data: summary() })

    if (url.includes('/api/storage-locations/') && url.includes('/inventory')) {
      const id = url.split('/api/storage-locations/')[1]?.split('/')[0]
      const location = locations.find((item) => item.id === id)
      if (!location)
        return jsonResponse(
          { error: { code: 'NOT_FOUND', message: 'Lokasi tidak ditemukan.' } },
          404
        )
      const lines = balances
        .filter((balance) => balance.locationId === id)
        .map((balance, index) => {
          const product = products.find((item) => item.id === balance.productId)!
          return {
            id: `bal-${id}-${index}`,
            level: balance.level ?? 1,
            quantity: balance.quantity,
            updatedAt: NOW.toISOString(),
            product: {
              id: product.id,
              sku: product.sku,
              name: product.name,
              unit: product.unit,
              reorderThreshold: product.reorderThreshold,
              active: product.active,
              category: { name: product.category },
            },
          }
        })
      return jsonResponse({
        data: {
          location: {
            id: location.id,
            code: location.code,
            label: location.label,
            type: location.type,
            zone: { name: location.zone },
            capacity: location.capacity,
            levels: 3,
            warehouse,
          },
          balances: lines,
          totalQuantity: lines.reduce((sum, line) => sum + line.quantity, 0),
        },
      })
    }

    if (url.includes('/api/products/')) {
      const id = url.split('/api/products/')[1]
      const product = apiProducts.find((item) => item.id === id)
      if (!product)
        return jsonResponse(
          { error: { code: 'NOT_FOUND', message: 'Produk tidak ditemukan.' } },
          404
        )
      const productBalances = balances
        .filter((balance) => balance.productId === id)
        .map((balance, index) => {
          const location = locations.find((item) => item.id === balance.locationId)!
          return {
            id: `pb-${index}`,
            level: balance.level ?? 1,
            quantity: balance.quantity,
            location: {
              id: location.id,
              code: location.code,
              label: location.label,
              zone: { name: location.zone },
            },
          }
        })
      return jsonResponse({
        data: {
          ...product,
          balances: productBalances,
          movements: apiMovements.filter((movement) => movement.productId === id).slice(0, 20),
        },
      })
    }

    if (url.includes('/api/products')) {
      const searchParam = new URL(url).searchParams.get('search')?.toLowerCase()
      const filtered = searchParam
        ? apiProducts.filter(
            (product) =>
              product.name.toLowerCase().includes(searchParam) ||
              product.sku.toLowerCase().includes(searchParam) ||
              (product.barcode ?? '').includes(searchParam)
          )
        : apiProducts
      return jsonResponse({ data: filtered, pagination: { total: filtered.length } })
    }

    if (url.includes('/api/categories')) {
      return jsonResponse({
        data: [...categoryIds.entries()].map(([name, id]) => ({
          id,
          name,
          _count: { products: products.filter((product) => product.category === name).length },
        })),
      })
    }

    if (url.includes('/api/stock-movements') && method === 'GET') {
      return jsonResponse({ data: apiMovements, pagination: { total: apiMovements.length } })
    }

    if (url.includes('/api/stock-movements/') && method === 'POST') {
      const payload = JSON.parse(String(init?.body ?? '{}')) as {
        productId: string
        quantity: number
        sourceLocationId?: string | null
        sourceLevel?: number | null
      }
      // Simulate the server-side oversell guard for stock-out.
      if (url.endsWith('/stock-out')) {
        const available =
          balances.find(
            (balance) =>
              balance.productId === payload.productId &&
              balance.locationId === payload.sourceLocationId &&
              (balance.level ?? 1) === (payload.sourceLevel ?? 1)
          )?.quantity ?? 0
        if (payload.quantity > available) {
          return jsonResponse(
            {
              error: {
                code: 'INSUFFICIENT_STOCK',
                message: `Stok tidak cukup di lokasi ini untuk mengeluarkan ${payload.quantity} unit.`,
              },
            },
            422
          )
        }
      }
      return jsonResponse({ data: { id: 'mv-new', reference: null } })
    }

    if (url.includes('/api/notifications')) {
      return jsonResponse({
        data: [
          {
            id: 'ntf-1',
            workspaceId: workspace.id,
            userId: null,
            type: 'LOW_STOCK',
            title: 'Beberapa produk di bawah ambang stok',
            body: 'Pantau halaman laporan untuk detailnya.',
            readAt: null,
            createdAt: NOW.toISOString(),
          },
        ],
        unread: 1,
      })
    }

    if (url.endsWith('/api/health')) return jsonResponse({ status: 'ok' })

    return jsonResponse(
      { error: { code: 'NOT_FOUND', message: `Stub tidak menangani ${url}` } },
      404
    )
  })

  vi.stubGlobal('fetch', stub)
  return stub
}
