import type { FastifyInstance, FastifyRequest } from 'fastify'
import { z } from 'zod'

import { AppError, ERRORS } from '../lib/errors.js'
import { prisma } from '../lib/prisma.js'
import { requireRole } from '../lib/session.js'
import { parseWith } from '../lib/validate.js'
import { maybeCreateLowStockNotification } from '../services/notifications.js'
import { movementService, type MovementInput } from '../services/movements.js'

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
    // Stock-in only: optional supplier of the received goods.
    supplierId: z.string().uuid().nullish(),
  })
  .strict()

const listQuerySchema = z.object({
  type: z.enum(['IN', 'OUT', 'TRANSFER', 'ADJUSTMENT']).optional(),
  productId: z.string().uuid().optional(),
  locationId: z.string().uuid().optional(),
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(20),
})

type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0]

/** Validate an optional supplier for stock-ins against the active workspace. */
async function resolveSupplierId(
  tx: Tx,
  workspaceId: string,
  supplierId?: string | null
): Promise<string | null> {
  if (!supplierId) return null
  const supplier = await tx.supplier.findFirst({
    where: { id: supplierId, workspaceId },
    select: { id: true },
  })
  if (!supplier) {
    throw AppError.notFound('SUPPLIER_NOT_FOUND', 'Supplier tidak ditemukan di workspace ini.')
  }
  return supplier.id
}

/**
 * Resolve the owning warehouse of the movement's location (source preferred,
 * else destination), verifying the warehouse belongs to the active workspace.
 */
async function resolveWarehouseId(
  tx: Tx,
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

type MovementOperation = (
  tx: Tx,
  workspaceId: string,
  warehouseId: string,
  input: MovementInput
) => ReturnType<typeof movementService.stockIn>

/**
 * Shared pipeline: validate → transaction (warehouse + session actor + service
 * call) → post-commit low-stock notification check. The actor always comes
 * from the session — the client can never choose it.
 */
async function applyMovement(
  request: FastifyRequest,
  kind: 'IN' | 'OUT' | 'TRANSFER' | 'ADJUSTMENT',
  operation: MovementOperation
) {
  const body = parseWith(movementBodySchema, request.body)
  const data = await prisma.$transaction(async (tx) => {
    const workspaceId = request.workspace.id
    const warehouseId = await resolveWarehouseId(tx, workspaceId, body)
    const input = {
      productId: body.productId,
      quantity: body.quantity,
      sourceLocationId: body.sourceLocationId ?? null,
      destinationLocationId: body.destinationLocationId ?? null,
      sourceLevel: body.sourceLevel ?? null,
      destinationLevel: body.destinationLevel ?? null,
      reference: body.reference ?? null,
      note: body.note ?? null,
      supplierId: kind === 'IN' ? await resolveSupplierId(tx, workspaceId, body.supplierId) : null,
      actorId: request.user.id,
    }
    return operation(tx, workspaceId, warehouseId, input)
  })

  // Best-effort notification (never blocks the committed movement result).
  try {
    await maybeCreateLowStockNotification(request.workspace.id, body.productId)
  } catch (error) {
    request.log.warn({ err: error }, 'low-stock notification check failed')
  }

  request.log.info({ movementId: data.id, type: kind }, 'stock movement committed')
  return { data }
}

export async function movementRoutes(app: FastifyInstance) {
  // Recording stock movements requires at least STAFF (PRD §4).
  const staffOnly = {
    preHandler: requireRole('STAFF'),
    config: { rateLimit: { max: 60, timeWindow: '1 minute' } },
  }

  app.post('/api/stock-movements/stock-in', staffOnly, (request) =>
    applyMovement(request, 'IN', (tx, workspaceId, warehouseId, input) =>
      movementService.stockIn(tx, workspaceId, warehouseId, input)
    )
  )

  app.post('/api/stock-movements/stock-out', staffOnly, (request) =>
    applyMovement(request, 'OUT', (tx, workspaceId, warehouseId, input) =>
      movementService.stockOut(tx, workspaceId, warehouseId, input)
    )
  )

  app.post('/api/stock-movements/transfer', staffOnly, (request) =>
    applyMovement(request, 'TRANSFER', (tx, workspaceId, warehouseId, input) =>
      movementService.transfer(tx, workspaceId, warehouseId, input)
    )
  )

  app.post('/api/stock-movements/adjustment', staffOnly, (request) =>
    applyMovement(request, 'ADJUSTMENT', (tx, workspaceId, warehouseId, input) =>
      movementService.adjustment(tx, workspaceId, warehouseId, input)
    )
  )

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
