import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { usePresence } from '../hooks/usePresence';
import { UserAvatar } from '../components/UserAvatar';
import { api } from '../services/api';
import type { Achievement, Friend } from '../types';

function NeonLine() {
  return (
    <div
      style={{
        height: '1.5px',
        borderRadius: '999px',
        background: 'linear-gradient(90deg, #6ee7ff, #ff4fd8, #b84dff)',
        boxShadow: '0 0 6px #6ee7ff, 0 0 12px #ff4fd8, 0 0 20px #b84dff',
        marginBottom: '0.875rem',
      }}
    />
  );
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <h2
        className="font-display"
        style={{ fontSize: '0.7rem', letterSpacing: '0.2em', color: 'rgba(255,255,255,0.45)', marginBottom: '0.5rem' }}
      >
        {children}
      </h2>
      <NeonLine />
    </div>
  );
}

export function DashboardPage() {
  const { user } = useAuth();
  const { isOnline } = usePresence();
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
    api.getFriends().then(setFriends).catch(console.error);
  }, []);

  if (!user) return null;

  const totalGames = user.wins + user.losses;
  const winRate = totalGames > 0 ? Math.round((user.wins / totalGames) * 100) : 0;

  const quickActions = [
    { to: '/play',     icon: '🏓', label: 'PLAY PONG',     sub: 'モードを選択',    color: '#34d399' },
    { to: '/history',  icon: '📋', label: 'MATCH HISTORY', sub: '対戦履歴',        color: '#6ee7ff' },
    { to: '/ranking',  icon: '🏆', label: 'RANKING',       sub: 'ランキングを見る', color: '#fcd34d' },
  ];

  return (
    <div
      className="animate-slide-in"
      style={{ display: 'flex', flexDirection: 'column', gap: '1rem', paddingBottom: '0.5rem' }}
    >
      {/* ── プロフィールカード ── */}
      <div
        className="cosmic-card"
        style={{
          flexShrink: 0,
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: '1.5rem',
          padding: '1.25rem 1.75rem',
        }}
      >
        <UserAvatar avatarUrl={user.avatarUrl} nickname={user.nickname} size="xl" showRing />

        <div style={{ flex: '1 1 180px' }}>
          <h1
            className="font-display font-black"
            style={{
              fontSize: 'clamp(1.25rem, 2.5vw, 1.75rem)',
              color: '#faf5ff',
              textShadow: '0 0 12px rgba(255,79,216,0.5)',
              marginBottom: '0.2rem',
            }}
          >
            {user.nickname}
          </h1>
          <p className="font-display" style={{ fontSize: '0.7rem', letterSpacing: '0.18em', color: 'rgba(110,231,255,0.6)' }}>
            LEVEL {user.level}
          </p>
        </div>

        {/* ランク */}
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.25rem' }}>
          <span
            className="font-display font-black"
            style={{
              fontSize: 'clamp(2.5rem, 5vw, 3.5rem)',
              color: '#6ee7ff',
              textShadow: '0 0 8px rgba(255,255,255,0.8), 0 0 18px #6ee7ff, 0 0 40px #b84dff',
              lineHeight: 1,
            }}
          >
            {user.rank}
          </span>
          <span className="font-display" style={{ fontSize: '1.1rem', color: 'rgba(110,231,255,0.5)' }}>
            {user.rank === 1 ? 'st' : user.rank === 2 ? 'nd' : user.rank === 3 ? 'rd' : 'th'}
          </span>
        </div>

        {/* 統計 */}
        <div
          style={{
            display: 'flex',
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '999px',
            overflow: 'hidden',
          }}
        >
          {[
            { val: user.wins,     label: 'WINS',     color: '#34d399' },
            { val: user.losses,   label: 'LOSSES',   color: '#fb7185' },
            { val: `${winRate}%`, label: 'WIN RATE', color: '#fcd34d' },
          ].map((s, i) => (
            <div key={s.label} style={{ display: 'flex', alignItems: 'center' }}>
              {i > 0 && <div style={{ width: '1px', background: 'rgba(255,255,255,0.1)', margin: '0.75rem 0' }} />}
              <div className="text-center" style={{ padding: '0.6rem 1.1rem' }}>
                <div
                  className="font-display font-black"
                  style={{ fontSize: '1.25rem', color: s.color, textShadow: `0 0 10px ${s.color}` }}
                >
                  {s.val}
                </div>
                <div style={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.35)', letterSpacing: '0.1em' }}>
                  {s.label}
                </div>
              </div>
            </div>
          ))}
        </div>

        <Link to="/profile/edit" className="cosmic-btn" style={{ fontSize: '0.8rem', padding: '0.6rem 1.4rem', flexShrink: 0 }}>
          ✏️ 編集
        </Link>
      </div>

      {/* ── クイックアクション ── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
          gap: '1rem',
        }}
      >
        {quickActions.map((action) => (
          <Link
            key={action.to}
            to={action.to}
            className="cosmic-card"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '1rem',
              padding: '1rem 1.5rem',
              textDecoration: 'none',
              border: `1px solid ${action.color}33`,
              transition: 'all 0.22s ease',
            }}
            onMouseEnter={(e) => {
              const el = e.currentTarget as HTMLElement;
              el.style.boxShadow = `0 0 18px ${action.color}44, 0 0 36px ${action.color}22`;
              el.style.borderColor = `${action.color}66`;
              el.style.transform = 'translateY(-2px)';
            }}
            onMouseLeave={(e) => {
              const el = e.currentTarget as HTMLElement;
              el.style.boxShadow = '';
              el.style.borderColor = `${action.color}33`;
              el.style.transform = '';
            }}
          >
            <div style={{ fontSize: '2rem', lineHeight: 1, flexShrink: 0 }}>{action.icon}</div>
            <div>
              <div
                className="font-display font-bold"
                style={{ fontSize: '0.85rem', letterSpacing: '0.1em', color: action.color, textShadow: `0 0 8px ${action.color}` }}
              >
                {action.label}
              </div>
              <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.3)', marginTop: '0.15rem' }}>
                {action.sub}
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* ── 実績 & フレンド ── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
          gap: '1rem',
        }}
      >
        {/* 実績 */}
        <div
          className="cosmic-card"
          style={{ padding: '1.25rem 1.5rem', display: 'flex', flexDirection: 'column' }}
        >
          <SectionHeading>ACHIEVEMENTS</SectionHeading>
          <div style={{ maxHeight: '260px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
            {achievements.map((a) => (
              <div
                key={a.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.875rem',
                  padding: '0.625rem 0.875rem',
                  borderRadius: '12px',
                  background: a.unlockedAt ? 'rgba(110,231,255,0.06)' : 'rgba(255,255,255,0.02)',
                  border: a.unlockedAt ? '1px solid rgba(110,231,255,0.16)' : '1px solid rgba(255,255,255,0.05)',
                  opacity: a.unlockedAt ? 1 : 0.4,
                  flexShrink: 0,
                }}
              >
                <span style={{ fontSize: '1.4rem' }}>{a.icon}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#faf5ff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.name}</div>
                  <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.35)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.description}</div>
                </div>
                {a.unlockedAt && (
                  <div style={{ fontSize: '0.65rem', color: 'rgba(110,231,255,0.5)', flexShrink: 0 }}>
                    {new Date(a.unlockedAt).toLocaleDateString('ja-JP')}
                  </div>
                )}
              </div>
            ))}
            {achievements.length === 0 && (
              <p style={{ textAlign: 'center', color: 'rgba(255,255,255,0.25)', fontSize: '0.85rem', paddingTop: '1.5rem' }}>実績なし</p>
            )}
          </div>
        </div>

        {/* フレンド */}
        <div
          className="cosmic-card"
          style={{ padding: '1.25rem 1.5rem', display: 'flex', flexDirection: 'column' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
            <SectionHeading>FRIENDS</SectionHeading>
            <Link
              to="/friends"
              style={{
                fontSize: '0.7rem',
                color: 'rgba(110,231,255,0.7)',
                textDecoration: 'none',
                padding: '0.2rem 0.6rem',
                borderRadius: '999px',
                border: '1px solid rgba(110,231,255,0.25)',
                transition: 'all 0.18s ease',
                letterSpacing: '0.05em',
              }}
              onMouseEnter={(e) => {
                const el = e.currentTarget as HTMLElement;
                el.style.background = 'rgba(255,79,216,0.12)';
                el.style.borderColor = 'rgba(255,79,216,0.4)';
                el.style.color = '#ff4fd8';
              }}
              onMouseLeave={(e) => {
                const el = e.currentTarget as HTMLElement;
                el.style.background = 'transparent';
                el.style.borderColor = 'rgba(110,231,255,0.25)';
                el.style.color = 'rgba(110,231,255,0.7)';
              }}
            >
              All →
            </Link>
          </div>
          <div style={{ maxHeight: '260px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
            {friends.map((f) => (
              <Link
                key={f.id}
                to={`/user/${f.user.id}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.875rem',
                  padding: '0.625rem 0.875rem',
                  borderRadius: '12px',
                  textDecoration: 'none',
                  background: 'rgba(255,255,255,0.02)',
                  border: '1px solid rgba(255,255,255,0.05)',
                  transition: 'all 0.18s ease',
                  flexShrink: 0,
                }}
                onMouseEnter={(e) => {
                  const el = e.currentTarget as HTMLElement;
                  el.style.background = 'rgba(255,79,216,0.07)';
                  el.style.borderColor = 'rgba(255,79,216,0.2)';
                }}
                onMouseLeave={(e) => {
                  const el = e.currentTarget as HTMLElement;
                  el.style.background = 'rgba(255,255,255,0.02)';
                  el.style.borderColor = 'rgba(255,255,255,0.05)';
                }}
              >
                <UserAvatar
                  avatarUrl={f.user.avatarUrl}
                  nickname={f.user.nickname}
                  size="sm"
                  onlineStatus={isOnline(f.user.id) ? 'online' : 'offline'}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#faf5ff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {f.user.nickname}
                  </div>
                </div>
              </Link>
            ))}
            {friends.length === 0 && (
              <p style={{ textAlign: 'center', color: 'rgba(255,255,255,0.25)', fontSize: '0.85rem', paddingTop: '1.5rem' }}>フレンドがいません</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
