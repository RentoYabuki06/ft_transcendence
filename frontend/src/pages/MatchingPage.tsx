import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { UserAvatar } from '../components/UserAvatar';
import { api } from '../services/api';

export function MatchingPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [status, setStatus] = useState<'searching' | 'matched' | 'cancelled'>('searching');
  const [opponent, setOpponent] = useState<{ nickname: string; avatarUrl: string | null; rank: number } | null>(null);
  const [dots, setDots] = useState('');

  useEffect(() => {
    // Start matchmaking
    api.joinMatchmaking().catch(console.error);

    // Animate dots
    const dotInterval = setInterval(() => {
      setDots((prev) => (prev.length >= 3 ? '' : prev + '.'));
    }, 500);

    // Simulate finding opponent after 3-5 seconds
    const matchTimer = setTimeout(() => {
      setOpponent({ nickname: 'NebulaStar', avatarUrl: null, rank: 1 });
      setStatus('matched');
    }, 3000 + Math.random() * 2000);

    return () => {
      clearInterval(dotInterval);
      clearTimeout(matchTimer);
    };
  }, []);

  // After matched, navigate to game after 2s
  useEffect(() => {
    if (status === 'matched') {
      const timer = setTimeout(() => {
        navigate('/game/1');
      }, 2500);
      return () => clearTimeout(timer);
    }
  }, [status, navigate]);

  const handleCancel = () => {
    api.cancelMatchmaking().catch(console.error);
    setStatus('cancelled');
    navigate('/dashboard');
  };

  if (!user) return null;

  return (
    <div className="flex items-center justify-center min-h-[70vh]">
      {status === 'searching' && (
        <div className="text-center animate-slide-in">
          {/* Pulse ring animation */}
          <div className="relative w-48 h-48 mx-auto mb-8">
            <div className="absolute inset-0 rounded-full border-2 border-cosmic-cyan/20 animate-ping" style={{ animationDuration: '2s' }} />
            <div className="absolute inset-4 rounded-full border border-cosmic-cyan/30 animate-ping" style={{ animationDuration: '2.5s' }} />
            <div className="absolute inset-8 rounded-full border border-cosmic-purple/20 animate-ping" style={{ animationDuration: '3s' }} />
            <div className="absolute inset-0 flex items-center justify-center">
              <UserAvatar avatarUrl={user.avatarUrl} nickname={user.nickname} size="lg" showRing />
            </div>
          </div>

          <h2 className="font-display text-xl text-cosmic-cyan text-glow-cyan mb-2">
            対戦相手を探しています{dots}
          </h2>
          <p className="text-sm text-star-white/30 mb-8">マッチメイキング中</p>

          <button
            onClick={handleCancel}
            className="cosmic-btn text-cosmic-red border-cosmic-red/30 hover:bg-cosmic-red/10 hover:border-cosmic-red/50"
          >
            キャンセル
          </button>
        </div>
      )}

      {status === 'matched' && opponent && (
        <div className="text-center animate-slide-in">
          <div className="flex items-center justify-center gap-8 md:gap-16 mb-8">
            {/* Player 1 */}
            <div className="text-center">
              <UserAvatar avatarUrl={user.avatarUrl} nickname={user.nickname} size="lg" showRing />
              <p className="font-display text-lg text-star-white mt-3">{user.nickname}</p>
              <p className="text-xs text-cosmic-cyan/50 font-display">Rank #{user.rank}</p>
            </div>

            {/* VS */}
            <div
              className="font-display text-4xl font-black"
              style={{
                background: 'linear-gradient(135deg, #00d4ff, #8b5cf6)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                filter: 'drop-shadow(0 0 20px rgba(0,212,255,0.4))',
                animation: 'glow-pulse 1s ease-in-out infinite',
              }}
            >
              VS
            </div>

            {/* Player 2 */}
            <div className="text-center">
              <UserAvatar avatarUrl={opponent.avatarUrl} nickname={opponent.nickname} size="lg" showRing />
              <p className="font-display text-lg text-star-white mt-3">{opponent.nickname}</p>
              <p className="text-xs text-cosmic-cyan/50 font-display">Rank #{opponent.rank}</p>
            </div>
          </div>

          <p className="font-display text-cosmic-green text-glow-cyan animate-glow-pulse text-lg tracking-wider">
            MATCH FOUND
          </p>
          <p className="text-xs text-star-white/30 mt-2">まもなくゲームが開始されます...</p>
        </div>
      )}
    </div>
  );
}
