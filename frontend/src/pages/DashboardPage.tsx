import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { UserAvatar } from '../components/UserAvatar';
import { api } from '../services/api';
import type { Achievement, Friend } from '../types';

export function DashboardPage() {
  const { user } = useAuth();
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [friends, setFriends] = useState<Friend[]>([]);

  useEffect(() => {
    const token = sessionStorage.getItem('auth_token');
    fetch('/api/users/me/achievements', {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then((r) => r.json())
      .then(setAchievements)
      .catch(console.error);

    api.getFriends()
      .then(setFriends)
      .catch(console.error);
  }, []);

  if (!user) return null;

  const totalGames = user.wins + user.losses;
  const winRate = totalGames > 0 ? Math.round((user.wins / totalGames) * 100) : 0;

  return (
    <div className="py-8 space-y-8 animate-slide-in">
      {/* User Overview Card */}
      <div className="cosmic-card flex flex-col md:flex-row items-center gap-6 md:gap-8">
        <UserAvatar avatarUrl={user.avatarUrl} nickname={user.nickname} size="xl" showRing />

        <div className="flex-1 text-center md:text-left">
          <h1 className="font-display text-3xl font-bold text-star-white mb-1">
            {user.nickname}
          </h1>
          <p className="text-cosmic-cyan/60 text-sm font-display tracking-wide mb-4">
            Level {user.level}
          </p>

          {/* Rank display */}
          <div className="inline-flex items-baseline gap-1 mb-4">
            <span className="font-display text-6xl font-black text-cosmic-cyan text-glow-cyan">
              {user.rank}
            </span>
            <span className="font-display text-2xl text-cosmic-cyan/60">
              {user.rank === 1 ? 'st' : user.rank === 2 ? 'nd' : user.rank === 3 ? 'rd' : 'th'}
            </span>
          </div>

          {/* Stats */}
          <div className="flex items-center justify-center md:justify-start gap-6 text-sm">
            <div className="text-center">
              <div className="font-display text-2xl font-bold text-cosmic-green">{user.wins}</div>
              <div className="text-star-white/40 text-xs">WINS</div>
            </div>
            <div className="text-center">
              <div className="font-display text-2xl font-bold text-cosmic-red">{user.losses}</div>
              <div className="text-star-white/40 text-xs">LOSSES</div>
            </div>
            <div className="text-center">
              <div className="font-display text-2xl font-bold text-cosmic-gold">{winRate}%</div>
              <div className="text-star-white/40 text-xs">WIN RATE</div>
            </div>
          </div>
        </div>

        {/* Edit profile button */}
        <Link
          to="/profile/edit"
          className="cosmic-btn text-sm"
        >
          編集
        </Link>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Link
          to="/matching"
          className="cosmic-card group flex flex-col items-center justify-center py-8 cursor-pointer hover:border-cosmic-green/40"
        >
          <div className="text-4xl mb-3">🏓</div>
          <span className="font-display text-lg text-star-white group-hover:text-cosmic-green transition-colors">
            PLAY PONG
          </span>
          <span className="text-xs text-star-white/30 mt-1">対戦相手を探す</span>
        </Link>

        <Link
          to="/history"
          className="cosmic-card group flex flex-col items-center justify-center py-8 cursor-pointer"
        >
          <div className="text-4xl mb-3">📋</div>
          <span className="font-display text-lg text-star-white group-hover:text-cosmic-cyan transition-colors">
            MATCH HISTORY
          </span>
          <span className="text-xs text-star-white/30 mt-1">対戦履歴を確認</span>
        </Link>

        <Link
          to="/ranking"
          className="cosmic-card group flex flex-col items-center justify-center py-8 cursor-pointer"
        >
          <div className="text-4xl mb-3">🏆</div>
          <span className="font-display text-lg text-star-white group-hover:text-cosmic-gold transition-colors">
            RANKING
          </span>
          <span className="text-xs text-star-white/30 mt-1">ランキングを見る</span>
        </Link>
      </div>

      {/* Two column: Achievements & Friends */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Achievements */}
        <div className="cosmic-card">
          <h2 className="font-display text-sm tracking-wider text-cosmic-cyan/60 uppercase mb-4">
            Achievements
          </h2>
          <div className="space-y-3">
            {achievements.map((a) => (
              <div
                key={a.id}
                className={`flex items-center gap-3 p-3 rounded-lg transition-all ${
                  a.unlockedAt
                    ? 'bg-cosmic-cyan/5 border border-cosmic-cyan/10'
                    : 'bg-white/2 border border-white/5 opacity-40'
                }`}
              >
                <span className="text-2xl">{a.icon}</span>
                <div className="flex-1">
                  <div className="text-sm font-medium text-star-white">{a.name}</div>
                  <div className="text-xs text-star-white/40">{a.description}</div>
                </div>
                {a.unlockedAt && (
                  <div className="text-xs text-cosmic-cyan/50">
                    {new Date(a.unlockedAt).toLocaleDateString('ja-JP')}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Friends */}
        <div className="cosmic-card">
          <h2 className="font-display text-sm tracking-wider text-cosmic-cyan/60 uppercase mb-4">
            Friends
          </h2>
          <div className="space-y-3">
            {friends.map((f) => (
              <Link
                key={f.id}
                to={`/user/${f.user.id}`}
                className="flex items-center gap-3 p-3 rounded-lg hover:bg-white/5 transition-all"
              >
                <UserAvatar
                  avatarUrl={f.user.avatarUrl}
                  nickname={f.user.nickname}
                  size="sm"
                  onlineStatus={f.onlineStatus}
                />
                <div className="flex-1">
                  <div className="text-sm font-medium text-star-white">{f.user.nickname}</div>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full ${
                  f.onlineStatus === 'online' ? 'bg-cosmic-green/10 text-cosmic-green' :
                  f.onlineStatus === 'in-game' ? 'bg-cosmic-gold/10 text-cosmic-gold' :
                  'bg-white/5 text-star-white/30'
                }`}>
                  {f.onlineStatus === 'online' ? 'オンライン' :
                   f.onlineStatus === 'in-game' ? 'ゲーム中' : 'オフライン'}
                </span>
              </Link>
            ))}
            {friends.length === 0 && (
              <p className="text-sm text-star-white/30 text-center py-4">フレンドがいません</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
