import { FastifyInstance } from 'fastify'
import prisma from '../lib/prisma.js'
import { authenticate } from '../lib/middleware.js'

export async function gameRoutes(fastify: FastifyInstance) {
  // GET /games/history — 自身の試合履歴
  fastify.get('/games/history', { preHandler: authenticate }, async (request, reply) => {
    const userId = (request as any).userId as number
    const { page = '1', limit = '10', sort = 'date_desc' } = request.query as Record<string, string>

    const pageNum = Math.max(1, parseInt(page, 10))
    const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10)))
    const skip = (pageNum - 1) * limitNum

    const myScores = await prisma.playerScores.findMany({ where: { userId } })
    const gameIds = [...new Set(myScores.map(s => s.gameId))]
    const total = gameIds.length

    const orderBy = sort === 'date_asc'
      ? { createdAt: 'asc' as const }
      : { createdAt: 'desc' as const }

    const games = await prisma.games.findMany({
      where: { id: { in: gameIds } },
      orderBy,
      skip,
      take: limitNum,
    })

    const data = await Promise.all(
      games.map(async (game) => {
        const allScores = await prisma.playerScores.findMany({ where: { gameId: game.id } })
        const myScore = allScores.find(s => s.userId === userId)
        const opponentScore = allScores.find(s => s.userId !== userId)

        let opponent = null
        if (opponentScore) {
          const oppUser = await prisma.users.findUnique({ where: { id: opponentScore.userId } })
          opponent = oppUser
            ? { id: oppUser.id, nickname: oppUser.nickname, avatarUrl: oppUser.pictureURL }
            : null
        }

        return {
          id: game.id,
          date: game.createdAt.toISOString(),
          opponent,
          myScore: myScore?.score ?? 0,
          opponentScore: opponentScore?.score ?? 0,
          result: myScore?.isWinner ? 'win' : 'loss',
        }
      })
    )

    return reply.send({ data, total, page: pageNum, limit: limitNum })
  })

  // GET /games/:id
  fastify.get('/games/:id', { preHandler: authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const gameId = parseInt(id, 10)
    if (isNaN(gameId)) return reply.code(400).send({ message: '無効なゲームIDです' })

    const game = await prisma.games.findUnique({ where: { id: gameId } })
    if (!game) return reply.code(404).send({ message: 'ゲームが見つかりません' })

    const status = await prisma.statuses.findUnique({ where: { id: game.statusId } })
    const scores = await prisma.playerScores.findMany({ where: { gameId } })

    const players = await Promise.all(
      scores.map(async (s) => {
        const user = await prisma.users.findUnique({ where: { id: s.userId } })
        return {
          id: s.id,
          gameId: s.gameId,
          userId: s.userId,
          user: user ? { id: user.id, nickname: user.nickname, avatarUrl: user.pictureURL } : null,
          score: s.score,
          isWinner: s.isWinner,
        }
      })
    )

    return reply.send({
      id: game.id,
      tournamentId: game.tournamentId,
      gameTypeId: game.gameTypeId,
      statusId: game.statusId,
      status: status ? { id: status.id, name: status.name, entityType: status.category } : null,
      createdAt: game.createdAt.toISOString(),
      updatedAt: game.updatedAt.toISOString(),
      players,
    })
  })

  // GET /ranking
  fastify.get('/ranking', { preHandler: authenticate }, async (request, reply) => {
    const { page = '1', limit = '10' } = request.query as Record<string, string>
    const pageNum = Math.max(1, parseInt(page, 10))
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)))

    const allScores = await prisma.playerScores.findMany()

    const statsMap = new Map<number, { wins: number; losses: number }>()
    for (const score of allScores) {
      const prev = statsMap.get(score.userId) || { wins: 0, losses: 0 }
      if (score.isWinner) prev.wins++
      else prev.losses++
      statsMap.set(score.userId, prev)
    }

    const allUsers = await prisma.users.findMany()
    const ranked = allUsers
      .map(user => {
        const stats = statsMap.get(user.id) || { wins: 0, losses: 0 }
        const total = stats.wins + stats.losses
        return {
          userId: user.id,
          nickname: user.nickname,
          avatarUrl: user.pictureURL,
          wins: stats.wins,
          losses: stats.losses,
          winRate: total > 0 ? Math.round((stats.wins / total) * 100) / 100 : 0,
          level: Math.floor(stats.wins / 5) + 1,
        }
      })
      .sort((a, b) => b.wins - a.wins || b.winRate - a.winRate)

    const total = ranked.length
    const slice = ranked.slice((pageNum - 1) * limitNum, pageNum * limitNum)
    const data = slice.map((r, i) => ({
      rank: (pageNum - 1) * limitNum + i + 1,
      user: { id: r.userId, nickname: r.nickname, avatarUrl: r.avatarUrl },
      wins: r.wins,
      losses: r.losses,
      winRate: r.winRate,
      level: r.level,
    }))

    return reply.send({ data, total })
  })
}
