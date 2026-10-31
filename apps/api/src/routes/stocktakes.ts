import type { FastifyInstance } from 'fastify'
import { z } from 'zod'

import { AppError, ERRORS } from '../lib/errors.js'
import { prisma } from '../lib/prisma.js'
import { requireRole } from '../lib/session.js'
import { parseWith } from '../lib/validate.js'

/**
 * Guided stocktake (stock opname): creating a stocktake snapshots the current
 * balances of one warehouse into lines; counters fill in `countedQty`; commit
 * turns every differing line into an ADJUSTMENT movement inside one
 * transaction — reusing the existing, tested adjustment machinery.
 */

const createSchema = z
  .object({
    warehouseId: z.string().uuid(),
    note: z.string().trim().max(500).nullish(),
  })
  .strict()

const lineUpdateSchema = z
  .object({
    countedQty: z.number().int().min(0).nullable(),
  })
  .strict()

async function requireStocktake(workspaceId: string, id: string) {
  const stocktake = await prisma.stocktake.findFirst({
    where: { id, workspaceId },
    include: { lines: true },
  })
  if (!stocktake) throw AppError.notFound('STOCKTAKE_NOT_FOUND', 'Stock opname tidak ditemukan.')
  return stocktake
}

export async function stocktakeRoutes(app: FastifyInstance) {
  app.get('/api/stocktakes', async (request) => {
    const stocktakes = await prisma.stocktake.findMany({
      where: { workspaceId: request.workspace.id },
      include: {
        warehouse: { select: { id: true, name: true, code: true } },
        createdBy: { select: { id: true, name: true } },
        _count: { select: { lines: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })
    return { data: stocktakes }
  })

  app.post('/api/stocktakes', { preHandler: requireRole('STAFF') }, async (request) => {
    const body = parseWith(createSchema, request.body)

    const warehouse = await prisma.warehouse.findFirst({
      where: { id: body.warehouseId, workspaceId: request.workspace.id },
      select: { id: true },
    })
    if (!warehouse) throw AppError.notFound(ERRORS.WAREHOUSE_NOT_FOUND, 'Gudang tidak ditemukan.')

    const existingOpen = await prisma.stocktake.findFirst({
      where: { workspaceId: request.workspace.id, warehouseId: body.warehouseId, status: 'OPEN' },
      select: { id: true },
    })
    if (existingOpen) {
      throw AppError.conflict(
        'STOCKTAKE_OPEN',
        'Masih ada stock opname berstatus terbuka untuk gudang ini — selesaikan atau batalkan dulu.'
      )
    }

    const balances = await prisma.inventoryBalance.findMany({
      where: { location: { warehouseId: body.warehouseId } },
      select: { productId: true, locationId: true, level: true, quantity: true },
    })
    if (balances.length === 0) {
      throw AppError.badRequest('STOCKTAKE_EMPTY', 'Gudang ini belum memiliki stok untuk dihitung.')
    }

    const stocktake = await prisma.stocktake.create({
      data: {
        workspaceId: request.workspace.id,
        warehouseId: body.warehouseId,
        note: body.note ?? null,
        createdById: request.user.id,
        lines: {
          create: balances.map((balance) => ({
            productId: balance.productId,
            locationId: balance.locationId,
            level: balance.level,
            expectedQty: balance.quantity,
          })),
        },
      },
      include: { _count: { select: { lines: true } } },
    })
    request.log.info({ stocktakeId: stocktake.id, lines: balances.length }, 'stocktake created')
    return { data: stocktake }
  })

  app.get('/api/stocktakes/:id', async (request) => {
    const { id } = parseWith(z.object({ id: z.string().uuid() }), request.params)
    const stocktake = await requireStocktake(request.workspace.id, id)

    const lines = await prisma.stocktakeLine.findMany({
      where: { stocktakeId: id },
      include: {
        product: { select: { id: true, sku: true, name: true, unit: true } },
        location: { select: { id: true, code: true, label: true } },
      },
      orderBy: [{ locationId: 'asc' }, { level: 'asc' }],
    })
    return { data: { ...stocktake, lines } }
  })

  app.patch(
    '/api/stocktakes/:id/lines/:lineId',
    { preHandler: requireRole('STAFF') },
    async (request) => {
      const params = parseWith(
        z.object({ id: z.string().uuid(), lineId: z.string().uuid() }),
        request.params
      )
      const body = parseWith(lineUpdateSchema, request.body)
      const stocktake = await requireStocktake(request.workspace.id, params.id)
      if (stocktake.status !== 'OPEN') {
        throw AppError.conflict(
          'STOCKTAKE_CLOSED',
          'Stock opname ini sudah ditutup — jumlah tidak bisa diubah.'
        )
      }

      const line = stocktake.lines.find((line) => line.id === params.lineId)
      if (!line)
        throw AppError.notFound('STOCKTAKE_LINE_NOT_FOUND', 'Baris hitung tidak ditemukan.')

      const updated = await prisma.stocktakeLine.update({
        where: { id: line.id },
        data: { countedQty: body.countedQty },
      })
      return { data: updated }
    }
  )

  /** Commit: every differing counted line becomes an ADJUSTMENT movement. */
  app.post('/api/stocktakes/:id/commit', { preHandler: requireRole('STAFF') }, async (request) => {
    const { id } = parseWith(z.object({ id: z.string().uuid() }), request.params)
    const stocktake = await requireStocktake(request.workspace.id, id)
    if (stocktake.status !== 'OPEN') {
      throw AppError.conflict('STOCKTAKE_CLOSED', 'Stock opname ini sudah ditutup.')
    }

    const counted = stocktake.lines.filter((line) => line.countedQty !== null)
    const diffs = counted.filter((line) => line.countedQty !== line.expectedQty)

    const result = await prisma.$transaction(async (tx) => {
      const movements = []
      for (const line of diffs) {
        const delta = line.countedQty! - line.expectedQty
        const input = {
          productId: line.productId,
          quantity: delta,
          sourceLocationId: delta < 0 ? line.locationId : null,
          destinationLocationId: delta > 0 ? line.locationId : null,
          sourceLevel: delta < 0 ? line.level : null,
          destinationLevel: delta > 0 ? line.level : null,
          reference: `ST-${stocktake.id.slice(0, 8).toUpperCase()}`,
          note: `Hasil stock opname: hitung ${line.countedQty}, tercatat ${line.expectedQty}`,
          actorId: request.user.id,
        }
        // Reuse the guarded adjustment logic: negative deltas are conditional
        // decrements (cannot go below zero — a concurrently moved balance is
        // re-synced by the adjustment failing loudly).
        const movement =
          delta > 0
            ? await (async () => {
                await tx.inventoryBalance.updateMany({
                  where: {
                    productId: line.productId,
                    locationId: line.locationId,
                    level: line.level,
                  },
                  data: { quantity: { increment: delta } },
                })
                return tx.stockMovement.create({
                  data: {
                    workspaceId: request.workspace.id,
                    productId: line.productId,
                    type: 'ADJUSTMENT',
                    quantity: delta,
                    destinationLocationId: line.locationId,
                    destinationLevel: line.level,
                    reference: input.reference,
                    note: input.note,
                    actorId: request.user.id,
                  },
                })
              })()
            : await (async () => {
                const decremented = await tx.inventoryBalance.updateMany({
                  where: {
                    productId: line.productId,
                    locationId: line.locationId,
                    level: line.level,
                    quantity: { gte: -delta },
                  },
                  data: { quantity: { decrement: -delta } },
                })
                if (decremented.count === 0) {
                  throw AppError.conflict(
                    'STOCKTAKE_STALE',
                    `Saldo untuk salah satu produk berubah sejak snapshot — commit dibatalkan, buka ulang stock opname.`
                  )
                }
                return tx.stockMovement.create({
                  data: {
                    workspaceId: request.workspace.id,
                    productId: line.productId,
                    type: 'ADJUSTMENT',
                    quantity: delta,
                    sourceLocationId: line.locationId,
                    sourceLevel: line.level,
                    reference: input.reference,
                    note: input.note,
                    actorId: request.user.id,
                  },
                })
              })()
        movements.push(movement)
      }

      return prisma.stocktake.update({
        where: { id: stocktake.id },
        data: { status: 'COMPLETED', completedAt: new Date() },
        include: { _count: { select: { lines: true } } },
      })
    })

    request.log.info(
      { stocktakeId: stocktake.id, adjustments: diffs.length, counted: counted.length },
      'stocktake committed'
    )
    return {
      data: {
        stocktake: result,
        adjustments: diffs.length,
        countedLines: counted.length,
        skippedLines: stocktake.lines.length - counted.length,
      },
    }
  })

  app.post('/api/stocktakes/:id/cancel', { preHandler: requireRole('STAFF') }, async (request) => {
    const { id } = parseWith(z.object({ id: z.string().uuid() }), request.params)
    const stocktake = await requireStocktake(request.workspace.id, id)
    if (stocktake.status !== 'OPEN') {
      throw AppError.conflict('STOCKTAKE_CLOSED', 'Stock opname ini sudah ditutup.')
    }
    const cancelled = await prisma.stocktake.update({
      where: { id: stocktake.id },
      data: { status: 'CANCELLED', completedAt: new Date() },
    })
    return { data: cancelled }
  })
}
