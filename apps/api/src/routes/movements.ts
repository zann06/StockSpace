import type { FastifyInstance } from 'fastify'
import { z } from 'zod'

import { AppError, ERRORS } from '../lib/errors.js'
import { prisma } from '../lib/prisma.js'
import { parseWith } from '../lib/validate.js'
import { movementService } from '../services/movements.js'

const movementBodySchema = z
  .object({
    productId: z.string().uuid(),
    quantity: z.number().int(),
    sourceLocationId: z.string().uuid().nullish(),
    destinationLocationId: z.string().uuid().nullish(),
    sourceLevel: z.number().int().min(1).max(10).nullish(),
    destinationLevel: z.number().int().min(1).max(10).nullish(),
    reference: z.string().trim().max(64).nullish(),
    note: z.string().trim().max(1000).nullish(),
    // Replaced by the session user once authentication lands (Phase 4).
    actorId: z.string().uuid(),
  })
  .strict()

const listQuerySchema = z.object({
  type: z.enum(['IN', 'OUT', 'TRANSFER', 'ADJUSTMENT']).optional(),
  productId: z.string().uuid().optional(),
  locationId: z.string().uuid().optional(),
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(20),
})

/**
 * Resolve the owning warehouse of the movement's location (source preferred,
 * else destination), verifying the warehouse belongs to the caller's workspace.
 */
async function resolveWarehouseId(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  workspaceId: string,
  body: { sourceLocationId?: string | null; destinationLocationId?: string | null }
): Promise<string> {
  const locationId = body.sourceLocationId ?? body.destinationLocationId
  if (!locationId) {
    throw AppError.badRequest(ERRORS.LOCATION_NOT_FOUND, 'Lokasi sumber atau tujuan wajib diisi.')
  }
  const location = await tx.storageLocation.findFirst({
    where: { id: locationId, warehouse: { workspaceId } },
    select: { warehouseId: true },
  })
  if (!location) {
    throw AppError.notFound(ERRORS.LOCATION_NOT_FOUND, 'Lokasi tidak ditemukan di workspace ini.')
  }
  return location.warehouseId
}

export async function movementRoutes(app: FastifyInstance) {
  app.post('/api/stock-movements/stock-in', async (request) => {
    const body = parseWith(movementBodySchema, request.body)
    const data = await prisma.$transaction(async (tx) => {
      const warehouseId = await resolveWarehouseId(tx, request.workspace.id, body)
      return movementService.stockIn(tx, request.workspace.id, warehouseId, body)
    })
    request.log.info({ movementId: data.id, type: 'IN' }, 'stock movement committed')
    return { data }
  })

  app.post('/api/stock-movements/stock-out', async (request) => {
    const body = parseWith(movementBodySchema, request.body)
    const data = await prisma.$transaction(async (tx) => {
      const warehouseId = await resolveWarehouseId(tx, request.workspace.id, body)
      return movementService.stockOut(tx, request.workspace.id, warehouseId, body)
    })
    request.log.info({ movementId: data.id, type: 'OUT' }, 'stock movement committed')
    return { data }
  })

  app.post('/api/stock-movements/transfer', async (request) => {
    const body = parseWith(movementBodySchema, request.body)
    const data = await prisma.$transaction(async (tx) => {
      const warehouseId = await resolveWarehouseId(tx, request.workspace.id, body)
      return movementService.transfer(tx, request.workspace.id, warehouseId, body)
    })
    request.log.info({ movementId: data.id, type: 'TRANSFER' }, 'stock movement committed')
    return { data }
  })

  app.post('/api/stock-movements/adjustment', async (request) => {
    const body = parseWith(movementBodySchema, request.body)
    const data = await prisma.$transaction(async (tx) => {
      const warehouseId = await resolveWarehouseId(tx, request.workspace.id, body)
      return movementService.adjustment(tx, request.workspace.id, warehouseId, body)
    })
    request.log.info({ movementId: data.id, type: 'ADJUSTMENT' }, 'stock movement committed')
    return { data }
  })

  app.get('/api/stock-movements', async (request) => {
    const query = parseWith(listQuerySchema, request.query)

    const where = {
      workspaceId: request.workspace.id,
      ...(query.type ? { type: query.type } : {}),
      ...(query.productId ? { productId: query.productId } : {}),
      ...(query.locationId
        ? {
            OR: [
              { sourceLocationId: query.locationId },
              { destinationLocationId: query.locationId },
            ],
          }
        : {}),
    }

    const [items, total] = await Promise.all([
      prisma.stockMovement.findMany({
        where,
        include: {
          product: { select: { id: true, name: true, sku: true, unit: true } },
          actor: { select: { id: true, name: true } },
          sourceLocation: { select: { id: true, code: true, label: true } },
          destinationLocation: { select: { id: true, code: true, label: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.perPage,
        take: query.perPage,
      }),
      prisma.stockMovement.count({ where }),
    ])

    return { data: items, pagination: { page: query.page, perPage: query.perPage, total } }
  })
}
