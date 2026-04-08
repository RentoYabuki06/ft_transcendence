import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { UserAvatar } from '../components/UserAvatar';
import { api } from '../services/api';
import type { User } from '../types';

export function UserProfilePage() {
  const { id } = useParams<{ id: string }>();
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) return;
    setIsLoading(true);
    api.getUser(Number(id))
      .then(setUser)
      .catch((err) => setError(err.message))
      .finally(() => setIsLoading(false));
  }, [id]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="font-display text-cosmic-cyan text-glow-cyan animate-glow-pulse">Loading...</div>
      </div>
    );
  }

  if (error || !user) {
    return (
      <div className="flex flex-col items-center justify-center py-32">
        <p className="text-cosmic-red mb-4">{error || 'ユーザーが見つかりません'}</p>
        <Link to="/dashboard" className="cosmic-btn">ダッシュボードに戻る</Link>
      </div>
    );
  }

  const totalGames = user.wins + user.losses;
  const winRate = totalGames > 0 ? Math.round((user.wins / totalGames) * 100) : 0;

  return (
    <div className="py-8 max-w-3xl mx-auto animate-slide-in">
      <div className="cosmic-card">
        {/* Profile Header */}
        <div className="flex flex-col items-center mb-8">
          <UserAvatar avatarUrl={user.avatarUrl} nickname={user.nickname} size="xl" showRing />
          <h1 className="font-display text-3xl font-bold text-star-white mt-4">
            {user.nickname}
          </h1>
          <p className="text-cosmic-cyan/60 text-sm font-display tracking-wide">
            Level {user.level}
          </p>
        </div>

        {/* Rank */}
        <div className="text-center mb-8">
          <div className="inline-flex items-baseline gap-1">
            <span className="font-display text-7xl font-black text-cosmic-cyan text-glow-cyan">
              {user.rank}
            </span>
            <span className="font-display text-2xl text-cosmic-cyan/60">
              {user.rank === 1 ? 'st' : user.rank === 2 ? 'nd' : user.rank === 3 ? 'rd' : 'th'}
            </span>
          </div>
        </div>

        {/* Stats */}
        <div className="flex items-center justify-center gap-8 mb-8">
          <div className="text-center">
            <div className="font-display text-3xl font-bold text-cosmic-green">{user.wins}</div>
            <div className="text-star-white/40 text-xs font-display tracking-wider">WINS</div>
          </div>
          <div className="w-px h-12 bg-cosmic-cyan/10" />
          <div className="text-center">
            <div className="font-display text-3xl font-bold text-cosmic-red">{user.losses}</div>
            <div className="text-star-white/40 text-xs font-display tracking-wider">LOSSES</div>
          </div>
          <div className="w-px h-12 bg-cosmic-cyan/10" />
          <div className="text-center">
            <div className="font-display text-3xl font-bold text-cosmic-gold">{winRate}%</div>
            <div className="text-star-white/40 text-xs font-display tracking-wider">WIN RATE</div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-center gap-4">
          <Link to="/history" className="cosmic-btn text-sm">
            対戦履歴
          </Link>
          <Link to="/ranking" className="cosmic-btn text-sm">
            ランキング
          </Link>
        </div>
      </div>
    </div>
  );
}
