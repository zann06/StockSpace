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

import type { MovementType, StocktakeStatus } from '@/types'
import type { MemberRole } from './types'
import { roleAtLeast } from '@/lib/roles'
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
  products as seedProducts,
  warehouse,
} from '@/mocks/warehouse-data'

const DEMO_PASSWORD = 'stockspace-demo'

const DEMO_ACCOUNTS: Record<string, { name: string; role: MemberRole }> = {
  'farid@technusa.example': { name: 'Farid Rizky', role: 'OWNER' },
  'dewi@technusa.example': { name: 'Dewi Lestari', role: 'STAFF' },
  'budi@technusa.example': { name: 'Budi Santoso', role: 'STAFF' },
  'viewer@technusa.example': { name: 'Nadia Viewer', role: 'VIEWER' },
  // Registered accounts that are not workspace members yet — they make the
  // invite flow demonstrable in the static build.
  'admin@technusa.example': { name: 'Andi Pratama', role: 'ADMIN' },
  'sari@technusa.example': { name: 'Sari Wulandari', role: 'STAFF' },
}

interface DemoSession {
  user: { id: string; name: string; email: string; emailVerified: boolean; image: null }
  role: MemberRole
}

interface DemoMember {
  id: string
  userId: string
  name: string
  email: string
  role: MemberRole
  createdAt: string
}

interface DemoNotification {
  id: string
  type: 'LOW_STOCK' | 'INFO'
  title: string
  body: string
  readAt: string | null
  createdAt: string
}

interface DemoSupplier {
  id: string
  name: string
  contactName: string | null
  email: string | null
  phone: string | null
  address: string | null
  notes: string | null
}

interface DemoStocktakeLine {
  id: string
  productId: string
  locationId: string
  level: number
  expectedQty: number
  countedQty: number | null
}

interface DemoStocktake {
  id: string
  warehouseId: string
  status: StocktakeStatus
  note: string | null
  createdById: string
  createdAt: string
  completedAt: string | null
  lines: DemoStocktakeLine[]
}

interface DemoState {
  suppliers: DemoSupplier[]
  stocktakes: DemoStocktake[]
  session: DemoSession | null
  members: DemoMember[]
  products: typeof seedProducts
  balances: typeof mockBalances
  movements: ReturnType<typeof buildMovements>
  notifications: DemoNotification[]
  counter: number
}

let state: DemoState

function demoUserId(email: string): string {
  return `user-${email.split('@')[0]}`
}

function initialMembers(): DemoMember[] {
  const createdAt = new Date().toISOString()
  return [
    'farid@technusa.example',
    'dewi@technusa.example',
    'budi@technusa.example',
    'viewer@technusa.example',
  ].map((email, index) => ({
    id: `member-${index + 1}`,
    userId: demoUserId(email),
    name: DEMO_ACCOUNTS[email]!.name,
    email,
    role: DEMO_ACCOUNTS[email]!.role,
    createdAt,
  }))
}

const DEMO_SUPPLIERS: DemoSupplier[] = [
  {
    id: 'sup-1',
    name: 'PT Sumber Teknik',
    contactName: 'Andi Wijaya',
    email: 'andi@sumberteknik.example',
    phone: '021-555-0101',
    address: 'Jl. Industri Raya 12, Jakarta',
    notes: null,
  },
  {
    id: 'sup-2',
    name: 'CV Aksesori Nusantara',
    contactName: 'Rina Hartati',
    email: 'rina@aksesorinusantara.example',
    phone: '022-555-0102',
    address: null,
    notes: 'Pengiriman hanya hari kerja.',
  },
]

function resetDemoState(options: { signedIn?: boolean } = {}) {
  const now = new Date()
  state = {
    session: options.signedIn
      ? {
          user: {
            id: 'user-dewi',
            name: 'Dewi Lestari',
            email: 'dewi@technusa.example',
            emailVerified: true,
            image: null,
          },
          role: 'STAFF',
        }
      : null,
    members: initialMembers(),
    products: seedProducts.map((product) => ({ ...product })),
    suppliers: DEMO_SUPPLIERS.map((supplier) => ({ ...supplier })),
    balances: mockBalances.map((balance) => ({ ...balance })),
    movements: buildMovements(now),
    notifications: [],
    stocktakes: [],
    counter: 0,
  }
}

resetDemoState({ signedIn: false })

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
  [...new Set(seedProducts.map((product) => product.category))].map((name, index) => [
    name,
    `cat-${index}`,
  ])
)

function apiProducts() {
  const quantities = quantityByProduct(state.balances)
  const nowISO = new Date().toISOString()
  return state.products.map((product) => ({
    id: product.id,
    sku: product.sku,
    name: product.name,
    category: product.category
      ? {
          id: categoryIds.get(product.category) ?? `cat-${product.category}`,
          name: product.category,
        }
      : null,
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
    product: state.products.find((candidate) => candidate.id === movement.productId) ?? {
      id: movement.productId,
      sku: '—',
      name: 'Produk tidak dikenal',
      unit: 'pcs',
    },
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
  const product = state.products.find((candidate) => candidate.id === productId)
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

  const product = state.products.find((candidate) => candidate.id === productId)
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

  let supplierId: string | null = null
  if (kind === 'stock-in' && body.supplierId) {
    const supplier = state.suppliers.find((item) => item.id === body.supplierId)
    if (!supplier) {
      return jsonResponse(
        {
          error: {
            code: 'SUPPLIER_NOT_FOUND',
            message: 'Supplier tidak ditemukan di workspace ini.',
          },
        },
        404
      )
    }
    supplierId = supplier.id
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
    supplierId,
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
    const membership = state.members.find((member) => member.userId === state.session!.user.id)
    return jsonResponse({
      data: membership
        ? [
            {
              id: 'ws-1',
              name: 'Toko TechNusa',
              currency: 'IDR',
              timezone: 'Asia/Jakarta',
              role: membership.role,
            },
          ]
        : [],
    })
  }

  // ---- workspace members ----
  if (route === '/api/members' || route.startsWith('/api/members/')) {
    if (!state.session) {
      return jsonResponse(
        { error: { code: 'UNAUTHORIZED', message: 'Sesi tidak ditemukan.' } },
        401
      )
    }
    const session = state.session
    if (!state.members.some((member) => member.userId === session.user.id)) {
      return jsonResponse(
        { error: { code: 'NOT_A_MEMBER', message: 'Anda bukan anggota workspace ini.' } },
        403
      )
    }
    const canManage = roleAtLeast(session.role, 'ADMIN')

    if (route === '/api/members' && method === 'GET') {
      return jsonResponse({ data: state.members })
    }

    if (route === '/api/members' && method === 'POST') {
      if (!canManage) {
        return jsonResponse(
          {
            error: {
              code: 'ROLE_FORBIDDEN',
              message: `Peran Anda (${session.role}) tidak berhak melakukan aksi ini (butuh ADMIN+).`,
            },
          },
          403
        )
      }
      const email = String(body.email ?? '')
        .trim()
        .toLowerCase()
      const role = String(body.role ?? 'STAFF') as MemberRole
      const account = DEMO_ACCOUNTS[email]
      if (!account) {
        return jsonResponse(
          {
            error: {
              code: 'USER_NOT_FOUND',
              message: `Belum ada akun StockSpace dengan email "${email}". Minta pengguna mendaftar terlebih dahulu.`,
            },
          },
          404
        )
      }
      if (state.members.some((member) => member.email === email)) {
        return jsonResponse(
          {
            error: {
              code: 'MEMBER_EXISTS',
              message: 'Pengguna ini sudah menjadi anggota workspace.',
            },
          },
          409
        )
      }
      if (!roleAtLeast(session.role, role)) {
        return jsonResponse(
          {
            error: {
              code: 'ROLE_FORBIDDEN',
              message: `Peran Anda (${session.role}) tidak berhak mengundang anggota sebagai ${role}.`,
            },
          },
          403
        )
      }
      const member: DemoMember = {
        id: `member-${++state.counter}-invited`,
        userId: demoUserId(email),
        name: account.name,
        email,
        role,
        createdAt: new Date().toISOString(),
      }
      state.members.push(member)
      return jsonResponse({ data: member })
    }

    const memberId = route.split('/api/members/')[1]
    const member = state.members.find((candidate) => candidate.id === memberId)
    if (!member) {
      return jsonResponse(
        { error: { code: 'MEMBER_NOT_FOUND', message: 'Anggota tidak ditemukan.' } },
        404
      )
    }
    if (!canManage) {
      return jsonResponse(
        {
          error: {
            code: 'ROLE_FORBIDDEN',
            message: `Peran Anda (${session.role}) tidak berhak melakukan aksi ini (butuh ADMIN+).`,
          },
        },
        403
      )
    }
    if (member.userId === session.user.id) {
      return jsonResponse(
        {
          error: {
            code: method === 'DELETE' ? 'SELF_REMOVE' : 'SELF_ROLE_CHANGE',
            message:
              method === 'DELETE'
                ? 'Anda tidak dapat menghapus keanggotaan sendiri.'
                : 'Anda tidak dapat mengubah peran sendiri. Minta Owner lain melakukannya.',
          },
        },
        400
      )
    }
    if (!roleAtLeast(session.role, member.role)) {
      return jsonResponse(
        {
          error: {
            code: 'ROLE_FORBIDDEN',
            message: `Peran Anda (${session.role}) tidak berhak mengelola anggota dengan peran ${member.role}.`,
          },
        },
        403
      )
    }

    if (method === 'DELETE') {
      if (
        member.role === 'OWNER' &&
        !state.members.some((item) => item.role === 'OWNER' && item.id !== member.id)
      ) {
        return jsonResponse(
          {
            error: {
              code: 'LAST_OWNER',
              message:
                'Workspace harus memiliki minimal satu Owner. Angkat Owner lain terlebih dahulu.',
            },
          },
          409
        )
      }
      state.members = state.members.filter((item) => item.id !== member.id)
      return jsonResponse({ data: { id: member.id } })
    }

    if (method === 'PATCH') {
      const role = String(body.role ?? '') as MemberRole
      if (!['OWNER', 'ADMIN', 'STAFF', 'VIEWER'].includes(role)) {
        return jsonResponse(
          {
            error: { code: 'VALIDATION_FAILED', message: 'Data tidak valid — role tidak dikenal.' },
          },
          422
        )
      }
      if (!roleAtLeast(session.role, role)) {
        return jsonResponse(
          {
            error: {
              code: 'ROLE_FORBIDDEN',
              message: `Peran Anda (${session.role}) tidak berhak mengangkat anggota menjadi ${role}.`,
            },
          },
          403
        )
      }
      if (member.role === 'OWNER' && role !== 'OWNER') {
        const otherOwner = state.members.some(
          (item) => item.role === 'OWNER' && item.id !== member.id
        )
        if (!otherOwner) {
          return jsonResponse(
            {
              error: {
                code: 'LAST_OWNER',
                message:
                  'Workspace harus memiliki minimal satu Owner. Angkat Owner lain terlebih dahulu.',
              },
            },
            409
          )
        }
      }
      member.role = role
      return jsonResponse({ data: member })
    }
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
        products: state.products.map((product) => ({
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
    const low = lowStockProducts(state.products, state.balances)
    const moved = [...state.products]
      .map((product) => ({ id: product.id, name: product.name, moved: product.totalMoved }))
      .sort((a, b) => b.moved - a.moved)
      .slice(0, 5)
    return jsonResponse({
      data: {
        totalUnits: totalUnitsOnHand(state.balances),
        inventoryValue: calcInventoryValue(state.products, state.balances),
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
  // ---- product import (before the detail route below) ----
  if (route === '/api/products/import' && method === 'POST') {
    if (!state.session || !roleAtLeast(state.session.role, 'ADMIN')) {
      return jsonResponse(
        {
          error: {
            code: 'ROLE_FORBIDDEN',
            message: 'Peran Anda tidak berhak melakukan aksi ini (butuh ADMIN+).',
          },
        },
        403
      )
    }
    const rows = (body.rows as Array<Record<string, unknown>>) ?? []
    const created: string[] = []
    const updated: string[] = []
    const errors: { row: number; message: string }[] = []
    rows.forEach((row, index) => {
      const sku = String(row.sku ?? '').trim()
      const name = String(row.name ?? '').trim()
      if (!sku || !name) {
        errors.push({ row: index + 1, message: 'SKU dan nama wajib diisi.' })
        return
      }
      const existing = state.products.find((product) => product.sku === sku)
      if (existing) {
        existing.name = name
        existing.unit = String(row.unit ?? existing.unit)
        existing.barcode = (row.barcode as string) ?? existing.barcode
        existing.costPrice = Number(row.costPrice ?? existing.costPrice)
        existing.reorderThreshold = Number(row.reorderThreshold ?? existing.reorderThreshold)
        updated.push(sku)
      } else {
        state.products.push({
          id: `prd-${++state.counter}`,
          sku,
          name,
          category: String(row.category ?? 'Tanpa Kategori'),
          unit: String(row.unit ?? 'pcs'),
          barcode: (row.barcode as string) ?? null,
          costPrice: Number(row.costPrice ?? 0),
          reorderThreshold: Number(row.reorderThreshold ?? 0),
          description: (row.description as string) ?? null,
          active: true,
          totalMoved: 0,
        })
        created.push(sku)
      }
    })
    return jsonResponse({ data: { created, updated, errors } })
  }

  const productIdFromPath = route.startsWith('/api/products/')
    ? route.split('/api/products/')[1]
    : null
  const canWriteProducts = !!state.session && roleAtLeast(state.session.role, 'ADMIN')

  if (route === '/api/products' && method === 'POST') {
    if (!canWriteProducts) {
      return jsonResponse(
        {
          error: {
            code: 'ROLE_FORBIDDEN',
            message: 'Peran Anda tidak berhak menambah produk (butuh ADMIN+).',
          },
        },
        403
      )
    }
    const sku = String(body.sku ?? '').trim()
    const name = String(body.name ?? '').trim()
    if (!sku || !name) {
      return jsonResponse(
        { error: { code: 'VALIDATION_FAILED', message: 'SKU dan nama produk wajib diisi.' } },
        422
      )
    }
    if (state.products.some((product) => product.sku === sku)) {
      return jsonResponse(
        {
          error: {
            code: 'SKU_TAKEN',
            message: `SKU "${sku}" sudah dipakai produk lain di workspace ini.`,
          },
        },
        409
      )
    }
    const categoryId = body.categoryId ? String(body.categoryId) : null
    const categoryName = categoryId
      ? [...categoryIds.entries()].find(([, id]) => id === categoryId)?.[0]
      : ''
    if (categoryId && !categoryName) {
      return jsonResponse(
        {
          error: {
            code: 'PRODUCT_NOT_FOUND',
            message: 'Kategori tidak ditemukan di workspace ini.',
          },
        },
        404
      )
    }
    const created = {
      id: `p-demo-${++state.counter}`,
      sku,
      name,
      category: categoryName ?? '',
      unit: String(body.unit ?? 'pcs') || 'pcs',
      barcode: body.barcode ? String(body.barcode) : null,
      costPrice: Number(body.costPrice ?? 0),
      reorderThreshold: Number(body.reorderThreshold ?? 0),
      description: String(body.description ?? ''),
      active: body.active !== false,
      totalMoved: 0,
    }
    state.products.push(created)
    return jsonResponse({ data: apiProducts().find((product) => product.id === created.id) })
  }

  if (productIdFromPath && method === 'PATCH') {
    if (!canWriteProducts) {
      return jsonResponse(
        {
          error: {
            code: 'ROLE_FORBIDDEN',
            message: 'Peran Anda tidak berhak mengubah produk (butuh ADMIN+).',
          },
        },
        403
      )
    }
    const product = state.products.find((candidate) => candidate.id === productIdFromPath)
    if (!product) {
      return jsonResponse(
        { error: { code: 'PRODUCT_NOT_FOUND', message: 'Produk tidak ditemukan.' } },
        404
      )
    }
    if (body.name !== undefined) product.name = String(body.name).trim()
    if (body.unit !== undefined) product.unit = String(body.unit)
    if (body.barcode !== undefined) product.barcode = body.barcode ? String(body.barcode) : null
    if (body.costPrice !== undefined) product.costPrice = Number(body.costPrice)
    if (body.reorderThreshold !== undefined)
      product.reorderThreshold = Number(body.reorderThreshold)
    if (body.description !== undefined) product.description = String(body.description ?? '')
    if (body.active !== undefined) product.active = body.active !== false
    if (body.categoryId !== undefined) {
      if (body.categoryId === null) {
        product.category = ''
      } else {
        const categoryId = String(body.categoryId)
        const categoryName = [...categoryIds.entries()].find(([, id]) => id === categoryId)?.[0]
        if (!categoryName) {
          return jsonResponse(
            {
              error: {
                code: 'PRODUCT_NOT_FOUND',
                message: 'Kategori tidak ditemukan di workspace ini.',
              },
            },
            404
          )
        }
        product.category = categoryName
      }
    }
    return jsonResponse({ data: apiProducts().find((item) => item.id === product.id) })
  }

  if (productIdFromPath && method === 'GET') {
    const id = productIdFromPath
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

  if (route === '/api/products' && method === 'GET') {
    const search = query.get('search')?.toLowerCase()
    const categoryId = query.get('categoryId')
    const items = apiProducts().filter((product) => {
      if (categoryId && product.category?.id !== categoryId) return false
      if (!search) return true
      return (
        product.name.toLowerCase().includes(search) ||
        product.sku.toLowerCase().includes(search) ||
        (product.barcode ?? '').includes(search)
      )
    })
    return jsonResponse({ data: items, pagination: { total: items.length } })
  }

  // ---- categories ----
  if (route === '/api/categories') {
    return jsonResponse({
      data: [...categoryIds.entries()].map(([name, id]) => ({
        id,
        name,
        _count: { products: state.products.filter((product) => product.category === name).length },
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
        const product = state.products.find((item) => item.id === balance.productId)!
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
    const items = state.products
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
    const page = Math.max(1, Number(query.get('page') ?? 1) || 1)
    const perPage = Math.min(100, Math.max(1, Number(query.get('perPage') ?? 50) || 50))
    const items = apiMovements().filter((movement) => {
      if (type && movement.type !== type) return false
      if (productId && movement.productId !== productId) return false
      if (from && new Date(movement.createdAt) < new Date(from)) return false
      if (to && new Date(movement.createdAt) > new Date(to)) return false
      return true
    })
    return jsonResponse({
      data: items.slice((page - 1) * perPage, page * perPage),
      pagination: { page, perPage, total: items.length },
    })
  }
  // ---- suppliers ----
  if (route === '/api/suppliers' && method === 'GET') {
    if (!state.session)
      return jsonResponse(
        { error: { code: 'UNAUTHORIZED', message: 'Sesi tidak ditemukan.' } },
        401
      )
    const search = query.get('search')?.toLowerCase()
    return jsonResponse({
      data: state.suppliers
        .filter((supplier) =>
          search
            ? supplier.name.toLowerCase().includes(search) ||
              (supplier.contactName ?? '').toLowerCase().includes(search)
            : true
        )
        .map((supplier) => ({
          ...supplier,
          _count: {
            products: state.products.filter((product) => product.supplierId === supplier.id).length,
          },
        })),
    })
  }
  if (route === '/api/suppliers' && method === 'POST') {
    if (!state.session || !roleAtLeast(state.session.role, 'ADMIN')) {
      return jsonResponse(
        {
          error: {
            code: 'ROLE_FORBIDDEN',
            message: 'Peran Anda tidak berhak melakukan aksi ini (butuh ADMIN+).',
          },
        },
        403
      )
    }
    const supplier: DemoSupplier = {
      id: `sup-${++state.counter}`,
      name: String(body.name ?? 'Supplier baru'),
      contactName: (body.contactName as string) ?? null,
      email: (body.email as string) ?? null,
      phone: (body.phone as string) ?? null,
      address: (body.address as string) ?? null,
      notes: (body.notes as string) ?? null,
    }
    state.suppliers.push(supplier)
    return jsonResponse({ data: supplier })
  }
  if (route.startsWith('/api/suppliers/') && (method === 'PATCH' || method === 'DELETE')) {
    if (!state.session || !roleAtLeast(state.session.role, 'ADMIN')) {
      return jsonResponse(
        {
          error: {
            code: 'ROLE_FORBIDDEN',
            message: 'Peran Anda tidak berhak melakukan aksi ini (butuh ADMIN+).',
          },
        },
        403
      )
    }
    const id = route.split('/api/suppliers/')[1]
    const index = state.suppliers.findIndex((supplier) => supplier.id === id)
    if (index === -1) {
      return jsonResponse(
        { error: { code: 'SUPPLIER_NOT_FOUND', message: 'Supplier tidak ditemukan.' } },
        404
      )
    }
    if (method === 'DELETE') {
      const inUse = state.products.filter((product) => product.supplierId === id).length
      if (inUse > 0) {
        return jsonResponse(
          {
            error: {
              code: 'SUPPLIER_IN_USE',
              message: `Supplier masih dipakai ${inUse} produk — lepas dulu relasinya.`,
            },
          },
          409
        )
      }
      state.suppliers.splice(index, 1)
      return jsonResponse({ data: { id } })
    }
    state.suppliers[index] = { ...state.suppliers[index], ...(body as Partial<DemoSupplier>) }
    return jsonResponse({ data: state.suppliers[index] })
  }

  // ---- stocktakes ----
  if (route === '/api/stocktakes' && method === 'GET') {
    if (!state.session)
      return jsonResponse(
        { error: { code: 'UNAUTHORIZED', message: 'Sesi tidak ditemukan.' } },
        401
      )
    return jsonResponse({
      data: state.stocktakes.map((stocktake) => ({
        ...stocktake,
        warehouse: { ...warehouse },
        createdBy: { id: stocktake.createdById, name: state.session?.user.name ?? '—' },
        _count: { lines: stocktake.lines.length },
      })),
    })
  }
  if (route === '/api/stocktakes' && method === 'POST') {
    if (!state.session || !roleAtLeast(state.session.role, 'STAFF')) {
      return jsonResponse(
        {
          error: {
            code: 'ROLE_FORBIDDEN',
            message: 'Peran Anda tidak berhak melakukan aksi ini (butuh STAFF+).',
          },
        },
        403
      )
    }
    if (state.stocktakes.some((stocktake) => stocktake.status === 'OPEN')) {
      return jsonResponse(
        {
          error: {
            code: 'STOCKTAKE_OPEN',
            message: 'Masih ada stock opname berstatus terbuka — selesaikan atau batalkan dulu.',
          },
        },
        409
      )
    }
    const stocktake: DemoStocktake = {
      id: `st-${++state.counter}`,
      warehouseId: warehouse.id,
      status: 'OPEN',
      note: (body.note as string) ?? null,
      createdById: state.session.user.id,
      createdAt: new Date().toISOString(),
      completedAt: null,
      lines: state.balances.map((balance, index) => ({
        id: `stl-${state.counter}-${index}`,
        productId: balance.productId,
        locationId: balance.locationId,
        level: balance.level ?? 1,
        expectedQty: balance.quantity,
        countedQty: null,
      })),
    }
    state.stocktakes.unshift(stocktake)
    return jsonResponse({ data: { ...stocktake, _count: { lines: stocktake.lines.length } } })
  }
  if (route.startsWith('/api/stocktakes/')) {
    if (!state.session)
      return jsonResponse(
        { error: { code: 'UNAUTHORIZED', message: 'Sesi tidak ditemukan.' } },
        401
      )
    const parts = route.split('/api/stocktakes/')[1].split('/')
    const stocktake = state.stocktakes.find((item) => item.id === parts[0])
    if (!stocktake)
      return jsonResponse(
        { error: { code: 'STOCKTAKE_NOT_FOUND', message: 'Stock opname tidak ditemukan.' } },
        404
      )

    if (method === 'GET' && parts.length === 1) {
      return jsonResponse({
        data: {
          ...stocktake,
          warehouse: { ...warehouse },
          createdBy: { id: stocktake.createdById, name: state.session.user.name },
          lines: stocktake.lines.map((line) => ({
            ...line,
            product: state.products.find((product) => product.id === line.productId) ?? {
              id: line.productId,
              sku: '—',
              name: 'Produk tidak dikenal',
              unit: 'pcs',
            },
            location: locations.find((location) => location.id === line.locationId) ?? {
              id: line.locationId,
              code: '—',
              label: 'Lokasi tidak dikenal',
            },
          })),
        },
      })
    }
    if (parts[1] === 'lines' && method === 'PATCH' && parts.length === 3) {
      if (stocktake.status !== 'OPEN') {
        return jsonResponse(
          { error: { code: 'STOCKTAKE_CLOSED', message: 'Stock opname ini sudah ditutup.' } },
          409
        )
      }
      const line = stocktake.lines.find((item) => item.id === parts[2])
      if (!line)
        return jsonResponse(
          { error: { code: 'STOCKTAKE_LINE_NOT_FOUND', message: 'Baris hitung tidak ditemukan.' } },
          404
        )
      line.countedQty = body.countedQty === null ? null : Number(body.countedQty)
      return jsonResponse({ data: line })
    }
    if (parts[1] === 'commit' && method === 'POST') {
      if (stocktake.status !== 'OPEN') {
        return jsonResponse(
          { error: { code: 'STOCKTAKE_CLOSED', message: 'Stock opname ini sudah ditutup.' } },
          409
        )
      }
      let adjustments = 0
      for (const line of stocktake.lines) {
        if (line.countedQty === null || line.countedQty === line.expectedQty) continue
        const delta = line.countedQty - line.expectedQty
        applyBalance(line.productId, line.locationId, line.level, delta)
        state.movements.unshift({
          id: `mv-stk-${++state.counter}`,
          productId: line.productId,
          type: 'ADJUSTMENT',
          quantity: delta,
          sourceLocationId: delta < 0 ? line.locationId : null,
          destinationLocationId: delta > 0 ? line.locationId : null,
          reference: `ST-${stocktake.id.slice(-6).toUpperCase()}`,
          note: `Hasil stock opname: hitung ${line.countedQty}, tercatat ${line.expectedQty}`,
          actor: state.session.user.name,
          createdAt: new Date().toISOString(),
        })
        maybeAddLowStockNotification(line.productId)
        adjustments += 1
      }
      stocktake.status = 'COMPLETED'
      stocktake.completedAt = new Date().toISOString()
      return jsonResponse({
        data: {
          stocktake,
          adjustments,
          countedLines: stocktake.lines.filter((line) => line.countedQty !== null).length,
          skippedLines: stocktake.lines.filter((line) => line.countedQty === null).length,
        },
      })
    }
    if (parts[1] === 'cancel' && method === 'POST') {
      stocktake.status = 'CANCELLED'
      stocktake.completedAt = new Date().toISOString()
      return jsonResponse({ data: stocktake })
    }
  }

  // ---- restock report ----
  if (route === '/api/reports/restock') {
    if (!state.session)
      return jsonResponse(
        { error: { code: 'UNAUTHORIZED', message: 'Sesi tidak ditemukan.' } },
        401
      )
    const quantities = quantityByProduct(state.balances)
    const items = state.products
      .filter(
        (product) => product.active && (quantities.get(product.id) ?? 0) < product.reorderThreshold
      )
      .map((product) => {
        const shortfall = Math.max(0, product.reorderThreshold - (quantities.get(product.id) ?? 0))
        return {
          id: product.id,
          sku: product.sku,
          name: product.name,
          unit: product.unit,
          quantity: quantities.get(product.id) ?? 0,
          reorderThreshold: product.reorderThreshold,
          shortfall,
          estimatedCost: shortfall * product.costPrice,
          supplier: state.suppliers.find((supplier) => supplier.id === product.supplierId) ?? null,
        }
      })
      .sort((a, b) => b.estimatedCost - a.estimatedCost)
    return jsonResponse({
      data: items,
      totalEstimatedCost: items.reduce((sum, item) => sum + item.estimatedCost, 0),
    })
  }

  if (route === '/api/reports/export.csv') {
    const report = query.get('report') ?? 'movements'
    if (report === 'restock') {
      const quantities = quantityByProduct(state.balances)
      const rows: string[][] = [
        ['sku', 'produk', 'unit', 'stok', 'ambang', 'usulan_beli', 'estimasi_biaya', 'supplier'],
        ...state.products
          .filter(
            (product) =>
              product.active && (quantities.get(product.id) ?? 0) < product.reorderThreshold
          )
          .map((product) => {
            const shortfall = product.reorderThreshold - (quantities.get(product.id) ?? 0)
            const supplier = state.suppliers.find((item) => item.id === product.supplierId)
            return [
              product.sku,
              product.name,
              product.unit,
              String(quantities.get(product.id) ?? 0),
              String(product.reorderThreshold),
              String(shortfall),
              String(shortfall * product.costPrice),
              supplier?.name ?? '',
            ]
          }),
      ]
      const csv = rows
        .map((row) =>
          row
            .map((cell) => (/[",\n;]/.test(cell) ? `"${cell.replace(/"/g, '""')}"` : cell))
            .join(',')
        )
        .join('\r\n')
      return new Response(csv, {
        status: 200,
        headers: { 'content-type': 'text/csv; charset=utf-8' },
      })
    }
    const rows: string[][] =
      report === 'low-stock'
        ? [
            ['sku', 'produk', 'kategori', 'stok', 'ambang', 'kekurangan'],
            ...state.products
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
              const product = state.products.find((item) => item.id === movement.productId)
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
