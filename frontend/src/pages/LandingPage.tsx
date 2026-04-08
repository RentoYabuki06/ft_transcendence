import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { StarField } from '../components/StarField';

export function LandingPage() {
  const navigate = useNavigate();
  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Fade in
    const fadeTimer = setTimeout(() => setVisible(true), 100);

    // Progress bar over 3 seconds
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          return 100;
        }
        return prev + 1;
      });
    }, 30);

    // Navigate after 3 seconds
    const navTimer = setTimeout(() => {
      navigate('/login');
    }, 3000);

    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(navTimer);
      clearInterval(interval);
    };
  }, [navigate]);

  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden" style={{ background: 'var(--color-space-deep)' }}>
      <StarField />

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
          background: 'radial-gradient(circle, rgba(0,212,255,0.08) 0%, rgba(139,92,246,0.04) 40%, transparent 70%)',
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
          className="font-display text-8xl md:text-9xl font-black tracking-widest mb-4"
          style={{
            background: 'linear-gradient(135deg, #00d4ff 0%, #8b5cf6 50%, #00d4ff 100%)',
            backgroundSize: '200% 200%',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            animation: 'glow-pulse 2s ease-in-out infinite',
            filter: 'drop-shadow(0 0 30px rgba(0,212,255,0.3)) drop-shadow(0 0 60px rgba(139,92,246,0.2))',
          }}
        >
          Pong
        </h1>

        {/* Subtitle */}
        <p
          className="font-display text-lg tracking-[0.3em] text-cosmic-cyan/50 uppercase mb-12"
          style={{ animation: 'slide-in-up 0.8s ease-out 0.3s both' }}
        >
          ft_transcendence
        </p>

        {/* Decorative line */}
        <div className="flex items-center justify-center gap-3 mb-8" style={{ animation: 'slide-in-up 0.8s ease-out 0.5s both' }}>
          <div className="h-px w-16 bg-gradient-to-r from-transparent to-cosmic-cyan/40" />
          <div className="w-2 h-2 rounded-full bg-cosmic-cyan/60 animate-glow-pulse" />
          <div className="h-px w-16 bg-gradient-to-l from-transparent to-cosmic-cyan/40" />
        </div>

        {/* Progress bar */}
        <div
          className="w-48 h-0.5 mx-auto rounded-full overflow-hidden"
          style={{
            background: 'rgba(0,212,255,0.1)',
            animation: 'slide-in-up 0.8s ease-out 0.7s both',
          }}
        >
          <div
            className="h-full rounded-full transition-all duration-75"
            style={{
              width: `${progress}%`,
              background: 'linear-gradient(90deg, #00d4ff, #8b5cf6)',
              boxShadow: '0 0 10px rgba(0,212,255,0.5)',
            }}
          />
        </div>
      </div>
    </div>
  );
}
