import type { FastifyInstance } from 'fastify'
import { z } from 'zod'

import { AppError, ERRORS } from '../lib/errors.js'
import { prisma } from '../lib/prisma.js'
import { parseWith } from '../lib/validate.js'

export async function notificationRoutes(app: FastifyInstance) {
  app.get('/api/notifications', async (request) => {
    const notifications = await prisma.notification.findMany({
      where: { workspaceId: request.workspace.id },
      orderBy: [{ readAt: 'asc' }, { createdAt: 'desc' }],
      take: 50,
    })
    const unread = notifications.filter((item) => item.readAt === null).length
    return { data: notifications, unread }
  })

  app.patch('/api/notifications/:id/read', async (request) => {
    const { id } = parseWith(z.object({ id: z.string().uuid() }), request.params)

    const notification = await prisma.notification.findFirst({
      where: { id, workspaceId: request.workspace.id },
      select: { id: true },
    })
    if (!notification)
      throw AppError.notFound(ERRORS.NOTIFICATION_NOT_FOUND, 'Notifikasi tidak ditemukan.')

    const updated = await prisma.notification.update({
      where: { id },
      data: { readAt: new Date() },
    })
    return { data: updated }
  })
}
