import { FastifyInstance } from 'fastify'
import prisma from '../lib/prisma.js'
import { authenticate } from '../lib/middleware.js'
import { notifyMatchFound } from './websocket.js'

export async function matchmakingRoutes(fastify: FastifyInstance) {
  // POST /matchmaking/join
  fastify.post('/matchmaking/join', { preHandler: authenticate }, async (request, reply) => {
    const userId = (request as any).userId as number

    const waitingStatus = await prisma.statuses.findFirst({
      where: { category: 'waitroom', name: 'waiting' },
    })
    const matchedStatus = await prisma.statuses.findFirst({
      where: { category: 'waitroom', name: 'matched' },
    })
    const gameStatus = await prisma.statuses.findFirst({
      where: { category: 'game', name: 'pending' },
    })
    const gameType = await prisma.gameTypes.findFirst()

    if (!waitingStatus || !matchedStatus || !gameStatus) {
      return reply.code(500).send({ message: 'ステータスマスターが初期化されていません' })
    }

    // 既に待機中か確認
    const alreadyWaiting = await prisma.waitingRoomParticipants.findFirst({
      where: { userId },
    })
    if (alreadyWaiting) {
      return reply.send({ waitingRoomId: alreadyWaiting.waitingRoomId })
    }

    // 既存の waiting 部屋を探す（自分以外が作ったもの）
    const existingRoom = await prisma.waitingRooms.findFirst({
      where: { statusId: waitingStatus.id, adminUserId: { not: userId } },
    })

    if (existingRoom) {
      const participants = await prisma.waitingRoomParticipants.findMany({
        where: { waitingRoomId: existingRoom.id },
      })

      if (participants.length === 1) {
        // マッチング成立
        await prisma.waitingRoomParticipants.create({
          data: { waitingRoomId: existingRoom.id, userId, statusId: waitingStatus.id },
        })
        await prisma.waitingRooms.update({
          where: { id: existingRoom.id },
          data: { statusId: matchedStatus.id },
        })

        // Games レコード作成（PlayerScores も同時に作成）
        const game = await prisma.games.create({
          data: {
            statusId: gameStatus.id,
            gameTypeId: gameType?.id ?? 1,
            playerNum: 2,
          },
        })

        const opponentId = participants[0].userId
        await prisma.playerScores.createMany({
          data: [
            { gameId: game.id, userId, statusId: gameStatus.id },
            { gameId: game.id, userId: opponentId, statusId: gameStatus.id },
          ],
        })

        // WebSocket でマッチング成立を通知
        const meUser = await prisma.users.findUnique({ where: { id: userId } })
        const oppUser = await prisma.users.findUnique({ where: { id: opponentId } })
        notifyMatchFound(
          userId,
          opponentId,
          game.id,
          { id: userId, nickname: meUser?.nickname ?? '', avatarUrl: meUser?.pictureURL ?? null },
          { id: opponentId, nickname: oppUser?.nickname ?? '', avatarUrl: oppUser?.pictureURL ?? null },
        )

        return reply.send({ waitingRoomId: existingRoom.id, matched: true, gameId: game.id })
      }
    }

    // 新しい waiting 部屋を作成
    const newRoom = await prisma.waitingRooms.create({
      data: {
        statusId: waitingStatus.id,
        name: `room_${userId}_${Date.now()}`,
        adminUserId: userId,
      },
    })
    await prisma.waitingRoomParticipants.create({
      data: { waitingRoomId: newRoom.id, userId, statusId: waitingStatus.id },
    })

    return reply.send({ waitingRoomId: newRoom.id, matched: false })
  })

  // POST /matchmaking/cancel
  fastify.post('/matchmaking/cancel', { preHandler: authenticate }, async (request, reply) => {
    const userId = (request as any).userId as number
    await prisma.waitingRoomParticipants.deleteMany({ where: { userId } })
    return reply.send(null)
  })
}
