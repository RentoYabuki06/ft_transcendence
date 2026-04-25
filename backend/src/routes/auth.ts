import { FastifyInstance } from 'fastify'
import bcrypt from 'bcryptjs'
import axios from 'axios'
import jwt from 'jsonwebtoken'
import prisma from '../lib/prisma.js'
import { signToken } from '../lib/auth.js'
import { authenticate } from '../lib/middleware.js'
import { buildUserResponse } from '../lib/userBuilder.js'
import { issueOtpAndSend, verifyOtp } from './twofa.js'

// 42 OAuth 用の link state token: ログイン中ユーザーに 42 を紐付けたい時、
// JWT を OAuth `state` に詰めて自分の callback まで運ぶための短命トークン。
interface LinkStatePayload {
  link: true
  userId: number
  nonce: string
}

function buildAuthorizeUrl(clientId: string, redirectUri: string, state: string): string {
  return (
    `https://api.intra.42.fr/oauth/authorize` +
    `?client_id=${encodeURIComponent(clientId)}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&response_type=code` +
    `&state=${encodeURIComponent(state)}`
  )
}

// ニックネーム重複時に末尾に連番を付けて空きを探す
async function pickUniqueNickname(base: string): Promise<string> {
  const trimmed = base.slice(0, 17) // 末尾連番分の余白を確保（最大20）
  let candidate = trimmed
  let suffix = 0
  // SQLite のロック競合を避けるためループ上限を設ける
  while (suffix < 1000 && (await prisma.users.findUnique({ where: { nickname: candidate } }))) {
    suffix += 1
    candidate = `${trimmed}${suffix}`
  }
  return candidate
}

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

  // GET /auth/42 — 42 OAuth 開始（ログイン/新規登録）
  fastify.get('/auth/42', async (_request, reply) => {
    const clientId = process.env.INTRA42_CLIENT_ID
    const redirectUri = process.env.INTRA42_REDIRECT_URI || 'https://localhost:8443/api/auth/42/callback'
    if (!clientId) {
      return reply.code(503).send({ message: '42 OAuth が設定されていません' })
    }
    // ログイン用は state にランダム値だけ詰める（CSRF 対策のためのプレースホルダ）
    const state = Math.random().toString(36).slice(2)
    return reply.redirect(buildAuthorizeUrl(clientId, redirectUri, state))
  })

  // POST /auth/42/link/start — ログイン中ユーザーに 42 を紐付ける開始エンドポイント。
  // フロントは Bearer 付きで叩いて、返された url にブラウザを飛ばす。
  fastify.post('/auth/42/link/start', { preHandler: authenticate }, async (request, reply) => {
    const userId = (request as any).userId as number
    const clientId = process.env.INTRA42_CLIENT_ID
    const redirectUri = process.env.INTRA42_REDIRECT_URI || 'https://localhost:8443/api/auth/42/callback'
    if (!clientId) {
      return reply.code(503).send({ message: '42 OAuth が設定されていません' })
    }

    // 既に紐付いていれば即時エラー（無駄な OAuth ラウンドトリップを防ぐ）
    const existing = await prisma.accounts.findFirst({
      where: { userId, provider: 'intra42' },
    })
    if (existing) {
      return reply.code(409).send({ message: '既に 42 アカウントが連携されています' })
    }

    // 5 分で失効する linkState トークンを発行し、それを OAuth `state` として渡す
    const secret = process.env.JWT_SECRET
    if (!secret) return reply.code(500).send({ message: 'サーバー設定エラー' })
    const linkState = jwt.sign(
      { link: true, userId, nonce: Math.random().toString(36).slice(2) } satisfies LinkStatePayload,
      secret,
      { expiresIn: '5m' }
    )
    return reply.send({ url: buildAuthorizeUrl(clientId, redirectUri, linkState) })
  })

  // DELETE /auth/42/link — 連携解除
  fastify.delete('/auth/42/link', { preHandler: authenticate }, async (request, reply) => {
    const userId = (request as any).userId as number

    // ローカル認証手段があるかチェックしないと、42 解除した瞬間にロックアウトされる
    const localAccount = await prisma.accounts.findFirst({
      where: { userId, provider: 'local', passwordHash: { not: null } },
    })
    if (!localAccount) {
      return reply
        .code(400)
        .send({ message: 'パスワードを設定してから 42 連携を解除してください' })
    }

    await prisma.accounts.deleteMany({ where: { userId, provider: 'intra42' } })
    return reply.send({ message: '42 連携を解除しました' })
  })

  // GET /auth/42/callback — 42 OAuth コールバック
  // 通常のログイン/新規登録に加え、`state` が link トークンならログイン中ユーザーに 42 を紐付ける。
  fastify.get('/auth/42/callback', async (request, reply) => {
    const { code, state } = request.query as { code?: string; state?: string }
    const frontendUrl = process.env.FRONTEND_URL || 'https://localhost:8443'

    if (!code) {
      return reply.redirect(`${frontendUrl}/login?error=oauth_failed`)
    }

    // state が link トークンなら「設定画面からの連携モード」
    let linkUserId: number | null = null
    if (state && process.env.JWT_SECRET) {
      try {
        const payload = jwt.verify(state, process.env.JWT_SECRET) as Partial<LinkStatePayload>
        if (payload?.link === true && typeof payload.userId === 'number') {
          linkUserId = payload.userId
        }
      } catch {
        // state がただのランダム文字列（ログインモード）なら検証失敗は無視
      }
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

      // 連携モード: state.userId に対して 42 アカウントを紐付ける
      if (linkUserId !== null) {
        const existingForIntra = await prisma.accounts.findUnique({
          where: {
            provider_providerAccountId: {
              provider: 'intra42',
              providerAccountId: String(intraId),
            },
          },
        })
        if (existingForIntra && existingForIntra.userId !== linkUserId) {
          // この 42 アカウントは別ユーザーに紐付け済み
          return reply.redirect(`${frontendUrl}/profile/edit?error=already_linked_other`)
        }
        if (!existingForIntra) {
          await prisma.accounts.create({
            data: {
              userId: linkUserId,
              provider: 'intra42',
              providerAccountId: String(intraId),
              statusId: activeStatus.id,
            },
          })
        }
        return reply.redirect(`${frontendUrl}/profile/edit?linked=42`)
      }

      // 通常のログイン/新規登録モード:
      // 1) 42 アカウントが既に存在 → そのユーザーでログイン
      // 2) email が一致するユーザー → そのユーザーに 42 を紐付けてログイン
      // 3) どちらも無い → 新規ユーザー作成
      let user = null as Awaited<ReturnType<typeof prisma.users.findUnique>>

      const existing42 = await prisma.accounts.findUnique({
        where: {
          provider_providerAccountId: { provider: 'intra42', providerAccountId: String(intraId) },
        },
      })
      if (existing42) {
        user = await prisma.users.findUnique({ where: { id: existing42.userId } })
      }

      if (!user) {
        user = await prisma.users.findUnique({ where: { email } })
      }

      if (!user) {
        // ニックネーム重複時はサフィックスで回避（既存ローカルユーザーと衝突しても落ちないように）
        const nickname = await pickUniqueNickname(login)
        user = await prisma.users.create({
          data: {
            email,
            name: login,
            nickname,
            pictureURL: image?.link ?? null,
            statusId: activeStatus.id,
          },
        })
      }

      if (!existing42) {
        await prisma.accounts.create({
          data: {
            userId: user.id,
            provider: 'intra42',
            providerAccountId: String(intraId),
            statusId: activeStatus.id,
          },
        })
      }

      const jwtToken = signToken({ userId: user.id, email: user.email })
      return reply.redirect(`${frontendUrl}/dashboard?token=${jwtToken}`)
    } catch (err) {
      fastify.log.error(err)
      const dest = linkUserId !== null
        ? `${frontendUrl}/profile/edit?error=oauth_failed`
        : `${frontendUrl}/login?error=oauth_failed`
      return reply.redirect(dest)
    }
  })
}
