import { FastifyInstance } from 'fastify'
import prisma from '../lib/prisma.js'
import { authenticate } from '../lib/middleware.js'

export async function messageRoutes(fastify: FastifyInstance) {
  // GET /messages/conversations — 自分が関わる相手の一覧と最終メッセージ
  fastify.get('/messages/conversations', { preHandler: authenticate }, async (request, reply) => {
    const userId = (request as any).userId as number

    const msgs = await prisma.messages.findMany({
      where: { OR: [{ senderId: userId }, { receiverId: userId }] },
      orderBy: { createdAt: 'desc' },
    })

    // 相手ごとの最新メッセージを集約
    const byPartner = new Map<number, typeof msgs[number]>()
    for (const m of msgs) {
      const partnerId = m.senderId === userId ? m.receiverId : m.senderId
      if (!byPartner.has(partnerId)) byPartner.set(partnerId, m)
    }

    const result = await Promise.all(
      [...byPartner.entries()].map(async ([partnerId, lastMsg]) => {
        const u = await prisma.users.findUnique({ where: { id: partnerId } })
        const unreadCount = await prisma.messages.count({
          where: { senderId: partnerId, receiverId: userId, readAt: null },
        })
        return {
          partnerId,
          nickname: u?.nickname,
          avatarUrl: u?.pictureURL,
          lastMessage: {
            body: lastMsg.body,
            createdAt: lastMsg.createdAt.toISOString(),
            fromMe: lastMsg.senderId === userId,
          },
          unreadCount,
        }
      })
    )

    return reply.send(result)
  })

  // GET /messages/:userId — 特定ユーザーとの会話履歴
  fastify.get('/messages/:userId', { preHandler: authenticate }, async (request, reply) => {
    const userId = (request as any).userId as number
    const { userId: partnerIdStr } = request.params as { userId: string }
    const partnerId = parseInt(partnerIdStr, 10)
    if (isNaN(partnerId)) return reply.code(400).send({ message: '無効なユーザーIDです' })

    const msgs = await prisma.messages.findMany({
      where: {
        OR: [
          { senderId: userId, receiverId: partnerId },
          { senderId: partnerId, receiverId: userId },
        ],
      },
      orderBy: { createdAt: 'asc' },
      take: 200,
    })

    // 既読処理（相手から自分への未読を既読に）
    await prisma.messages.updateMany({
      where: { senderId: partnerId, receiverId: userId, readAt: null },
      data: { readAt: new Date() },
    })

    return reply.send(
      msgs.map((m) => ({
        id: m.id,
        senderId: m.senderId,
        receiverId: m.receiverId,
        body: m.body,
        createdAt: m.createdAt.toISOString(),
        readAt: m.readAt?.toISOString() ?? null,
      }))
    )
  })

  // POST /messages — メッセージ送信
  fastify.post('/messages', { preHandler: authenticate }, async (request, reply) => {
    const userId = (request as any).userId as number
    const { receiverId, body } = request.body as { receiverId?: number; body?: string }

    if (!receiverId || typeof receiverId !== 'number') {
      return reply.code(400).send({ message: 'receiverId は必須です' })
    }
    if (!body || typeof body !== 'string' || body.trim().length === 0) {
      return reply.code(400).send({ message: 'body は必須です' })
    }
    if (body.length > 2000) {
      return reply.code(400).send({ message: 'メッセージは2000文字以内にしてください' })
    }
    if (receiverId === userId) {
      return reply.code(400).send({ message: '自分自身には送信できません' })
    }

    const receiver = await prisma.users.findUnique({ where: { id: receiverId } })
    if (!receiver) return reply.code(404).send({ message: '受信者が見つかりません' })

    const msg = await prisma.messages.create({
      data: { senderId: userId, receiverId, body: body.trim() },
    })

    // WebSocket 経由でリアルタイム配信
    const { deliverChatMessage } = await import('./websocket.js')
    deliverChatMessage(receiverId, {
      id: msg.id,
      senderId: msg.senderId,
      receiverId: msg.receiverId,
      body: msg.body,
      createdAt: msg.createdAt.toISOString(),
    })

    return reply.code(201).send({
      id: msg.id,
      senderId: msg.senderId,
      receiverId: msg.receiverId,
      body: msg.body,
      createdAt: msg.createdAt.toISOString(),
    })
  })
}
