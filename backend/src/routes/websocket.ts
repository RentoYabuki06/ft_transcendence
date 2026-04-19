import { FastifyInstance } from 'fastify'
import { WebSocket } from '@fastify/websocket'
import { verifyToken } from '../lib/auth.js'
import prisma from '../lib/prisma.js'

// --- 接続管理 ---
// presenceMap: userId -> WebSocket (オンライン状態)
const presenceMap = new Map<number, WebSocket>()
// matchmakingMap: userId -> WebSocket (マッチング通知待ち)
const matchmakingMap = new Map<number, WebSocket>()
// gameRooms: gameId -> Map<userId, WebSocket> (ゲームルーム)
const gameRooms = new Map<number, Map<number, WebSocket>>()

// --- ヘルパー ---
function broadcast(map: Map<number, WebSocket>, data: unknown) {
  const msg = JSON.stringify(data)
  for (const ws of map.values()) {
    if (ws.readyState === ws.OPEN) ws.send(msg)
  }
}

function sendToUser(map: Map<number, WebSocket>, userId: number, data: unknown) {
  const ws = map.get(userId)
  if (ws && ws.readyState === ws.OPEN) {
    ws.send(JSON.stringify(data))
  }
}

function authenticateWs(token: string): number | null {
  try {
    const payload = verifyToken(token)
    return payload.userId
  } catch {
    return null
  }
}

// --- エクスポート: マッチング成立時に外部から通知する ---
export function notifyMatchFound(
  userId1: number,
  userId2: number,
  gameId: number,
  opponent1: { id: number; nickname: string; avatarUrl: string | null },
  opponent2: { id: number; nickname: string; avatarUrl: string | null },
) {
  sendToUser(matchmakingMap, userId1, { type: 'matched', gameId, opponent: opponent2 })
  sendToUser(matchmakingMap, userId2, { type: 'matched', gameId, opponent: opponent1 })
}

export async function websocketRoutes(fastify: FastifyInstance) {
  // ----------------------------------------------------------------
  // WS /ws/presence — オンライン状態 broadcast
  // ----------------------------------------------------------------
  fastify.get('/ws/presence', { websocket: true }, (socket, request) => {
    const token = (request.query as Record<string, string>).token
    const userId = token ? authenticateWs(token) : null
    if (!userId) {
      socket.send(JSON.stringify({ type: 'error', message: '認証が必要です' }))
      socket.close()
      return
    }

    presenceMap.set(userId, socket)

    // 全接続ユーザーに「online になった」を通知
    broadcast(presenceMap, { type: 'presence', userId, status: 'online' })

    // 現在オンラインのユーザー一覧を送信
    const onlineUsers = [...presenceMap.keys()]
    socket.send(JSON.stringify({ type: 'presence_list', onlineUsers }))

    socket.on('close', () => {
      presenceMap.delete(userId)
      broadcast(presenceMap, { type: 'presence', userId, status: 'offline' })
    })

    socket.on('error', () => {
      presenceMap.delete(userId)
    })
  })

  // ----------------------------------------------------------------
  // WS /ws/matchmaking — マッチング成立通知
  // ----------------------------------------------------------------
  fastify.get('/ws/matchmaking', { websocket: true }, (socket, request) => {
    const token = (request.query as Record<string, string>).token
    const userId = token ? authenticateWs(token) : null
    if (!userId) {
      socket.send(JSON.stringify({ type: 'error', message: '認証が必要です' }))
      socket.close()
      return
    }

    matchmakingMap.set(userId, socket)
    socket.send(JSON.stringify({ type: 'waiting', message: '対戦相手を探しています...' }))

    socket.on('close', () => {
      matchmakingMap.delete(userId)
    })

    socket.on('error', () => {
      matchmakingMap.delete(userId)
    })
  })

  // ----------------------------------------------------------------
  // WS /ws/game/:id — ゲームリアルタイム同期
  // ----------------------------------------------------------------
  fastify.get('/ws/game/:id', { websocket: true }, async (socket, request) => {
    const token = (request.query as Record<string, string>).token
    const userId = token ? authenticateWs(token) : null
    if (!userId) {
      socket.send(JSON.stringify({ type: 'error', message: '認証が必要です' }))
      socket.close()
      return
    }

    const gameId = parseInt((request.params as Record<string, string>).id, 10)
    if (isNaN(gameId)) {
      socket.send(JSON.stringify({ type: 'error', message: '無効なゲームIDです' }))
      socket.close()
      return
    }

    // ゲームの参加者か確認
    const score = await prisma.playerScores.findFirst({ where: { gameId, userId } })
    if (!score) {
      socket.send(JSON.stringify({ type: 'error', message: 'このゲームに参加していません' }))
      socket.close()
      return
    }

    // ゲームルームに追加
    if (!gameRooms.has(gameId)) gameRooms.set(gameId, new Map())
    const room = gameRooms.get(gameId)!
    room.set(userId, socket)

    socket.send(JSON.stringify({ type: 'connected', gameId, userId }))

    // 両プレイヤーが揃ったらゲーム開始通知
    if (room.size === 2) {
      const players = [...room.keys()]
      broadcast(room, { type: 'game_start', gameId, players })
    }

    socket.on('message', async (rawMsg: Buffer) => {
      try {
        const msg = JSON.parse(rawMsg.toString()) as {
          type: string
          paddleY?: number
          score?: { [userId: number]: number }
          winnerId?: number
        }

        if (msg.type === 'paddle_move') {
          // パドル移動を相手に転送
          const room = gameRooms.get(gameId)
          if (room) {
            for (const [pid, ws] of room.entries()) {
              if (pid !== userId && ws.readyState === ws.OPEN) {
                ws.send(JSON.stringify({ type: 'opponent_paddle', paddleY: msg.paddleY, from: userId }))
              }
            }
          }
        } else if (msg.type === 'game_over' && msg.winnerId) {
          // ゲーム終了処理
          await handleGameOver(gameId, msg.winnerId, room)
        }
      } catch {
        // JSON parse error は無視
      }
    })

    socket.on('close', () => {
      const room = gameRooms.get(gameId)
      if (room) {
        room.delete(userId)
        if (room.size === 0) gameRooms.delete(gameId)
        else {
          broadcast(room, { type: 'opponent_disconnected', userId })
        }
      }
    })

    socket.on('error', () => {
      const room = gameRooms.get(gameId)
      if (room) {
        room.delete(userId)
        if (room.size === 0) gameRooms.delete(gameId)
      }
    })
  })
}

// ゲーム終了処理（スコア記録・実績解除）
async function handleGameOver(
  gameId: number,
  winnerId: number,
  room: Map<number, WebSocket>,
) {
  const finishedStatus = await prisma.statuses.findFirst({
    where: { category: 'game', name: 'finished' },
  })
  if (!finishedStatus) return

  await prisma.games.update({
    where: { id: gameId },
    data: { statusId: finishedStatus.id, winnerId },
  })

  // PlayerScores の isWinner を更新
  const scores = await prisma.playerScores.findMany({ where: { gameId } })
  for (const s of scores) {
    await prisma.playerScores.update({
      where: { id: s.id },
      data: { isWinner: s.userId === winnerId },
    })
  }

  // 実績チェック
  for (const playerId of [...room.keys()]) {
    await checkAndUnlockAchievements(playerId)
  }

  broadcast(room, { type: 'game_finished', gameId, winnerId })
}

// --- 実績チェック・解除 ---
export async function checkAndUnlockAchievements(userId: number) {
  const scores = await prisma.playerScores.findMany({ where: { userId } })
  const wins = scores.filter(s => s.isWinner).length
  const friends = await prisma.friendships.findMany({ where: { userId } })
  const user = await prisma.users.findUnique({ where: { id: userId } })

  const allAchievements = await prisma.achievements.findMany()
  const unlocked = await prisma.userAchievements.findMany({ where: { userId } })
  const unlockedKeys = new Set(
    unlocked.map(u => allAchievements.find(a => a.id === u.achievementId)?.key)
  )

  const toUnlock: string[] = []
  if (wins >= 1) toUnlock.push('first_win')
  if (wins >= 10) toUnlock.push('ten_wins')
  if (wins >= 50) toUnlock.push('fifty_wins')
  if (friends.length >= 1) toUnlock.push('social')
  if (user?.isTwoFactorEnabled) toUnlock.push('two_fa')

  for (const key of toUnlock) {
    if (!unlockedKeys.has(key)) {
      const achievement = allAchievements.find(a => a.key === key)
      if (achievement) {
        await prisma.userAchievements.upsert({
          where: { userId_achievementId: { userId, achievementId: achievement.id } },
          update: {},
          create: { userId, achievementId: achievement.id },
        })
      }
    }
  }
}
