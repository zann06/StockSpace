import type { FastifyInstance } from 'fastify'
import { z } from 'zod'

import { AppError, ERRORS } from '../lib/errors.js'
import { prisma } from '../lib/prisma.js'
import { requireRole } from '../lib/session.js'
import { parseWith } from '../lib/validate.js'

const listQuerySchema = z.object({
  search: z.string().trim().max(120).optional(),
  categoryId: z.string().uuid().optional(),
  active: z.enum(['true', 'false']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(20),
})

const createProductSchema = z.object({
  sku: z.string().trim().min(1).max(64),
  name: z.string().trim().min(1).max(200),
  categoryId: z.string().uuid().nullish(),
  supplierId: z.string().uuid().nullish(),
  unit: z.string().trim().min(1).max(24).default('pcs'),
  barcode: z.string().trim().max(64).nullish(),
  costPrice: z.number().min(0).max(9_999_999_999_999).default(0),
  reorderThreshold: z.number().int().min(0).default(0),
  description: z.string().trim().max(2000).nullish(),
  active: z.boolean().default(true),
})

const updateProductSchema = createProductSchema
  .partial()
  .omit({ sku: true })
  .refine((data) => Object.keys(data).length > 0, { message: 'Minimal satu field untuk diubah.' })

function serializeMoney(value: { toNumber(): number } | number): number {
  return typeof value === 'number' ? value : value.toNumber()
}

export async function productRoutes(app: FastifyInstance) {
  const adminOnly = { preHandler: requireRole('ADMIN') }
  app.get('/api/products', async (request) => {
    const query = parseWith(listQuerySchema, request.query)

    const where = {
      workspaceId: request.workspace.id,
      ...(query.active ? { active: query.active === 'true' } : {}),
      ...(query.categoryId ? { categoryId: query.categoryId } : {}),
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: 'insensitive' as const } },
              { sku: { contains: query.search, mode: 'insensitive' as const } },
              { barcode: { contains: query.search } },
            ],
          }
        : {}),
    }

    const [items, total, balanceGroups] = await Promise.all([
      prisma.product.findMany({
        where,
        include: { category: { select: { id: true, name: true } } },
        orderBy: { name: 'asc' },
        skip: (query.page - 1) * query.perPage,
        take: query.perPage,
      }),
      prisma.product.count({ where }),
      prisma.inventoryBalance.groupBy({
        by: ['productId'],
        where: { product: { workspaceId: request.workspace.id } },
        _sum: { quantity: true },
      }),
    ])

    const totals = new Map(
      balanceGroups.map((group) => [group.productId, group._sum.quantity ?? 0])
    )

    return {
      data: items.map((product) => ({
        id: product.id,
        sku: product.sku,
        name: product.name,
        category: product.category,
        unit: product.unit,
        barcode: product.barcode,
        costPrice: serializeMoney(product.costPrice),
        reorderThreshold: product.reorderThreshold,
        description: product.description,
        active: product.active,
        totalQuantity: totals.get(product.id) ?? 0,
        createdAt: product.createdAt,
        updatedAt: product.updatedAt,
      })),
      pagination: { page: query.page, perPage: query.perPage, total },
    }
  })

  app.post('/api/products', { preHandler: requireRole('ADMIN') }, async (request) => {
    const body = parseWith(createProductSchema, request.body)

    if (body.categoryId) {
      const category = await prisma.category.findFirst({
        where: { id: body.categoryId, workspaceId: request.workspace.id },
        select: { id: true },
      })
      if (!category)
        throw AppError.notFound(
          ERRORS.PRODUCT_NOT_FOUND,
          'Kategori tidak ditemukan di workspace ini.'
        )
    }

    const duplicate = await prisma.product.findFirst({
      where: { workspaceId: request.workspace.id, sku: body.sku },
      select: { id: true },
    })
    if (duplicate) {
      throw AppError.conflict(
        ERRORS.SKU_TAKEN,
        `SKU "${body.sku}" sudah dipakai produk lain di workspace ini.`
      )
    }

    const product = await prisma.product.create({
      data: {
        workspaceId: request.workspace.id,
        sku: body.sku,
        name: body.name,
        categoryId: body.categoryId ?? null,
        supplierId: body.supplierId ?? null,
        unit: body.unit,
        barcode: body.barcode ?? null,
        costPrice: body.costPrice,
        reorderThreshold: body.reorderThreshold,
        description: body.description ?? null,
        active: body.active,
      },
      include: { category: { select: { id: true, name: true } } },
    })

    request.log.info({ productId: product.id }, 'product created')
    return { data: { ...product, costPrice: serializeMoney(product.costPrice) } }
  })

  app.get('/api/products/:id', async (request) => {
    const { id } = parseWith(z.object({ id: z.string().uuid() }), request.params)

    const product = await prisma.product.findFirst({
      where: { id, workspaceId: request.workspace.id },
      include: {
        category: { select: { id: true, name: true } },
        supplier: {
          select: { id: true, name: true, contactName: true, email: true, phone: true },
        },
      },
    })
    if (!product) throw AppError.notFound(ERRORS.PRODUCT_NOT_FOUND, 'Produk tidak ditemukan.')

    const [balances, movements] = await Promise.all([
      prisma.inventoryBalance.findMany({
        where: { productId: id },
        include: {
          location: {
            select: { id: true, code: true, label: true, zone: { select: { name: true } } },
          },
        },
        orderBy: [{ locationId: 'asc' }, { level: 'asc' }],
      }),
      prisma.stockMovement.findMany({
        where: { productId: id },
        include: {
          actor: { select: { id: true, name: true } },
          sourceLocation: { select: { code: true } },
          destinationLocation: { select: { code: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
    ])

    return {
      data: { ...product, costPrice: serializeMoney(product.costPrice), balances, movements },
    }
  })

  /**
   * Bulk import (ADMIN+): upsert by SKU — existing SKUs are updated, new ones
   * created. Per-row validation; bad rows are reported, good rows commit.
   */
  app.post('/api/products/import', adminOnly, async (request) => {
    const body = parseWith(
      z
        .object({
          rows: z
            .array(
              z.object({
                sku: z.string().trim().min(1).max(64),
                name: z.string().trim().min(1).max(200),
                category: z.string().trim().max(120).nullish(),
                unit: z.string().trim().max(24).nullish(),
                barcode: z.string().trim().max(64).nullish(),
                costPrice: z.number().min(0).max(9_999_999_999_999).nullish(),
                reorderThreshold: z.number().int().min(0).nullish(),
                description: z.string().trim().max(2000).nullish(),
              })
            )
            .min(1)
            .max(1000),
        })
        .strict(),
      request.body
    )

    const categories = await prisma.category.findMany({
      where: { workspaceId: request.workspace.id },
      select: { id: true, name: true },
    })
    const categoryByName = new Map(categories.map((c) => [c.name.toLowerCase(), c.id]))

    const created: string[] = []
    const updated: string[] = []
    const errors: { row: number; message: string }[] = []

    for (const [index, row] of body.rows.entries()) {
      try {
        if (row.category && !categoryByName.has(row.category.toLowerCase())) {
          throw new Error(`Kategori "${row.category}" belum ada — buat dulu di Pengaturan.`)
        }
        const categoryId = row.category
          ? (categoryByName.get(row.category.toLowerCase()) ?? null)
          : null
        const existing = await prisma.product.findFirst({
          where: { workspaceId: request.workspace.id, sku: row.sku },
          select: { id: true },
        })
        if (existing) {
          await prisma.product.update({
            where: { id: existing.id },
            data: {
              name: row.name,
              categoryId,
              unit: row.unit ?? undefined,
              barcode: row.barcode ?? null,
              costPrice: row.costPrice ?? undefined,
              reorderThreshold: row.reorderThreshold ?? undefined,
              description: row.description ?? null,
            },
          })
          updated.push(row.sku)
        } else {
          await prisma.product.create({
            data: {
              workspaceId: request.workspace.id,
              sku: row.sku,
              name: row.name,
              categoryId,
              unit: row.unit ?? 'pcs',
              barcode: row.barcode ?? null,
              costPrice: row.costPrice ?? 0,
              reorderThreshold: row.reorderThreshold ?? 0,
              description: row.description ?? null,
            },
          })
          created.push(row.sku)
        }
      } catch (error) {
        errors.push({
          row: index + 1,
          message: error instanceof Error ? error.message : String(error),
        })
      }
    }

    request.log.info(
      { created: created.length, updated: updated.length, failed: errors.length },
      'products imported'
    )
    return { data: { created, updated, errors } }
  })

  app.patch('/api/products/:id', { preHandler: requireRole('ADMIN') }, async (request) => {
    const { id } = parseWith(z.object({ id: z.string().uuid() }), request.params)
    const body = parseWith(updateProductSchema, request.body)

    const existing = await prisma.product.findFirst({
      where: { id, workspaceId: request.workspace.id },
      select: { id: true },
    })
    if (!existing) throw AppError.notFound(ERRORS.PRODUCT_NOT_FOUND, 'Produk tidak ditemukan.')

    if (body.categoryId) {
      const category = await prisma.category.findFirst({
        where: { id: body.categoryId, workspaceId: request.workspace.id },
        select: { id: true },
      })
      if (!category)
        throw AppError.notFound(
          ERRORS.PRODUCT_NOT_FOUND,
          'Kategori tidak ditemukan di workspace ini.'
        )
    }

    const product = await prisma.product.update({
      where: { id },
      data: {
        ...(body.name !== undefined ? { name: body.name } : {}),
        ...(body.categoryId !== undefined ? { categoryId: body.categoryId ?? null } : {}),
        ...(body.supplierId !== undefined ? { supplierId: body.supplierId ?? null } : {}),
        ...(body.unit !== undefined ? { unit: body.unit } : {}),
        ...(body.barcode !== undefined ? { barcode: body.barcode ?? null } : {}),
        ...(body.costPrice !== undefined ? { costPrice: body.costPrice } : {}),
        ...(body.reorderThreshold !== undefined ? { reorderThreshold: body.reorderThreshold } : {}),
        ...(body.description !== undefined ? { description: body.description ?? null } : {}),
        ...(body.active !== undefined ? { active: body.active } : {}),
      },
      include: { category: { select: { id: true, name: true } } },
    })

    request.log.info({ productId: product.id }, 'product updated')
    return { data: { ...product, costPrice: serializeMoney(product.costPrice) } }
  })
}
