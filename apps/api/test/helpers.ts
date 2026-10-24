import type { FastifyInstance } from 'fastify'

import { buildApp } from '../src/app.js'
import { prisma } from '../src/lib/prisma.js'

export interface TestUser {
  id: string
  name: string
  email: string
  role: 'OWNER' | 'ADMIN' | 'STAFF' | 'VIEWER'
  cookie: string
}

export interface Fixtures {
  workspaceId: string
  otherWorkspaceId: string
  warehouseId: string
  owner: TestUser
  staff: TestUser
  viewer: TestUser
  outsider: TestUser
  rackA: { id: string; code: string }
  rackB: { id: string; code: string }
  product: { id: string; sku: string; name: string }
}

export interface TestApp {
  app: FastifyInstance
  close: () => Promise<void>
}

export async function buildTestApp(): Promise<TestApp> {
  const app = buildApp()
  await app.ready()
  return { app, close: () => app.close() }
}

/** HTTP sign-in via the real better-auth handler; returns the session cookie. */
async function signIn(
  app: FastifyInstance,
  email: string,
  password = 'test-password-123'
): Promise<string> {
  const response = await app.inject({
    method: 'POST',
    url: '/api/auth/sign-in/email',
    headers: { 'content-type': 'application/json' },
    payload: JSON.stringify({ email, password }),
  })
  if (response.statusCode !== 200) {
    throw new Error(`sign-in failed for ${email}: ${response.statusCode} ${response.body}`)
  }
  const setCookie = response.headers['set-cookie']
  const cookies = Array.isArray(setCookie) ? setCookie : setCookie ? [setCookie] : []
  const sessionCookie = cookies.find((value) => value.startsWith('better-auth.session_token'))
  if (!sessionCookie) throw new Error(`no session cookie for ${email}`)
  return sessionCookie.split(';')[0] ?? sessionCookie
}

/** Creates a user through better-auth (real credential account), signs them in,
 * and returns their id + session cookie. */
async function createUser(
  app: FastifyInstance,
  workspaceId: string,
  role: TestUser['role'],
  name: string
): Promise<TestUser> {
  const email = `${name.toLowerCase().replace(/\s+/g, '-')}-${crypto.randomUUID().slice(0, 8)}@test.local`
  const response = await app.inject({
    method: 'POST',
    url: '/api/auth/sign-up/email',
    headers: { 'content-type': 'application/json' },
    payload: JSON.stringify({ name, email, password: 'test-password-123' }),
  })
  if (response.statusCode !== 200) {
    throw new Error(`sign-up failed for ${email}: ${response.statusCode} ${response.body}`)
  }
  const { user } = response.json() as { user: { id: string } }
  await prisma.workspaceMember.create({
    data: { workspaceId, userId: user.id, role },
  })
  const cookie = await signIn(app, email)
  return { id: user.id, name, email, role, cookie }
}

export async function createFixtures(app: FastifyInstance): Promise<Fixtures> {
  const [workspace, otherWorkspace] = await Promise.all([
    prisma.workspace.create({ data: { name: 'WS Uji' } }),
    prisma.workspace.create({ data: { name: 'WS Lain' } }),
  ])

  // Users with distinct roles in the main workspace + one outsider.
  const [owner, staff, viewer, outsider] = await Promise.all([
    createUser(app, workspace.id, 'OWNER', 'Pemilik Uji'),
    createUser(app, workspace.id, 'STAFF', 'Staf Uji'),
    createUser(app, workspace.id, 'VIEWER', 'Pelihat Uji'),
    createUser(app, otherWorkspace.id, 'OWNER', 'Orang Luar'),
  ])

  const warehouse = await prisma.warehouse.create({
    data: { workspaceId: workspace.id, name: 'Gudang Uji', code: 'GDG-TST' },
  })
  const zone = await prisma.zone.create({
    data: { warehouseId: warehouse.id, name: 'Zona Uji', code: 'Z1' },
  })
  const [rackA, rackB] = await Promise.all([
    prisma.storageLocation.create({
      data: {
        warehouseId: warehouse.id,
        zoneId: zone.id,
        type: 'RACK',
        code: 'A1',
        label: 'Rak A1',
        x: 0,
        z: 0,
        capacity: 500,
        levels: 3,
      },
    }),
    prisma.storageLocation.create({
      data: {
        warehouseId: warehouse.id,
        zoneId: zone.id,
        type: 'RACK',
        code: 'B1',
        label: 'Rak B1',
        x: 3,
        z: 0,
        capacity: 500,
        levels: 3,
      },
    }),
  ])
  const product = await prisma.product.create({
    data: {
      workspaceId: workspace.id,
      sku: 'SKU-UJI-001',
      name: 'Produk Uji',
      costPrice: 10_000,
      reorderThreshold: 5,
      unit: 'pcs',
    },
  })

  return {
    workspaceId: workspace.id,
    otherWorkspaceId: otherWorkspace.id,
    warehouseId: warehouse.id,
    owner,
    staff,
    viewer,
    outsider,
    rackA: { id: rackA.id, code: rackA.code },
    rackB: { id: rackB.id, code: rackB.code },
    product: { id: product.id, sku: product.sku, name: product.name },
  }
}

export async function seedBalance(
  productId: string,
  locationId: string,
  level: number,
  quantity: number
) {
  return prisma.inventoryBalance.create({ data: { productId, locationId, level, quantity } })
}

export async function getBalanceQuantity(
  productId: string,
  locationId: string,
  level = 1
): Promise<number> {
  const row = await prisma.inventoryBalance.findUnique({
    where: { productId_locationId_level: { productId, locationId, level } },
  })
  return row?.quantity ?? 0
}

export async function movementCount(productId: string): Promise<number> {
  return prisma.stockMovement.count({ where: { productId } })
}

/** Wipe all data between tests (CASCADE covers sessions/accounts). */
export async function truncateAll() {
  await prisma.$executeRawUnsafe(`TRUNCATE "Workspace", "User" CASCADE`)
}

/** inject helper preconfigured with JSON + session cookie + workspace header. */
export function call(
  app: FastifyInstance,
  user: { cookie: string },
  method: 'GET' | 'POST' | 'PATCH',
  url: string,
  payload?: unknown,
  workspaceId?: string
) {
  return app.inject({
    method,
    url,
    headers: {
      'content-type': 'application/json',
      cookie: user.cookie,
      ...(workspaceId ? { 'x-workspace-id': workspaceId } : {}),
    },
    ...(payload !== undefined ? { payload: JSON.stringify(payload) } : {}),
  })
}
