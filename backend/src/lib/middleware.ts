import { FastifyRequest, FastifyReply } from 'fastify'
import { verifyToken } from './auth.js'

export async function authenticate(request: FastifyRequest, reply: FastifyReply) {
  const authHeader = request.headers.authorization
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    reply.code(401).send({ message: '認証が必要です' })
    return
  }
  const token = authHeader.slice(7)
  try {
    const payload = verifyToken(token)
    ;(request as any).userId = payload.userId
    ;(request as any).userEmail = payload.email
  } catch {
    reply.code(401).send({ message: 'トークンが無効または期限切れです' })
  }
}
