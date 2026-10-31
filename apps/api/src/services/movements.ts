import type { Prisma, PrismaClient } from '@prisma/client'

import { AppError, ERRORS } from '../lib/errors.js'

/**
 * Stock movement application logic. Every function runs inside a Prisma
 * interactive transaction so balance updates and the movement record commit or
 * roll back together (PRD §7.3 / §12, invariant #3).
 *
 * Anti-oversell strategy: decrements are performed with a single conditional
 * UPDATE (`quantity >= n`), which is atomic at the row level — two concurrent
 * stock-outs can never both consume the same units, and the database CHECK
 * `quantity >= 0` is the last line of defense.
 */

type Tx = Prisma.TransactionClient | PrismaClient

export interface MovementInput {
  productId: string
  quantity: number
  sourceLocationId?: string | null
  destinationLocationId?: string | null
  sourceLevel?: number | null
  destinationLevel?: number | null
  reference?: string | null
  note?: string | null
  /** Optional supplier for stock-ins — validated against the workspace. */
  supplierId?: string | null
  actorId: string
}

async function requireProduct(tx: Tx, workspaceId: string, productId: string) {
  const product = await tx.product.findFirst({
    where: { id: productId, workspaceId },
    select: { id: true, name: true },
  })
  if (!product)
    throw AppError.notFound(ERRORS.PRODUCT_NOT_FOUND, 'Produk tidak ditemukan di workspace ini.')
  return product
}

async function requireLocation(tx: Tx, warehouseId: string, locationId: string | null | undefined) {
  if (!locationId) throw AppError.badRequest(ERRORS.LOCATION_NOT_FOUND, 'Lokasi wajib diisi.')
  const location = await tx.storageLocation.findFirst({
    where: { id: locationId, warehouseId, active: true },
    select: { id: true, code: true, warehouseId: true, levels: true },
  })
  if (!location)
    throw AppError.notFound(ERRORS.LOCATION_NOT_FOUND, 'Lokasi penyimpanan tidak ditemukan.')
  return location
}

function assertValidLevel(
  location: { levels: number; code: string },
  level: number | null | undefined
) {
  if (level != null && (level < 1 || level > location.levels)) {
    throw AppError.badRequest(
      'INVALID_LEVEL',
      `Level ${level} di luar rentang lokasi ${location.code} (1–${location.levels}).`
    )
  }
}

async function incrementBalance(
  tx: Tx,
  productId: string,
  locationId: string,
  level: number,
  amount: number
) {
  // Upsert + increment in one atomic statement per branch.
  const existing = await tx.inventoryBalance.findUnique({
    where: { productId_locationId_level: { productId, locationId, level } },
    select: { id: true },
  })
  if (existing) {
    return tx.inventoryBalance.update({
      where: { id: existing.id },
      data: { quantity: { increment: amount } },
    })
  }
  return tx.inventoryBalance.create({ data: { productId, locationId, level, quantity: amount } })
}

/**
 * Conditional decrement. Returns false when the balance row does not exist or
 * holds fewer units than requested — no partial write is possible.
 */
async function decrementBalance(
  tx: Tx,
  productId: string,
  locationId: string,
  level: number,
  amount: number
): Promise<boolean> {
  const updated = await tx.inventoryBalance.updateMany({
    where: { productId, locationId, level, quantity: { gte: amount } },
    data: { quantity: { decrement: amount } },
  })
  return updated.count > 0
}

async function createMovement(
  tx: Tx,
  workspaceId: string,
  type: 'IN' | 'OUT' | 'TRANSFER' | 'ADJUSTMENT',
  input: MovementInput
) {
  return tx.stockMovement.create({
    data: {
      workspaceId,
      productId: input.productId,
      type,
      quantity: input.quantity,
      sourceLocationId: input.sourceLocationId ?? null,
      destinationLocationId: input.destinationLocationId ?? null,
      sourceLevel: input.sourceLevel ?? null,
      destinationLevel: input.destinationLevel ?? null,
      reference: input.reference ?? null,
      note: input.note ?? null,
      supplierId: input.supplierId ?? null,
      actorId: input.actorId,
    },
  })
}

export const movementService = {
  /** Stock in: increase destination balance, record an IN movement. */
  async stockIn(db: Tx, workspaceId: string, warehouseId: string, input: MovementInput) {
    if (input.quantity <= 0)
      throw AppError.badRequest(ERRORS.INVALID_QUANTITY, 'Jumlah harus lebih dari 0.')
    const location = await requireLocation(db, warehouseId, input.destinationLocationId)
    assertValidLevel(location, input.destinationLevel ?? 1)
    await requireProduct(db, workspaceId, input.productId)
    await incrementBalance(
      db,
      input.productId,
      location.id,
      input.destinationLevel ?? 1,
      input.quantity
    )
    return createMovement(db, workspaceId, 'IN', input)
  },

  /** Stock out: conditional decrement, then record an OUT movement. */
  async stockOut(db: Tx, workspaceId: string, warehouseId: string, input: MovementInput) {
    if (input.quantity <= 0)
      throw AppError.badRequest(ERRORS.INVALID_QUANTITY, 'Jumlah harus lebih dari 0.')
    const location = await requireLocation(db, warehouseId, input.sourceLocationId)
    assertValidLevel(location, input.sourceLevel ?? 1)
    await requireProduct(db, workspaceId, input.productId)

    const ok = await decrementBalance(
      db,
      input.productId,
      location.id,
      input.sourceLevel ?? 1,
      input.quantity
    )
    if (!ok) {
      throw AppError.unprocessable(
        ERRORS.INSUFFICIENT_STOCK,
        `Stok tidak cukup di ${location.code} untuk mengeluarkan ${input.quantity} unit.`
      )
    }
    return createMovement(db, workspaceId, 'OUT', input)
  },

  /**
   * Transfer: decrease source and increase destination by the same quantity,
   * recorded as one TRANSFER movement. Total inventory is conserved.
   */
  async transfer(db: Tx, workspaceId: string, warehouseId: string, input: MovementInput) {
    if (input.quantity <= 0)
      throw AppError.badRequest(ERRORS.INVALID_QUANTITY, 'Jumlah harus lebih dari 0.')
    if (
      input.sourceLocationId === input.destinationLocationId &&
      (input.sourceLevel ?? 1) === (input.destinationLevel ?? 1)
    ) {
      throw AppError.badRequest(
        ERRORS.SAME_SOURCE_AND_DESTINATION,
        'Lokasi/level asal dan tujuan tidak boleh sama.'
      )
    }
    const source = await requireLocation(db, warehouseId, input.sourceLocationId)
    const destination = await requireLocation(db, warehouseId, input.destinationLocationId)
    assertValidLevel(source, input.sourceLevel ?? 1)
    assertValidLevel(destination, input.destinationLevel ?? 1)
    await requireProduct(db, workspaceId, input.productId)

    const decremented = await decrementBalance(
      db,
      input.productId,
      source.id,
      input.sourceLevel ?? 1,
      input.quantity
    )
    if (!decremented) {
      throw AppError.unprocessable(
        ERRORS.INSUFFICIENT_STOCK,
        `Stok tidak cukup di ${source.code} untuk memindahkan ${input.quantity} unit.`
      )
    }
    await incrementBalance(
      db,
      input.productId,
      destination.id,
      input.destinationLevel ?? 1,
      input.quantity
    )
    return createMovement(db, workspaceId, 'TRANSFER', input)
  },

  /**
   * Adjustment: signed delta applied to one location. Requires a reason
   * (invariant #4) and never drives the balance below zero.
   */
  async adjustment(db: Tx, workspaceId: string, warehouseId: string, input: MovementInput) {
    if (input.quantity === 0)
      throw AppError.badRequest(ERRORS.INVALID_QUANTITY, 'Penyesuaian tidak boleh 0.')
    if (!input.note || input.note.trim().length === 0) {
      throw AppError.badRequest(ERRORS.REASON_REQUIRED, 'Penyesuaian wajib menyertakan alasan.')
    }
    const location = await requireLocation(
      db,
      warehouseId,
      input.sourceLocationId ?? input.destinationLocationId
    )
    assertValidLevel(location, input.sourceLevel ?? input.destinationLevel ?? 1)
    await requireProduct(db, workspaceId, input.productId)

    const level = input.sourceLevel ?? input.destinationLevel ?? 1
    if (input.quantity > 0) {
      await incrementBalance(db, input.productId, location.id, level, input.quantity)
    } else {
      const decremented = await decrementBalance(
        db,
        input.productId,
        location.id,
        level,
        -input.quantity
      )
      if (!decremented) {
        throw AppError.unprocessable(
          ERRORS.INSUFFICIENT_STOCK,
          `Stok di ${location.code} tidak cukup untuk penyesuaian ${input.quantity}.`
        )
      }
    }
    return createMovement(db, workspaceId, 'ADJUSTMENT', {
      ...input,
      sourceLocationId: location.id,
    })
  },
}
