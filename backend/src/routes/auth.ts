import { FastifyInstance } from 'fastify'
import bcrypt from 'bcryptjs'
import axios from 'axios'
import prisma from '../lib/prisma.js'
import { signToken } from '../lib/auth.js'
import { authenticate } from '../lib/middleware.js'
import { buildUserResponse } from '../lib/userBuilder.js'
import { issueOtpAndSend, verifyOtp } from './twofa.js'

export async function authRoutes(fastify: FastifyInstance) {
  // POST /auth/signup
  fastify.post('/auth/signup', async (request, reply) => {
    const { nickname, email, password } = request.body as {
      nickname?: string
      email?: string
      password?: string
    }

    if (!nickname || !email || !password) {
      return reply.code(400).send({ message: 'nickname, email, password は必須です' })
    }
    if (typeof nickname !== 'string' || nickname.length < 2 || nickname.length > 20) {
      return reply.code(400).send({ message: 'nickname は 2〜20 文字で入力してください' })
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (typeof email !== 'string' || email.length > 255 || !emailRegex.test(email)) {
      return reply.code(400).send({ message: 'email の形式が正しくありません' })
    }
    if (typeof password !== 'string' || password.length < 8 || password.length > 128) {
      return reply.code(400).send({ message: 'password は 8〜128 文字で入力してください' })
    }

    const existing = await prisma.users.findUnique({ where: { email } })
    if (existing) {
      return reply.code(409).send({ message: 'このメールアドレスは既に使用されています' })
    }

    const existingNickname = await prisma.users.findUnique({ where: { nickname } })
    if (existingNickname) {
      return reply.code(409).send({ message: 'このニックネームは既に使用されています' })
    }

    const activeStatus = await prisma.statuses.findFirst({
      where: { category: 'user', name: 'active' },
    })
    if (!activeStatus) {
      return reply.code(500).send({ message: 'ステータスマスターが初期化されていません' })
    }

    const hashedPassword = await bcrypt.hash(password, 12)

    const user = await prisma.users.create({
      data: {
        email,
        name: nickname,
        nickname,
        statusId: activeStatus.id,
      },
    })

    await prisma.accounts.create({
      data: {
        userId: user.id,
        provider: 'local',
        providerAccountId: String(user.id),
        statusId: activeStatus.id,
        passwordHash: hashedPassword,
      },
    })

    const token = signToken({ userId: user.id, email: user.email })
    const userResponse = await buildUserResponse(user.id)
    return reply.code(201).send({ token, user: userResponse })
  })

  // POST /auth/login
  fastify.post('/auth/login', async (request, reply) => {
    const { email, password } = request.body as { email?: string; password?: string }

    if (!email || !password) {
      return reply.code(400).send({ message: 'email と password は必須です' })
    }
    if (typeof email !== 'string' || typeof password !== 'string' ||
        email.length > 255 || password.length > 128) {
      return reply.code(400).send({ message: '入力値が不正です' })
    }

    const user = await prisma.users.findUnique({ where: { email } })
    if (!user) {
      return reply.code(401).send({ message: 'メールアドレスまたはパスワードが正しくありません' })
    }

    const account = await prisma.accounts.findFirst({
      where: { userId: user.id, provider: 'local' },
    })
    if (!account || !account.passwordHash) {
      return reply.code(401).send({ message: 'メールアドレスまたはパスワードが正しくありません' })
    }

    const valid = await bcrypt.compare(password, account.passwordHash)
    if (!valid) {
      return reply.code(401).send({ message: 'メールアドレスまたはパスワードが正しくありません' })
    }

    // 2FA が有効な場合: OTP をメール送信し、仮トークンを返す
    if (user.isTwoFactorEnabled) {
      await issueOtpAndSend(user.id, user.email, user.nickname)
      const tempToken = signToken({
        userId: user.id,
        email: user.email,
        twoFaPending: true,
      } as any)
      // メールアドレスを部分マスクして返す（UI表示用）
      const maskedEmail = user.email.replace(/^(.{1,2})[^@]*(@.*)$/, '$1***$2')
      return reply.send({ requires2fa: true, tempToken, email: maskedEmail })
    }

    const token = signToken({ userId: user.id, email: user.email })
    const userResponse = await buildUserResponse(user.id)
    return reply.send({ token, user: userResponse })
  })

  // POST /auth/2fa/challenge — 2FA ログインチャレンジ
  fastify.post('/auth/2fa/challenge', async (request, reply) => {
    const { tempToken, code } = request.body as { tempToken?: string; code?: string }
    if (!tempToken || !code) {
      return reply.code(400).send({ message: 'tempToken と code は必須です' })
    }

    let payload: any
    try {
      const { verifyToken } = await import('../lib/auth.js')
      payload = verifyToken(tempToken)
    } catch {
      return reply.code(401).send({ message: 'トークンが無効または期限切れです' })
    }

    if (!payload.twoFaPending) {
      return reply.code(400).send({ message: '2FA チャレンジが不要なトークンです' })
    }

    const user = await prisma.users.findUnique({ where: { id: payload.userId } })
    if (!user || !user.isTwoFactorEnabled) {
      return reply.code(401).send({ message: '2FA が設定されていません' })
    }

    const valid = await verifyOtp(user.id, code.trim())
    if (!valid) return reply.code(401).send({ message: 'コードが正しくないか期限切れです' })

    const token = signToken({ userId: user.id, email: user.email })
    const userResponse = await buildUserResponse(user.id)
    return reply.send({ token, user: userResponse })
  })

  // POST /auth/2fa/resend — ログイン途中で OTP を再送
  fastify.post('/auth/2fa/resend', async (request, reply) => {
    const { tempToken } = request.body as { tempToken?: string }
    if (!tempToken) return reply.code(400).send({ message: 'tempToken は必須です' })

    let payload: any
    try {
      const { verifyToken } = await import('../lib/auth.js')
      payload = verifyToken(tempToken)
    } catch {
      return reply.code(401).send({ message: 'トークンが無効または期限切れです' })
    }
    if (!payload.twoFaPending) {
      return reply.code(400).send({ message: '2FA チャレンジが不要なトークンです' })
    }

    const user = await prisma.users.findUnique({ where: { id: payload.userId } })
    if (!user || !user.isTwoFactorEnabled) {
      return reply.code(401).send({ message: '2FA が設定されていません' })
    }

    await issueOtpAndSend(user.id, user.email, user.nickname)
    return reply.send({ message: '確認コードを再送しました' })
  })

  // POST /auth/logout
  fastify.post('/auth/logout', { preHandler: authenticate }, async (_request, reply) => {
    return reply.send(null)
  })

  // GET /auth/42 — 42 OAuth 開始
  fastify.get('/auth/42', async (_request, reply) => {
    const clientId = process.env.INTRA42_CLIENT_ID
    const redirectUri = process.env.INTRA42_REDIRECT_URI || 'https://localhost:8443/api/auth/42/callback'
    if (!clientId) {
      return reply.code(503).send({ message: '42 OAuth が設定されていません' })
    }
    const state = Math.random().toString(36).slice(2)
    const url = `https://api.intra.42.fr/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&state=${state}`
    return reply.redirect(url)
  })

  // GET /auth/42/callback — 42 OAuth コールバック
  fastify.get('/auth/42/callback', async (request, reply) => {
    const { code } = request.query as { code?: string }
    if (!code) {
      return reply.redirect(`${process.env.FRONTEND_URL || 'https://localhost:8443'}/login?error=oauth_failed`)
    }

    try {
      const tokenRes = await axios.post('https://api.intra.42.fr/oauth/token', {
        grant_type: 'authorization_code',
        client_id: process.env.INTRA42_CLIENT_ID,
        client_secret: process.env.INTRA42_CLIENT_SECRET,
        code,
        redirect_uri: process.env.INTRA42_REDIRECT_URI,
      })
      const tokenData = tokenRes.data as { access_token: string }
      const accessToken = tokenData.access_token

      const meRes = await axios.get('https://api.intra.42.fr/v2/me', {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      const meData = meRes.data as { id: number; email: string; login: string; image?: { link?: string } }
      const { id: intraId, email, login, image } = meData

      const activeStatus = await prisma.statuses.findFirst({
        where: { category: 'user', name: 'active' },
      })
      if (!activeStatus) throw new Error('Status not seeded')

      let user = await prisma.users.findUnique({ where: { email } })
      if (!user) {
        user = await prisma.users.create({
          data: {
            email,
            name: login,
            nickname: login,
            pictureURL: image?.link ?? null,
            statusId: activeStatus.id,
          },
        })
      }

      const existing42Account = await prisma.accounts.findUnique({
        where: { provider_providerAccountId: { provider: 'intra42', providerAccountId: String(intraId) } },
      })
      if (!existing42Account) {
        await prisma.accounts.create({
          data: {
            userId: user.id,
            provider: 'intra42',
            providerAccountId: String(intraId),
            statusId: activeStatus.id,
          },
        })
      }

      const token = signToken({ userId: user.id, email: user.email })
      const frontendUrl = process.env.FRONTEND_URL || 'https://localhost:8443'
      return reply.redirect(`${frontendUrl}/dashboard?token=${token}`)
    } catch (err) {
      fastify.log.error(err)
      return reply.redirect(`${process.env.FRONTEND_URL || 'https://localhost:8443'}/login?error=oauth_failed`)
    }
  })
}
