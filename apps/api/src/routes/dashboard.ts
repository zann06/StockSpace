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

    // Most-moved products + daily in/out series for the dashboard bottom row.
    const seriesStart = new Date()
    seriesStart.setDate(seriesStart.getDate() - 6)
    seriesStart.setHours(0, 0, 0, 0)
    const monthStart = new Date()
    monthStart.setDate(monthStart.getDate() - 30)

    const [recentMovements, movedGroups] = await Promise.all([
      prisma.stockMovement.findMany({
        where: { workspaceId, createdAt: { gte: seriesStart } },
        select: { type: true, quantity: true, createdAt: true },
      }),
      prisma.stockMovement.groupBy({
        by: ['productId'],
        where: {
          workspaceId,
          createdAt: { gte: monthStart },
          type: { in: ['OUT', 'TRANSFER'] },
        },
        _sum: { quantity: true },
        orderBy: { _sum: { quantity: 'desc' } },
        take: 5,
      }),
    ])

    const series: { date: string; masuk: number; keluar: number }[] = []
    for (let offset = 6; offset >= 0; offset--) {
      const date = new Date(seriesStart)
      date.setDate(date.getDate() + offset)
      series.push({ date: date.toISOString().slice(0, 10), masuk: 0, keluar: 0 })
    }
    for (const movement of recentMovements) {
      const dayIndex = Math.floor(
        (new Date(movement.createdAt).setHours(0, 0, 0, 0) - seriesStart.getTime()) / 86_400_000
      )
      const point = series[dayIndex]
      if (!point) continue
      if (movement.type === 'IN') point.masuk += 1
      else if (movement.type === 'OUT') point.keluar += 1
    }

    const productNames = new Map(products.map((product) => [product.id, product.name]))
    const topMoved = movedGroups.map((group) => ({
      id: group.productId,
      name: productNames.get(group.productId) ?? '—',
      moved: group._sum.quantity ?? 0,
    }))

    return {
      data: {
        totalUnits,
        inventoryValue,
        lowStockCount: lowStock.length,
        lowStock,
        movementsToday,
        topMoved,
        movementSeries: series,
      },
    }
  })
}
