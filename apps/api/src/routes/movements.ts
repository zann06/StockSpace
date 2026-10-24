import type { FastifyInstance, FastifyRequest } from 'fastify'
import { z } from 'zod'

import { AppError, ERRORS } from '../lib/errors.js'
import { prisma } from '../lib/prisma.js'
import { parseWith } from '../lib/validate.js'
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
    // Optional until authentication lands (Phase 4): when omitted, the first
    // owner/admin of the workspace is recorded as the actor.
    actorId: z.string().uuid().nullish(),
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

/**
 * Resolve the owning warehouse of the movement's location (source preferred,
 * else destination), verifying the warehouse belongs to the caller's workspace.
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

/** Default actor (first workspace owner, else any member) for the pre-auth phase. */
async function resolveActorId(
  tx: Tx,
  workspaceId: string,
  actorId?: string | null
): Promise<string> {
  if (actorId) return actorId
  const member = await tx.workspaceMember.findFirst({
    where: { workspaceId, role: { in: ['OWNER', 'ADMIN', 'STAFF'] } },
    orderBy: { role: 'asc' },
    select: { userId: true },
  })
  if (!member) {
    throw AppError.badRequest(
      'ACTOR_REQUIRED',
      'Workspace tidak memiliki anggota yang bisa dicatat sebagai aktor.'
    )
  }
  return member.userId
}

type MovementOperation = (
  tx: Tx,
  workspaceId: string,
  warehouseId: string,
  input: MovementInput
) => ReturnType<typeof movementService.stockIn>

/** Shared pipeline: validate → transaction (warehouse + actor + service call). */
async function applyMovement(
  request: FastifyRequest,
  kind: 'IN' | 'OUT' | 'TRANSFER' | 'ADJUSTMENT',
  operation: MovementOperation
) {
  const body = parseWith(movementBodySchema, request.body)
  const data = await prisma.$transaction(async (tx) => {
    const workspaceId = request.workspace.id
    const warehouseId = await resolveWarehouseId(tx, workspaceId, body)
    const actorId = await resolveActorId(tx, workspaceId, body.actorId)
    const input: MovementInput = {
      productId: body.productId,
      quantity: body.quantity,
      sourceLocationId: body.sourceLocationId ?? null,
      destinationLocationId: body.destinationLocationId ?? null,
      sourceLevel: body.sourceLevel ?? null,
      destinationLevel: body.destinationLevel ?? null,
      reference: body.reference ?? null,
      note: body.note ?? null,
      actorId,
    }
    return operation(tx, workspaceId, warehouseId, input)
  })
  request.log.info({ movementId: data.id, type: kind }, 'stock movement committed')
  return { data }
}

export async function movementRoutes(app: FastifyInstance) {
  app.post('/api/stock-movements/stock-in', (request) =>
    applyMovement(request, 'IN', (tx, workspaceId, warehouseId, input) =>
      movementService.stockIn(tx, workspaceId, warehouseId, input)
    )
  )

  app.post('/api/stock-movements/stock-out', (request) =>
    applyMovement(request, 'OUT', (tx, workspaceId, warehouseId, input) =>
      movementService.stockOut(tx, workspaceId, warehouseId, input)
    )
  )

  app.post('/api/stock-movements/transfer', (request) =>
    applyMovement(request, 'TRANSFER', (tx, workspaceId, warehouseId, input) =>
      movementService.transfer(tx, workspaceId, warehouseId, input)
    )
  )

  app.post('/api/stock-movements/adjustment', (request) =>
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
