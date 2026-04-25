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

    // 進行中(pending)の通常対戦(1v1)が残っていたらその試合へ戻す（切断→ホーム→再マッチ のフロー対策）
    // トーナメント試合はブラケット画面から直接遷移するため、ここで横取りしない。
    const pendingScore = await prisma.playerScores.findFirst({
      where: { userId, statusId: gameStatus.id },
      orderBy: { id: 'desc' },
    })
    if (pendingScore) {
      const pendingGame = await prisma.games.findUnique({ where: { id: pendingScore.gameId } })
      if (
        pendingGame &&
        pendingGame.statusId === gameStatus.id &&
        pendingGame.tournamentId === null
      ) {
        return reply.send({ matched: true, gameId: pendingGame.id, reconnect: true })
      }
    }

    // 既に待機中か確認: 自分1人だけで待機中なら部屋ごと破棄して再マッチング
    const alreadyWaiting = await prisma.waitingRoomParticipants.findFirst({
      where: { userId },
    })
    if (alreadyWaiting) {
      const room = await prisma.waitingRooms.findUnique({
        where: { id: alreadyWaiting.waitingRoomId },
      })
      if (room?.statusId === matchedStatus.id) {
        // 既にマッチ済みの古い部屋に残っている → 参加レコードを削除して新規マッチへ
        await prisma.waitingRoomParticipants.deleteMany({
          where: { userId, waitingRoomId: alreadyWaiting.waitingRoomId },
        })
      } else {
        const roomPeers = await prisma.waitingRoomParticipants.findMany({
          where: { waitingRoomId: alreadyWaiting.waitingRoomId },
        })
        if (roomPeers.length === 1) {
          await prisma.waitingRoomParticipants.deleteMany({ where: { waitingRoomId: alreadyWaiting.waitingRoomId } })
          await prisma.waitingRooms.deleteMany({ where: { id: alreadyWaiting.waitingRoomId } })
        } else {
          return reply.send({ waitingRoomId: alreadyWaiting.waitingRoomId })
        }
      }
    }

    // ブロック関係にあるユーザーを除外
    const blocks = await prisma.blocks.findMany({
      where: { OR: [{ userId }, { blockedId: userId }] },
    })
    const blockedIds = new Set<number>()
    for (const b of blocks) {
      blockedIds.add(b.userId === userId ? b.blockedId : b.userId)
    }

    // 待機中かつ参加者が1人いる部屋を探す（自分以外が作ったもの、ブロック関係を除外）
    const waitingParticipants = await prisma.waitingRoomParticipants.findMany({
      where: { userId: { not: userId, notIn: [...blockedIds] } },
    })
    const candidateRoomIds = [...new Set(waitingParticipants.map(p => p.waitingRoomId))]

    const existingRoom = candidateRoomIds.length > 0
      ? await prisma.waitingRooms.findFirst({
          where: {
            id: { in: candidateRoomIds },
            statusId: waitingStatus.id,
            adminUserId: { not: userId },
          },
        })
      : null

    if (existingRoom) {
      const participants = await prisma.waitingRoomParticipants.findMany({
        where: { waitingRoomId: existingRoom.id },
      })

      if (participants.length === 1) {
        // マッチング成立（並列 POST による race を吸収）
        try {
          await prisma.waitingRoomParticipants.create({
            data: { waitingRoomId: existingRoom.id, userId, statusId: waitingStatus.id },
          })
        } catch (e: any) {
          if (e?.code === 'P2002') {
            return reply.send({ waitingRoomId: existingRoom.id })
          }
          throw e
        }
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
