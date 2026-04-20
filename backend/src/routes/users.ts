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

  // GET /users/:id
  fastify.get('/users/:id', { preHandler: authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const userId = parseInt(id, 10)
    if (isNaN(userId)) return reply.code(400).send({ message: '無効なユーザーIDです' })

    const user = await buildUserResponse(userId)
    if (!user) return reply.code(404).send({ message: 'ユーザーが見つかりません' })
    return reply.send(user)
  })
}
