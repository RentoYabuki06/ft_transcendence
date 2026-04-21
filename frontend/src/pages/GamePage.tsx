import { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 500;
const PADDLE_WIDTH = 12;
const PADDLE_HEIGHT = 80;
const BALL_SIZE = 10;
const PADDLE_SPEED = 6;
const BALL_SPEED_INIT = 4;
const WINNING_SCORE = 11;
const BALL_SEND_INTERVAL = 50;
const SERVE_OFFSET_X = 60;

interface GameState {
  ball: { x: number; y: number; vx: number; vy: number };
  myPaddle: { y: number };
  opponentPaddle: { y: number };
  myScore: number;
  opponentScore: number;
  running: boolean;
  serving: boolean;
  serverIsMe: boolean;
}

type ConnectionStatus = 'connecting' | 'waiting' | 'countdown' | 'playing' | 'paused' | 'reconnecting' | 'finished' | 'error';

export function GamePage() {
  const { id: gameId } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<GameState | null>(null);
  const keysRef = useRef<Set<string>>(new Set());
  const wsRef = useRef<WebSocket | null>(null);
  const isHostRef = useRef(false);
  const lastBallSendRef = useRef(0);
  // Host-only: tracks which user is currently serving
  const serverIdRef = useRef<number | null>(null);
  const playersRef = useRef<number[]>([]);
  const gameEndedRef = useRef(false);

  const [connStatus, setConnStatus] = useState<ConnectionStatus>('connecting');
  const [scores, setScores] = useState({ my: 0, opp: 0 });
  const [winner, setWinner] = useState<'me' | 'opponent' | null>(null);
  const [countdown, setCountdown] = useState<number>(0);
  const [disconnectReason, setDisconnectReason] = useState<'opponent_left' | 'network' | null>(null);
  const [pauseSeconds, setPauseSeconds] = useState<number | null>(null);
  const pauseTimerRef = useRef<number | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const intentionalCloseRef = useRef(false);
  const statusBeforePauseRef = useRef<ConnectionStatus | null>(null);
  const [servingState, setServingState] = useState<{ serving: boolean; serverIsMe: boolean }>({ serving: false, serverIsMe: false });
  const [portrait, setPortrait] = useState(() =>
    typeof window !== 'undefined' && window.innerHeight > window.innerWidth,
  );

  useEffect(() => {
    const handler = () => setPortrait(window.innerHeight > window.innerWidth);
    window.addEventListener('resize', handler);
    window.addEventListener('orientationchange', handler);
    return () => {
      window.removeEventListener('resize', handler);
      window.removeEventListener('orientationchange', handler);
    };
  }, []);

  const initGame = useCallback((): GameState => ({
    ball: { x: CANVAS_WIDTH / 2, y: CANVAS_HEIGHT / 2, vx: 0, vy: 0 },
    myPaddle: { y: CANVAS_HEIGHT / 2 - PADDLE_HEIGHT / 2 },
    opponentPaddle: { y: CANVAS_HEIGHT / 2 - PADDLE_HEIGHT / 2 },
    myScore: 0,
    opponentScore: 0,
    running: false,
    serving: false,
    serverIsMe: false,
  }), []);

  // Place ball on server's side, stopped. Host-local coordinates.
  const placeBallForServe = (state: GameState, serverIsHost: boolean) => {
    state.ball.x = serverIsHost ? SERVE_OFFSET_X + PADDLE_WIDTH + BALL_SIZE : CANVAS_WIDTH - SERVE_OFFSET_X - PADDLE_WIDTH - BALL_SIZE;
    state.ball.y = CANVAS_HEIGHT / 2;
    state.ball.vx = 0;
    state.ball.vy = 0;
    state.serving = true;
  };

  useEffect(() => {
    const token = sessionStorage.getItem('auth_token');
    if (!token || !gameId || !user) return;

    const wsUrl = `${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}/api/ws/game/${gameId}?token=${token}`;
    gameRef.current = initGame();
    intentionalCloseRef.current = false;

    const connect = () => {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;
      attachHandlers(ws);
    };

    const attachHandlers = (ws: WebSocket) => {
    ws.onopen = () => {
      reconnectAttemptsRef.current = 0;
      setConnStatus((prev) => (prev === 'reconnecting' ? 'reconnecting' : 'waiting'));
    };

    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data);
      const state = gameRef.current;

      if (msg.type === 'error') {
        // サーバー側から拒否された（試合終了済み・非参加者など）
        intentionalCloseRef.current = true;
        setDisconnectReason('network');
        setConnStatus('error');
        return;
      } else if (msg.type === 'connected') {
        setConnStatus((prev) => (prev === 'reconnecting' ? prev : 'waiting'));
      } else if (msg.type === 'game_start') {
        isHostRef.current = msg.players[0] === user.id;
        playersRef.current = msg.players;
        if (isHostRef.current) {
          // Host decides initial server
          serverIdRef.current = msg.players[Math.floor(Math.random() * 2)];
        }
        setConnStatus('countdown');
        setCountdown(3);
      } else if (msg.type === 'opponent_paddle') {
        if (state) state.opponentPaddle.y = msg.paddleY;
      } else if (msg.type === 'ball_update' && !isHostRef.current) {
        if (state) {
          state.ball.x = CANVAS_WIDTH - msg.x;
          state.ball.y = msg.y;
          state.ball.vx = -msg.vx;
          state.ball.vy = msg.vy;
          // ホストがサーブを打った → サーブ表示を解除
          if (state.serving && (msg.vx !== 0 || msg.vy !== 0)) {
            state.serving = false;
            state.serverIsMe = false;
            setServingState({ serving: false, serverIsMe: false });
          }
        }
      } else if (msg.type === 'serve_ready') {
        // Guest: mirror server's ball placement
        if (state && !isHostRef.current) {
          const myTurn = msg.serverId === user.id;
          state.ball.x = CANVAS_WIDTH - msg.ballX;
          state.ball.y = msg.ballY;
          state.ball.vx = 0;
          state.ball.vy = 0;
          state.serving = true;
          state.serverIsMe = myTurn;
          setServingState({ serving: true, serverIsMe: myTurn });
        }
      } else if (msg.type === 'serve_launch' && isHostRef.current) {
        // Host receives: guest (server) launched
        if (state && serverIdRef.current !== user.id) {
          launchBall(state, false);
          setServingState({ serving: false, serverIsMe: false });
        }
      } else if (msg.type === 'score_update') {
        if (!isHostRef.current) {
          const my = msg.opponentScore ?? 0;
          const opp = msg.myScore ?? 0;
          if (state) {
            state.myScore = my;
            state.opponentScore = opp;
          }
          setScores({ my, opp });
        }
      } else if (msg.type === 'game_finished') {
        gameEndedRef.current = true;
        intentionalCloseRef.current = true;
        if (state) state.running = false;
        if (msg.winnerId == null) {
          setWinner(null);
        } else {
          setWinner(msg.winnerId === user.id ? 'me' : 'opponent');
        }
        setConnStatus('finished');
        if (pauseTimerRef.current !== null) {
          window.clearInterval(pauseTimerRef.current);
          pauseTimerRef.current = null;
        }
        setPauseSeconds(null);
      } else if (msg.type === 'opponent_disconnected') {
        if (state) state.running = false;
        statusBeforePauseRef.current = connStatus === 'paused' ? statusBeforePauseRef.current : connStatus;
        setConnStatus('paused');
        const grace = typeof msg.graceSeconds === 'number' ? msg.graceSeconds : 15;
        setPauseSeconds(grace);
        if (pauseTimerRef.current !== null) window.clearInterval(pauseTimerRef.current);
        pauseTimerRef.current = window.setInterval(() => {
          setPauseSeconds((s) => {
            if (s === null) return null;
            if (s <= 1) {
              if (pauseTimerRef.current !== null) {
                window.clearInterval(pauseTimerRef.current);
                pauseTimerRef.current = null;
              }
              return 0;
            }
            return s - 1;
          });
        }, 1000);
      } else if (msg.type === 'opponent_reconnected') {
        if (pauseTimerRef.current !== null) {
          window.clearInterval(pauseTimerRef.current);
          pauseTimerRef.current = null;
        }
        setPauseSeconds(null);
        setConnStatus((prev) => (prev === 'paused' ? (statusBeforePauseRef.current ?? 'playing') : prev));
        if (state) state.running = true;
      } else if (msg.type === 'game_resumed') {
        // 自分が再接続したときサーバーから届く
        if (msg.scores && user) {
          const my = msg.scores[user.id] ?? 0;
          const oppId = Object.keys(msg.scores).map(Number).find((id) => id !== user.id);
          const opp = oppId !== undefined ? msg.scores[oppId] : 0;
          if (state) {
            state.myScore = my;
            state.opponentScore = opp;
          }
          setScores({ my, opp });
        }
        if (typeof msg.hostId === 'number' && user) {
          isHostRef.current = msg.hostId === user.id;
        }
        setConnStatus('playing');
        if (state) state.running = true;
      }
    };

    ws.onerror = () => {
      // onclose で再接続処理
    };
    ws.onclose = () => {
      if (intentionalCloseRef.current) return;
      // 対戦に入っていない状態で切れた場合は再接続しない
      // （サーバーからの拒否・初回接続失敗など）
      let shouldReconnect = false;
      setConnStatus((prev) => {
        if (prev === 'countdown' || prev === 'playing' || prev === 'paused' || prev === 'reconnecting') {
          shouldReconnect = true;
          return 'reconnecting';
        }
        setDisconnectReason('network');
        return 'error';
      });
      if (!shouldReconnect) return;

      const attempts = reconnectAttemptsRef.current;
      if (attempts >= 5) {
        setDisconnectReason('network');
        setConnStatus('error');
        return;
      }
      reconnectAttemptsRef.current = attempts + 1;
      const backoff = Math.min(8000, 1000 * Math.pow(2, attempts));
      window.setTimeout(() => {
        if (!intentionalCloseRef.current) connect();
      }, backoff);
    };
    };

    connect();

    return () => {
      intentionalCloseRef.current = true;
      if (pauseTimerRef.current !== null) {
        window.clearInterval(pauseTimerRef.current);
        pauseTimerRef.current = null;
      }
      wsRef.current?.close();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameId, user?.id]);

  // Launch ball from serving position. serverIsHost: true if host is server (ball goes right).
  const launchBall = (state: GameState, serverIsHost: boolean) => {
    state.ball.vx = BALL_SPEED_INIT * (serverIsHost ? 1 : -1);
    state.ball.vy = (Math.random() - 0.5) * BALL_SPEED_INIT;
    state.serving = false;
  };

  // Reload warning during active game
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (connStatus === 'playing' || connStatus === 'countdown') {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [connStatus]);

  // Countdown → start first serve
  useEffect(() => {
    if (connStatus !== 'countdown') return;
    if (countdown <= 0) {
      setConnStatus('playing');
      const state = gameRef.current;
      const ws = wsRef.current;
      if (state && isHostRef.current && ws && ws.readyState === WebSocket.OPEN) {
        const serverId = serverIdRef.current!;
        const serverIsHost = serverId === user?.id;
        placeBallForServe(state, serverIsHost);
        state.serverIsMe = serverIsHost;
        setServingState({ serving: true, serverIsMe: serverIsHost });
        ws.send(JSON.stringify({
          type: 'serve_ready',
          serverId,
          ballX: state.ball.x,
          ballY: state.ball.y,
        }));
      }
      if (state) state.running = true;
      return;
    }
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [connStatus, countdown, user?.id]);

  useEffect(() => {
    if (connStatus !== 'playing') return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;

    const handleKeyDown = (e: KeyboardEvent) => {
      keysRef.current.add(e.key);
      if (e.key === ' ' || e.code === 'Space') {
        e.preventDefault();
        const state = gameRef.current;
        const ws = wsRef.current;
        if (!state || !state.serving || !ws) return;
        if (!state.serverIsMe) return;
        if (isHostRef.current) {
          launchBall(state, true);
          setServingState({ serving: false, serverIsMe: false });
        } else if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'serve_launch' }));
          // Optimistic: stop showing serve prompt; host will drive ball via ball_update
          state.serving = false;
          setServingState({ serving: false, serverIsMe: false });
        }
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => keysRef.current.delete(e.key);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    let lastPaddleY = -1;

    function handleScore(state: GameState, hostScored: boolean) {
      const ws = wsRef.current;
      if (!ws) return;
      if (hostScored) state.myScore++;
      else state.opponentScore++;
      setScores({ my: state.myScore, opp: state.opponentScore });
      ws.send(JSON.stringify({ type: 'score_update', myScore: state.myScore, opponentScore: state.opponentScore }));

      const hostWon = state.myScore >= WINNING_SCORE;
      const guestWon = state.opponentScore >= WINNING_SCORE;
      if (hostWon || guestWon) {
        state.running = false;
        state.serving = false;
        gameEndedRef.current = true;
        const winnerId = hostWon ? user?.id : playersRef.current.find((p) => p !== user?.id);
        ws.send(JSON.stringify({
          type: 'match_result',
          winnerId,
          myScore: state.myScore,
          opponentScore: state.opponentScore,
        }));
        return;
      }

      // Alternate serve: whoever was scored against serves next
      const loserId = hostScored
        ? playersRef.current.find((p) => p !== user?.id)
        : user?.id;
      serverIdRef.current = loserId ?? serverIdRef.current;
      const serverIsHost = serverIdRef.current === user?.id;
      placeBallForServe(state, serverIsHost);
      state.serverIsMe = serverIsHost;
      setServingState({ serving: true, serverIsMe: serverIsHost });
      ws.send(JSON.stringify({
        type: 'serve_ready',
        serverId: serverIdRef.current,
        ballX: state.ball.x,
        ballY: state.ball.y,
      }));
    }

    function update() {
      const state = gameRef.current;
      const ws = wsRef.current;
      if (!state || !state.running || !ws) return;

      const keys = keysRef.current;

      const up = keys.has('w') || keys.has('W') || keys.has('ArrowUp') || keys.has('ArrowLeft') || keys.has('a') || keys.has('A');
      const down = keys.has('s') || keys.has('S') || keys.has('ArrowDown') || keys.has('ArrowRight') || keys.has('d') || keys.has('D');
      if (up) {
        state.myPaddle.y = Math.max(0, state.myPaddle.y - PADDLE_SPEED);
      }
      if (down) {
        state.myPaddle.y = Math.min(CANVAS_HEIGHT - PADDLE_HEIGHT, state.myPaddle.y + PADDLE_SPEED);
      }

      if (state.myPaddle.y !== lastPaddleY && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'paddle_move', paddleY: state.myPaddle.y }));
        lastPaddleY = state.myPaddle.y;
      }

      if (state.serving) return;

      // ゲスト側: ball_update 間のローカル補間のみ行う（衝突判定・スコアはホスト専任）
      if (!isHostRef.current) {
        state.ball.x += state.ball.vx;
        state.ball.y += state.ball.vy;
        if (state.ball.y - BALL_SIZE <= 0) {
          state.ball.y = BALL_SIZE;
          state.ball.vy = Math.abs(state.ball.vy);
        } else if (state.ball.y + BALL_SIZE >= CANVAS_HEIGHT) {
          state.ball.y = CANVAS_HEIGHT - BALL_SIZE;
          state.ball.vy = -Math.abs(state.ball.vy);
        }
        return;
      }

      // 前フレーム位置を記録して掃引衝突判定に使う
      const prevX = state.ball.x;
      const prevY = state.ball.y;
      state.ball.x += state.ball.vx;
      state.ball.y += state.ball.vy;

      // 上下壁（ball.x,y は中心、BALL_SIZE は半径）
      if (state.ball.y - BALL_SIZE <= 0) {
        state.ball.y = BALL_SIZE;
        state.ball.vy = Math.abs(state.ball.vy);
      } else if (state.ball.y + BALL_SIZE >= CANVAS_HEIGHT) {
        state.ball.y = CANVAS_HEIGHT - BALL_SIZE;
        state.ball.vy = -Math.abs(state.ball.vy);
      }

      // 左パドル: x=20 幅 PADDLE_WIDTH → 右端=20+PADDLE_WIDTH
      const leftPaddleRight = 20 + PADDLE_WIDTH;
      const leftCollisionX = leftPaddleRight + BALL_SIZE; // ボール中心がこの位置より左に来たらヒット
      if (state.ball.vx < 0 && state.ball.x <= leftCollisionX && prevX > leftCollisionX) {
        // 交差時刻 t ∈ [0,1] を求めて、その瞬間の y で判定（トンネリング対策）
        const denom = prevX - state.ball.x;
        const t = denom > 0 ? (prevX - leftCollisionX) / denom : 0;
        const hitY = prevY + (state.ball.y - prevY) * t;
        if (
          hitY + BALL_SIZE >= state.myPaddle.y &&
          hitY - BALL_SIZE <= state.myPaddle.y + PADDLE_HEIGHT
        ) {
          state.ball.x = leftCollisionX + 0.5;
          state.ball.y = hitY;
          state.ball.vx = Math.abs(state.ball.vx) * 1.05;
          const rel = (hitY - (state.myPaddle.y + PADDLE_HEIGHT / 2)) / (PADDLE_HEIGHT / 2);
          state.ball.vy = Math.max(-1, Math.min(1, rel)) * BALL_SPEED_INIT;
        }
      }

      // 右パドル: x=CANVAS_WIDTH-20-PADDLE_WIDTH 左端=CANVAS_WIDTH-20-PADDLE_WIDTH
      const rightPaddleLeft = CANVAS_WIDTH - 20 - PADDLE_WIDTH;
      const rightCollisionX = rightPaddleLeft - BALL_SIZE;
      if (state.ball.vx > 0 && state.ball.x >= rightCollisionX && prevX < rightCollisionX) {
        const denom = state.ball.x - prevX;
        const t = denom > 0 ? (rightCollisionX - prevX) / denom : 0;
        const hitY = prevY + (state.ball.y - prevY) * t;
        if (
          hitY + BALL_SIZE >= state.opponentPaddle.y &&
          hitY - BALL_SIZE <= state.opponentPaddle.y + PADDLE_HEIGHT
        ) {
          state.ball.x = rightCollisionX - 0.5;
          state.ball.y = hitY;
          state.ball.vx = -Math.abs(state.ball.vx) * 1.05;
          const rel = (hitY - (state.opponentPaddle.y + PADDLE_HEIGHT / 2)) / (PADDLE_HEIGHT / 2);
          state.ball.vy = Math.max(-1, Math.min(1, rel)) * BALL_SPEED_INIT;
        }
      }

      if (state.ball.x < -BALL_SIZE) {
        handleScore(state, false);
      } else if (state.ball.x > CANVAS_WIDTH + BALL_SIZE) {
        handleScore(state, true);
      }

      const now = Date.now();
      if (now - lastBallSendRef.current >= BALL_SEND_INTERVAL && ws.readyState === WebSocket.OPEN && !state.serving) {
        ws.send(JSON.stringify({
          type: 'ball_update',
          x: state.ball.x,
          y: state.ball.y,
          vx: state.ball.vx,
          vy: state.ball.vy,
        }));
        lastBallSendRef.current = now;
      }
    }

    function draw() {
      const state = gameRef.current;
      if (!state) return;

      ctx!.fillStyle = '#050a18';
      ctx!.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      ctx!.setLineDash([8, 8]);
      ctx!.strokeStyle = 'rgba(0, 212, 255, 0.15)';
      ctx!.lineWidth = 2;
      ctx!.beginPath();
      ctx!.moveTo(CANVAS_WIDTH / 2, 0);
      ctx!.lineTo(CANVAS_WIDTH / 2, CANVAS_HEIGHT);
      ctx!.stroke();
      ctx!.setLineDash([]);

      ctx!.shadowColor = '#00d4ff';
      ctx!.shadowBlur = 15;
      ctx!.fillStyle = '#00d4ff';
      ctx!.fillRect(20, state.myPaddle.y, PADDLE_WIDTH, PADDLE_HEIGHT);

      ctx!.shadowColor = '#8b5cf6';
      ctx!.shadowBlur = 15;
      ctx!.fillStyle = '#8b5cf6';
      ctx!.fillRect(CANVAS_WIDTH - 20 - PADDLE_WIDTH, state.opponentPaddle.y, PADDLE_WIDTH, PADDLE_HEIGHT);

      ctx!.shadowColor = '#ffffff';
      ctx!.shadowBlur = 20;
      ctx!.fillStyle = '#ffffff';
      ctx!.beginPath();
      ctx!.arc(state.ball.x, state.ball.y, BALL_SIZE, 0, Math.PI * 2);
      ctx!.fill();

      ctx!.shadowBlur = 0;
      const gradient = ctx!.createRadialGradient(
        state.ball.x, state.ball.y, 0,
        state.ball.x, state.ball.y, BALL_SIZE * 4,
      );
      gradient.addColorStop(0, 'rgba(0, 212, 255, 0.2)');
      gradient.addColorStop(1, 'rgba(0, 212, 255, 0)');
      ctx!.fillStyle = gradient;
      ctx!.beginPath();
      ctx!.arc(state.ball.x, state.ball.y, BALL_SIZE * 4, 0, Math.PI * 2);
      ctx!.fill();

      ctx!.shadowBlur = 0;
    }

    function gameLoop() {
      update();
      draw();
      animId = requestAnimationFrame(gameLoop);
    }

    animId = requestAnimationFrame(gameLoop);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [connStatus, user?.id]);

  return (
    <div className="flex flex-col items-center justify-center relative w-full" style={{ background: 'var(--color-space-deep)', minHeight: 'calc(100vh - 10rem)' }}>
      {connStatus === 'connecting' || connStatus === 'waiting' ? (
        <div className="text-center">
          <div className="font-display text-xl text-cosmic-cyan text-glow-cyan animate-pulse mb-4">
            {connStatus === 'connecting' ? '接続中...' : '対戦相手を待っています...'}
          </div>
          <p className="text-sm text-star-white/30">Game #{gameId}</p>
        </div>
      ) : null}

      {connStatus === 'error' && (
        <div className="text-center">
          <div className="font-display text-xl text-cosmic-red mb-4">
            {disconnectReason === 'opponent_left'
              ? '相手が退出しました'
              : '接続が切断されました'}
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
            <button onClick={() => navigate('/matching')} className="cosmic-btn cosmic-btn-primary">
              もう一度対戦
            </button>
            <button onClick={() => navigate('/dashboard')} className="cosmic-btn">
              ダッシュボードへ
            </button>
          </div>
        </div>
      )}

      {connStatus === 'reconnecting' && (
        <div className="text-center">
          <div className="font-display text-xl text-cosmic-cyan animate-pulse mb-4">
            サーバーに再接続中...
          </div>
          <p className="text-sm text-star-white/30">Game #{gameId}</p>
        </div>
      )}

      {(connStatus === 'countdown' || connStatus === 'playing' || connStatus === 'paused' || connStatus === 'finished') && (
        <>
          <div className="flex items-center gap-12 mb-6">
            <div className="text-center">
              <div className="font-display text-xs text-cosmic-cyan/50 tracking-widest mb-1">YOU</div>
              <div className="font-display text-5xl font-black text-cosmic-cyan text-glow-cyan">{scores.my}</div>
            </div>
            <div className="font-display text-2xl text-star-white/20">-</div>
            <div className="text-center">
              <div className="font-display text-xs text-cosmic-purple/50 tracking-widest mb-1">OPPONENT</div>
              <div className="font-display text-5xl font-black text-cosmic-purple">{scores.opp}</div>
            </div>
          </div>

          <div
            className="relative"
            style={portrait ? {
              width: 'min(calc(100vh - 14rem), calc(100vw - 2rem) * 1.6)',
              aspectRatio: '5 / 8',
              maxWidth: '500px',
              marginLeft: 'auto',
              marginRight: 'auto',
            } : {
              width: '100%',
              maxWidth: 'min(calc(100vw - 4rem), calc((100vh - 18rem) * 1.6), 800px)',
              aspectRatio: '8 / 5',
              marginLeft: 'auto',
              marginRight: 'auto',
            }}
          >
            <canvas
              ref={canvasRef}
              width={CANVAS_WIDTH}
              height={CANVAS_HEIGHT}
              className="rounded-xl"
              style={portrait ? {
                border: '1px solid rgba(0, 212, 255, 0.15)',
                boxShadow: '0 0 40px rgba(0, 212, 255, 0.05), inset 0 0 40px rgba(0, 0, 0, 0.5)',
                position: 'absolute',
                top: '50%',
                left: '50%',
                width: 'calc(100% * 8 / 5)',
                height: 'calc(100% * 5 / 8)',
                transform: 'translate(-50%, -50%) rotate(-90deg)',
                transformOrigin: 'center center',
              } : {
                border: '1px solid rgba(0, 212, 255, 0.15)',
                boxShadow: '0 0 40px rgba(0, 212, 255, 0.05), inset 0 0 40px rgba(0, 0, 0, 0.5)',
                display: 'block',
                width: '100%',
                height: '100%',
              }}
            />

            {connStatus === 'countdown' && (
              <div className="absolute inset-0 flex items-center justify-center rounded-xl" style={{ background: 'rgba(5,10,24,0.7)', backdropFilter: 'blur(2px)' }}>
                <div
                  className="font-display font-black"
                  style={{
                    fontSize: '8rem',
                    background: 'linear-gradient(135deg, #00d4ff, #ff4fd8, #b84dff)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    textShadow: '0 0 40px rgba(255,79,216,0.5)',
                    animation: 'glow-pulse 1s ease-in-out',
                  }}
                  key={countdown}
                >
                  {countdown > 0 ? countdown : 'GO!'}
                </div>
              </div>
            )}

            {connStatus === 'paused' && (
              <div className="absolute inset-0 flex flex-col items-center justify-center rounded-xl" style={{ background: 'rgba(5,10,24,0.75)', backdropFilter: 'blur(2px)', gap: '1rem' }}>
                <div className="font-display text-2xl text-cosmic-cyan text-glow-cyan">相手が切断しました</div>
                <div className="text-sm text-star-white/60">
                  {pauseSeconds !== null && pauseSeconds > 0
                    ? `${pauseSeconds} 秒以内に復帰しない場合、不戦勝になります`
                    : '不戦勝処理中...'}
                </div>
              </div>
            )}

            {connStatus === 'playing' && servingState.serving && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div
                  className="font-display"
                  style={{
                    fontSize: '1.25rem',
                    color: servingState.serverIsMe ? '#00d4ff' : '#8b5cf6',
                    textShadow: `0 0 20px ${servingState.serverIsMe ? '#00d4ff' : '#8b5cf6'}`,
                    background: 'rgba(5,10,24,0.7)',
                    padding: '0.75rem 1.25rem',
                    borderRadius: '12px',
                    letterSpacing: '0.1em',
                  }}
                >
                  {servingState.serverIsMe
                    ? 'SPACE を押してサーブ'
                    : '相手のサーブを待っています...'}
                </div>
              </div>
            )}

            {connStatus === 'finished' && (
              <div className="absolute inset-0 flex flex-col items-center justify-center rounded-xl" style={{ background: 'rgba(5,10,24,0.85)', backdropFilter: 'blur(4px)' }}>
                <h2
                  className="font-display text-4xl font-black mb-2"
                  style={{
                    background: 'linear-gradient(135deg, #00d4ff, #8b5cf6)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                  }}
                >
                  GAME OVER
                </h2>
                <p className="font-display text-lg mb-2">
                  {winner === 'me'
                    ? <span className="text-cosmic-green">あなたの勝ち!</span>
                    : winner === 'opponent'
                    ? <span className="text-cosmic-red">相手の勝ち</span>
                    : <span className="text-star-white/60">試合が中断されました</span>}
                </p>
                <div className="font-display text-3xl text-star-white mb-8">
                  {scores.my} - {scores.opp}
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button onClick={() => navigate('/matching')} className="cosmic-btn cosmic-btn-primary">
                    もう一度対戦
                  </button>
                  <button onClick={() => navigate('/dashboard')} className="cosmic-btn">
                    ダッシュボードへ
                  </button>
                </div>
              </div>
            )}
          </div>

          {(connStatus === 'playing' || connStatus === 'countdown' || connStatus === 'paused') && (
            <div className="flex justify-center mt-4">
              <button
                onClick={() => {
                  if (!confirm('本当に降参しますか？この試合は敗北として記録されます。')) return;
                  const ws = wsRef.current;
                  if (ws && ws.readyState === WebSocket.OPEN) {
                    ws.send(JSON.stringify({ type: 'resign' }));
                  }
                }}
                className="cosmic-btn"
                style={{ fontSize: '0.75rem', padding: '0.4rem 1rem', borderColor: 'rgba(251,113,133,0.3)', color: '#fb7185' }}
              >
                降参する
              </button>
            </div>
          )}

          <div className="flex items-center gap-4 mt-6 text-xs text-star-white/20 flex-wrap justify-center">
            <span className="text-cosmic-cyan/40">操作:</span>
            <kbd className="px-1.5 py-0.5 rounded border border-cosmic-cyan/20 bg-cosmic-cyan/5 text-cosmic-cyan/40 font-mono">W</kbd>
            <kbd className="px-1.5 py-0.5 rounded border border-cosmic-cyan/20 bg-cosmic-cyan/5 text-cosmic-cyan/40 font-mono">S</kbd>
            <span className="text-star-white/10">or</span>
            <kbd className="px-1.5 py-0.5 rounded border border-cosmic-cyan/20 bg-cosmic-cyan/5 text-cosmic-cyan/40 font-mono">↑</kbd>
            <kbd className="px-1.5 py-0.5 rounded border border-cosmic-cyan/20 bg-cosmic-cyan/5 text-cosmic-cyan/40 font-mono">↓</kbd>
            <span className="text-star-white/10">/ サーブ</span>
            <kbd className="px-1.5 py-0.5 rounded border border-cosmic-cyan/20 bg-cosmic-cyan/5 text-cosmic-cyan/40 font-mono">SPACE</kbd>
          </div>
        </>
      )}
    </div>
  );
}
