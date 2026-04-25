import { FastifyInstance } from 'fastify'
import prisma from '../lib/prisma.js'
import { authenticate } from '../lib/middleware.js'

export async function achievementRoutes(fastify: FastifyInstance) {
  // GET /users/me/achievements
  fastify.get('/users/me/achievements', { preHandler: authenticate }, async (request, reply) => {
    const userId = (request as any).userId as number

    const allAchievements = await prisma.achievements.findMany()
    const unlocked = await prisma.userAchievements.findMany({ where: { userId } })
    const unlockedMap = new Map(unlocked.map(u => [u.achievementId, u.unlockedAt]))

    const result = allAchievements.map(a => ({
      id: a.key,
      name: a.name,
      description: a.description,
      icon: a.icon,
      unlockedAt: unlockedMap.has(a.id) ? unlockedMap.get(a.id)!.toISOString() : null,
    }))

    return reply.send(result)
  })
}
