import type { FastifyInstance, FastifyReply } from 'fastify'
import { z } from 'zod'

import { prisma } from '../lib/prisma.js'
import { parseWith } from '../lib/validate.js'

const movementFilterSchema = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  productId: z.string().uuid().optional(),
  type: z.enum(['IN', 'OUT', 'TRANSFER', 'ADJUSTMENT']).optional(),
  actorId: z.string().uuid().optional(),
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(50),
})

function movementWhere(
  request: import('fastify').FastifyRequest,
  parsed: z.output<typeof movementFilterSchema>
) {
  return {
    workspaceId: request.workspace.id,
    ...(parsed.from || parsed.to
      ? {
          createdAt: {
            ...(parsed.from ? { gte: parsed.from } : {}),
            ...(parsed.to ? { lte: parsed.to } : {}),
          },
        }
      : {}),
    ...(parsed.productId ? { productId: parsed.productId } : {}),
    ...(parsed.type ? { type: parsed.type } : {}),
    ...(parsed.actorId ? { actorId: parsed.actorId } : {}),
  }
}

/** Minimal RFC-4180 CSV escaping. */
function csvCell(value: string | number | null | undefined): string {
  const text = value === null || value === undefined ? '' : String(value)
  return /[",\n;]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

function csvResponse(reply: FastifyReply, filename: string, rows: (string | number | null)[][]) {
  const csv = rows.map((row) => row.map(csvCell).join(',')).join('\r\n')
  reply
    .header('content-type', 'text/csv; charset=utf-8')
    .header('content-disposition', `attachment; filename="${filename}"`)
  return csv
}

export async function reportRoutes(app: FastifyInstance) {
  /** Full low-stock report (not truncated like the dashboard summary). */
  app.get('/api/reports/low-stock', async (request) => {
    const balanceGroups = await prisma.inventoryBalance.groupBy({
      by: ['productId'],
      where: { product: { workspaceId: request.workspace.id } },
      _sum: { quantity: true },
    })
    const totals = new Map(
      balanceGroups.map((group) => [group.productId, group._sum.quantity ?? 0])
    )

    const products = await prisma.product.findMany({
      where: { workspaceId: request.workspace.id, active: true },
      select: {
        id: true,
        sku: true,
        name: true,
        reorderThreshold: true,
        costPrice: true,
        category: { select: { name: true } },
      },
      orderBy: { name: 'asc' },
    })

    const items = products
      .map((product) => ({
        id: product.id,
        sku: product.sku,
        name: product.name,
        category: product.category?.name ?? null,
        quantity: totals.get(product.id) ?? 0,
        reorderThreshold: product.reorderThreshold,
        shortfall: Math.max(0, product.reorderThreshold - (totals.get(product.id) ?? 0)),
        stockValue: (totals.get(product.id) ?? 0) * Number(product.costPrice),
      }))
      .filter((item) => item.quantity < item.reorderThreshold)
      .sort((a, b) => a.quantity / a.reorderThreshold - b.quantity / b.reorderThreshold)

    return { data: items }
  })

  /** Movement report with date/product/type/actor filters. */
  app.get('/api/reports/movements', async (request) => {
    const parsed = parseWith(movementFilterSchema, request.query)
    const where = movementWhere(request, parsed)

    const [items, total] = await Promise.all([
      prisma.stockMovement.findMany({
        where,
        include: {
          product: { select: { name: true, sku: true } },
          actor: { select: { name: true } },
          sourceLocation: { select: { code: true } },
          destinationLocation: { select: { code: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (parsed.page - 1) * parsed.perPage,
        take: parsed.perPage,
      }),
      prisma.stockMovement.count({ where }),
    ])

    return { data: items, pagination: { page: parsed.page, perPage: parsed.perPage, total } }
  })

  /** CSV export: ?report=low-stock|movements (+ the same filters). */
  /** Restock proposal: aggregate shortfall of active products under threshold. */
  app.get('/api/reports/restock', async (request) => {
    const [balanceGroups, products] = await Promise.all([
      prisma.inventoryBalance.groupBy({
        by: ['productId'],
        where: { product: { workspaceId: request.workspace.id } },
        _sum: { quantity: true },
      }),
      prisma.product.findMany({
        where: { workspaceId: request.workspace.id, active: true },
        select: {
          id: true,
          sku: true,
          name: true,
          unit: true,
          reorderThreshold: true,
          costPrice: true,
          supplier: {
            select: { id: true, name: true, contactName: true, email: true, phone: true },
          },
        },
        orderBy: { name: 'asc' },
      }),
    ])
    const totals = new Map(
      balanceGroups.map((group) => [group.productId, group._sum.quantity ?? 0])
    )

    const items = products
      .map((product) => ({
        id: product.id,
        sku: product.sku,
        name: product.name,
        unit: product.unit,
        quantity: totals.get(product.id) ?? 0,
        reorderThreshold: product.reorderThreshold,
        shortfall: Math.max(0, product.reorderThreshold - (totals.get(product.id) ?? 0)),
        estimatedCost:
          Math.max(0, product.reorderThreshold - (totals.get(product.id) ?? 0)) *
          Number(product.costPrice),
        supplier: product.supplier,
      }))
      .filter((item) => item.shortfall > 0)
      .sort((a, b) => b.estimatedCost - a.estimatedCost)

    return {
      data: items,
      totalEstimatedCost: items.reduce((sum, item) => sum + item.estimatedCost, 0),
    }
  })

  app.get('/api/reports/export.csv', async (request, reply) => {
    const report = (request.query as { report?: string }).report ?? 'movements'

    if (report === 'restock') {
      const balanceGroups = await prisma.inventoryBalance.groupBy({
        by: ['productId'],
        where: { product: { workspaceId: request.workspace.id } },
        _sum: { quantity: true },
      })
      const totals = new Map(
        balanceGroups.map((group) => [group.productId, group._sum.quantity ?? 0])
      )
      const products = await prisma.product.findMany({
        where: { workspaceId: request.workspace.id, active: true },
        select: {
          id: true,
          sku: true,
          name: true,
          unit: true,
          reorderThreshold: true,
          costPrice: true,
          supplier: { select: { name: true } },
        },
        orderBy: { name: 'asc' },
      })
      const rows: (string | number | null)[][] = [
        ['sku', 'produk', 'unit', 'stok', 'ambang', 'usulan_beli', 'estimasi_biaya', 'supplier'],
        ...products
          .map((product) => {
            const shortfall = Math.max(0, product.reorderThreshold - (totals.get(product.id) ?? 0))
            return [
              product.sku,
              product.name,
              product.unit,
              totals.get(product.id) ?? 0,
              product.reorderThreshold,
              shortfall,
              shortfall * Number(product.costPrice),
              product.supplier?.name ?? '',
            ]
          })
          .filter((row) => Number(row[5]) > 0),
      ]
      return csvResponse(
        reply,
        `stockspace-restock-${new Date().toISOString().slice(0, 10)}.csv`,
        rows
      )
    }

    if (report === 'low-stock') {
      // Reuse the JSON endpoint's computation by calling the same logic inline.
      const balanceGroups = await prisma.inventoryBalance.groupBy({
        by: ['productId'],
        where: { product: { workspaceId: request.workspace.id } },
        _sum: { quantity: true },
      })
      const totals = new Map(
        balanceGroups.map((group) => [group.productId, group._sum.quantity ?? 0])
      )
      const products = await prisma.product.findMany({
        where: { workspaceId: request.workspace.id, active: true },
        select: {
          id: true,
          sku: true,
          name: true,
          reorderThreshold: true,
          category: { select: { name: true } },
        },
        orderBy: { name: 'asc' },
      })
      const rows: (string | number | null)[][] = [
        ['sku', 'produk', 'kategori', 'stok', 'ambang', 'kekurangan'],
        ...products
          .filter((product) => (totals.get(product.id) ?? 0) < product.reorderThreshold)
          .map((product) => [
            product.sku,
            product.name,
            product.category?.name ?? '',
            totals.get(product.id) ?? 0,
            product.reorderThreshold,
            Math.max(0, product.reorderThreshold - (totals.get(product.id) ?? 0)),
          ]),
      ]
      return csvResponse(
        reply,
        `stockspace-low-stock-${new Date().toISOString().slice(0, 10)}.csv`,
        rows
      )
    }

    const parsed = parseWith(movementFilterSchema, request.query)
    const where = movementWhere(request, parsed)
    const items = await prisma.stockMovement.findMany({
      where,
      include: {
        product: { select: { name: true, sku: true } },
        actor: { select: { name: true } },
        sourceLocation: { select: { code: true } },
        destinationLocation: { select: { code: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 5000,
    })
    const rows: (string | number | null)[][] = [
      ['waktu', 'sku', 'produk', 'jenis', 'jumlah', 'dari', 'ke', 'referensi', 'aktor'],
      ...items.map((item) => [
        item.createdAt.toISOString(),
        item.product.sku,
        item.product.name,
        item.type,
        item.quantity,
        item.sourceLocation?.code ?? '',
        item.destinationLocation?.code ?? '',
        item.reference ?? '',
        item.actor.name,
      ]),
    ]
    return csvResponse(
      reply,
      `stockspace-movements-${new Date().toISOString().slice(0, 10)}.csv`,
      rows
    )
  })
}
