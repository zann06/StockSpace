import { prisma } from '../lib/prisma.js'

/**
 * Post-commit low-stock notification (PRD §7.6): after a movement, if the
 * product's total on-hand stock is below its reorder threshold, create one
 * grouped LOW_STOCK notification — but only if there is no unread one for the
 * same product yet (that is the "grouping" of repeated alerts).
 */
export async function maybeCreateLowStockNotification(workspaceId: string, productId: string) {
  const product = await prisma.product.findFirst({
    where: { id: productId, workspaceId },
    select: { id: true, name: true, reorderThreshold: true },
  })
  if (!product) return

  const [balanceGroup] = await prisma.inventoryBalance.groupBy({
    by: ['productId'],
    where: { productId },
    _sum: { quantity: true },
  })
  const total = balanceGroup?._sum.quantity ?? 0
  if (total >= product.reorderThreshold) return

  const existing = await prisma.notification.findFirst({
    where: {
      workspaceId,
      type: 'LOW_STOCK',
      readAt: null,
      body: { contains: product.id },
    },
    select: { id: true },
  })
  if (existing) return

  await prisma.notification.create({
    data: {
      workspaceId,
      type: 'LOW_STOCK',
      title: `${product.name} di bawah ambang stok`,
      body: `Sisa ${total} unit (ambang ${product.reorderThreshold}). Segera buat pesanan pembelian. [product:${product.id}]`,
    },
  })
}
