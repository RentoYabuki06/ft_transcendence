import Fastify, { FastifyInstance, RouteShorthandOptions } from 'fastify'
import { PrismaClient } from '@prisma/client'

const server: FastifyInstance = Fastify({
  logger: true
})

const prisma = new PrismaClient()


/*
レスポンススキーマ定義
*/

// ヘルスチェックレスポンススキーマ
const healthResponseSchema = {
  type: 'object',
  properties: {
    status: { type: 'string' },
    timestamp: { type: 'string' },
    uptime: { type: 'number' }
  }
} as const

const opts: RouteShorthandOptions = {
  schema: {
    response: {
      200: {
        type: 'object',
        properties: {
          pong: {
            type: 'string'
          }
        }
      }
    }
  }
}

const healthOpts: RouteShorthandOptions = {
  schema: {
    response: {
      200: healthResponseSchema,
      503: healthResponseSchema
    }
  }
}

// ヘルスチェックのメタデータを生成する関数
const createHealthMetadata = () => {
  const timestamp: Date = new Date()
  const timestamp_string: string = timestamp.toISOString()
  const uptime: number = process.uptime()
  
  return {
    timestamp: timestamp_string,
    uptime: uptime
  }
}

server.get('/health', healthOpts, async (_request, reply) => {
  try {
    // DB接続チェック
    await prisma.$queryRaw`SELECT 1`
    
    const metadata = createHealthMetadata()
    
    return { 
      status: 'ok',
      ...metadata
    }
  } catch (error) {
    const metadata = createHealthMetadata()
    
    reply.code(503)
    return {
      status: 'error',
      ...metadata
    }
  }
})

server.get('/ping', opts, async () => {
  return { pong: 'it worked!' }
})

const start = async () => {
  try {
    const port: number = parseInt(process.env.PORT || '3000', 10)
    const host: string = process.env.HOST || '0.0.0.0'
    
    await server.listen({ port: port, host: host })
    
    console.log(`Server is running on http://${host}:${port}`)
  } catch (err) {
    server.log.error(err)
    process.exit(1)
  }
}

// サーバー終了時にPrisma接続をクリーンアップ
process.on('beforeExit', async () => {
  await prisma.$disconnect()
})

start()