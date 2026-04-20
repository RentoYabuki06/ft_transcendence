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
const BALL_SEND_INTERVAL = 50; // ms

interface GameState {
  ball: { x: number; y: number; vx: number; vy: number };
  myPaddle: { y: number };
  opponentPaddle: { y: number };
  myScore: number;
  opponentScore: number;
  running: boolean;
}

type ConnectionStatus = 'connecting' | 'waiting' | 'playing' | 'finished' | 'error';

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

  const [connStatus, setConnStatus] = useState<ConnectionStatus>('connecting');
  const [scores, setScores] = useState({ my: 0, opp: 0 });
  const [winner, setWinner] = useState<'me' | 'opponent' | null>(null);

  const initGame = useCallback((): GameState => ({
    ball: {
      x: CANVAS_WIDTH / 2,
      y: CANVAS_HEIGHT / 2,
      vx: BALL_SPEED_INIT * (Math.random() > 0.5 ? 1 : -1),
      vy: (Math.random() - 0.5) * BALL_SPEED_INIT,
    },
    myPaddle: { y: CANVAS_HEIGHT / 2 - PADDLE_HEIGHT / 2 },
    opponentPaddle: { y: CANVAS_HEIGHT / 2 - PADDLE_HEIGHT / 2 },
    myScore: 0,
    opponentScore: 0,
    running: false,
  }), []);

  const resetBall = (state: GameState) => {
    state.ball.x = CANVAS_WIDTH / 2;
    state.ball.y = CANVAS_HEIGHT / 2;
    state.ball.vx = BALL_SPEED_INIT * (state.ball.vx > 0 ? -1 : 1);
    state.ball.vy = (Math.random() - 0.5) * BALL_SPEED_INIT;
  };

  useEffect(() => {
    const token = sessionStorage.getItem('auth_token');
    if (!token || !gameId || !user) return;

    const wsUrl = `${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}/api/ws/game/${gameId}?token=${token}`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;
    gameRef.current = initGame();

    ws.onopen = () => setConnStatus('waiting');

    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data);

      if (msg.type === 'connected') {
        setConnStatus('waiting');
      } else if (msg.type === 'game_start') {
        // 最初に接続したプレイヤーがホスト（ボール物理担当）
        isHostRef.current = msg.players[0] === user.id;
        if (gameRef.current) gameRef.current.running = true;
        setConnStatus('playing');
      } else if (msg.type === 'opponent_paddle') {
        if (gameRef.current) gameRef.current.opponentPaddle.y = msg.paddleY;
      } else if (msg.type === 'ball_update' && !isHostRef.current) {
        // ゲストはホストのボール位置を受け取る
        if (gameRef.current) {
          gameRef.current.ball.x = CANVAS_WIDTH - msg.x; // ミラーリング
          gameRef.current.ball.y = msg.y;
          gameRef.current.ball.vx = -msg.vx;
          gameRef.current.ball.vy = msg.vy;
        }
      } else if (msg.type === 'game_finished') {
        if (gameRef.current) gameRef.current.running = false;
        setWinner(msg.winnerId === user.id ? 'me' : 'opponent');
        setConnStatus('finished');
      } else if (msg.type === 'opponent_disconnected') {
        if (gameRef.current) gameRef.current.running = false;
        setConnStatus('error');
      }
    };

    ws.onerror = () => setConnStatus('error');
    ws.onclose = () => {
      if (connStatus === 'playing') setConnStatus('error');
    };

    return () => ws.close();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameId, user?.id]);

  useEffect(() => {
    if (connStatus !== 'playing') return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;

    const handleKeyDown = (e: KeyboardEvent) => keysRef.current.add(e.key);
    const handleKeyUp = (e: KeyboardEvent) => keysRef.current.delete(e.key);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    let lastPaddleY = -1;

    function update() {
      const state = gameRef.current;
      const ws = wsRef.current;
      if (!state || !state.running || !ws) return;

      const keys = keysRef.current;

      // My paddle movement
      if (keys.has('w') || keys.has('W') || keys.has('ArrowUp')) {
        state.myPaddle.y = Math.max(0, state.myPaddle.y - PADDLE_SPEED);
      }
      if (keys.has('s') || keys.has('S') || keys.has('ArrowDown')) {
        state.myPaddle.y = Math.min(CANVAS_HEIGHT - PADDLE_HEIGHT, state.myPaddle.y + PADDLE_SPEED);
      }

      // Send paddle position if changed
      if (state.myPaddle.y !== lastPaddleY && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'paddle_move', paddleY: state.myPaddle.y }));
        lastPaddleY = state.myPaddle.y;
      }

      if (!isHostRef.current) return; // ゲストはボール物理を動かさない

      // Ball movement (host only)
      state.ball.x += state.ball.vx;
      state.ball.y += state.ball.vy;

      // Top/bottom bounce
      if (state.ball.y <= 0 || state.ball.y >= CANVAS_HEIGHT - BALL_SIZE) {
        state.ball.vy *= -1;
      }

      // My paddle (left) collision
      if (
        state.ball.x <= PADDLE_WIDTH + 20 &&
        state.ball.y + BALL_SIZE >= state.myPaddle.y &&
        state.ball.y <= state.myPaddle.y + PADDLE_HEIGHT &&
        state.ball.vx < 0
      ) {
        state.ball.vx = Math.abs(state.ball.vx) * 1.05;
        state.ball.vy = ((state.ball.y - state.myPaddle.y) / PADDLE_HEIGHT - 0.5) * BALL_SPEED_INIT * 2;
      }

      // Opponent paddle (right) collision
      if (
        state.ball.x >= CANVAS_WIDTH - PADDLE_WIDTH - 20 - BALL_SIZE &&
        state.ball.y + BALL_SIZE >= state.opponentPaddle.y &&
        state.ball.y <= state.opponentPaddle.y + PADDLE_HEIGHT &&
        state.ball.vx > 0
      ) {
        state.ball.vx = -Math.abs(state.ball.vx) * 1.05;
        state.ball.vy = ((state.ball.y - state.opponentPaddle.y) / PADDLE_HEIGHT - 0.5) * BALL_SPEED_INIT * 2;
      }

      // Scoring
      if (state.ball.x < 0) {
        state.opponentScore++;
        setScores({ my: state.myScore, opp: state.opponentScore });
        if (state.opponentScore >= WINNING_SCORE) {
          state.running = false;
          ws.send(JSON.stringify({ type: 'game_over', winnerId: null })); // determined server-side
        } else {
          resetBall(state);
        }
      } else if (state.ball.x > CANVAS_WIDTH) {
        state.myScore++;
        setScores({ my: state.myScore, opp: state.opponentScore });
        if (state.myScore >= WINNING_SCORE) {
          state.running = false;
          ws.send(JSON.stringify({ type: 'game_over', winnerId: user?.id }));
        } else {
          resetBall(state);
        }
      }

      // Send ball state to guest
      const now = Date.now();
      if (now - lastBallSendRef.current >= BALL_SEND_INTERVAL && ws.readyState === WebSocket.OPEN) {
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

      // Center dashed line
      ctx!.setLineDash([8, 8]);
      ctx!.strokeStyle = 'rgba(0, 212, 255, 0.15)';
      ctx!.lineWidth = 2;
      ctx!.beginPath();
      ctx!.moveTo(CANVAS_WIDTH / 2, 0);
      ctx!.lineTo(CANVAS_WIDTH / 2, CANVAS_HEIGHT);
      ctx!.stroke();
      ctx!.setLineDash([]);

      // My paddle (left = cyan)
      ctx!.shadowColor = '#00d4ff';
      ctx!.shadowBlur = 15;
      ctx!.fillStyle = '#00d4ff';
      ctx!.fillRect(20, state.myPaddle.y, PADDLE_WIDTH, PADDLE_HEIGHT);

      // Opponent paddle (right = purple)
      ctx!.shadowColor = '#8b5cf6';
      ctx!.shadowBlur = 15;
      ctx!.fillStyle = '#8b5cf6';
      ctx!.fillRect(CANVAS_WIDTH - 20 - PADDLE_WIDTH, state.opponentPaddle.y, PADDLE_WIDTH, PADDLE_HEIGHT);

      // Ball
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
    <div className="min-h-screen flex flex-col items-center justify-center relative" style={{ background: 'var(--color-space-deep)' }}>
      {/* Waiting overlay */}
      {connStatus === 'connecting' || connStatus === 'waiting' ? (
        <div className="text-center">
          <div className="font-display text-xl text-cosmic-cyan text-glow-cyan animate-pulse mb-4">
            {connStatus === 'connecting' ? '接続中...' : '対戦相手を待っています...'}
          </div>
          <p className="text-sm text-star-white/30">Game #{gameId}</p>
        </div>
      ) : null}

      {/* Error overlay */}
      {connStatus === 'error' && (
        <div className="text-center">
          <div className="font-display text-xl text-cosmic-red mb-4">接続が切断されました</div>
          <button onClick={() => navigate('/dashboard')} className="cosmic-btn">ダッシュボードへ</button>
        </div>
      )}

      {/* Game */}
      {(connStatus === 'playing' || connStatus === 'finished') && (
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

          <div className="relative">
            <canvas
              ref={canvasRef}
              width={CANVAS_WIDTH}
              height={CANVAS_HEIGHT}
              className="rounded-xl"
              style={{
                border: '1px solid rgba(0, 212, 255, 0.15)',
                boxShadow: '0 0 40px rgba(0, 212, 255, 0.05), inset 0 0 40px rgba(0, 0, 0, 0.5)',
              }}
            />

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
                    : <span className="text-cosmic-red">相手の勝ち</span>}
                </p>
                <div className="font-display text-3xl text-star-white mb-8">
                  {scores.my} - {scores.opp}
                </div>
                <button onClick={() => navigate('/dashboard')} className="cosmic-btn">
                  ダッシュボードへ
                </button>
              </div>
            )}
          </div>

          <div className="flex items-center gap-4 mt-6 text-xs text-star-white/20">
            <span className="text-cosmic-cyan/40">操作:</span>
            <kbd className="px-1.5 py-0.5 rounded border border-cosmic-cyan/20 bg-cosmic-cyan/5 text-cosmic-cyan/40 font-mono">W</kbd>
            <kbd className="px-1.5 py-0.5 rounded border border-cosmic-cyan/20 bg-cosmic-cyan/5 text-cosmic-cyan/40 font-mono">S</kbd>
            <span className="text-star-white/10">or</span>
            <kbd className="px-1.5 py-0.5 rounded border border-cosmic-cyan/20 bg-cosmic-cyan/5 text-cosmic-cyan/40 font-mono">↑</kbd>
            <kbd className="px-1.5 py-0.5 rounded border border-cosmic-cyan/20 bg-cosmic-cyan/5 text-cosmic-cyan/40 font-mono">↓</kbd>
          </div>
        </>
      )}
    </div>
  );
}
