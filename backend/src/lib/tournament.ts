// トーナメント進行ロジック。
// - 全試合終了 → 次ラウンドのブラケットを生成
// - 1人残り → トーナメント終了
// 冪等性: 同じラウンドの次ラウンドが既に存在する場合は何もしない（同時終了時の二重生成を防止）

import prisma from './prisma.js'

export interface AdvanceResult {
  status: 'no_op' | 'next_round_created' | 'tournament_finished'
  nextRound?: number
  createdGameIds?: number[]
}

/**
 * 指定トーナメントの最大ラウンドが全て終了していたら、
 * - 残り1人 → トーナメントを finished に
 * - 残り2人以上 → 次ラウンドを生成（既に存在すれば何もしない）
 */
export async function advanceTournament(tournamentId: number): Promise<AdvanceResult> {
  const tournament = await prisma.tournaments.findUnique({ where: { id: tournamentId } })
  if (!tournament) return { status: 'no_op' }

  const finishedTournamentStatus = await prisma.statuses.findFirst({
    where: { category: 'tournament', name: 'finished' },
  })
  const ongoingTournamentStatus = await prisma.statuses.findFirst({
    where: { category: 'tournament', name: 'ongoing' },
  })
  const finishedGameStatus = await prisma.statuses.findFirst({
    where: { category: 'game', name: 'finished' },
  })
  const pendingGameStatus = await prisma.statuses.findFirst({
    where: { category: 'game', name: 'pending' },
  })
  const gameType = await prisma.gameTypes.findFirst()

  if (!finishedTournamentStatus || !ongoingTournamentStatus || !finishedGameStatus || !pendingGameStatus) {
    return { status: 'no_op' }
  }

  // ongoing 状態でなければ進行不要（pending or finished）
  if (tournament.statusId !== ongoingTournamentStatus.id) {
    return { status: 'no_op' }
  }

  const allGames = await prisma.games.findMany({
    where: { tournamentId },
    orderBy: [{ round: 'asc' }, { order: 'asc' }],
  })
  if (allGames.length === 0) return { status: 'no_op' }

  const maxRound = Math.max(...allGames.map(g => g.round))
  const currentRoundGames = allGames.filter(g => g.round === maxRound)
  const allFinished = currentRoundGames.every(g => g.statusId === finishedGameStatus.id)
  if (!allFinished) return { status: 'no_op' }

  // winnerId が null（中断試合）は次ラウンドに進めない
  const winners = currentRoundGames
    .map(g => g.winnerId)
    .filter((w): w is number => w !== null)

  // 残り1人 → 優勝
  if (winners.length === 1) {
    await prisma.tournaments.update({
      where: { id: tournamentId },
      data: { statusId: finishedTournamentStatus.id },
    })
    return { status: 'tournament_finished' }
  }

  // 全試合中断などで勝者0人 → トーナメントも終了扱い
  if (winners.length === 0) {
    await prisma.tournaments.update({
      where: { id: tournamentId },
      data: { statusId: finishedTournamentStatus.id },
    })
    return { status: 'tournament_finished' }
  }

  // 既に次ラウンドが存在 → 冪等性で no-op
  const nextRound = maxRound + 1
  const existingNextRound = await prisma.games.findFirst({
    where: { tournamentId, round: nextRound },
  })
  if (existingNextRound) {
    return { status: 'no_op' }
  }

  // 次ラウンド生成（順序は前ラウンドの order を維持してペアリング:
  // 1試合目の勝者 × 2試合目の勝者、3試合目の勝者 × 4試合目の勝者 ...）
  const orderedWinners = currentRoundGames
    .filter(g => g.winnerId !== null)
    .sort((a, b) => a.order - b.order)
    .map(g => g.winnerId as number)

  // 奇数だったら最後の1人は不戦勝として次ラウンドに繰り上げ。ただし通常は4/8人で割り切れる
  const createdGameIds: number[] = []
  for (let i = 0; i < orderedWinners.length; i += 2) {
    if (i + 1 >= orderedWinners.length) break
    const game = await prisma.games.create({
      data: {
        statusId: pendingGameStatus.id,
        tournamentId,
        round: nextRound,
        order: Math.floor(i / 2) + 1,
        playerNum: 2,
        gameTypeId: gameType?.id ?? 1,
      },
    })
    await prisma.playerScores.createMany({
      data: [
        { gameId: game.id, userId: orderedWinners[i], statusId: pendingGameStatus.id },
        { gameId: game.id, userId: orderedWinners[i + 1], statusId: pendingGameStatus.id },
      ],
    })
    createdGameIds.push(game.id)
  }

  return { status: 'next_round_created', nextRound, createdGameIds }
}
