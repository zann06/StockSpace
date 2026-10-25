/**
 * In-memory demo backend for the static GitHub Pages build (VITE_DEMO_MODE).
 *
 * The Pages site cannot run Fastify/PostgreSQL, so this module reimplements
 * the API surface over the fictional mock dataset — statefully. Sign-in with
 * the demo accounts works, stock movements actually mutate the in-memory
 * balances (with the same business rules: no overselling, viewer is
 * read-only, adjustments need a reason), the dashboard recomputes, and
 * low-stock notifications appear grouped. State resets when the page is
 * reloaded, and every screen keeps the visible "Data Seed Demo" badge.
 *
 * The web test suite exercises this same router through a fetch stub
 * (src/test/fetch-stub.ts), so the demo and the tests share one source of
 * truth.
 */

import type { MovementType } from '@/types'
import {
  inventoryValue as calcInventoryValue,
  lowStockProducts,
  movementSeries,
  movementsToday,
  quantityByProduct,
  totalUnitsOnHand,
} from '@/lib/stats'
import {
  balances as mockBalances,
  buildMovements,
  locations,
  products as mockProducts,
  warehouse,
} from '@/mocks/warehouse-data'

const DEMO_PASSWORD = 'stockspace-demo'

const DEMO_ACCOUNTS: Record<string, { name: string; role: 'OWNER' | 'STAFF' | 'VIEWER' }> = {
  'farid@technusa.example': { name: 'Farid Rizky', role: 'OWNER' },
  'dewi@technusa.example': { name: 'Dewi Lestari', role: 'STAFF' },
  'budi@technusa.example': { name: 'Budi Santoso', role: 'STAFF' },
  'viewer@technusa.example': { name: 'Nadia Viewer', role: 'VIEWER' },
}

interface DemoSession {
  user: { id: string; name: string; email: string; emailVerified: boolean; image: null }
  role: 'OWNER' | 'STAFF' | 'VIEWER'
}

interface DemoNotification {
  id: string
  type: 'LOW_STOCK' | 'INFO'
  title: string
  body: string
  readAt: string | null
  createdAt: string
}

interface DemoState {
  session: DemoSession | null
  balances: typeof mockBalances
  movements: ReturnType<typeof buildMovements>
  notifications: DemoNotification[]
  counter: number
}

let state: DemoState

function resetDemoState(options: { signedIn?: boolean } = {}) {
  const now = new Date()
  state = {
    session: options.signedIn
      ? {
          user: {
            id: 'user-1',
            name: 'Dewi Lestari',
            email: 'dewi@technusa.example',
            emailVerified: true,
            image: null,
          },
          role: 'STAFF',
        }
      : null,
    balances: mockBalances.map((balance) => ({ ...balance })),
    movements: buildMovements(now),
    notifications: [],
    counter: 0,
  }
}

resetDemoState({ signedIn: true })

export function isDemoMode(): boolean {
  return import.meta.env.VITE_DEMO_MODE === 'true'
}

// ---------- helpers ----------

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

const zoneIds = new Map(
  [...new Set(locations.map((location) => location.zone))].map((zone, index) => [
    zone,
    `zone-${index}`,
  ])
)
const categoryIds = new Map(
  [...new Set(mockProducts.map((product) => product.category))].map((name, index) => [
    name,
    `cat-${index}`,
  ])
)

function apiProducts() {
  const quantities = quantityByProduct(state.balances)
  const nowISO = new Date().toISOString()
  return mockProducts.map((product) => ({
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
    createdAt: nowISO,
    updatedAt: nowISO,
  }))
}

function apiMovements() {
  return state.movements.map((movement) => ({
    ...movement,
    actor: { id: 'user-1', name: movement.actor },
    sourceLocation: locations.find((location) => location.id === movement.sourceLocationId) ?? null,
    destinationLocation:
      locations.find((location) => location.id === movement.destinationLocationId) ?? null,
    sourceLevel: null,
    destinationLevel: null,
  }))
}

function balanceAt(productId: string, locationId: string, level: number) {
  return state.balances.find(
    (balance) =>
      balance.productId === productId &&
      balance.locationId === locationId &&
      (balance.level ?? 1) === level
  )
}

function applyBalance(productId: string, locationId: string, level: number, delta: number) {
  const row = balanceAt(productId, locationId, level)
  if (row) row.quantity += delta
  else state.balances.push({ productId, locationId, level: level as 1 | 2 | 3, quantity: delta })
}

function maybeAddLowStockNotification(productId: string) {
  const product = mockProducts.find((candidate) => candidate.id === productId)
  if (!product) return
  const total = quantityByProduct(state.balances).get(productId) ?? 0
  if (total >= product.reorderThreshold) return
  const existing = state.notifications.find(
    (item) =>
      item.type === 'LOW_STOCK' &&
      item.readAt === null &&
      item.body.includes(`[product:${productId}]`)
  )
  if (existing) return
  state.notifications.unshift({
    id: `ntf-low-${++state.counter}`,
    type: 'LOW_STOCK',
    title: `${product.name} di bawah ambang stok`,
    body: `Sisa ${total} unit (ambang ${product.reorderThreshold}). [product:${productId}]`,
    readAt: null,
    createdAt: new Date().toISOString(),
  })
}

/** Shared validation for the four movement endpoints. */
function handleMovement(
  kind: 'stock-in' | 'stock-out' | 'transfer' | 'adjustment',
  body: Record<string, unknown>
) {
  if (!state.session)
    return jsonResponse({ error: { code: 'UNAUTHORIZED', message: 'Sesi tidak ditemukan.' } }, 401)
  if (state.session.role === 'VIEWER') {
    return jsonResponse(
      {
        error: {
          code: 'ROLE_FORBIDDEN',
          message: `Peran Anda (VIEWER) tidak berhak melakukan aksi ini (butuh STAFF+).`,
        },
      },
      403
    )
  }

  const productId = String(body.productId ?? '')
  const quantity = Number(body.quantity ?? 0)
  const sourceLocationId = (body.sourceLocationId as string | undefined) ?? null
  const destinationLocationId = (body.destinationLocationId as string | undefined) ?? null
  const sourceLevel = Number(body.sourceLevel ?? 1)
  const destinationLevel = Number(body.destinationLevel ?? 1)
  const note = (body.note as string | undefined)?.trim() ?? ''

  const product = mockProducts.find((candidate) => candidate.id === productId)
  if (!product)
    return jsonResponse(
      { error: { code: 'PRODUCT_NOT_FOUND', message: 'Produk tidak ditemukan.' } },
      404
    )

  if (kind === 'adjustment' && quantity === 0) {
    return jsonResponse(
      { error: { code: 'INVALID_QUANTITY', message: 'Penyesuaian tidak boleh 0.' } },
      400
    )
  }
  if (kind !== 'adjustment' && quantity <= 0) {
    return jsonResponse(
      { error: { code: 'INVALID_QUANTITY', message: 'Jumlah harus lebih dari 0.' } },
      400
    )
  }
  if (kind === 'adjustment' && note.length < 3) {
    return jsonResponse(
      { error: { code: 'REASON_REQUIRED', message: 'Penyesuaian wajib menyertakan alasan.' } },
      400
    )
  }

  const needsSource = kind !== 'stock-in'
  const needsDestination = kind === 'stock-in' || kind === 'transfer'
  if (needsSource && !sourceLocationId) {
    return jsonResponse(
      { error: { code: 'LOCATION_NOT_FOUND', message: 'Lokasi sumber wajib diisi.' } },
      400
    )
  }
  if (needsDestination && !destinationLocationId) {
    return jsonResponse(
      { error: { code: 'LOCATION_NOT_FOUND', message: 'Lokasi tujuan wajib diisi.' } },
      400
    )
  }

  if (
    kind === 'transfer' &&
    sourceLocationId === destinationLocationId &&
    sourceLevel === destinationLevel
  ) {
    return jsonResponse(
      {
        error: {
          code: 'SAME_SOURCE_AND_DESTINATION',
          message: 'Lokasi/level asal dan tujuan tidak boleh sama.',
        },
      },
      400
    )
  }

  const debitLocation = kind === 'stock-in' ? null : sourceLocationId!
  const debitLevel = kind === 'stock-in' ? 1 : sourceLevel
  const debitAmount = kind === 'adjustment' ? -quantity : quantity

  if (debitLocation) {
    const available = balanceAt(productId, debitLocation, debitLevel)?.quantity ?? 0
    if (available < debitAmount) {
      const codeLabel =
        locations.find((location) => location.id === debitLocation)?.code ?? 'lokasi'
      return jsonResponse(
        {
          error: {
            code: 'INSUFFICIENT_STOCK',
            message: `Stok tidak cukup di ${codeLabel} untuk operasi ${debitAmount} unit.`,
          },
        },
        422
      )
    }
  }

  if (debitLocation) applyBalance(productId, debitLocation, debitLevel, -debitAmount)
  if (kind === 'stock-in')
    applyBalance(productId, destinationLocationId!, destinationLevel, quantity)
  if (kind === 'transfer')
    applyBalance(productId, destinationLocationId!, destinationLevel, quantity)
  if (kind === 'adjustment' && quantity > 0)
    applyBalance(productId, sourceLocationId!, sourceLevel, quantity)

  const type: MovementType =
    kind === 'stock-in'
      ? 'IN'
      : kind === 'stock-out'
        ? 'OUT'
        : kind === 'transfer'
          ? 'TRANSFER'
          : 'ADJUSTMENT'
  state.movements.unshift({
    id: `mv-demo-${++state.counter}`,
    productId,
    type,
    quantity,
    sourceLocationId: debitLocation,
    destinationLocationId: needsDestination ? destinationLocationId : null,
    reference: (body.reference as string | undefined)?.trim() || null,
    note: note || null,
    actor: state.session.user.name,
    createdAt: new Date().toISOString(),
  })

  maybeAddLowStockNotification(productId)
  return jsonResponse({
    data: { id: `mv-demo-${state.counter}`, reference: (body.reference as string) ?? null },
  })
}

// ---------- router ----------

/** Minimal Response-based router mirroring the Fastify API surface. */
export async function demoFetch(
  path: string,
  init?: { method?: string; body?: unknown }
): Promise<Response> {
  await delay(120)
  const url = new URL(path, 'http://demo.local')
  const route = url.pathname
  const method = (init?.method ?? 'GET').toUpperCase()
  const query = url.searchParams
  const body =
    typeof init?.body === 'string'
      ? (JSON.parse(init.body) as Record<string, unknown>)
      : ((init?.body ?? {}) as Record<string, unknown>)

  // ---- auth ----
  if (route === '/api/auth/get-session') {
    return jsonResponse(
      state.session
        ? {
            session: {
              id: 'sess-1',
              expiresAt: '2099-01-01T00:00:00.000Z',
              userId: state.session.user.id,
            },
            user: state.session.user,
          }
        : null
    )
  }
  if (route === '/api/auth/sign-in/email' && method === 'POST') {
    const account = DEMO_ACCOUNTS[String(body.email ?? '')]
    if (account && body.password === DEMO_PASSWORD) {
      const email = String(body.email)
      state.session = {
        user: {
          id: `user-${email.split('@')[0]}`,
          name: account.name,
          email,
          emailVerified: true,
          image: null,
        },
        role: account.role,
      }
      return jsonResponse({ user: state.session.user })
    }
    return jsonResponse({ message: 'Email atau password salah.' }, 401)
  }
  if (route === '/api/auth/sign-out' && method === 'POST') {
    state.session = null
    return jsonResponse({ success: true })
  }

  // ---- workspaces ----
  if (route === '/api/workspaces') {
    if (!state.session)
      return jsonResponse(
        { error: { code: 'UNAUTHORIZED', message: 'Sesi tidak ditemukan.' } },
        401
      )
    return jsonResponse({
      data: [
        {
          ...warehouse,
          id: 'ws-1',
          currency: 'IDR',
          timezone: 'Asia/Jakarta',
          role: state.session.role,
        },
      ],
    })
  }

  // ---- warehouses / layout ----
  if (route.startsWith('/api/warehouses/') && route.endsWith('/layout')) {
    return jsonResponse({
      data: {
        warehouse,
        zones: [...zoneIds.entries()].map(([name, id]) => ({ id, name, code: id })),
        locations: locations.map((location) => ({
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
        })),
        balances: state.balances,
        products: mockProducts.map((product) => ({
          id: product.id,
          sku: product.sku,
          name: product.name,
          unit: product.unit,
          reorderThreshold: product.reorderThreshold,
        })),
      },
    })
  }
  if (route === '/api/warehouses') {
    return jsonResponse({
      data: [{ id: warehouse.id, name: warehouse.name, code: warehouse.code }],
    })
  }

  // ---- dashboard ----
  if (route === '/api/dashboard/summary') {
    const quantities = quantityByProduct(state.balances)
    const low = lowStockProducts(mockProducts, state.balances)
    const moved = [...mockProducts]
      .map((product) => ({ id: product.id, name: product.name, moved: product.totalMoved }))
      .sort((a, b) => b.moved - a.moved)
      .slice(0, 5)
    return jsonResponse({
      data: {
        totalUnits: totalUnitsOnHand(state.balances),
        inventoryValue: calcInventoryValue(mockProducts, state.balances),
        lowStockCount: low.length,
        lowStock: low.slice(0, 8).map((product) => ({
          id: product.id,
          name: product.name,
          quantity: quantities.get(product.id) ?? 0,
          reorderThreshold: product.reorderThreshold,
        })),
        movementsToday: movementsToday(state.movements, new Date()),
        topMoved: moved,
        movementSeries: movementSeries(state.movements, new Date(), 7),
      },
    })
  }

  // ---- products ----
  if (route.startsWith('/api/products/')) {
    const id = route.split('/api/products/')[1]
    const product = apiProducts().find((item) => item.id === id)
    if (!product)
      return jsonResponse({ error: { code: 'NOT_FOUND', message: 'Produk tidak ditemukan.' } }, 404)
    const productBalances = state.balances
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
        movements: apiMovements()
          .filter((movement) => movement.productId === id)
          .slice(0, 20),
      },
    })
  }
  if (route === '/api/products') {
    const search = query.get('search')?.toLowerCase()
    const items = search
      ? apiProducts().filter(
          (product) =>
            product.name.toLowerCase().includes(search) ||
            product.sku.toLowerCase().includes(search) ||
            (product.barcode ?? '').includes(search)
        )
      : apiProducts()
    return jsonResponse({ data: items, pagination: { total: items.length } })
  }

  // ---- categories ----
  if (route === '/api/categories') {
    return jsonResponse({
      data: [...categoryIds.entries()].map(([name, id]) => ({
        id,
        name,
        _count: { products: mockProducts.filter((product) => product.category === name).length },
      })),
    })
  }

  // ---- location inventory ----
  if (route.startsWith('/api/storage-locations/') && route.endsWith('/inventory')) {
    const id = route.split('/api/storage-locations/')[1].split('/')[0]
    const location = locations.find((item) => item.id === id)
    if (!location)
      return jsonResponse({ error: { code: 'NOT_FOUND', message: 'Lokasi tidak ditemukan.' } }, 404)
    const lines = state.balances
      .filter((balance) => balance.locationId === id)
      .map((balance, index) => {
        const product = mockProducts.find((item) => item.id === balance.productId)!
        return {
          id: `bal-${id}-${index}`,
          level: balance.level ?? 1,
          quantity: balance.quantity,
          updatedAt: new Date().toISOString(),
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
      .sort((a, b) => a.level - b.level || b.quantity - a.quantity)
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

  // ---- movements ----
  if (route.startsWith('/api/stock-movements/') && method === 'POST') {
    const kind = route.split('/api/stock-movements/')[1] as
      'stock-in' | 'stock-out' | 'transfer' | 'adjustment'
    return handleMovement(kind, body)
  }
  if (route === '/api/stock-movements' && method === 'GET') {
    const type = query.get('type')
    const productId = query.get('productId')
    const locationId = query.get('locationId')
    const items = apiMovements().filter((movement) => {
      if (type && movement.type !== type) return false
      if (productId && movement.productId !== productId) return false
      if (
        locationId &&
        movement.sourceLocationId !== locationId &&
        movement.destinationLocationId !== locationId
      )
        return false
      return true
    })
    return jsonResponse({ data: items, pagination: { total: items.length } })
  }

  // ---- notifications ----
  if (route.startsWith('/api/notifications/') && route.endsWith('/read') && method === 'PATCH') {
    const id = route.split('/api/notifications/')[1].split('/')[0]
    const notification = state.notifications.find((item) => item.id === id)
    if (notification) notification.readAt = new Date().toISOString()
    return jsonResponse({ data: notification ?? {} })
  }
  if (route === '/api/notifications') {
    return jsonResponse({
      data: state.notifications,
      unread: state.notifications.filter((item) => item.readAt === null).length,
    })
  }

  // ---- reports ----
  if (route === '/api/reports/low-stock') {
    const quantities = quantityByProduct(state.balances)
    const items = mockProducts
      .filter(
        (product) => product.active && (quantities.get(product.id) ?? 0) < product.reorderThreshold
      )
      .map((product) => ({
        id: product.id,
        sku: product.sku,
        name: product.name,
        category: product.category,
        quantity: quantities.get(product.id) ?? 0,
        reorderThreshold: product.reorderThreshold,
        shortfall: Math.max(0, product.reorderThreshold - (quantities.get(product.id) ?? 0)),
        stockValue: (quantities.get(product.id) ?? 0) * product.costPrice,
      }))
      .sort((a, b) => a.quantity / a.reorderThreshold - b.quantity / b.reorderThreshold)
    return jsonResponse({ data: items })
  }
  if (route === '/api/reports/movements') {
    const type = query.get('type')
    const productId = query.get('productId')
    const from = query.get('from')
    const to = query.get('to')
    const items = apiMovements().filter((movement) => {
      if (type && movement.type !== type) return false
      if (productId && movement.productId !== productId) return false
      if (from && new Date(movement.createdAt) < new Date(from)) return false
      if (to && new Date(movement.createdAt) > new Date(to)) return false
      return true
    })
    return jsonResponse({ data: items, pagination: { total: items.length } })
  }
  if (route === '/api/reports/export.csv') {
    const report = query.get('report') ?? 'movements'
    const rows: string[][] =
      report === 'low-stock'
        ? [
            ['sku', 'produk', 'kategori', 'stok', 'ambang', 'kekurangan'],
            ...mockProducts
              .filter((product) => product.active)
              .map((product) => [
                product.sku,
                product.name,
                product.category,
                String(quantityByProduct(state.balances).get(product.id) ?? 0),
                String(product.reorderThreshold),
              ]),
          ]
        : [
            ['waktu', 'sku', 'produk', 'jenis', 'jumlah', 'dari', 'ke', 'referensi', 'aktor'],
            ...apiMovements().map((movement) => {
              const product = mockProducts.find((item) => item.id === movement.productId)
              return [
                movement.createdAt,
                product?.sku ?? '',
                product?.name ?? '',
                movement.type,
                String(movement.quantity),
                locations.find((item) => item.id === movement.sourceLocationId)?.code ?? '',
                locations.find((item) => item.id === movement.destinationLocationId)?.code ?? '',
                movement.reference ?? '',
                movement.actor.name,
              ]
            }),
          ]
    const csv = rows
      .map((row) =>
        row.map((cell) => (/[",\n;]/.test(cell) ? `"${cell.replace(/"/g, '""')}"` : cell)).join(',')
      )
      .join('\r\n')
    return new Response(csv, {
      status: 200,
      headers: { 'content-type': 'text/csv; charset=utf-8' },
    })
  }

  return jsonResponse(
    { error: { code: 'NOT_FOUND', message: `Demo tidak menangani ${route}` } },
    404
  )
}

export { resetDemoState, DEMO_PASSWORD, DEMO_ACCOUNTS }
export type { DemoState }
