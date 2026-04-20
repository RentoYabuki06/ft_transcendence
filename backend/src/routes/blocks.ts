import { FastifyInstance } from 'fastify'
import prisma from '../lib/prisma.js'
import { authenticate } from '../lib/middleware.js'

export async function blockRoutes(fastify: FastifyInstance) {
  // GET /users/me/blocks — ブロック中のユーザー一覧
  fastify.get('/users/me/blocks', { preHandler: authenticate }, async (request, reply) => {
    const userId = (request as any).userId as number
    const blocks = await prisma.blocks.findMany({ where: { userId } })
    const list = await Promise.all(
      blocks.map(async (b) => {
        const u = await prisma.users.findUnique({ where: { id: b.blockedId } })
        return u
          ? { id: u.id, nickname: u.nickname, avatarUrl: u.pictureURL, blockedAt: b.createdAt }
          : null
      })
    )
    return reply.send(list.filter(Boolean))
  })

  // POST /users/me/blocks/:userId — ブロック
  fastify.post('/users/me/blocks/:userId', { preHandler: authenticate }, async (request, reply) => {
    const userId = (request as any).userId as number
    const targetId = parseInt((request.params as any).userId, 10)
    if (isNaN(targetId)) return reply.code(400).send({ message: '無効なユーザーIDです' })
    if (userId === targetId) return reply.code(400).send({ message: '自分自身はブロックできません' })

    const target = await prisma.users.findUnique({ where: { id: targetId } })
    if (!target) return reply.code(404).send({ message: 'ユーザーが見つかりません' })

    const existing = await prisma.blocks.findUnique({
      where: { userId_blockedId: { userId, blockedId: targetId } },
    })
    if (existing) return reply.code(409).send({ message: '既にブロック済みです' })

    await prisma.blocks.create({ data: { userId, blockedId: targetId } })

    // ブロック時にフレンド関係も解除（双方向）
    await prisma.friendships.deleteMany({
      where: {
        OR: [
          { userId, friendId: targetId },
          { userId: targetId, friendId: userId },
        ],
      },
    })

    return reply.code(201).send({ message: 'ブロックしました' })
  })

  // DELETE /users/me/blocks/:userId — ブロック解除
  fastify.delete('/users/me/blocks/:userId', { preHandler: authenticate }, async (request, reply) => {
    const userId = (request as any).userId as number
    const targetId = parseInt((request.params as any).userId, 10)
    if (isNaN(targetId)) return reply.code(400).send({ message: '無効なユーザーIDです' })

    await prisma.blocks.deleteMany({ where: { userId, blockedId: targetId } })
    return reply.send({ message: 'ブロックを解除しました' })
  })
}
