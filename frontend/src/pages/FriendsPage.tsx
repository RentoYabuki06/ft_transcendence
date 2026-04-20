import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/api';
import { usePresence } from '../hooks/usePresence';
import { UserAvatar } from '../components/UserAvatar';
import type { Friend } from '../types';

interface SearchResult {
  id: number;
  nickname: string;
  avatarUrl: string | null;
}

export function FriendsPage() {
  const { isOnline } = usePresence();
  const [friends, setFriends] = useState<Friend[]>([]);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState('');

  const loadFriends = () => {
    api.getFriends().then(setFriends).catch((e) => setError(e.message));
  };

  useEffect(() => {
    loadFriends();
  }, []);

  useEffect(() => {
    if (query.trim().length === 0) {
      setResults([]);
      return;
    }
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        const r = await api.searchUsers(query.trim());
        setResults(r);
      } catch (e) {
        setError(e instanceof Error ? e.message : '検索に失敗しました');
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [query]);

  const handleAdd = async (userId: number) => {
    try {
      await api.addFriend(userId);
      setQuery('');
      setResults([]);
      loadFriends();
    } catch (e) {
      setError(e instanceof Error ? e.message : '追加に失敗しました');
    }
  };

  const handleRemove = async (userId: number) => {
    if (!confirm('このフレンドを削除しますか？')) return;
    try {
      await api.removeFriend(userId);
      loadFriends();
    } catch (e) {
      setError(e instanceof Error ? e.message : '削除に失敗しました');
    }
  };

  const friendIds = new Set(friends.map((f) => f.user.id));

  return (
    <div className="py-8 max-w-3xl mx-auto animate-slide-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <h1 className="font-display text-2xl font-bold text-star-white tracking-wide">FRIENDS</h1>

      {error && (
        <div className="p-3 rounded-xl bg-cosmic-red/10 border border-cosmic-red/30 text-cosmic-red text-sm">
          {error}
        </div>
      )}

      {/* 検索 */}
      <div className="cosmic-card" style={{ padding: '1.25rem 1.5rem' }}>
        <label className="block text-xs text-star-white/50 font-display tracking-wider mb-2">
          USER SEARCH
        </label>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="ニックネームで検索..."
          className="cosmic-input"
        />
        {searching && <p className="text-xs text-cosmic-cyan/50 mt-2">検索中...</p>}
        {results.length > 0 && (
          <div style={{ marginTop: '0.875rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {results.map((u) => (
              <div
                key={u.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  padding: '0.5rem 0.75rem',
                  borderRadius: '10px',
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.05)',
                }}
              >
                <UserAvatar avatarUrl={u.avatarUrl} nickname={u.nickname} size="sm" />
                <div style={{ flex: 1, color: '#faf5ff', fontSize: '0.9rem' }}>{u.nickname}</div>
                {friendIds.has(u.id) ? (
                  <span className="text-xs text-star-white/40">追加済</span>
                ) : (
                  <button onClick={() => handleAdd(u.id)} className="cosmic-btn" style={{ fontSize: '0.75rem', padding: '0.4rem 1rem' }}>
                    追加
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* フレンド一覧 */}
      <div className="cosmic-card" style={{ padding: '1.25rem 1.5rem' }}>
        <h2 className="font-display text-xs tracking-wider text-cosmic-cyan/60 uppercase mb-3">
          MY FRIENDS ({friends.length})
        </h2>
        {friends.length === 0 ? (
          <p className="text-sm text-star-white/30 text-center py-4">フレンドがいません</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {friends.map((f) => (
              <div
                key={f.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  padding: '0.625rem 0.875rem',
                  borderRadius: '12px',
                  background: 'rgba(255,255,255,0.02)',
                  border: '1px solid rgba(255,255,255,0.05)',
                }}
              >
                <Link to={`/user/${f.user.id}`} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1, textDecoration: 'none' }}>
                  <UserAvatar
                    avatarUrl={f.user.avatarUrl}
                    nickname={f.user.nickname}
                    size="sm"
                    onlineStatus={isOnline(f.user.id) ? 'online' : 'offline'}
                  />
                  <div style={{ color: '#faf5ff', fontSize: '0.9rem' }}>{f.user.nickname}</div>
                </Link>
                <Link to={`/chat/${f.user.id}`} className="cosmic-btn" style={{ fontSize: '0.7rem', padding: '0.35rem 0.8rem' }}>
                  💬
                </Link>
                <button onClick={() => handleRemove(f.user.id)} className="cosmic-btn" style={{ fontSize: '0.7rem', padding: '0.35rem 0.8rem', borderColor: 'rgba(251,113,133,0.3)' }}>
                  削除
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
