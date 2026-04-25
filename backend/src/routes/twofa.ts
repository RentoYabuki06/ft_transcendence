import { FastifyInstance } from 'fastify'
import bcrypt from 'bcryptjs'
import prisma from '../lib/prisma.js'
import { authenticate } from '../lib/middleware.js'
import { sendMail, generateOtpCode } from '../lib/mailer.js'

const OTP_TTL_MS = 10 * 60 * 1000 // 10分

async function issueOtpAndSend(userId: number, email: string, nickname: string): Promise<void> {
  const code = generateOtpCode()
  const hash = await bcrypt.hash(code, 8)
  await prisma.users.update({
    where: { id: userId },
    data: {
      twoFactorCode: hash,
      twoFactorCodeExpiresAt: new Date(Date.now() + OTP_TTL_MS),
    },
  })
  await sendMail({
    to: email,
    subject: '【ft_transcendence】2段階認証コード',
    text: `${nickname} さん\n\nログイン用の確認コードです:\n\n    ${code}\n\nこのコードは 10 分間有効です。本人の操作でない場合はこのメールを無視してください。`,
  })
}

async function verifyOtp(userId: number, code: string): Promise<boolean> {
  const user = await prisma.users.findUnique({ where: { id: userId } })
  if (!user || !user.twoFactorCode || !user.twoFactorCodeExpiresAt) return false
  if (user.twoFactorCodeExpiresAt.getTime() < Date.now()) return false
  const ok = await bcrypt.compare(code, user.twoFactorCode)
  if (!ok) return false
  // 使い捨て: 成功したら即無効化
  await prisma.users.update({
    where: { id: userId },
    data: { twoFactorCode: null, twoFactorCodeExpiresAt: null },
  })
  return true
}

export async function twofaRoutes(fastify: FastifyInstance) {
  // POST /users/me/2fa/setup — 有効化のための確認コードをメール送信
  fastify.post('/users/me/2fa/setup', { preHandler: authenticate }, async (request, reply) => {
    const userId = (request as any).userId as number
    const user = await prisma.users.findUnique({ where: { id: userId } })
    if (!user) return reply.code(404).send({ message: 'ユーザーが見つかりません' })

    await issueOtpAndSend(user.id, user.email, user.nickname)
    return reply.send({ message: `${user.email} に確認コードを送信しました`, email: user.email })
  })

  // POST /users/me/2fa/verify — 届いたコードを検証して 2FA を有効化
  fastify.post('/users/me/2fa/verify', { preHandler: authenticate }, async (request, reply) => {
    const userId = (request as any).userId as number
    const { code } = request.body as { code?: string }
    if (!code || typeof code !== 'string') {
      return reply.code(400).send({ message: 'code は必須です' })
    }

    const ok = await verifyOtp(userId, code.trim())
    if (!ok) return reply.code(401).send({ message: 'コードが正しくないか期限切れです' })

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
      data: {
        isTwoFactorEnabled: false,
        twoFactorCode: null,
        twoFactorCodeExpiresAt: null,
      },
    })
    return reply.send({ message: '2FA を無効にしました' })
  })
}

// auth ルートから再利用するため export
export { issueOtpAndSend, verifyOtp }
