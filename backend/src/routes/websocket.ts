import { FastifyInstance } from 'fastify'
import { WebSocket } from '@fastify/websocket'
import { verifyToken } from '../lib/auth.js'
import prisma from '../lib/prisma.js'
import {
  buildSnapshot,
  COUNTDOWN_MS,
  createInitialState,
  GameState,
  launchBall,
  Side,
  SNAPSHOT_MS,
  tick,
  TICK_MS,
} from '../lib/gameEngine.js'
import { advanceTournament } from '../lib/tournament.js'

// --- 接続管理 ---
// presenceMap: userId -> WebSocket (オンライン状態)
const presenceMap = new Map<number, WebSocket>()
// matchmakingMap: userId -> WebSocket (マッチング通知待ち)
const matchmakingMap = new Map<number, WebSocket>()

// --- ゲームインスタンス ---
interface GameInstance {
  id: number
  leftId: number
  rightId: number
  sockets: Map<number, WebSocket> // userId -> socket
  state: GameState
  tickInterval: NodeJS.Timeout | null
  snapshotInterval: NodeJS.Timeout | null
  finishing: boolean
  playerGraceTimers: Map<number, NodeJS.Timeout>
  roomDropTimer: NodeJS.Timeout | null
}

const gameInstances = new Map<number, GameInstance>()

const PLAYER_GRACE_MS = 60_000 // 片方切断の猶予（ホーム→再マッチで戻るフローに備えて長めに設定）
const ROOM_DROP_MS = 60_000    // 両者切断の猶予
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
  // WS /ws/game/:id — ゲームリアルタイム同期（サーバー権威モデル）
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

    // 参加者確認 & 並び取得（playerScores.id 昇順を左右の順とみなす）
    const participants = await prisma.playerScores.findMany({
      where: { gameId },
      orderBy: { id: 'asc' },
    })
    if (participants.length !== 2 || !participants.some(p => p.userId === userId)) {
      socket.send(JSON.stringify({ type: 'error', message: 'このゲームに参加していません' }))
      socket.close()
      return
    }

    const gameRow = await prisma.games.findUnique({ where: { id: gameId } })
    const finishedStatusCheck = await prisma.statuses.findFirst({
      where: { category: 'game', name: 'finished' },
    })
    if (gameRow && finishedStatusCheck && gameRow.statusId === finishedStatusCheck.id) {
      socket.send(JSON.stringify({ type: 'error', message: 'この試合は既に終了しています' }))
      socket.close()
      return
    }

    // インスタンス取得 or 生成
    let inst = gameInstances.get(gameId)
    if (!inst) {
      inst = {
        id: gameId,
        leftId: participants[0].userId,
        rightId: participants[1].userId,
        sockets: new Map(),
        state: createInitialState(),
        tickInterval: null,
        snapshotInterval: null,
        finishing: false,
        playerGraceTimers: new Map(),
        roomDropTimer: null,
      }
      gameInstances.set(gameId, inst)
    }

    const side: Side = userId === inst.leftId ? 'left' : 'right'

    // 既存ソケットを置き換え（再接続）
    // 再接続判定は「ゲームが進行中(=phase !== 'waiting')」で行う。
    // 切断時に inst.sockets から userId を削除しているため、
    // previousSocket の有無だけでは再接続を検知できない。
    const previousSocket = inst.sockets.get(userId)
    const isReconnect = inst.state.phase !== 'waiting'
    if (previousSocket && previousSocket !== socket && previousSocket.readyState === previousSocket.OPEN) {
      try { previousSocket.close() } catch { /* ignore */ }
    }
    inst.sockets.set(userId, socket)

    // 猶予タイマーをキャンセル
    const gt = inst.playerGraceTimers.get(userId)
    if (gt) {
      clearTimeout(gt)
      inst.playerGraceTimers.delete(userId)
    }
    if (inst.roomDropTimer) {
      clearTimeout(inst.roomDropTimer)
      inst.roomDropTimer = null
    }

    socket.send(JSON.stringify({
      type: 'connected',
      gameId,
      yourSide: side,
      players: { left: inst.leftId, right: inst.rightId },
      reconnect: isReconnect,
    }))

    if (isReconnect) {
      // 再接続通知 + 最新snapshotを即送信
      for (const [pid, ws] of inst.sockets.entries()) {
        if (pid !== userId && ws.readyState === ws.OPEN) {
          ws.send(JSON.stringify({ type: 'opponent_reconnected', userId }))
        }
      }
      socket.send(JSON.stringify(buildSnapshot(inst.state)))
    } else if (inst.sockets.size === 2 && inst.state.phase === 'waiting') {
      inst.state.phase = 'countdown'
      inst.state.countdownEndsAt = Date.now() + COUNTDOWN_MS
      inst.state.serveSide = Math.random() < 0.5 ? 'left' : 'right'
      inst.state.lastUpdate = Date.now()
      broadcastInstance(inst, {
        type: 'game_start',
        players: { left: inst.leftId, right: inst.rightId },
        countdownEndsAt: inst.state.countdownEndsAt,
        serveSide: inst.state.serveSide,
      })
      startGameLoops(inst)
    }

    socket.on('message', (rawMsg: Buffer) => {
      if (!inst) return
      try {
        const msg = JSON.parse(rawMsg.toString())
        const input = side === 'left' ? inst.state.inputLeft : inst.state.inputRight
        if (msg.type === 'input') {
          input.up = !!msg.up
          input.down = !!msg.down
        } else if (msg.type === 'serve') {
          if (inst.state.phase === 'serving' && inst.state.serveSide === side) {
            launchBall(inst.state)
          }
        } else if (msg.type === 'resign') {
          // 相手が勝者、即終了
          inst.state.phase = 'finished'
          inst.state.winnerSide = side === 'left' ? 'right' : 'left'
          // 次の tick で finalize が呼ばれる
        }
      } catch {
        // JSON parse error は無視
      }
    })

    socket.on('close', () => {
      if (!inst) return
      // 既に別 socket に置き換わっている場合は何もしない（再接続パス）
      if (inst.sockets.get(userId) !== socket) return
      inst.sockets.delete(userId)

      // 入力状態クリア（押しっぱなしで消えるのを防ぐ）
      const input = side === 'left' ? inst.state.inputLeft : inst.state.inputRight
      input.up = false
      input.down = false

      if (inst.state.phase === 'finished' || inst.state.phase === 'waiting') {
        // 終了済み or 未開始: 両者いなければクリーンアップ
        if (inst.sockets.size === 0 && inst.state.phase === 'waiting') {
          stopGameLoops(inst)
          gameInstances.delete(gameId)
        }
        return
      }

      if (inst.sockets.size === 0) {
        // 両者切断 → ROOM_DROP_MS の猶予
        // 先に設定されていた片方向の graceTimer は、
        // 両者切断では ROOM_DROP_MS 側を優先するため解除する。
        for (const t of inst.playerGraceTimers.values()) clearTimeout(t)
        inst.playerGraceTimers.clear()
        broadcastInstance(inst, {
          type: 'opponent_disconnected',
          userId,
          graceSeconds: ROOM_DROP_MS / 1000,
        })
        if (inst.roomDropTimer) clearTimeout(inst.roomDropTimer)
        inst.roomDropTimer = setTimeout(() => {
          if (!inst) return
          if (inst.sockets.size > 0) return
          // 放棄: winner=null で終了
          inst.state.phase = 'finished'
          inst.state.winnerSide = null
          // finalize は tick で拾われる
        }, ROOM_DROP_MS)
        return
      }

      // 片方残存: PLAYER_GRACE_MS の猶予
      broadcastInstance(inst, {
        type: 'opponent_disconnected',
        userId,
        graceSeconds: PLAYER_GRACE_MS / 1000,
      })
      const existing = inst.playerGraceTimers.get(userId)
      if (existing) clearTimeout(existing)
      inst.playerGraceTimers.set(
        userId,
        setTimeout(() => {
          if (!inst) return
          if (inst.sockets.has(userId)) return // 再接続済み
          inst.state.phase = 'finished'
          inst.state.winnerSide = side === 'left' ? 'right' : 'left'
          // finalize は tick で拾われる
        }, PLAYER_GRACE_MS),
      )
    })

    socket.on('error', () => {
      // close が別途呼ばれるのでここでは何もしない
    })
  })
}

// インスタンス向け broadcast
function broadcastInstance(inst: GameInstance, data: unknown) {
  const msg = JSON.stringify(data)
  for (const ws of inst.sockets.values()) {
    if (ws.readyState === ws.OPEN) ws.send(msg)
  }
}

// 60Hz 物理 tick と 30Hz snapshot broadcast を開始
function startGameLoops(inst: GameInstance) {
  if (inst.tickInterval) return
  inst.tickInterval = setInterval(() => {
    tick(inst.state, Date.now())
    if (inst.state.phase === 'finished' && !inst.finishing) {
      inst.finishing = true
      finalizeGame(inst).catch(err => {
        console.error('finalizeGame error:', err)
      })
    }
  }, TICK_MS)
  inst.snapshotInterval = setInterval(() => {
    if (inst.sockets.size === 0) return
    broadcastInstance(inst, buildSnapshot(inst.state))
  }, SNAPSHOT_MS)
}

function stopGameLoops(inst: GameInstance) {
  if (inst.tickInterval) {
    clearInterval(inst.tickInterval)
    inst.tickInterval = null
  }
  if (inst.snapshotInterval) {
    clearInterval(inst.snapshotInterval)
    inst.snapshotInterval = null
  }
}

// ゲーム終了: DB 保存 → 通知 → 後片付け
async function finalizeGame(inst: GameInstance) {
  const finishedStatus = await prisma.statuses.findFirst({
    where: { category: 'game', name: 'finished' },
  })
  if (!finishedStatus) return

  const winnerId =
    inst.state.winnerSide === 'left' ? inst.leftId
    : inst.state.winnerSide === 'right' ? inst.rightId
    : null

  const game = await prisma.games.findUnique({ where: { id: inst.id } })
  const tournamentId = game?.tournamentId ?? null
  if (game && game.statusId !== finishedStatus.id) {
    await prisma.games.update({
      where: { id: inst.id },
      data: { statusId: finishedStatus.id, winnerId },
    })
    const playerScores = await prisma.playerScores.findMany({ where: { gameId: inst.id } })
    for (const ps of playerScores) {
      const isLeftPlayer = ps.userId === inst.leftId
      await prisma.playerScores.update({
        where: { id: ps.id },
        data: {
          isWinner: winnerId !== null && ps.userId === winnerId,
          statusId: finishedStatus.id,
          score: isLeftPlayer ? inst.state.scoreLeft : inst.state.scoreRight,
        },
      })
    }

    // 通常対戦時のみ待機部屋をクリーンアップ
    // (トーナメントは waitingRoom を経由しないため不要)
    if (tournamentId === null) {
      const participantUserIds = [inst.leftId, inst.rightId]
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
    }

    // トーナメント試合だった場合、次ラウンド生成 or 優勝判定
    if (tournamentId !== null) {
      try {
        await advanceTournament(tournamentId)
      } catch (e) {
        console.error('advanceTournament error:', e)
      }
    }
  }

  // 最終 snapshot と game_finished を broadcast
  broadcastInstance(inst, buildSnapshot(inst.state))
  broadcastInstance(inst, {
    type: 'game_finished',
    winnerId,
    scoreLeft: inst.state.scoreLeft,
    scoreRight: inst.state.scoreRight,
    tournamentId,
  })

  // 実績チェック
  for (const pid of [inst.leftId, inst.rightId]) {
    try {
      await checkAndUnlockAchievements(pid)
    } catch {
      /* ignore */
    }
  }

  stopGameLoops(inst)

  // タイマー類クリア
  for (const t of inst.playerGraceTimers.values()) clearTimeout(t)
  inst.playerGraceTimers.clear()
  if (inst.roomDropTimer) {
    clearTimeout(inst.roomDropTimer)
    inst.roomDropTimer = null
  }

  // 少し待ってからソケットを閉じてインスタンス削除
  setTimeout(() => {
    for (const ws of inst.sockets.values()) {
      try {
        if (ws.readyState === ws.OPEN) ws.close()
      } catch {
        /* ignore */
      }
    }
    gameInstances.delete(inst.id)
  }, 1000)
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
