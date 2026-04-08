import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { UserAvatar } from '../components/UserAvatar';
import { api } from '../services/api';
import type { RankingEntry } from '../types';

export function RankingPage() {
  const [rankings, setRankings] = useState<RankingEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    api.getRanking({ limit: 10 })
      .then((res) => setRankings(res.data))
      .catch(console.error)
      .finally(() => setIsLoading(false));
  }, []);

  const getRankStyle = (rank: number) => {
    if (rank === 1) return 'text-cosmic-gold';
    if (rank === 2) return 'text-gray-300';
    if (rank === 3) return 'text-amber-600';
    return 'text-star-white/40';
  };

  const getRankIcon = (rank: number) => {
    if (rank === 1) return '🥇';
    if (rank === 2) return '🥈';
    if (rank === 3) return '🥉';
    return '';
  };

  return (
    <div className="py-8 animate-slide-in">
      <h1 className="font-display text-2xl font-bold text-star-white tracking-wide mb-6">
        Ranking
      </h1>

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <span className="font-display text-cosmic-cyan animate-glow-pulse">Loading...</span>
        </div>
      ) : (
        <div className="space-y-3">
          {rankings.map((entry) => (
            <Link
              key={entry.rank}
              to={`/user/${entry.user.id}`}
              className={`cosmic-card flex items-center gap-4 py-4 px-5 ${
                entry.rank <= 3 ? 'border-cosmic-gold/15' : ''
              }`}
            >
              {/* Rank */}
              <div className="w-16 text-center">
                {entry.rank <= 3 ? (
                  <span className="text-2xl">{getRankIcon(entry.rank)}</span>
                ) : (
                  <span className={`font-display text-2xl font-bold ${getRankStyle(entry.rank)}`}>
                    {entry.rank}
                  </span>
                )}
              </div>

              {/* User */}
              <UserAvatar avatarUrl={entry.user.avatarUrl} nickname={entry.user.nickname} size="md" />
              <div className="flex-1 min-w-0">
                <div className="font-display text-lg text-star-white truncate">{entry.user.nickname}</div>
                <div className="text-xs text-star-white/30">Level {entry.level}</div>
              </div>

              {/* Stats */}
              <div className="hidden md:flex items-center gap-6 text-sm">
                <div className="text-center">
                  <div className="font-display font-bold text-cosmic-green">{entry.wins}</div>
                  <div className="text-[10px] text-star-white/30">W</div>
                </div>
                <div className="text-center">
                  <div className="font-display font-bold text-cosmic-red">{entry.losses}</div>
                  <div className="text-[10px] text-star-white/30">L</div>
                </div>
                <div className="text-center">
                  <div className="font-display font-bold text-cosmic-gold">{entry.winRate}%</div>
                  <div className="text-[10px] text-star-white/30">Rate</div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
