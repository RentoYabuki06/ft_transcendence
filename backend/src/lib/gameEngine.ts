// サーバー権威モデルの Pong 物理エンジン。
// - 60Hz 固定ステップ
// - 毎ステップでサブステップ化し、高速ボールでもトンネリングしない swept 衝突判定
// - スコア・勝敗判定もサーバー側
// - クライアントは snapshot(30Hz) を補間してレンダリングするだけ

export const WIDTH = 800
export const HEIGHT = 500
export const PADDLE_WIDTH = 12
export const PADDLE_HEIGHT = 80
export const BALL_RADIUS = 10
export const PADDLE_X_LEFT = 20
export const PADDLE_X_RIGHT = WIDTH - 20 - PADDLE_WIDTH
export const PADDLE_SPEED = 360 // px/sec
export const BALL_INIT_SPEED = 280 // px/sec
export const BALL_SPEEDUP = 1.05
export const BALL_MAX_SPEED = 900
export const WIN_SCORE = 11
export const TICK_MS = 1000 / 60
export const SNAPSHOT_MS = 1000 / 30
export const COUNTDOWN_MS = 3000
export const SERVE_OFFSET_X = 80

export type Side = 'left' | 'right'
export type Phase = 'waiting' | 'countdown' | 'serving' | 'rally' | 'finished'

export interface GameState {
  ball: { x: number; y: number; vx: number; vy: number }
  paddleLeft: number
  paddleRight: number
  inputLeft: { up: boolean; down: boolean }
  inputRight: { up: boolean; down: boolean }
  scoreLeft: number
  scoreRight: number
  phase: Phase
  serveSide: Side | null
  countdownEndsAt: number | null
  winnerSide: Side | null
  lastUpdate: number
}

export function createInitialState(): GameState {
  return {
    ball: { x: WIDTH / 2, y: HEIGHT / 2, vx: 0, vy: 0 },
    paddleLeft: HEIGHT / 2 - PADDLE_HEIGHT / 2,
    paddleRight: HEIGHT / 2 - PADDLE_HEIGHT / 2,
    inputLeft: { up: false, down: false },
    inputRight: { up: false, down: false },
    scoreLeft: 0,
    scoreRight: 0,
    phase: 'waiting',
    serveSide: null,
    countdownEndsAt: null,
    winnerSide: null,
    lastUpdate: Date.now(),
  }
}

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v))
}

export function placeBallForServe(state: GameState): void {
  if (!state.serveSide) return
  state.ball.x =
    state.serveSide === 'left'
      ? PADDLE_X_LEFT + PADDLE_WIDTH + SERVE_OFFSET_X
      : PADDLE_X_RIGHT - SERVE_OFFSET_X
  state.ball.y = HEIGHT / 2
  state.ball.vx = 0
  state.ball.vy = 0
}

export function launchBall(state: GameState): boolean {
  if (state.phase !== 'serving' || !state.serveSide) return false
  const dir = state.serveSide === 'left' ? 1 : -1
  // ±30° の範囲でランダム
  const angle = (Math.random() - 0.5) * (Math.PI / 3)
  state.ball.vx = BALL_INIT_SPEED * dir * Math.cos(angle)
  state.ball.vy = BALL_INIT_SPEED * Math.sin(angle)
  state.phase = 'rally'
  return true
}

export function tick(state: GameState, now: number): void {
  const dt = Math.min(0.05, (now - state.lastUpdate) / 1000)
  state.lastUpdate = now

  // パドル更新（どのフェーズでも入力を反映。待機中の暇つぶしにも）
  const dyL = (state.inputLeft.down ? 1 : 0) - (state.inputLeft.up ? 1 : 0)
  const dyR = (state.inputRight.down ? 1 : 0) - (state.inputRight.up ? 1 : 0)
  state.paddleLeft = clamp(state.paddleLeft + dyL * PADDLE_SPEED * dt, 0, HEIGHT - PADDLE_HEIGHT)
  state.paddleRight = clamp(state.paddleRight + dyR * PADDLE_SPEED * dt, 0, HEIGHT - PADDLE_HEIGHT)

  if (state.phase === 'countdown') {
    if (state.countdownEndsAt !== null && now >= state.countdownEndsAt) {
      state.phase = 'serving'
      state.countdownEndsAt = null
      placeBallForServe(state)
    }
    return
  }

  if (state.phase !== 'rally') return

  // サブステップ化: 1ステップでのボール移動が「パドル幅」or「ボール半径」の半分を超えないように
  const speed = Math.hypot(state.ball.vx, state.ball.vy)
  const maxMovePerStep = Math.min(BALL_RADIUS, PADDLE_WIDTH) * 0.5
  const steps = Math.max(1, Math.ceil((speed * dt) / maxMovePerStep))
  const subDt = dt / steps
  for (let i = 0; i < steps; i++) {
    stepBall(state, subDt)
    if (state.phase !== 'rally') break
  }
}

function stepBall(state: GameState, dt: number): void {
  const ball = state.ball
  const prevX = ball.x
  const prevY = ball.y
  ball.x += ball.vx * dt
  ball.y += ball.vy * dt

  // 上下壁
  if (ball.y - BALL_RADIUS <= 0) {
    ball.y = BALL_RADIUS
    ball.vy = Math.abs(ball.vy)
  } else if (ball.y + BALL_RADIUS >= HEIGHT) {
    ball.y = HEIGHT - BALL_RADIUS
    ball.vy = -Math.abs(ball.vy)
  }

  // 左パドル (swept)
  const leftCollisionX = PADDLE_X_LEFT + PADDLE_WIDTH + BALL_RADIUS
  if (ball.vx < 0 && ball.x <= leftCollisionX && prevX > leftCollisionX) {
    const denom = prevX - ball.x
    const t = denom > 0 ? (prevX - leftCollisionX) / denom : 0
    const hitY = prevY + (ball.y - prevY) * t
    if (
      hitY + BALL_RADIUS >= state.paddleLeft &&
      hitY - BALL_RADIUS <= state.paddleLeft + PADDLE_HEIGHT
    ) {
      ball.x = leftCollisionX
      ball.y = hitY
      const newVx = Math.min(BALL_MAX_SPEED, Math.abs(ball.vx) * BALL_SPEEDUP)
      ball.vx = newVx
      const rel = clamp(
        (hitY - (state.paddleLeft + PADDLE_HEIGHT / 2)) / (PADDLE_HEIGHT / 2),
        -1,
        1,
      )
      ball.vy = rel * BALL_INIT_SPEED
    }
  }

  // 右パドル (swept)
  const rightCollisionX = PADDLE_X_RIGHT - BALL_RADIUS
  if (ball.vx > 0 && ball.x >= rightCollisionX && prevX < rightCollisionX) {
    const denom = ball.x - prevX
    const t = denom > 0 ? (rightCollisionX - prevX) / denom : 0
    const hitY = prevY + (ball.y - prevY) * t
    if (
      hitY + BALL_RADIUS >= state.paddleRight &&
      hitY - BALL_RADIUS <= state.paddleRight + PADDLE_HEIGHT
    ) {
      ball.x = rightCollisionX
      ball.y = hitY
      const newVx = Math.min(BALL_MAX_SPEED, Math.abs(ball.vx) * BALL_SPEEDUP)
      ball.vx = -newVx
      const rel = clamp(
        (hitY - (state.paddleRight + PADDLE_HEIGHT / 2)) / (PADDLE_HEIGHT / 2),
        -1,
        1,
      )
      ball.vy = rel * BALL_INIT_SPEED
    }
  }

  // 得点
  if (ball.x < -BALL_RADIUS) {
    state.scoreRight++
    onScore(state, 'left')
  } else if (ball.x > WIDTH + BALL_RADIUS) {
    state.scoreLeft++
    onScore(state, 'right')
  }
}

function onScore(state: GameState, loserSide: Side): void {
  if (state.scoreLeft >= WIN_SCORE || state.scoreRight >= WIN_SCORE) {
    state.phase = 'finished'
    state.winnerSide = state.scoreLeft >= WIN_SCORE ? 'left' : 'right'
    state.ball.vx = 0
    state.ball.vy = 0
    return
  }
  state.phase = 'serving'
  state.serveSide = loserSide
  placeBallForServe(state)
}

// 30Hz で broadcast する state snapshot。数値は丸めて帯域を抑える
export interface StateSnapshot {
  type: 'state'
  t: number
  ball: [number, number, number, number] // x, y, vx, vy
  pl: number // paddleLeft.y
  pr: number // paddleRight.y
  sl: number // scoreLeft
  sr: number // scoreRight
  p: Phase
  ss: Side | null // serveSide
  cd: number | null // 残カウントダウン(ms)
  w: Side | null // winner
}

export function buildSnapshot(state: GameState): StateSnapshot {
  const now = Date.now()
  const remainingCd =
    state.phase === 'countdown' && state.countdownEndsAt !== null
      ? Math.max(0, state.countdownEndsAt - now)
      : null
  const r = (n: number) => Math.round(n * 10) / 10
  return {
    type: 'state',
    t: now,
    ball: [r(state.ball.x), r(state.ball.y), r(state.ball.vx), r(state.ball.vy)],
    pl: r(state.paddleLeft),
    pr: r(state.paddleRight),
    sl: state.scoreLeft,
    sr: state.scoreRight,
    p: state.phase,
    ss: state.serveSide,
    cd: remainingCd,
    w: state.winnerSide,
  }
}
