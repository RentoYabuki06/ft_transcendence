import { FastifyInstance } from 'fastify'
import prisma from '../lib/prisma.js'
import { authenticate } from '../lib/middleware.js'

export async function friendRoutes(fastify: FastifyInstance) {
  // GET /users/me/friends — 承認済みフレンド一覧
  fastify.get('/users/me/friends', { preHandler: authenticate }, async (request, reply) => {
    const userId = (request as any).userId as number

    // accepted 状態で、自分が送信 or 受信したレコードの相手を返す
    const friendships = await prisma.friendships.findMany({
      where: {
        status: 'accepted',
        OR: [{ userId }, { friendId: userId }],
      },
    })

    const friends = await Promise.all(
      friendships.map(async (f) => {
        const otherId = f.userId === userId ? f.friendId : f.userId
        const friend = await prisma.users.findUnique({ where: { id: otherId } })
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

  // GET /users/me/friends/requests — 自分宛の承認待ち申請一覧
  fastify.get('/users/me/friends/requests', { preHandler: authenticate }, async (request, reply) => {
    const userId = (request as any).userId as number

    const incoming = await prisma.friendships.findMany({
      where: { friendId: userId, status: 'pending' },
    })
    const outgoing = await prisma.friendships.findMany({
      where: { userId, status: 'pending' },
    })

    const incomingList = await Promise.all(
      incoming.map(async (f) => {
        const u = await prisma.users.findUnique({ where: { id: f.userId } })
        return {
          id: f.id,
          user: u ? { id: u.id, nickname: u.nickname, avatarUrl: u.pictureURL } : null,
          createdAt: f.createdAt,
        }
      })
    )
    const outgoingList = await Promise.all(
      outgoing.map(async (f) => {
        const u = await prisma.users.findUnique({ where: { id: f.friendId } })
        return {
          id: f.id,
          user: u ? { id: u.id, nickname: u.nickname, avatarUrl: u.pictureURL } : null,
          createdAt: f.createdAt,
        }
      })
    )

    return reply.send({ incoming: incomingList, outgoing: outgoingList })
  })

  // POST /users/me/friends/:userId — 申請を送信（pending）
  fastify.post('/users/me/friends/:userId', { preHandler: authenticate }, async (request, reply) => {
    const userId = (request as any).userId as number
    const { userId: targetIdStr } = request.params as { userId: string }
    const targetId = parseInt(targetIdStr, 10)

    if (isNaN(targetId)) return reply.code(400).send({ message: '無効なユーザーIDです' })
    if (userId === targetId) return reply.code(400).send({ message: '自分自身をフレンドに追加できません' })

    const target = await prisma.users.findUnique({ where: { id: targetId } })
    if (!target) return reply.code(404).send({ message: 'ユーザーが見つかりません' })

    const blocked = await prisma.blocks.findFirst({
      where: {
        OR: [
          { userId, blockedId: targetId },
          { userId: targetId, blockedId: userId },
        ],
      },
    })
    if (blocked) return reply.code(403).send({ message: 'このユーザーとはフレンドになれません' })

    // 自分が既に送った or 相手から届いているレコードを確認
    const mine = await prisma.friendships.findUnique({
      where: { userId_friendId: { userId, friendId: targetId } },
    })
    const theirs = await prisma.friendships.findUnique({
      where: { userId_friendId: { userId: targetId, friendId: userId } },
    })

    if (mine) {
      if (mine.status === 'accepted') return reply.code(409).send({ message: '既にフレンドです' })
      return reply.code(409).send({ message: '既に申請済みです' })
    }
    if (theirs) {
      if (theirs.status === 'accepted') return reply.code(409).send({ message: '既にフレンドです' })
      // 相手からの保留中の申請 → 承認扱いにして成立
      await prisma.friendships.update({
        where: { id: theirs.id },
        data: { status: 'accepted' },
      })
      const { checkAndUnlockAchievements } = await import('./websocket.js')
      await checkAndUnlockAchievements(userId)
      await checkAndUnlockAchievements(targetId)
      return reply.code(201).send({ status: 'accepted' })
    }

    await prisma.friendships.create({
      data: { userId, friendId: targetId, status: 'pending' },
    })

    return reply.code(201).send({ status: 'pending' })
  })

  // PATCH /users/me/friends/:userId/accept — 受信した申請を承認
  fastify.patch('/users/me/friends/:userId/accept', { preHandler: authenticate }, async (request, reply) => {
    const userId = (request as any).userId as number
    const { userId: targetIdStr } = request.params as { userId: string }
    const targetId = parseInt(targetIdStr, 10)
    if (isNaN(targetId)) return reply.code(400).send({ message: '無効なユーザーIDです' })

    // 相手 → 自分 の pending レコードを探す
    const req = await prisma.friendships.findUnique({
      where: { userId_friendId: { userId: targetId, friendId: userId } },
    })
    if (!req || req.status !== 'pending') {
      return reply.code(404).send({ message: '承認待ちの申請が見つかりません' })
    }

    await prisma.friendships.update({
      where: { id: req.id },
      data: { status: 'accepted' },
    })

    const { checkAndUnlockAchievements } = await import('./websocket.js')
    await checkAndUnlockAchievements(userId)
    await checkAndUnlockAchievements(targetId)

    return reply.send({ status: 'accepted' })
  })

  // DELETE /users/me/friends/:userId — 申請取り消し / 拒否 / フレンド解除
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
