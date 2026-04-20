import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

export function LandingPage() {
  const navigate = useNavigate();
  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const fadeTimer = setTimeout(() => setVisible(true), 100);

    const durationMs = 3000;
    const start = performance.now();
    let rafId = 0;
    const loop = () => {
      const elapsed = performance.now() - start;
      const p = Math.min(100, Math.round((elapsed / durationMs) * 100));
      setProgress(p);
      if (p < 100) {
        rafId = requestAnimationFrame(loop);
      }
    };
    rafId = requestAnimationFrame(loop);

    const navTimer = setTimeout(() => {
      navigate('/login');
    }, durationMs);

    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(navTimer);
      cancelAnimationFrame(rafId);
    };
  }, [navigate]);

  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden">
      {/* Orbit rings */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div
          className="absolute w-[500px] h-[500px] rounded-full border border-cosmic-cyan/10"
          style={{ animation: 'orbit-ring 20s linear infinite' }}
        />
        <div
          className="absolute w-[700px] h-[700px] rounded-full border border-cosmic-purple/8"
          style={{ animation: 'orbit-ring 30s linear infinite reverse' }}
        />
        <div
          className="absolute w-[900px] h-[900px] rounded-full border border-cosmic-cyan/5"
          style={{ animation: 'orbit-ring 40s linear infinite' }}
        />
      </div>

      {/* Radial glow behind title */}
      <div
        className="absolute w-[600px] h-[600px] rounded-full"
        style={{
          background:
            'radial-gradient(circle, rgba(255,79,216,0.12) 0%, rgba(184,77,255,0.08) 38%, rgba(110,231,255,0.05) 55%, transparent 72%)',
          animation: 'glow-pulse 3s ease-in-out infinite',
        }}
      />

      {/* Main content */}
      <div
        className={`relative z-10 text-center transition-all duration-1000 ${
          visible ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
        }`}
      >
        {/* Title */}
        <h1
          className="font-display text-8xl md:text-9xl font-black tracking-widest mb-10"
          style={{
            background: 'linear-gradient(135deg, #6ee7ff 0%, #ff4fd8 45%, #b84dff 100%)',
            backgroundSize: '200% 200%',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            animation: 'glow-pulse 2s ease-in-out infinite',
            filter:
              'drop-shadow(0 0 24px rgba(255,79,216,0.45)) drop-shadow(0 0 48px rgba(184,77,255,0.35)) drop-shadow(0 0 64px rgba(110,231,255,0.2))',
          }}
        >
          Pong
        </h1>

        {/* Subtitle */}
        <p
          className="font-display text-lg tracking-[0.3em] text-cosmic-cyan/50 uppercase"
          style={{ animation: 'slide-in-up 0.8s ease-out 0.3s both', marginBottom: '1.5rem' }}
        >
          ft_transcendence
        </p>

        {/* 装飾ライン */}
        <div
          className="flex items-center justify-center gap-3"
          style={{
            width: 'min(92vw, 30rem)',
            margin: '0 auto',
            marginBottom: '6rem',
            animation: 'slide-in-up 0.8s ease-out 0.5s both',
          }}
        >
          <div className="h-px min-w-0 flex-1 bg-gradient-to-r from-transparent to-cosmic-cyan/40" />
          <div className="w-2 h-2 shrink-0 rounded-full bg-cosmic-cyan/60 animate-glow-pulse" />
          <div className="h-px min-w-0 flex-1 bg-gradient-to-l from-transparent to-cosmic-cyan/40" />
        </div>

        {/* プログレスバー */}
        <div
          style={{
            width: 'min(92vw, 30rem)',
            margin: '0 auto',
            height: '2px',
            borderRadius: '999px',
            overflow: 'hidden',
            background: 'rgba(255,255,255,0.08)',
            animation: 'slide-in-up 0.8s ease-out 0.6s both',
          }}
        >
          <div
            style={{
              width: `${progress}%`,
              height: '100%',
              borderRadius: '999px',
              background: 'linear-gradient(90deg, #6ee7ff, #ff4fd8, #b84dff)',
              boxShadow: '0 0 12px rgba(110,231,255,0.5), 0 0 24px rgba(255,79,216,0.35)',
            }}
          />
        </div>
      </div>
    </div>
  );
}
