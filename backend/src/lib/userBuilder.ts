import prisma from './prisma.js'

export async function buildUserResponse(userId: number) {
  const user = await prisma.users.findUnique({ where: { id: userId } })
  if (!user) return null

  const status = await prisma.statuses.findUnique({ where: { id: user.statusId } })

  const scores = await prisma.playerScores.findMany({ where: { userId } })
  const wins = scores.filter(s => s.isWinner).length
  const losses = scores.filter(s => !s.isWinner).length

  const allWins = await prisma.playerScores.groupBy({
    by: ['userId'],
    _count: { id: true },
    where: { isWinner: true },
    orderBy: { _count: { id: 'desc' } },
  })
  const rank = allWins.findIndex(r => r.userId === userId) + 1 || allWins.length + 1
  const level = Math.floor(wins / 5) + 1

  return {
    id: user.id,
    nickname: user.nickname,
    email: user.email,
    avatarUrl: user.pictureURL,
    isTwoFactorEnabled: user.isTwoFactorEnabled,
    statusId: user.statusId,
    status: status
      ? { id: status.id, name: status.name, entityType: status.category }
      : null,
    wins,
    losses,
    rank,
    level,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  }
}
