import { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 500;
const PADDLE_WIDTH = 12;
const PADDLE_HEIGHT = 80;
const BALL_SIZE = 10;
const PADDLE_SPEED = 6;
const BALL_SPEED_INIT = 4;
const WINNING_SCORE = 11;

interface GameState {
  ball: { x: number; y: number; vx: number; vy: number };
  paddle1: { y: number };
  paddle2: { y: number };
  score1: number;
  score2: number;
  running: boolean;
}

export function GamePage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<GameState | null>(null);
  const keysRef = useRef<Set<string>>(new Set());
  const navigate = useNavigate();
  const [scores, setScores] = useState({ p1: 0, p2: 0 });
  const [gameOver, setGameOver] = useState(false);
  const [winner, setWinner] = useState('');

  const initGame = useCallback((): GameState => ({
    ball: {
      x: CANVAS_WIDTH / 2,
      y: CANVAS_HEIGHT / 2,
      vx: BALL_SPEED_INIT * (Math.random() > 0.5 ? 1 : -1),
      vy: (Math.random() - 0.5) * BALL_SPEED_INIT,
    },
    paddle1: { y: CANVAS_HEIGHT / 2 - PADDLE_HEIGHT / 2 },
    paddle2: { y: CANVAS_HEIGHT / 2 - PADDLE_HEIGHT / 2 },
    score1: 0,
    score2: 0,
    running: true,
  }), []);

  const resetBall = (state: GameState) => {
    state.ball.x = CANVAS_WIDTH / 2;
    state.ball.y = CANVAS_HEIGHT / 2;
    state.ball.vx = BALL_SPEED_INIT * (state.ball.vx > 0 ? -1 : 1);
    state.ball.vy = (Math.random() - 0.5) * BALL_SPEED_INIT;
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    gameRef.current = initGame();
    let animId: number;

    const handleKeyDown = (e: KeyboardEvent) => keysRef.current.add(e.key);
    const handleKeyUp = (e: KeyboardEvent) => keysRef.current.delete(e.key);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    function update() {
      const state = gameRef.current;
      if (!state || !state.running) return;

      const keys = keysRef.current;

      // Player 1 controls (W/S)
      if (keys.has('w') || keys.has('W')) state.paddle1.y = Math.max(0, state.paddle1.y - PADDLE_SPEED);
      if (keys.has('s') || keys.has('S')) state.paddle1.y = Math.min(CANVAS_HEIGHT - PADDLE_HEIGHT, state.paddle1.y + PADDLE_SPEED);

      // Player 2 controls (Arrow keys)
      if (keys.has('ArrowUp')) state.paddle2.y = Math.max(0, state.paddle2.y - PADDLE_SPEED);
      if (keys.has('ArrowDown')) state.paddle2.y = Math.min(CANVAS_HEIGHT - PADDLE_HEIGHT, state.paddle2.y + PADDLE_SPEED);

      // Ball movement
      state.ball.x += state.ball.vx;
      state.ball.y += state.ball.vy;

      // Top/bottom collision
      if (state.ball.y <= 0 || state.ball.y >= CANVAS_HEIGHT - BALL_SIZE) {
        state.ball.vy *= -1;
      }

      // Paddle 1 collision (left)
      if (
        state.ball.x <= PADDLE_WIDTH + 20 &&
        state.ball.y + BALL_SIZE >= state.paddle1.y &&
        state.ball.y <= state.paddle1.y + PADDLE_HEIGHT &&
        state.ball.vx < 0
      ) {
        state.ball.vx = Math.abs(state.ball.vx) * 1.05;
        const hitPos = (state.ball.y - state.paddle1.y) / PADDLE_HEIGHT - 0.5;
        state.ball.vy = hitPos * BALL_SPEED_INIT * 2;
      }

      // Paddle 2 collision (right)
      if (
        state.ball.x >= CANVAS_WIDTH - PADDLE_WIDTH - 20 - BALL_SIZE &&
        state.ball.y + BALL_SIZE >= state.paddle2.y &&
        state.ball.y <= state.paddle2.y + PADDLE_HEIGHT &&
        state.ball.vx > 0
      ) {
        state.ball.vx = -Math.abs(state.ball.vx) * 1.05;
        const hitPos = (state.ball.y - state.paddle2.y) / PADDLE_HEIGHT - 0.5;
        state.ball.vy = hitPos * BALL_SPEED_INIT * 2;
      }

      // Scoring
      if (state.ball.x < 0) {
        state.score2++;
        setScores({ p1: state.score1, p2: state.score2 });
        if (state.score2 >= WINNING_SCORE) {
          state.running = false;
          setGameOver(true);
          setWinner('Player 2');
        } else {
          resetBall(state);
        }
      }

      if (state.ball.x > CANVAS_WIDTH) {
        state.score1++;
        setScores({ p1: state.score1, p2: state.score2 });
        if (state.score1 >= WINNING_SCORE) {
          state.running = false;
          setGameOver(true);
          setWinner('Player 1');
        } else {
          resetBall(state);
        }
      }
    }

    function draw() {
      const state = gameRef.current;
      if (!state) return;

      // Background
      ctx!.fillStyle = '#050a18';
      ctx!.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      // Center line
      ctx!.setLineDash([8, 8]);
      ctx!.strokeStyle = 'rgba(0, 212, 255, 0.15)';
      ctx!.lineWidth = 2;
      ctx!.beginPath();
      ctx!.moveTo(CANVAS_WIDTH / 2, 0);
      ctx!.lineTo(CANVAS_WIDTH / 2, CANVAS_HEIGHT);
      ctx!.stroke();
      ctx!.setLineDash([]);

      // Paddle 1 (cyan)
      ctx!.shadowColor = '#00d4ff';
      ctx!.shadowBlur = 15;
      ctx!.fillStyle = '#00d4ff';
      ctx!.fillRect(20, state.paddle1.y, PADDLE_WIDTH, PADDLE_HEIGHT);

      // Paddle 2 (purple)
      ctx!.shadowColor = '#8b5cf6';
      ctx!.shadowBlur = 15;
      ctx!.fillStyle = '#8b5cf6';
      ctx!.fillRect(CANVAS_WIDTH - 20 - PADDLE_WIDTH, state.paddle2.y, PADDLE_WIDTH, PADDLE_HEIGHT);

      // Ball
      ctx!.shadowColor = '#ffffff';
      ctx!.shadowBlur = 20;
      ctx!.fillStyle = '#ffffff';
      ctx!.beginPath();
      ctx!.arc(state.ball.x, state.ball.y, BALL_SIZE, 0, Math.PI * 2);
      ctx!.fill();

      // Ball trail glow
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
  }, [initGame]);

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center relative"
      style={{ background: 'var(--color-space-deep)' }}
    >
      {/* Score */}
      <div className="flex items-center gap-12 mb-6">
        <div className="text-center">
          <div className="font-display text-xs text-cosmic-cyan/50 tracking-widest mb-1">PLAYER 1</div>
          <div className="font-display text-5xl font-black text-cosmic-cyan text-glow-cyan">{scores.p1}</div>
        </div>
        <div className="font-display text-2xl text-star-white/20">-</div>
        <div className="text-center">
          <div className="font-display text-xs text-cosmic-purple/50 tracking-widest mb-1">PLAYER 2</div>
          <div className="font-display text-5xl font-black text-cosmic-purple text-glow-purple">{scores.p2}</div>
        </div>
      </div>

      {/* Game Canvas */}
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

        {/* Game Over Overlay */}
        {gameOver && (
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
            <p className="font-display text-lg text-cosmic-cyan mb-6">{winner} Wins!</p>
            <div className="font-display text-3xl text-star-white mb-8">
              {scores.p1} - {scores.p2}
            </div>
            <div className="flex gap-4">
              <button
                onClick={() => {
                  gameRef.current = initGame();
                  setScores({ p1: 0, p2: 0 });
                  setGameOver(false);
                  setWinner('');
                }}
                className="cosmic-btn cosmic-btn-primary"
              >
                もう一度
              </button>
              <button
                onClick={() => navigate('/dashboard')}
                className="cosmic-btn"
              >
                ダッシュボードへ
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Controls Help */}
      <div className="flex items-center gap-12 mt-6 text-xs text-star-white/20">
        <div className="flex items-center gap-2">
          <span className="text-cosmic-cyan/40">Player 1:</span>
          <kbd className="px-1.5 py-0.5 rounded border border-cosmic-cyan/20 bg-cosmic-cyan/5 text-cosmic-cyan/40 font-mono">W</kbd>
          <kbd className="px-1.5 py-0.5 rounded border border-cosmic-cyan/20 bg-cosmic-cyan/5 text-cosmic-cyan/40 font-mono">S</kbd>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-cosmic-purple/40">Player 2:</span>
          <kbd className="px-1.5 py-0.5 rounded border border-cosmic-purple/20 bg-cosmic-purple/5 text-cosmic-purple/40 font-mono">↑</kbd>
          <kbd className="px-1.5 py-0.5 rounded border border-cosmic-purple/20 bg-cosmic-purple/5 text-cosmic-purple/40 font-mono">↓</kbd>
        </div>
      </div>
    </div>
  );
}
