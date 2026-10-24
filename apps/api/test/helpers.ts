import type { FastifyInstance } from 'fastify'

import { buildApp } from '../src/app.js'
import { prisma } from '../src/lib/prisma.js'

export interface Fixtures {
  workspaceId: string
  actorId: string
  otherWorkspaceId: string
  warehouseId: string
  rackA: { id: string; code: string }
  rackB: { id: string; code: string }
  product: { id: string; sku: string; name: string }
}

/** Deterministic fixture set: one workspace + a decoy workspace, one warehouse,
 * two 3-level racks, and one product. */
export async function createFixtures(): Promise<Fixtures> {
  const [workspace, otherWorkspace, actor] = await Promise.all([
    prisma.workspace.create({ data: { name: 'WS Uji' } }),
    prisma.workspace.create({ data: { name: 'WS Lain' } }),
    prisma.user.create({
      data: { name: 'Penguji', email: `tester-${crypto.randomUUID()}@test.local` },
    }),
  ])

  const warehouse = await prisma.warehouse.create({
    data: { workspaceId: workspace.id, name: 'Gudang Uji', code: 'GDG-TST' },
  })
  await prisma.workspaceMember.create({
    data: { workspaceId: workspace.id, userId: actor.id, role: 'OWNER' },
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
    actorId: actor.id,
    otherWorkspaceId: otherWorkspace.id,
    warehouseId: warehouse.id,
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

/** Wipe all data between tests (order-independent via CASCADE). */
export async function truncateAll() {
  await prisma.$executeRawUnsafe(`TRUNCATE "Workspace", "User" CASCADE`)
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

/** inject helper preconfigured with JSON + workspace header. */
export function call(
  app: FastifyInstance,
  workspaceId: string,
  method: 'GET' | 'POST' | 'PATCH',
  url: string,
  payload?: unknown
) {
  return app.inject({
    method,
    url,
    headers: { 'content-type': 'application/json', 'x-workspace-id': workspaceId },
    ...(payload !== undefined ? { payload: JSON.stringify(payload) } : {}),
  })
}
