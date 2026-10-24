import type { FastifyInstance } from 'fastify'
import { z } from 'zod'

import { AppError, ERRORS } from '../lib/errors.js'
import { prisma } from '../lib/prisma.js'
import { parseWith } from '../lib/validate.js'

export async function warehouseRoutes(app: FastifyInstance) {
  app.get('/api/warehouses', async (request) => {
    const warehouses = await prisma.warehouse.findMany({
      where: { workspaceId: request.workspace.id },
      select: { id: true, name: true, code: true },
      orderBy: { name: 'asc' },
    })
    return { data: warehouses }
  })

  /**
   * Full layout for the 3D scene: zones, locations with persisted coordinates,
   * current balances, and the product summary needed to compute occupancy
   * status — one request renders the whole warehouse.
   */
  app.get('/api/warehouses/:id/layout', async (request) => {
    const { id } = parseWith(z.object({ id: z.string().uuid() }), request.params)

    const warehouse = await prisma.warehouse.findFirst({
      where: { id, workspaceId: request.workspace.id },
      select: { id: true, name: true, code: true },
    })
    if (!warehouse) throw AppError.notFound(ERRORS.WAREHOUSE_NOT_FOUND, 'Gudang tidak ditemukan.')

    const [zones, locations, balances, products] = await Promise.all([
      prisma.zone.findMany({
        where: { warehouseId: id },
        select: { id: true, name: true, code: true },
        orderBy: { code: 'asc' },
      }),
      prisma.storageLocation.findMany({
        where: { warehouseId: id, active: true },
        select: {
          id: true,
          zoneId: true,
          type: true,
          code: true,
          label: true,
          x: true,
          z: true,
          rotation: true,
          capacity: true,
          levels: true,
        },
        orderBy: { code: 'asc' },
      }),
      prisma.inventoryBalance.findMany({
        where: { location: { warehouseId: id } },
        select: { productId: true, locationId: true, level: true, quantity: true },
      }),
      prisma.product.findMany({
        where: { workspaceId: request.workspace.id, active: true },
        select: { id: true, sku: true, name: true, unit: true, reorderThreshold: true },
      }),
    ])

    return { data: { warehouse, zones, locations, balances, products } }
  })
}

export async function locationRoutes(app: FastifyInstance) {
  /** Products and balances stored at a location — feeds the 3D detail panel. */
  app.get('/api/storage-locations/:id/inventory', async (request) => {
    const { id } = parseWith(z.object({ id: z.string().uuid() }), request.params)

    const location = await prisma.storageLocation.findFirst({
      where: { id, warehouse: { workspaceId: request.workspace.id } },
      select: {
        id: true,
        code: true,
        label: true,
        type: true,
        zone: { select: { name: true } },
        capacity: true,
        levels: true,
        warehouse: { select: { id: true, name: true } },
      },
    })
    if (!location) throw AppError.notFound(ERRORS.LOCATION_NOT_FOUND, 'Lokasi tidak ditemukan.')

    const balances = await prisma.inventoryBalance.findMany({
      where: { locationId: id },
      select: {
        id: true,
        level: true,
        quantity: true,
        updatedAt: true,
        product: {
          select: {
            id: true,
            sku: true,
            name: true,
            unit: true,
            reorderThreshold: true,
            active: true,
            category: { select: { name: true } },
          },
        },
      },
      orderBy: [{ level: 'asc' }, { quantity: 'desc' }],
    })

    return {
      data: {
        location,
        balances,
        totalQuantity: balances.reduce((sum, row) => sum + row.quantity, 0),
      },
    }
  })
}

export async function categoryRoutes(app: FastifyInstance) {
  app.get('/api/categories', async (request) => {
    const categories = await prisma.category.findMany({
      where: { workspaceId: request.workspace.id },
      select: { id: true, name: true, _count: { select: { products: true } } },
      orderBy: { name: 'asc' },
    })
    return { data: categories }
  })
}
