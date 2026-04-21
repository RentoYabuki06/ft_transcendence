import { FastifyInstance } from 'fastify'
import { WebSocket } from '@fastify/websocket'
import { verifyToken } from '../lib/auth.js'
import prisma from '../lib/prisma.js'

// WINNING_SCORE はフロント側で定義（11点先取）

// --- 接続管理 ---
// presenceMap: userId -> WebSocket (オンライン状態)
const presenceMap = new Map<number, WebSocket>()
// matchmakingMap: userId -> WebSocket (マッチング通知待ち)
const matchmakingMap = new Map<number, WebSocket>()
// gameRooms: gameId -> Map<userId, WebSocket> (ゲームルーム)
const gameRooms = new Map<number, Map<number, WebSocket>>()
// gameScores: gameId -> Map<userId, score> (最新スコア、切断時のレコード保存用)
const gameScores = new Map<number, Map<number, number>>()
// gameHosts: gameId -> userId (各試合のホスト。score_update/ball_update を正当化するため)
const gameHosts = new Map<number, number>()
// gameStarted: gameId -> true (game_start を既に送信した試合)
const gameStarted = new Map<number, boolean>()
// disconnectTimers: gameId -> Map<userId, Timeout> (切断猶予タイマー)
const disconnectTimers = new Map<number, Map<number, NodeJS.Timeout>>()
// roomDropTimers: gameId -> Timeout (両者切断時のルーム削除タイマー)
const roomDropTimers = new Map<number, NodeJS.Timeout>()

const PLAYER_GRACE_MS = 15_000 // 片方切断の猶予
const ROOM_DROP_MS = 60_000    // 両者切断の猶予

function clearPlayerTimer(gameId: number, userId: number) {
  const map = disconnectTimers.get(gameId)
  const t = map?.get(userId)
  if (t) {
    clearTimeout(t)
    map!.delete(userId)
    if (map!.size === 0) disconnectTimers.delete(gameId)
  }
}

function clearRoomDropTimer(gameId: number) {
  const t = roomDropTimers.get(gameId)
  if (t) {
    clearTimeout(t)
    roomDropTimers.delete(gameId)
  }
}
// chatMap: userId -> Set<WebSocket> (チャットリアルタイム配信、複数タブ対応)
const chatMap = new Map<number, Set<WebSocket>>()

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

// --- エクスポート: チャット着信 ---
export function deliverChatMessage(
  receiverId: number,
  payload: { id: number; senderId: number; receiverId: number; body: string; createdAt: string },
) {
  const sockets = chatMap.get(receiverId)
  if (!sockets) return
  const msg = JSON.stringify({ type: 'chat_message', ...payload })
  for (const ws of sockets) {
    if (ws.readyState === ws.OPEN) ws.send(msg)
  }
}

export async function websocketRoutes(fastify: FastifyInstance) {
  // ----------------------------------------------------------------
  // WS /ws/chat — チャット配信
  // ----------------------------------------------------------------
  fastify.get('/ws/chat', { websocket: true }, (socket, request) => {
    const token = (request.query as Record<string, string>).token
    const userId = token ? authenticateWs(token) : null
    if (!userId) {
      socket.send(JSON.stringify({ type: 'error', message: '認証が必要です' }))
      socket.close()
      return
    }
    if (!chatMap.has(userId)) chatMap.set(userId, new Set())
    chatMap.get(userId)!.add(socket)
    const removeSocket = () => {
      const set = chatMap.get(userId)
      if (!set) return
      set.delete(socket)
      if (set.size === 0) chatMap.delete(userId)
    }
    socket.on('close', removeSocket)
    socket.on('error', removeSocket)
  })

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

    // 接続時点で既にマッチ済みなら matched を再送（通知取りこぼし対策）
    ;(async () => {
      const matchedStatus = await prisma.statuses.findFirst({
        where: { category: 'waitroom', name: 'matched' },
      })
      if (!matchedStatus) return
      const myParticipation = await prisma.waitingRoomParticipants.findFirst({
        where: { userId },
      })
      if (!myParticipation) return
      const room = await prisma.waitingRooms.findUnique({ where: { id: myParticipation.waitingRoomId } })
      if (!room || room.statusId !== matchedStatus.id) return
      const peers = await prisma.waitingRoomParticipants.findMany({ where: { waitingRoomId: room.id } })
      const opponentId = peers.find(p => p.userId !== userId)?.userId
      if (!opponentId) return
      const pendingGameStatus = await prisma.statuses.findFirst({ where: { category: 'game', name: 'pending' } })
      if (!pendingGameStatus) return
      const score = await prisma.playerScores.findFirst({
        where: { userId, statusId: pendingGameStatus.id },
        orderBy: { id: 'desc' },
      })
      if (!score) return
      // 試合がまだ pending 状態であることを確認（終了済みなら送らない）
      const pendingGame = await prisma.games.findUnique({ where: { id: score.gameId } })
      if (!pendingGame || pendingGame.statusId !== pendingGameStatus.id) return
      const opp = await prisma.users.findUnique({ where: { id: opponentId } })
      socket.send(JSON.stringify({
        type: 'matched',
        gameId: score.gameId,
        opponent: opp ? { id: opp.id, nickname: opp.nickname, avatarUrl: opp.pictureURL } : null,
      }))
    })().catch(() => {})

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

    // 既に終了している試合には接続を許可しない
    const gameState = await prisma.games.findUnique({ where: { id: gameId } })
    const finishedStatusCheck = await prisma.statuses.findFirst({
      where: { category: 'game', name: 'finished' },
    })
    if (gameState && finishedStatusCheck && gameState.statusId === finishedStatusCheck.id) {
      socket.send(JSON.stringify({ type: 'error', message: 'この試合は既に終了しています' }))
      socket.close()
      return
    }

    // ゲームルームに追加（既存ソケットがあれば再接続扱い）
    if (!gameRooms.has(gameId)) gameRooms.set(gameId, new Map())
    const room = gameRooms.get(gameId)!
    const previousSocket = room.get(userId)
    const isReconnect = !!previousSocket && gameStarted.get(gameId) === true
    if (previousSocket && previousSocket !== socket && previousSocket.readyState === previousSocket.OPEN) {
      try { previousSocket.close() } catch { /* ignore */ }
    }
    room.set(userId, socket)

    // 猶予タイマーをキャンセル
    clearPlayerTimer(gameId, userId)
    clearRoomDropTimer(gameId)

    socket.send(JSON.stringify({ type: 'connected', gameId, userId, reconnect: isReconnect }))

    if (isReconnect) {
      // 再接続を相手に通知し、最新スコアを送って state を復元
      const known = gameScores.get(gameId)
      const host = gameHosts.get(gameId)
      for (const [pid, ws] of room.entries()) {
        if (pid !== userId && ws.readyState === ws.OPEN) {
          ws.send(JSON.stringify({ type: 'opponent_reconnected', userId }))
        }
      }
      socket.send(JSON.stringify({
        type: 'game_resumed',
        gameId,
        hostId: host,
        scores: known ? Object.fromEntries(known) : {},
      }))
    } else if (room.size === 2 && !gameStarted.get(gameId)) {
      const players = [...room.keys()]
      // 最初に入室したプレイヤー = ホスト（score_update/ball_update の送信権を持つ）
      gameHosts.set(gameId, players[0])
      gameStarted.set(gameId, true)
      broadcast(room, { type: 'game_start', gameId, players })
    }

    socket.on('message', async (rawMsg: Buffer) => {
      try {
        const msg = JSON.parse(rawMsg.toString()) as {
          type: string
          paddleY?: number
          score?: { [userId: number]: number }
          winnerId?: number | null
          myScore?: number
          opponentScore?: number
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
        } else if (msg.type === 'score_update') {
          // ホスト以外からの score_update は無視（改ざん防止）
          if (gameHosts.get(gameId) !== userId) return
          // ホストがスコアを通知 → ゲストに転送、切断時のスコア記録用に保存
          const room = gameRooms.get(gameId)
          if (room) {
            // 送信者(ホスト)視点: myScore = 送信者, opponentScore = 相手
            let scoreMap = gameScores.get(gameId)
            if (!scoreMap) {
              scoreMap = new Map()
              gameScores.set(gameId, scoreMap)
            }
            scoreMap.set(userId, msg.myScore ?? 0)
            for (const pid of room.keys()) {
              if (pid !== userId) scoreMap.set(pid, msg.opponentScore ?? 0)
            }
            for (const [pid, ws] of room.entries()) {
              if (pid !== userId && ws.readyState === ws.OPEN) {
                ws.send(JSON.stringify({ type: 'score_update', myScore: msg.myScore, opponentScore: msg.opponentScore, from: userId }))
              }
            }
          }
        } else if (msg.type === 'serve_ready' || msg.type === 'serve_launch') {
          const room = gameRooms.get(gameId)
          if (room) {
            for (const [pid, ws] of room.entries()) {
              if (pid !== userId && ws.readyState === ws.OPEN) {
                ws.send(JSON.stringify({ ...msg, from: userId }))
              }
            }
          }
        } else if (msg.type === 'ball_update') {
          // ホスト以外からの ball_update は無視
          if (gameHosts.get(gameId) !== userId) return
          // ボール位置をゲストに転送（ホストのみ送信）
          const room = gameRooms.get(gameId)
          if (room) {
            for (const [pid, ws] of room.entries()) {
              if (pid !== userId && ws.readyState === ws.OPEN) {
                ws.send(JSON.stringify({ ...msg, from: userId }))
              }
            }
          }
        } else if (msg.type === 'match_result') {
          // ホストのみ決着を通知可能
          if (gameHosts.get(gameId) !== userId) return
          const senderScore = msg.myScore ?? 0
          const opponentScore = msg.opponentScore ?? 0
          const opponentId = [...room.keys()].find((id) => id !== userId)
          const winnerId =
            typeof msg.winnerId === 'number'
              ? msg.winnerId
              : senderScore >= opponentScore
                ? userId
                : (opponentId ?? userId)
          const scores = new Map<number, number>()
          scores.set(userId, senderScore)
          if (opponentId !== undefined) scores.set(opponentId, opponentScore)
          await handleGameOver(gameId, winnerId, room, scores)
        } else if (msg.type === 'resign') {
          // 送信者の降参 → 相手が勝者
          const opponentId = [...room.keys()].find((id) => id !== userId)
          const winnerId = opponentId ?? userId
          const known = gameScores.get(gameId)
          const scores = new Map<number, number>()
          scores.set(userId, known?.get(userId) ?? 0)
          if (opponentId !== undefined) scores.set(opponentId, known?.get(opponentId) ?? 0)
          await handleGameOver(gameId, winnerId, room, scores)
        }
      } catch {
        // JSON parse error は無視
      }
    })

    socket.on('close', async () => {
      const room = gameRooms.get(gameId)
      if (!room) return
      // 既に置き換わっている（再接続）場合は何もしない
      if (room.get(userId) !== socket) return
      room.delete(userId)

      // 試合が既に finished なら掃除して終わり
      const finishedStatus = await prisma.statuses.findFirst({
        where: { category: 'game', name: 'finished' },
      })
      const game = await prisma.games.findUnique({ where: { id: gameId } })
      const isFinished = !!(game && finishedStatus && game.statusId === finishedStatus.id)
      if (isFinished || !gameStarted.get(gameId)) {
        if (room.size === 0) {
          gameRooms.delete(gameId)
          gameStarted.delete(gameId)
          gameHosts.delete(gameId)
          gameScores.delete(gameId)
        }
        return
      }

      if (room.size === 0) {
        // 両者切断 → ROOM_DROP_MS 経過しても誰も戻らなければ試合をドロップ（pending のまま掃除）
        broadcast(room, { type: 'opponent_disconnected', userId, graceSeconds: ROOM_DROP_MS / 1000 })
        clearRoomDropTimer(gameId)
        roomDropTimers.set(
          gameId,
          setTimeout(async () => {
            roomDropTimers.delete(gameId)
            const r = gameRooms.get(gameId)
            if (r && r.size > 0) return // 誰か戻った
            // 両者不在のまま時間切れ → 試合を放棄扱いにして finished（winner=null）
            const finished = await prisma.statuses.findFirst({
              where: { category: 'game', name: 'finished' },
            })
            if (finished) {
              const g = await prisma.games.findUnique({ where: { id: gameId } })
              if (g && g.statusId !== finished.id) {
                await prisma.games.update({
                  where: { id: gameId },
                  data: { statusId: finished.id, winnerId: null },
                })
                await prisma.playerScores.updateMany({
                  where: { gameId },
                  data: { statusId: finished.id, isWinner: false },
                })
              }
            }
            gameRooms.delete(gameId)
            gameStarted.delete(gameId)
            gameHosts.delete(gameId)
            gameScores.delete(gameId)
          }, ROOM_DROP_MS)
        )
        return
      }

      // 片方だけ切断 → 残存側に猶予タイマーの通知、一定時間後に forfeit
      broadcast(room, {
        type: 'opponent_disconnected',
        userId,
        graceSeconds: PLAYER_GRACE_MS / 1000,
      })
      let timerMap = disconnectTimers.get(gameId)
      if (!timerMap) {
        timerMap = new Map()
        disconnectTimers.set(gameId, timerMap)
      }
      // 既存タイマーがあれば置き換え
      const existing = timerMap.get(userId)
      if (existing) clearTimeout(existing)
      timerMap.set(
        userId,
        setTimeout(async () => {
          const r = gameRooms.get(gameId)
          if (!r) return
          if (r.has(userId)) return // 再接続済み
          const winnerId = [...r.keys()][0]
          if (!winnerId) return
          const known = gameScores.get(gameId)
          const scores = new Map<number, number>()
          scores.set(winnerId, known?.get(winnerId) ?? 0)
          scores.set(userId, known?.get(userId) ?? 0)
          await handleGameOver(gameId, winnerId, r, scores)
          clearPlayerTimer(gameId, userId)
        }, PLAYER_GRACE_MS)
      )
    })

    socket.on('error', () => {
      // 実質 close と同じパスを通るのでここでは room から消さない
    })
  })
}

// ゲーム終了処理（スコア記録・実績解除）
async function handleGameOver(
  gameId: number,
  winnerId: number,
  room: Map<number, WebSocket>,
  scoresByUser?: Map<number, number>,
) {
  const finishedStatus = await prisma.statuses.findFirst({
    where: { category: 'game', name: 'finished' },
  })
  if (!finishedStatus) return

  // 二重処理防止: 既に finished なら何もしない
  const game = await prisma.games.findUnique({ where: { id: gameId } })
  if (!game || game.statusId === finishedStatus.id) return

  await prisma.games.update({
    where: { id: gameId },
    data: { statusId: finishedStatus.id, winnerId },
  })

  // PlayerScores の isWinner とスコアを更新（statusId も finished に）
  const scores = await prisma.playerScores.findMany({ where: { gameId } })
  for (const s of scores) {
    await prisma.playerScores.update({
      where: { id: s.id },
      data: {
        isWinner: s.userId === winnerId,
        statusId: finishedStatus.id,
        ...(scoresByUser?.has(s.userId) ? { score: scoresByUser.get(s.userId)! } : {}),
      },
    })
  }

  // 試合に関連する待機部屋レコードをクリーンアップ（再マッチ時の干渉防止）
  const participantUserIds = scores.map(s => s.userId)
  const stalePairs = await prisma.waitingRoomParticipants.findMany({
    where: { userId: { in: participantUserIds } },
  })
  const staleRoomIds = [...new Set(stalePairs.map(p => p.waitingRoomId))]
  if (staleRoomIds.length > 0) {
    await prisma.waitingRoomParticipants.deleteMany({
      where: { waitingRoomId: { in: staleRoomIds } },
    })
    await prisma.waitingRooms.deleteMany({
      where: { id: { in: staleRoomIds } },
    })
  }

  // 実績チェック
  for (const playerId of [...room.keys()]) {
    await checkAndUnlockAchievements(playerId)
  }

  broadcast(room, { type: 'game_finished', gameId, winnerId })
  gameScores.delete(gameId)
  gameHosts.delete(gameId)
  gameStarted.delete(gameId)
  // 進行中タイマーもクリア
  const tmap = disconnectTimers.get(gameId)
  if (tmap) {
    for (const t of tmap.values()) clearTimeout(t)
    disconnectTimers.delete(gameId)
  }
  clearRoomDropTimer(gameId)
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
