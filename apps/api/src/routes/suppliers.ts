import type { FastifyInstance } from 'fastify'
import { z } from 'zod'

import { AppError } from '../lib/errors.js'
import { prisma } from '../lib/prisma.js'
import { requireRole } from '../lib/session.js'
import { parseWith } from '../lib/validate.js'

const supplierBodySchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    contactName: z.string().trim().max(120).nullish(),
    email: z.string().trim().email().max(160).nullish(),
    phone: z.string().trim().max(40).nullish(),
    address: z.string().trim().max(400).nullish(),
    notes: z.string().trim().max(1000).nullish(),
  })
  .strict()

const listQuerySchema = z.object({
  search: z.string().trim().max(120).optional(),
})

export async function supplierRoutes(app: FastifyInstance) {
  const adminOnly = { preHandler: requireRole('ADMIN') }

  app.get('/api/suppliers', async (request) => {
    const query = parseWith(listQuerySchema, request.query)
    const search = query.search?.toLowerCase()

    const suppliers = await prisma.supplier.findMany({
      where: {
        workspaceId: request.workspace.id,
        ...(search
          ? {
              OR: [
                { name: { contains: search, mode: 'insensitive' } },
                { contactName: { contains: search, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      select: {
        id: true,
        name: true,
        contactName: true,
        email: true,
        phone: true,
        address: true,
        notes: true,
        _count: { select: { products: true } },
      },
      orderBy: { name: 'asc' },
    })
    return { data: suppliers }
  })

  app.post('/api/suppliers', adminOnly, async (request) => {
    const body = parseWith(supplierBodySchema, request.body)
    const supplier = await prisma.supplier.create({
      data: { workspaceId: request.workspace.id, ...body },
    })
    request.log.info({ supplierId: supplier.id }, 'supplier created')
    return { data: supplier }
  })

  app.patch('/api/suppliers/:id', adminOnly, async (request) => {
    const { id } = parseWith(z.object({ id: z.string().uuid() }), request.params)
    const body = parseWith(supplierBodySchema.partial(), request.body)

    const existing = await prisma.supplier.findFirst({
      where: { id, workspaceId: request.workspace.id },
      select: { id: true },
    })
    if (!existing) throw AppError.notFound('SUPPLIER_NOT_FOUND', 'Supplier tidak ditemukan.')

    const supplier = await prisma.supplier.update({ where: { id }, data: body })
    request.log.info({ supplierId: supplier.id }, 'supplier updated')
    return { data: supplier }
  })

  app.delete('/api/suppliers/:id', adminOnly, async (request) => {
    const { id } = parseWith(z.object({ id: z.string().uuid() }), request.params)

    const supplier = await prisma.supplier.findFirst({
      where: { id, workspaceId: request.workspace.id },
      select: { id: true, _count: { select: { products: true } } },
    })
    if (!supplier) throw AppError.notFound('SUPPLIER_NOT_FOUND', 'Supplier tidak ditemukan.')
    if (supplier._count.products > 0) {
      throw AppError.conflict(
        'SUPPLIER_IN_USE',
        `Supplier masih dipakai ${supplier._count.products} produk — lepas dulu relasinya sebelum menghapus.`
      )
    }

    await prisma.supplier.delete({ where: { id } })
    return { data: { id } }
  })
}
