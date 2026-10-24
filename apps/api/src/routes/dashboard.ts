import type { FastifyInstance } from 'fastify'

import { prisma } from '../lib/prisma.js'

export async function dashboardRoutes(app: FastifyInstance) {
  /** All metrics derive from persisted data (PRD §7.1) — no demo values. */
  app.get('/api/dashboard/summary', async (request) => {
    const workspaceId = request.workspace.id
    const dayStart = new Date()
    dayStart.setHours(0, 0, 0, 0)

    const [balanceGroups, products, movementsToday] = await Promise.all([
      prisma.inventoryBalance.groupBy({
        by: ['productId'],
        where: { product: { workspaceId } },
        _sum: { quantity: true },
      }),
      prisma.product.findMany({
        where: { workspaceId, active: true },
        select: { id: true, costPrice: true, reorderThreshold: true, name: true },
      }),
      prisma.stockMovement.count({ where: { workspaceId, createdAt: { gte: dayStart } } }),
    ])

    const totalsByProduct = new Map(
      balanceGroups.map((group) => [group.productId, group._sum.quantity ?? 0])
    )

    let totalUnits = 0
    let inventoryValue = 0
    for (const group of balanceGroups) {
      totalUnits += group._sum.quantity ?? 0
    }
    for (const product of products) {
      inventoryValue += (totalsByProduct.get(product.id) ?? 0) * Number(product.costPrice)
    }

    const lowStock = products
      .filter((product) => (totalsByProduct.get(product.id) ?? 0) < product.reorderThreshold)
      .sort((a, b) => {
        const qtyA = totalsByProduct.get(a.id) ?? 0
        const qtyB = totalsByProduct.get(b.id) ?? 0
        return qtyA / a.reorderThreshold - qtyB / b.reorderThreshold
      })
      .slice(0, 8)
      .map((product) => ({
        id: product.id,
        name: product.name,
        quantity: totalsByProduct.get(product.id) ?? 0,
        reorderThreshold: product.reorderThreshold,
      }))

    return {
      data: {
        totalUnits,
        inventoryValue,
        lowStockCount: lowStock.length,
        lowStock,
        movementsToday,
      },
    }
  })
}
