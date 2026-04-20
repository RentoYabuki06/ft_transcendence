import 'dotenv/config'
import path from 'path'
import { fileURLToPath } from 'url'
import Fastify from 'fastify'
import cors from '@fastify/cors'
import multipart from '@fastify/multipart'
import staticFiles from '@fastify/static'
import websocketPlugin from '@fastify/websocket'
import prisma from './src/lib/prisma.js'
import { authRoutes } from './src/routes/auth.js'
import { userRoutes } from './src/routes/users.js'
import { friendRoutes } from './src/routes/friends.js'
import { gameRoutes } from './src/routes/games.js'
import { matchmakingRoutes } from './src/routes/matchmaking.js'
import { achievementRoutes } from './src/routes/achievements.js'
import { twofaRoutes } from './src/routes/twofa.js'
import { tournamentRoutes } from './src/routes/tournaments.js'
import { messageRoutes } from './src/routes/messages.js'
import { websocketRoutes } from './src/routes/websocket.js'
import { legalRoutes } from './src/routes/legal.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const server = Fastify({ logger: true })

// --- Plugins ---
await server.register(cors, {
  origin: [
    process.env.FRONTEND_URL || 'http://localhost:5173',
    'http://localhost:3000',
    'https://localhost:8443',
    'http://localhost:8080',
  ],
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization'],
})

// Fastify 標準エラーハンドラ: 本番では stack を返さない
server.setErrorHandler((error: any, _request, reply) => {
  server.log.error(error)
  const statusCode = (error?.statusCode as number | undefined) ?? 500
  const message = typeof error?.message === 'string' ? error.message : 'An error occurred'
  reply.code(statusCode).send({
    message: statusCode >= 500 && process.env.NODE_ENV === 'production'
      ? 'Internal Server Error'
      : message,
  })
})

await server.register(multipart, { limits: { fileSize: 5 * 1024 * 1024 } })

// Serve uploaded avatars
const uploadsDir = path.resolve(__dirname, 'uploads')
await server.register(staticFiles, { root: uploadsDir, prefix: '/uploads/' })

// WebSocket
await server.register(websocketPlugin)

// --- Health / Ping ---
server.get('/health', async (_req, reply) => {
  try {
    await prisma.$queryRaw`SELECT 1`
    return reply.send({ status: 'ok', timestamp: new Date().toISOString(), uptime: process.uptime() })
  } catch {
    return reply.code(503).send({ status: 'error', timestamp: new Date().toISOString(), uptime: process.uptime() })
  }
})

server.get('/ping', async () => ({ pong: 'it worked!' }))

// --- REST Routes ---
await server.register(authRoutes)
await server.register(userRoutes)
await server.register(friendRoutes)
await server.register(gameRoutes)
await server.register(matchmakingRoutes)
await server.register(achievementRoutes)
await server.register(twofaRoutes)
await server.register(tournamentRoutes)
await server.register(messageRoutes)
await server.register(legalRoutes)

// --- WebSocket Routes ---
await server.register(websocketRoutes)

// --- Start ---
const port = parseInt(process.env.PORT || '3000', 10)
const host = process.env.HOST || '0.0.0.0'

try {
  await server.listen({ port, host })
  console.log(`Server running on http://${host}:${port}`)
} catch (err) {
  server.log.error(err)
  process.exit(1)
}

process.on('beforeExit', async () => {
  await prisma.$disconnect()
})
