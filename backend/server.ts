import 'dotenv/config'
import path from 'path'
import { fileURLToPath } from 'url'
import Fastify from 'fastify'
import cors from '@fastify/cors'
import multipart from '@fastify/multipart'
import staticFiles from '@fastify/static'
import prisma from './src/lib/prisma.js'
import { authRoutes } from './src/routes/auth.js'
import { userRoutes } from './src/routes/users.js'
import { friendRoutes } from './src/routes/friends.js'
import { gameRoutes } from './src/routes/games.js'
import { matchmakingRoutes } from './src/routes/matchmaking.js'
import { achievementRoutes } from './src/routes/achievements.js'
import { twofaRoutes } from './src/routes/twofa.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const server = Fastify({ logger: true })

// --- Plugins ---
await server.register(cors, {
  origin: [
    process.env.FRONTEND_URL || 'http://localhost:5173',
    'http://localhost:3000',
  ],
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization'],
})

await server.register(multipart, { limits: { fileSize: 5 * 1024 * 1024 } })

// Serve uploaded avatars
const uploadsDir = path.resolve(__dirname, 'uploads')
await server.register(staticFiles, { root: uploadsDir, prefix: '/uploads/' })

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

// --- Routes ---
await server.register(authRoutes)
await server.register(userRoutes)
await server.register(friendRoutes)
await server.register(gameRoutes)
await server.register(matchmakingRoutes)
await server.register(achievementRoutes)
await server.register(twofaRoutes)

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
