import { FastifyInstance } from 'fastify'
import prisma from '../lib/prisma.js'
import { authenticate } from '../lib/middleware.js'

export async function friendRoutes(fastify: FastifyInstance) {
  // GET /users/me/friends
  fastify.get('/users/me/friends', { preHandler: authenticate }, async (request, reply) => {
    const userId = (request as any).userId as number

    const friendships = await prisma.friendships.findMany({ where: { userId } })

    const friends = await Promise.all(
      friendships.map(async (f) => {
        const friend = await prisma.users.findUnique({ where: { id: f.friendId } })
        return {
          id: f.id,
          user: friend
            ? { id: friend.id, nickname: friend.nickname, avatarUrl: friend.pictureURL }
            : null,
          onlineStatus: 'offline' as const,
        }
      })
    )

    return reply.send(friends)
  })

  // POST /users/me/friends/:userId
  fastify.post('/users/me/friends/:userId', { preHandler: authenticate }, async (request, reply) => {
    const userId = (request as any).userId as number
    const { userId: targetIdStr } = request.params as { userId: string }
    const targetId = parseInt(targetIdStr, 10)

    if (isNaN(targetId)) return reply.code(400).send({ message: '無効なユーザーIDです' })
    if (userId === targetId) return reply.code(400).send({ message: '自分自身をフレンドに追加できません' })

    const target = await prisma.users.findUnique({ where: { id: targetId } })
    if (!target) return reply.code(404).send({ message: 'ユーザーが見つかりません' })

    const existing = await prisma.friendships.findUnique({
      where: { userId_friendId: { userId, friendId: targetId } },
    })
    if (existing) return reply.code(409).send({ message: '既にフレンドです' })

    await prisma.friendships.create({ data: { userId, friendId: targetId } })
    // 双方向フレンドシップ（既存なら無視）
    const reverse = await prisma.friendships.findUnique({
      where: { userId_friendId: { userId: targetId, friendId: userId } },
    })
    if (!reverse) {
      await prisma.friendships.create({ data: { userId: targetId, friendId: userId } })
    }

    const { checkAndUnlockAchievements } = await import('./websocket.js')
    await checkAndUnlockAchievements(userId)

    return reply.code(201).send(null)
  })

  // DELETE /users/me/friends/:userId
  fastify.delete('/users/me/friends/:userId', { preHandler: authenticate }, async (request, reply) => {
    const userId = (request as any).userId as number
    const { userId: targetIdStr } = request.params as { userId: string }
    const targetId = parseInt(targetIdStr, 10)

    if (isNaN(targetId)) return reply.code(400).send({ message: '無効なユーザーIDです' })

    await prisma.friendships.deleteMany({
      where: {
        OR: [
          { userId, friendId: targetId },
          { userId: targetId, friendId: userId },
        ],
      },
    })

    return reply.send(null)
  })
}
