import path from 'path'
import fs from 'fs/promises'
import { FastifyInstance } from 'fastify'
import bcrypt from 'bcryptjs'
import prisma from '../lib/prisma.js'
import { authenticate } from '../lib/middleware.js'
import { buildUserResponse } from '../lib/userBuilder.js'

const UPLOADS_DIR = path.resolve(process.cwd(), 'uploads')

export async function userRoutes(fastify: FastifyInstance) {
  // GET /users/me
  fastify.get('/users/me', { preHandler: authenticate }, async (request, reply) => {
    const userId = (request as any).userId as number
    const user = await buildUserResponse(userId)
    if (!user) return reply.code(404).send({ message: 'ユーザーが見つかりません' })
    return reply.send(user)
  })

  // PUT /users/me
  fastify.put('/users/me', { preHandler: authenticate }, async (request, reply) => {
    const userId = (request as any).userId as number
    const { nickname, email, password } = request.body as {
      nickname?: string
      email?: string
      password?: string
    }

    const updateData: Record<string, unknown> = {}
    if (nickname) updateData.nickname = nickname
    if (email) {
      const existing = await prisma.users.findFirst({ where: { email, NOT: { id: userId } } })
      if (existing) return reply.code(409).send({ message: 'このメールアドレスは既に使用されています' })
      updateData.email = email
    }

    if (Object.keys(updateData).length > 0) {
      await prisma.users.update({ where: { id: userId }, data: updateData })
    }

    if (password) {
      if (password.length < 8) {
        return reply.code(400).send({ message: 'パスワードは8文字以上にしてください' })
      }
      const hashedPassword = await bcrypt.hash(password, 12)
      await prisma.accounts.updateMany({
        where: { userId, provider: 'local' },
        data: { passwordHash: hashedPassword },
      })
    }

    const user = await buildUserResponse(userId)
    return reply.send(user)
  })

  // PUT /users/me/password — 現在のパスワードを検証して変更
  fastify.put('/users/me/password', { preHandler: authenticate }, async (request, reply) => {
    const userId = (request as any).userId as number
    const { currentPassword, newPassword } = request.body as {
      currentPassword?: string
      newPassword?: string
    }
    if (!currentPassword || !newPassword) {
      return reply.code(400).send({ message: '現在のパスワードと新しいパスワードを入力してください' })
    }
    if (newPassword.length < 8 || newPassword.length > 128) {
      return reply.code(400).send({ message: '新しいパスワードは8文字以上128文字以下にしてください' })
    }

    const account = await prisma.accounts.findFirst({ where: { userId, provider: 'local' } })
    if (!account) {
      return reply.code(400).send({ message: 'ローカルパスワードが設定されていません' })
    }

    const valid = await bcrypt.compare(currentPassword, account.passwordHash ?? '')
    if (!valid) {
      return reply.code(401).send({ message: '現在のパスワードが正しくありません' })
    }

    const hashedPassword = await bcrypt.hash(newPassword, 12)
    await prisma.accounts.update({ where: { id: account.id }, data: { passwordHash: hashedPassword } })

    return reply.send({ message: 'パスワードを変更しました' })
  })

  // POST /users/me/avatar
  fastify.post('/users/me/avatar', { preHandler: authenticate }, async (request, reply) => {
    const userId = (request as any).userId as number

    const data = await request.file()
    if (!data) return reply.code(400).send({ message: 'ファイルが見つかりません' })

    const allowedMimes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
    if (!allowedMimes.includes(data.mimetype)) {
      return reply.code(400).send({ message: '対応していない画像形式です (jpeg/png/gif/webp)' })
    }

    await fs.mkdir(UPLOADS_DIR, { recursive: true })
    const ext = data.mimetype.split('/')[1]
    const filename = `avatar_${userId}_${Date.now()}.${ext}`
    const filepath = path.join(UPLOADS_DIR, filename)

    const buffer = await data.toBuffer()
    if (buffer.length > 5 * 1024 * 1024) {
      return reply.code(400).send({ message: 'ファイルサイズは5MB以下にしてください' })
    }

    await fs.writeFile(filepath, buffer)
    const avatarUrl = `/uploads/${filename}`

    await prisma.users.update({ where: { id: userId }, data: { pictureURL: avatarUrl } })
    return reply.send({ avatarUrl })
  })

  // GET /users?search=xxx — ニックネーム検索（フレンド追加用）
  fastify.get('/users', { preHandler: authenticate }, async (request, reply) => {
    const userId = (request as any).userId as number
    const { search } = request.query as { search?: string }
    if (!search || search.trim().length < 1) {
      return reply.send([])
    }
    const q = search.trim().slice(0, 50)
    const users = await prisma.users.findMany({
      where: {
        nickname: { contains: q },
        NOT: { id: userId },
      },
      take: 20,
      select: { id: true, nickname: true, pictureURL: true },
    })
    return reply.send(
      users.map((u) => ({ id: u.id, nickname: u.nickname, avatarUrl: u.pictureURL }))
    )
  })

  // GET /users/:id
  fastify.get('/users/:id', { preHandler: authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const userId = parseInt(id, 10)
    if (isNaN(userId)) return reply.code(400).send({ message: '無効なユーザーIDです' })

    const user = await buildUserResponse(userId)
    if (!user) return reply.code(404).send({ message: 'ユーザーが見つかりません' })
    return reply.send(user)
  })

  // GET /users/me/export — GDPR: 全データをJSONでエクスポート
  fastify.get('/users/me/export', { preHandler: authenticate }, async (request, reply) => {
    const userId = (request as any).userId as number
    const user = await prisma.users.findUnique({ where: { id: userId } })
    if (!user) return reply.code(404).send({ message: 'ユーザーが見つかりません' })

    const accounts = await prisma.accounts.findMany({ where: { userId } })
    const friendships = await prisma.friendships.findMany({ where: { userId } })
    const messagesSent = await prisma.messages.findMany({ where: { senderId: userId } })
    const messagesReceived = await prisma.messages.findMany({ where: { receiverId: userId } })
    const playerScores = await prisma.playerScores.findMany({ where: { userId } })
    const tournamentParticipants = await prisma.tournamentParticipants.findMany({ where: { userId } })
    const userAchievements = await prisma.userAchievements.findMany({ where: { userId } })

    const data = {
      exportedAt: new Date().toISOString(),
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        nickname: user.nickname,
        pictureURL: user.pictureURL,
        isTwoFactorEnabled: user.isTwoFactorEnabled,
        createdAt: user.createdAt,
      },
      accounts: accounts.map((a) => ({
        provider: a.provider,
        providerAccountId: a.providerAccountId,
        createdAt: a.createdAt,
      })),
      friendships,
      messagesSent,
      messagesReceived,
      playerScores,
      tournamentParticipants,
      userAchievements,
    }

    reply.header('Content-Disposition', `attachment; filename="user-${userId}-export.json"`)
    return reply.send(data)
  })

  // DELETE /users/me — GDPR: アカウントと関連データを削除
  fastify.delete('/users/me', { preHandler: authenticate }, async (request, reply) => {
    const userId = (request as any).userId as number

    const anonNickname = `deleted_user_${userId}`
    await prisma.$transaction([
      prisma.userAchievements.deleteMany({ where: { userId } }),
      prisma.friendships.deleteMany({ where: { OR: [{ userId }, { friendId: userId }] } }),
      prisma.messages.deleteMany({ where: { OR: [{ senderId: userId }, { receiverId: userId }] } }),
      prisma.waitingRoomParticipants.deleteMany({ where: { userId } }),
      prisma.tournamentParticipants.deleteMany({ where: { userId } }),
      prisma.accounts.deleteMany({ where: { userId } }),
      // 試合履歴は残すが個人識別情報を匿名化
      prisma.users.update({
        where: { id: userId },
        data: {
          email: `deleted+${userId}@example.invalid`,
          name: anonNickname,
          nickname: anonNickname,
          pictureURL: null,
          twoFactorSecret: null,
          isTwoFactorEnabled: false,
        },
      }),
    ])

    return reply.send({ message: 'アカウントを削除しました' })
  })
}
