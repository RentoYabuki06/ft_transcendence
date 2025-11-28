import Fastify, { FastifyInstance, RouteShorthandOptions } from 'fastify'

const server: FastifyInstance = Fastify({
	logger: true
})

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

server.get('/health', async () => {
  return { 
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  }
})

server.get('/ping', opts, async () => {
	return { pong: 'it worked!' }
})

const start = async () => {
	try {
		await server.listen({ port:3000, host: '0.0.0.0' })
	} catch (err) {
		server.log.error(err)
		process.exit(1)
	}
}

start()