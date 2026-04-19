import { FastifyInstance } from 'fastify'
import speakeasy from 'speakeasy'
import qrcode from 'qrcode'
import prisma from '../lib/prisma.js'
import { authenticate } from '../lib/middleware.js'

export async function twofaRoutes(fastify: FastifyInstance) {
  // POST /users/me/2fa/setup
  fastify.post('/users/me/2fa/setup', { preHandler: authenticate }, async (request, reply) => {
    const userId = (request as any).userId as number
    const user = await prisma.users.findUnique({ where: { id: userId } })
    if (!user) return reply.code(404).send({ message: 'ユーザーが見つかりません' })

    const secret = speakeasy.generateSecret({
      name: `ft_transcendence (${user.email})`,
      length: 20,
    })

    await prisma.users.update({
      where: { id: userId },
      data: { twoFactorSecret: secret.base32 },
    })

    const qrCodeUrl = await qrcode.toDataURL(secret.otpauth_url!)
    return reply.send({ secret: secret.base32, qrCodeUrl })
  })

  // POST /users/me/2fa/verify
  fastify.post('/users/me/2fa/verify', { preHandler: authenticate }, async (request, reply) => {
    const userId = (request as any).userId as number
    const { code } = request.body as { code?: string }

    if (!code) return reply.code(400).send({ message: 'code は必須です' })

    const user = await prisma.users.findUnique({ where: { id: userId } })
    if (!user || !user.twoFactorSecret) {
      return reply.code(400).send({ message: '2FA が設定されていません。まず /users/me/2fa/setup を呼んでください' })
    }

    const valid = speakeasy.totp.verify({
      secret: user.twoFactorSecret,
      encoding: 'base32',
      token: code,
      window: 1,
    })

    if (!valid) return reply.code(401).send({ message: 'コードが正しくありません' })

    await prisma.users.update({ where: { id: userId }, data: { isTwoFactorEnabled: true } })

    const { checkAndUnlockAchievements } = await import('./websocket.js')
    await checkAndUnlockAchievements(userId)

    return reply.send({ message: '2FA が有効になりました' })
  })

  // DELETE /users/me/2fa — 2FA 無効化
  fastify.delete('/users/me/2fa', { preHandler: authenticate }, async (request, reply) => {
    const userId = (request as any).userId as number
    await prisma.users.update({
      where: { id: userId },
      data: { isTwoFactorEnabled: false, twoFactorSecret: null },
    })
    return reply.send({ message: '2FA を無効にしました' })
  })
}
