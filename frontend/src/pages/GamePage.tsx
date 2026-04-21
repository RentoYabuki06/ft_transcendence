// サーバー権威モデルのゲーム画面。
// - クライアントは入力(up/down/serve/resign)を送るだけ
// - サーバーから 30Hz で届く snapshot を 100ms バッファして補間表示
// - 自分が右側プレイヤーなら x 軸のみ描画側で反転（物理には影響なし）
import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

// サーバー側 gameEngine と同一の座標系
const WIDTH = 800;
const HEIGHT = 500;
const PADDLE_WIDTH = 12;
const PADDLE_HEIGHT = 80;
const BALL_RADIUS = 10;
const INTERP_DELAY_MS = 100;
const SNAP_BUFFER_MAX = 10;

type Side = 'left' | 'right';
type Phase = 'waiting' | 'countdown' | 'serving' | 'rally' | 'finished';
type ConnStatus =
  | 'connecting'
  | 'waiting'
  | 'playing'
  | 'paused'
  | 'reconnecting'
  | 'finished'
  | 'error';

interface Snapshot {
  receivedAt: number; // performance.now()
  t: number;
  ball: [number, number, number, number];
  pl: number;
  pr: number;
  sl: number;
  sr: number;
  p: Phase;
  ss: Side | null;
  cd: number | null;
  w: Side | null;
}

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

export function GamePage() {
  const { id: gameId } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const snapshotsRef = useRef<Snapshot[]>([]);
  const sideRef = useRef<Side | null>(null);
  const intentionalCloseRef = useRef(false);
  const reconnectAttemptsRef = useRef(0);
  const inputRef = useRef({ up: false, down: false });
  const pauseTimerRef = useRef<number | null>(null);
  const finishedPayloadRef = useRef<{ winnerId: number | null } | null>(null);

  const [connStatus, setConnStatus] = useState<ConnStatus>('connecting');
  const [phase, setPhase] = useState<Phase>('waiting');
  const [scores, setScores] = useState({ my: 0, opp: 0 });
  const [countdownSec, setCountdownSec] = useState(0);
  const [serveIsMine, setServeIsMine] = useState(false);
  const [winner, setWinner] = useState<'me' | 'opponent' | null>(null);
  const [pauseSeconds, setPauseSeconds] = useState<number | null>(null);
  const [disconnectReason, setDisconnectReason] = useState<
    'opponent_left' | 'network' | null
  >(null);
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

  // WebSocket 接続
  useEffect(() => {
    const token = sessionStorage.getItem('auth_token');
    if (!token || !gameId || !user) return;
    const wsUrl = `${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${
      location.host
    }/api/ws/game/${gameId}?token=${token}`;
    intentionalCloseRef.current = false;

    const connect = () => {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;
      attach(ws);
    };

    const attach = (ws: WebSocket) => {
      ws.onopen = () => {
        reconnectAttemptsRef.current = 0;
        // 再接続時は現在の入力状態を改めて送る
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(
            JSON.stringify({
              type: 'input',
              up: inputRef.current.up,
              down: inputRef.current.down,
            }),
          );
        }
      };

      ws.onmessage = (e) => {
        let msg: {
          type: string;
          [key: string]: unknown;
        };
        try {
          msg = JSON.parse(e.data);
        } catch {
          return;
        }

        if (msg.type === 'error') {
          intentionalCloseRef.current = true;
          setDisconnectReason('network');
          setConnStatus('error');
          return;
        }

        if (msg.type === 'connected') {
          sideRef.current = (msg.yourSide as Side) ?? null;
          setConnStatus((prev) =>
            prev === 'reconnecting' ? 'playing' : 'waiting',
          );
          return;
        }

        if (msg.type === 'game_start') {
          setConnStatus('playing');
          return;
        }

        if (msg.type === 'state') {
          const snap: Snapshot = {
            receivedAt: performance.now(),
            t: msg.t as number,
            ball: msg.ball as [number, number, number, number],
            pl: msg.pl as number,
            pr: msg.pr as number,
            sl: msg.sl as number,
            sr: msg.sr as number,
            p: msg.p as Phase,
            ss: (msg.ss as Side | null) ?? null,
            cd: (msg.cd as number | null) ?? null,
            w: (msg.w as Side | null) ?? null,
          };
          const buf = snapshotsRef.current;
          buf.push(snap);
          if (buf.length > SNAP_BUFFER_MAX) buf.shift();

          const mySide = sideRef.current;
          if (mySide) {
            const my = mySide === 'left' ? snap.sl : snap.sr;
            const opp = mySide === 'left' ? snap.sr : snap.sl;
            setScores((prev) =>
              prev.my === my && prev.opp === opp ? prev : { my, opp },
            );
            setServeIsMine(snap.ss !== null && snap.ss === mySide);
          }
          setPhase((prev) => (prev === snap.p ? prev : snap.p));
          setCountdownSec(
            snap.cd !== null ? Math.max(0, Math.ceil(snap.cd / 1000)) : 0,
          );
          return;
        }

        if (msg.type === 'opponent_disconnected') {
          setConnStatus('paused');
          const g =
            typeof msg.graceSeconds === 'number' ? msg.graceSeconds : 15;
          setPauseSeconds(g);
          if (pauseTimerRef.current !== null) {
            window.clearInterval(pauseTimerRef.current);
          }
          pauseTimerRef.current = window.setInterval(() => {
            setPauseSeconds((s) =>
              s === null ? null : Math.max(0, s - 1),
            );
          }, 1000);
          return;
        }

        if (msg.type === 'opponent_reconnected') {
          if (pauseTimerRef.current !== null) {
            window.clearInterval(pauseTimerRef.current);
            pauseTimerRef.current = null;
          }
          setPauseSeconds(null);
          setConnStatus('playing');
          return;
        }

        if (msg.type === 'game_finished') {
          intentionalCloseRef.current = true;
          const winnerId =
            typeof msg.winnerId === 'number' ? (msg.winnerId as number) : null;
          finishedPayloadRef.current = { winnerId };
          if (winnerId === null) {
            setWinner(null);
          } else if (user) {
            setWinner(winnerId === user.id ? 'me' : 'opponent');
          }
          const sl = typeof msg.scoreLeft === 'number' ? msg.scoreLeft : null;
          const sr = typeof msg.scoreRight === 'number' ? msg.scoreRight : null;
          const mySide = sideRef.current;
          if (sl !== null && sr !== null && mySide) {
            const my = mySide === 'left' ? sl : sr;
            const opp = mySide === 'left' ? sr : sl;
            setScores({ my, opp });
          }
          setConnStatus('finished');
          if (pauseTimerRef.current !== null) {
            window.clearInterval(pauseTimerRef.current);
            pauseTimerRef.current = null;
          }
          setPauseSeconds(null);
          return;
        }
      };

      ws.onerror = () => {
        // onclose 側で再接続判定
      };

      ws.onclose = () => {
        if (intentionalCloseRef.current) return;
        let shouldReconnect = false;
        setConnStatus((prev) => {
          if (
            prev === 'waiting' ||
            prev === 'playing' ||
            prev === 'paused' ||
            prev === 'reconnecting'
          ) {
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

  // キーボード・タップ入力
  useEffect(() => {
    const sendInput = () => {
      const ws = wsRef.current;
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(
          JSON.stringify({
            type: 'input',
            up: inputRef.current.up,
            down: inputRef.current.down,
          }),
        );
      }
    };
    const sendServe = () => {
      const ws = wsRef.current;
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'serve' }));
      }
    };
    const setUp = (v: boolean) => {
      if (inputRef.current.up !== v) {
        inputRef.current.up = v;
        sendInput();
      }
    };
    const setDown = (v: boolean) => {
      if (inputRef.current.down !== v) {
        inputRef.current.down = v;
        sendInput();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.key === 'w' ||
        e.key === 'W' ||
        e.key === 'ArrowUp'
      ) {
        setUp(true);
      } else if (
        e.key === 's' ||
        e.key === 'S' ||
        e.key === 'ArrowDown'
      ) {
        setDown(true);
      } else if (e.key === ' ' || e.code === 'Space') {
        e.preventDefault();
        sendServe();
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'w' || e.key === 'W' || e.key === 'ArrowUp') setUp(false);
      else if (e.key === 's' || e.key === 'S' || e.key === 'ArrowDown')
        setDown(false);
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    const canvasEl = canvasRef.current;
    const handleCanvasTap = () => sendServe();
    canvasEl?.addEventListener('click', handleCanvasTap);
    canvasEl?.addEventListener('touchstart', handleCanvasTap);

    // ブラウザがフォーカスを失ったら入力解除（パドルが動きっぱなしになるのを防止）
    const handleBlur = () => {
      setUp(false);
      setDown(false);
    };
    window.addEventListener('blur', handleBlur);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleBlur);
      canvasEl?.removeEventListener('click', handleCanvasTap);
      canvasEl?.removeEventListener('touchstart', handleCanvasTap);
    };
    // canvas 側 listener を貼り直すため connStatus を依存に入れる
  }, [connStatus]);

  // 再読み込み警告
  useEffect(() => {
    const h = (e: BeforeUnloadEvent) => {
      if (phase === 'rally' || phase === 'countdown' || phase === 'serving') {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, [phase]);

  // 描画ループ（snapshot 補間）
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let raf: number;

    const loop = () => {
      const buf = snapshotsRef.current;
      const nowLocal = performance.now();
      // 古すぎるsnapshotは捨てる
      while (buf.length > 2 && buf[0].receivedAt < nowLocal - 1000) buf.shift();

      if (buf.length === 0) {
        drawIdle(ctx);
        raf = requestAnimationFrame(loop);
        return;
      }

      const renderLocal = nowLocal - INTERP_DELAY_MS;

      // renderLocal を挟む2つを探す
      let prev: Snapshot = buf[0];
      let next: Snapshot = buf[buf.length - 1];
      for (let i = 0; i < buf.length; i++) {
        if (buf[i].receivedAt <= renderLocal) prev = buf[i];
      }
      for (let i = buf.length - 1; i >= 0; i--) {
        if (buf[i].receivedAt >= renderLocal) next = buf[i];
      }
      if (prev.receivedAt > renderLocal) prev = buf[0];
      if (next.receivedAt < renderLocal) next = buf[buf.length - 1];

      let ballX: number;
      let ballY: number;
      let pl: number;
      let pr: number;
      if (prev === next || prev.receivedAt === next.receivedAt) {
        ballX = prev.ball[0];
        ballY = prev.ball[1];
        pl = prev.pl;
        pr = prev.pr;
      } else {
        const t = clamp(
          (renderLocal - prev.receivedAt) /
            (next.receivedAt - prev.receivedAt),
          0,
          1,
        );
        ballX = prev.ball[0] + (next.ball[0] - prev.ball[0]) * t;
        ballY = prev.ball[1] + (next.ball[1] - prev.ball[1]) * t;
        pl = prev.pl + (next.pl - prev.pl) * t;
        pr = prev.pr + (next.pr - prev.pr) * t;
      }

      // 自分が右なら x 軸ミラーで「自分=左」として描画
      const mySide = sideRef.current;
      const mirror = mySide === 'right';
      const dispBallX = mirror ? WIDTH - ballX : ballX;
      const dispMyY = mirror ? pr : pl;
      const dispOppY = mirror ? pl : pr;

      // 背景
      ctx.fillStyle = '#050a18';
      ctx.fillRect(0, 0, WIDTH, HEIGHT);

      // センターライン
      ctx.setLineDash([8, 8]);
      ctx.strokeStyle = 'rgba(0, 212, 255, 0.15)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(WIDTH / 2, 0);
      ctx.lineTo(WIDTH / 2, HEIGHT);
      ctx.stroke();
      ctx.setLineDash([]);

      // パドル（左=自分=cyan, 右=相手=purple）
      ctx.fillStyle = '#00d4ff';
      ctx.fillRect(20, dispMyY, PADDLE_WIDTH, PADDLE_HEIGHT);
      ctx.fillStyle = '#8b5cf6';
      ctx.fillRect(
        WIDTH - 20 - PADDLE_WIDTH,
        dispOppY,
        PADDLE_WIDTH,
        PADDLE_HEIGHT,
      );

      // ボール
      ctx.shadowColor = '#00d4ff';
      ctx.shadowBlur = 8;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(dispBallX, ballY, BALL_RADIUS, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;

      raf = requestAnimationFrame(loop);
    };

    const drawIdle = (ctx: CanvasRenderingContext2D) => {
      ctx.fillStyle = '#050a18';
      ctx.fillRect(0, 0, WIDTH, HEIGHT);
    };

    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
    // connStatus を依存に入れることで canvas が DOM に入ってから ref が取れる
  }, [connStatus]);

  const resign = () => {
    if (!confirm('本当に降参しますか？この試合は敗北として記録されます。'))
      return;
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'resign' }));
    }
  };

  return (
    <div
      className="flex flex-col items-center justify-center relative w-full"
      style={{
        background: 'var(--color-space-deep)',
        minHeight: 'calc(100vh - 10rem)',
      }}
    >
      {(connStatus === 'connecting' || connStatus === 'waiting') && (
        <div className="text-center">
          <div className="font-display text-xl text-cosmic-cyan text-glow-cyan animate-pulse mb-4">
            {connStatus === 'connecting'
              ? '接続中...'
              : '対戦相手を待っています...'}
          </div>
          <p className="text-sm text-star-white/30">Game #{gameId}</p>
        </div>
      )}

      {connStatus === 'error' && (
        <div className="text-center">
          <div className="font-display text-xl text-cosmic-red mb-4">
            {disconnectReason === 'opponent_left'
              ? '相手が退出しました'
              : '接続が切断されました'}
          </div>
          <div
            style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}
          >
            <button
              onClick={() => navigate('/matching')}
              className="cosmic-btn cosmic-btn-primary"
            >
              もう一度対戦
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

      {connStatus === 'reconnecting' && (
        <div className="text-center">
          <div className="font-display text-xl text-cosmic-cyan animate-pulse mb-4">
            サーバーに再接続中...
          </div>
          <p className="text-sm text-star-white/30">Game #{gameId}</p>
        </div>
      )}

      {(connStatus === 'playing' ||
        connStatus === 'paused' ||
        connStatus === 'finished') && (
        <>
          <div className="flex items-center gap-12 mb-6">
            <div className="text-center">
              <div className="font-display text-xs text-cosmic-cyan/50 tracking-widest mb-1">
                YOU
              </div>
              <div className="font-display text-5xl font-black text-cosmic-cyan text-glow-cyan">
                {scores.my}
              </div>
            </div>
            <div className="font-display text-2xl text-star-white/20">-</div>
            <div className="text-center">
              <div className="font-display text-xs text-cosmic-purple/50 tracking-widest mb-1">
                OPPONENT
              </div>
              <div className="font-display text-5xl font-black text-cosmic-purple">
                {scores.opp}
              </div>
            </div>
          </div>

          <div
            className="relative"
            style={
              portrait
                ? {
                    width:
                      'min(calc(100vh - 14rem), calc(100vw - 2rem) * 1.6)',
                    aspectRatio: '5 / 8',
                    maxWidth: '500px',
                    marginLeft: 'auto',
                    marginRight: 'auto',
                  }
                : {
                    width: '100%',
                    maxWidth:
                      'min(calc(100vw - 4rem), calc((100vh - 18rem) * 1.6), 800px)',
                    aspectRatio: '8 / 5',
                    marginLeft: 'auto',
                    marginRight: 'auto',
                  }
            }
          >
            <canvas
              ref={canvasRef}
              width={WIDTH}
              height={HEIGHT}
              className="rounded-xl"
              style={
                portrait
                  ? {
                      border: '1px solid rgba(0, 212, 255, 0.15)',
                      boxShadow:
                        '0 0 40px rgba(0, 212, 255, 0.05), inset 0 0 40px rgba(0, 0, 0, 0.5)',
                      position: 'absolute',
                      top: '50%',
                      left: '50%',
                      width: 'calc(100% * 8 / 5)',
                      height: 'calc(100% * 5 / 8)',
                      transform: 'translate(-50%, -50%) rotate(-90deg)',
                      transformOrigin: 'center center',
                    }
                  : {
                      border: '1px solid rgba(0, 212, 255, 0.15)',
                      boxShadow:
                        '0 0 40px rgba(0, 212, 255, 0.05), inset 0 0 40px rgba(0, 0, 0, 0.5)',
                      display: 'block',
                      width: '100%',
                      height: '100%',
                    }
              }
            />

            {connStatus === 'playing' && phase === 'countdown' && (
              <div
                className="absolute inset-0 flex items-center justify-center rounded-xl"
                style={{
                  background: 'rgba(5,10,24,0.7)',
                  backdropFilter: 'blur(2px)',
                }}
              >
                <div
                  className="font-display font-black"
                  style={{
                    fontSize: '8rem',
                    background:
                      'linear-gradient(135deg, #00d4ff, #ff4fd8, #b84dff)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    textShadow: '0 0 40px rgba(255,79,216,0.5)',
                  }}
                  key={countdownSec}
                >
                  {countdownSec > 0 ? countdownSec : 'GO!'}
                </div>
              </div>
            )}

            {connStatus === 'playing' && phase === 'serving' && (
              <div
                className="absolute inset-0 flex items-center justify-center"
                style={{ pointerEvents: 'none' }}
              >
                <div
                  className="font-display"
                  style={{
                    fontSize: '1.25rem',
                    color: serveIsMine ? '#00d4ff' : '#8b5cf6',
                    textShadow: `0 0 20px ${
                      serveIsMine ? '#00d4ff' : '#8b5cf6'
                    }`,
                    background: 'rgba(5,10,24,0.7)',
                    padding: '0.75rem 1.25rem',
                    borderRadius: '12px',
                    letterSpacing: '0.1em',
                  }}
                >
                  {serveIsMine
                    ? 'SPACE / クリックでサーブ'
                    : '相手のサーブを待っています...'}
                </div>
              </div>
            )}

            {connStatus === 'paused' && (
              <div
                className="absolute inset-0 flex flex-col items-center justify-center rounded-xl"
                style={{
                  background: 'rgba(5,10,24,0.75)',
                  backdropFilter: 'blur(2px)',
                  gap: '1rem',
                }}
              >
                <div className="font-display text-2xl text-cosmic-cyan text-glow-cyan">
                  相手が切断しました
                </div>
                <div className="text-sm text-star-white/60">
                  {pauseSeconds !== null && pauseSeconds > 0
                    ? `${pauseSeconds} 秒以内に復帰しない場合、不戦勝になります`
                    : '不戦勝処理中...'}
                </div>
              </div>
            )}

            {connStatus === 'finished' && (
              <div
                className="absolute inset-0 flex flex-col items-center justify-center rounded-xl"
                style={{
                  background: 'rgba(5,10,24,0.85)',
                  backdropFilter: 'blur(4px)',
                }}
              >
                <h2
                  className="font-display text-4xl font-black mb-2"
                  style={{
                    background:
                      'linear-gradient(135deg, #00d4ff, #8b5cf6)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                  }}
                >
                  GAME OVER
                </h2>
                <p className="font-display text-lg mb-2">
                  {winner === 'me' ? (
                    <span className="text-cosmic-green">あなたの勝ち!</span>
                  ) : winner === 'opponent' ? (
                    <span className="text-cosmic-red">相手の勝ち</span>
                  ) : (
                    <span className="text-star-white/60">
                      試合が中断されました
                    </span>
                  )}
                </p>
                <div className="font-display text-3xl text-star-white mb-8">
                  {scores.my} - {scores.opp}
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    onClick={() => navigate('/matching')}
                    className="cosmic-btn cosmic-btn-primary"
                  >
                    もう一度対戦
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

          {(connStatus === 'playing' || connStatus === 'paused') && (
            <div className="flex justify-center mt-4">
              <button
                onClick={resign}
                className="cosmic-btn"
                style={{
                  fontSize: '0.75rem',
                  padding: '0.4rem 1rem',
                  borderColor: 'rgba(251,113,133,0.3)',
                  color: '#fb7185',
                }}
              >
                降参する
              </button>
            </div>
          )}

          <div className="flex items-center gap-4 mt-6 text-xs text-star-white/20 flex-wrap justify-center">
            <span className="text-cosmic-cyan/40">操作:</span>
            <kbd className="px-1.5 py-0.5 rounded border border-cosmic-cyan/20 bg-cosmic-cyan/5 text-cosmic-cyan/40 font-mono">
              W
            </kbd>
            <kbd className="px-1.5 py-0.5 rounded border border-cosmic-cyan/20 bg-cosmic-cyan/5 text-cosmic-cyan/40 font-mono">
              S
            </kbd>
            <span className="text-star-white/10">or</span>
            <kbd className="px-1.5 py-0.5 rounded border border-cosmic-cyan/20 bg-cosmic-cyan/5 text-cosmic-cyan/40 font-mono">
              ↑
            </kbd>
            <kbd className="px-1.5 py-0.5 rounded border border-cosmic-cyan/20 bg-cosmic-cyan/5 text-cosmic-cyan/40 font-mono">
              ↓
            </kbd>
            <span className="text-star-white/10">/ サーブ</span>
            <kbd className="px-1.5 py-0.5 rounded border border-cosmic-cyan/20 bg-cosmic-cyan/5 text-cosmic-cyan/40 font-mono">
              SPACE
            </kbd>
          </div>
        </>
      )}
    </div>
  );
}
