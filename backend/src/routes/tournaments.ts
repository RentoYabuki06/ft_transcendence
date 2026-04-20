import { FastifyInstance } from 'fastify'
import prisma from '../lib/prisma.js'
import { authenticate } from '../lib/middleware.js'

export async function tournamentRoutes(fastify: FastifyInstance) {
  // --- GET /tournaments — トーナメント一覧 ---
  fastify.get('/tournaments', { preHandler: authenticate }, async (_request, reply) => {
    const tournaments = await prisma.tournaments.findMany({
      orderBy: { createdAt: 'desc' },
    })

    const data = await Promise.all(
      tournaments.map(async (t) => {
        const status = await prisma.statuses.findUnique({ where: { id: t.statusId } })
        const participants = await prisma.tournamentParticipants.findMany({
          where: { tournamentId: t.id },
        })
        return {
          id: t.id,
          name: t.name,
          createdBy: t.createdBy,
          maxParticipants: t.maxParticipants,
          participantCount: participants.length,
          status: status ? { id: status.id, name: status.name } : null,
          createdAt: t.createdAt.toISOString(),
        }
      })
    )

    return reply.send(data)
  })

  // --- POST /tournaments — トーナメント作成 ---
  fastify.post('/tournaments', { preHandler: authenticate }, async (request, reply) => {
    const userId = (request as any).userId as number
    const { name, maxParticipants = 4 } = request.body as {
      name?: string
      maxParticipants?: number
    }

    if (!name) return reply.code(400).send({ message: 'name は必須です' })
    if (![4, 8].includes(maxParticipants)) {
      return reply.code(400).send({ message: 'maxParticipants は 4 または 8 にしてください' })
    }

    const pendingStatus = await prisma.statuses.findFirst({
      where: { category: 'tournament', name: 'pending' },
    })
    if (!pendingStatus) {
      return reply.code(500).send({ message: 'ステータスマスターが初期化されていません' })
    }

    const tournament = await prisma.tournaments.create({
      data: {
        name,
        createdBy: userId,
        maxParticipants,
        statusId: pendingStatus.id,
      },
    })

    // 作成者を参加者として自動追加
    const user = await prisma.users.findUnique({ where: { id: userId } })
    await prisma.tournamentParticipants.create({
      data: {
        tournamentId: tournament.id,
        userId,
        alias: user?.nickname ?? `player${userId}`,
      },
    })

    return reply.code(201).send({
      id: tournament.id,
      name: tournament.name,
      maxParticipants: tournament.maxParticipants,
      createdAt: tournament.createdAt.toISOString(),
    })
  })

  // --- GET /tournaments/:id — トーナメント詳細 ---
  fastify.get('/tournaments/:id', { preHandler: authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const tournamentId = parseInt(id, 10)
    if (isNaN(tournamentId)) return reply.code(400).send({ message: '無効なIDです' })

    const tournament = await prisma.tournaments.findUnique({ where: { id: tournamentId } })
    if (!tournament) return reply.code(404).send({ message: 'トーナメントが見つかりません' })

    const status = await prisma.statuses.findUnique({ where: { id: tournament.statusId } })
    const participants = await prisma.tournamentParticipants.findMany({
      where: { tournamentId },
    })

    const participantDetails = await Promise.all(
      participants.map(async (p) => {
        const user = await prisma.users.findUnique({ where: { id: p.userId } })
        return {
          id: p.id,
          userId: p.userId,
          alias: p.alias,
          nickname: user?.nickname,
          avatarUrl: user?.pictureURL,
        }
      })
    )

    const games = await prisma.games.findMany({
      where: { tournamentId },
      orderBy: [{ round: 'asc' }, { order: 'asc' }],
    })

    const bracket = await Promise.all(
      games.map(async (g) => {
        const scores = await prisma.playerScores.findMany({ where: { gameId: g.id } })
        const gameStatus = await prisma.statuses.findUnique({ where: { id: g.statusId } })
        return {
          id: g.id,
          round: g.round,
          order: g.order,
          status: gameStatus?.name,
          winnerId: g.winnerId,
          players: await Promise.all(
            scores.map(async (s) => {
              const u = await prisma.users.findUnique({ where: { id: s.userId } })
              return {
                userId: s.userId,
                nickname: u?.nickname,
                score: s.score,
                isWinner: s.isWinner,
              }
            })
          ),
        }
      })
    )

    return reply.send({
      id: tournament.id,
      name: tournament.name,
      createdBy: tournament.createdBy,
      maxParticipants: tournament.maxParticipants,
      status: status ? { id: status.id, name: status.name } : null,
      participants: participantDetails,
      bracket,
      createdAt: tournament.createdAt.toISOString(),
      updatedAt: tournament.updatedAt.toISOString(),
    })
  })

  // --- POST /tournaments/:id/join — トーナメント参加 ---
  fastify.post('/tournaments/:id/join', { preHandler: authenticate }, async (request, reply) => {
    const userId = (request as any).userId as number
    const { id } = request.params as { id: string }
    const tournamentId = parseInt(id, 10)
    if (isNaN(tournamentId)) return reply.code(400).send({ message: '無効なIDです' })

    const tournament = await prisma.tournaments.findUnique({ where: { id: tournamentId } })
    if (!tournament) return reply.code(404).send({ message: 'トーナメントが見つかりません' })

    const pendingStatus = await prisma.statuses.findFirst({
      where: { category: 'tournament', name: 'pending' },
    })
    if (tournament.statusId !== pendingStatus?.id) {
      return reply.code(400).send({ message: '既に開始または終了したトーナメントには参加できません' })
    }

    const participants = await prisma.tournamentParticipants.findMany({
      where: { tournamentId },
    })
    if (participants.length >= tournament.maxParticipants) {
      return reply.code(400).send({ message: '定員に達しています' })
    }

    const existing = await prisma.tournamentParticipants.findUnique({
      where: { tournamentId_userId: { tournamentId, userId } },
    })
    if (existing) return reply.code(409).send({ message: '既に参加しています' })

    const { alias } = request.body as { alias?: string }
    const user = await prisma.users.findUnique({ where: { id: userId } })

    await prisma.tournamentParticipants.create({
      data: {
        tournamentId,
        userId,
        alias: alias || user?.nickname || `player${userId}`,
      },
    })

    return reply.code(201).send({ message: '参加しました' })
  })

  // --- POST /tournaments/:id/start — トーナメント開始（ブラケット生成）---
  fastify.post('/tournaments/:id/start', { preHandler: authenticate }, async (request, reply) => {
    const userId = (request as any).userId as number
    const { id } = request.params as { id: string }
    const tournamentId = parseInt(id, 10)
    if (isNaN(tournamentId)) return reply.code(400).send({ message: '無効なIDです' })

    const tournament = await prisma.tournaments.findUnique({ where: { id: tournamentId } })
    if (!tournament) return reply.code(404).send({ message: 'トーナメントが見つかりません' })
    if (tournament.createdBy !== userId) {
      return reply.code(403).send({ message: '作成者のみ開始できます' })
    }

    const pendingStatus = await prisma.statuses.findFirst({
      where: { category: 'tournament', name: 'pending' },
    })
    const ongoingStatus = await prisma.statuses.findFirst({
      where: { category: 'tournament', name: 'ongoing' },
    })
    const gamePendingStatus = await prisma.statuses.findFirst({
      where: { category: 'game', name: 'pending' },
    })
    const gameType = await prisma.gameTypes.findFirst()

    if (!pendingStatus || !ongoingStatus || !gamePendingStatus) {
      return reply.code(500).send({ message: 'ステータスマスターが初期化されていません' })
    }

    if (tournament.statusId !== pendingStatus.id) {
      return reply.code(400).send({ message: 'このトーナメントは既に開始または終了しています' })
    }

    const participants = await prisma.tournamentParticipants.findMany({
      where: { tournamentId },
    })

    const minParticipants = 4
    if (participants.length < minParticipants) {
      return reply.code(400).send({ message: `最低${minParticipants}人必要です（現在${participants.length}人）` })
    }

    // シャッフルしてブラケット生成
    const shuffled = [...participants].sort(() => Math.random() - 0.5)

    // ラウンド1の試合を作成（2人1組）
    for (let i = 0; i < shuffled.length; i += 2) {
      if (i + 1 >= shuffled.length) break
      const game = await prisma.games.create({
        data: {
          statusId: gamePendingStatus.id,
          tournamentId,
          round: 1,
          order: Math.floor(i / 2) + 1,
          playerNum: 2,
          gameTypeId: gameType?.id ?? 1,
        },
      })

      const scoreStatus = await prisma.statuses.findFirst({
        where: { category: 'game', name: 'pending' },
      })

      await prisma.playerScores.createMany({
        data: [
          { gameId: game.id, userId: shuffled[i].userId, statusId: scoreStatus!.id },
          { gameId: game.id, userId: shuffled[i + 1].userId, statusId: scoreStatus!.id },
        ],
      })
    }

    await prisma.tournaments.update({
      where: { id: tournamentId },
      data: { statusId: ongoingStatus.id },
    })

    return reply.send({ message: 'トーナメントを開始しました', tournamentId })
  })

  // --- POST /tournaments/:id/games/:gameId/result — 試合結果登録 ---
  fastify.post(
    '/tournaments/:id/games/:gameId/result',
    { preHandler: authenticate },
    async (request, reply) => {
      const { id, gameId: gameIdStr } = request.params as { id: string; gameId: string }
      const tournamentId = parseInt(id, 10)
      const gameId = parseInt(gameIdStr, 10)
      if (isNaN(tournamentId) || isNaN(gameId)) {
        return reply.code(400).send({ message: '無効なIDです' })
      }

      const { scores } = request.body as {
        scores: Array<{ userId: number; score: number }>
      }
      if (!scores || scores.length !== 2) {
        return reply.code(400).send({ message: 'scores に2プレイヤーのスコアを指定してください' })
      }

      const game = await prisma.games.findUnique({ where: { id: gameId } })
      if (!game || game.tournamentId !== tournamentId) {
        return reply.code(404).send({ message: '試合が見つかりません' })
      }

      const finishedStatus = await prisma.statuses.findFirst({
        where: { category: 'game', name: 'finished' },
      })
      if (!finishedStatus) return reply.code(500).send({ message: 'Status not found' })

      const winner = scores.reduce((a, b) => (a.score >= b.score ? a : b))

      for (const s of scores) {
        await prisma.playerScores.updateMany({
          where: { gameId, userId: s.userId },
          data: { score: s.score, isWinner: s.userId === winner.userId },
        })
      }

      await prisma.games.update({
        where: { id: gameId },
        data: { statusId: finishedStatus.id, winnerId: winner.userId },
      })

      // 実績チェック
      const { checkAndUnlockAchievements } = await import('./websocket.js')
      for (const s of scores) await checkAndUnlockAchievements(s.userId)

      // トーナメント全試合終了チェック
      await checkTournamentCompletion(tournamentId)

      return reply.send({ message: '結果を登録しました', winnerId: winner.userId })
    }
  )
}

// トーナメントの全ラウンド1試合終了後に次ラウンドを生成
async function checkTournamentCompletion(tournamentId: number) {
  const allGames = await prisma.games.findMany({ where: { tournamentId } })
  const finishedStatus = await prisma.statuses.findFirst({
    where: { category: 'game', name: 'finished' },
  })
  const finishedTournamentStatus = await prisma.statuses.findFirst({
    where: { category: 'tournament', name: 'finished' },
  })
  const gamePendingStatus = await prisma.statuses.findFirst({
    where: { category: 'game', name: 'pending' },
  })
  const gameType = await prisma.gameTypes.findFirst()

  if (!finishedStatus || !finishedTournamentStatus || !gamePendingStatus) return

  const maxRound = Math.max(...allGames.map(g => g.round))
  const currentRoundGames = allGames.filter(g => g.round === maxRound)
  const allFinished = currentRoundGames.every(g => g.statusId === finishedStatus.id)

  if (!allFinished) return

  // 勝者を集める
  const winners = currentRoundGames
    .map(g => g.winnerId)
    .filter((w): w is number => w !== null)

  if (winners.length === 1) {
    // 優勝者決定 → トーナメント終了
    await prisma.tournaments.update({
      where: { id: tournamentId },
      data: { statusId: finishedTournamentStatus.id },
    })
    return
  }

  // 次ラウンドの試合生成
  const nextRound = maxRound + 1
  const shuffled = [...winners].sort(() => Math.random() - 0.5)

  for (let i = 0; i < shuffled.length; i += 2) {
    if (i + 1 >= shuffled.length) break
    const game = await prisma.games.create({
      data: {
        statusId: gamePendingStatus.id,
        tournamentId,
        round: nextRound,
        order: Math.floor(i / 2) + 1,
        playerNum: 2,
        gameTypeId: gameType?.id ?? 1,
      },
    })

    await prisma.playerScores.createMany({
      data: [
        { gameId: game.id, userId: shuffled[i], statusId: gamePendingStatus.id },
        { gameId: game.id, userId: shuffled[i + 1], statusId: gamePendingStatus.id },
      ],
    })
  }
}
