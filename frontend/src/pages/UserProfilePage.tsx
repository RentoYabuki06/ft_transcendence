import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { UserAvatar } from '../components/UserAvatar';
import { api } from '../services/api';
import { useAuth } from '../hooks/useAuth';
import { usePresence } from '../hooks/usePresence';
import type { User, Friend } from '../types';

export function UserProfilePage() {
  const { id } = useParams<{ id: string }>();
  const { user: me } = useAuth();
  const { isOnline } = usePresence();
  const [user, setUser] = useState<User | null>(null);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [blocks, setBlocks] = useState<Array<{ id: number }>>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [actionBusy, setActionBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const loadAll = () => {
    if (!id) return;
    setIsLoading(true);
    Promise.all([
      api.getUser(Number(id)),
      api.getFriends().catch(() => []),
      api.getBlocks().catch(() => []),
    ])
      .then(([u, fs, bs]) => {
        setUser(u);
        setFriends(fs as Friend[]);
        setBlocks(bs as Array<{ id: number }>);
      })
      .catch((err) => setError(err.message))
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const isSelf = me?.id === user?.id;
  const isFriend = friends.some((f) => f.user.id === user?.id);
  const isBlocked = blocks.some((b) => b.id === user?.id);

  const handleAddFriend = async () => {
    if (!user) return;
    setActionBusy(true);
    setMessage('');
    try {
      await api.addFriend(user.id);
      setMessage('フレンドに追加しました');
      loadAll();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : '追加に失敗しました');
    } finally {
      setActionBusy(false);
    }
  };

  const handleRemoveFriend = async () => {
    if (!user) return;
    if (!confirm('このフレンドを削除しますか？')) return;
    setActionBusy(true);
    try {
      await api.removeFriend(user.id);
      setMessage('フレンドを削除しました');
      loadAll();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : '削除に失敗しました');
    } finally {
      setActionBusy(false);
    }
  };

  const handleBlock = async () => {
    if (!user) return;
    if (!confirm('このユーザーをブロックしますか？フレンド関係も解除されます。')) return;
    setActionBusy(true);
    try {
      await api.blockUser(user.id);
      setMessage('ブロックしました');
      loadAll();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'ブロックに失敗しました');
    } finally {
      setActionBusy(false);
    }
  };

  const handleUnblock = async () => {
    if (!user) return;
    setActionBusy(true);
    try {
      await api.unblockUser(user.id);
      setMessage('ブロックを解除しました');
      loadAll();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : '解除に失敗しました');
    } finally {
      setActionBusy(false);
    }
  };

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
          <UserAvatar
            avatarUrl={user.avatarUrl}
            nickname={user.nickname}
            size="xl"
            showRing
            onlineStatus={isOnline(user.id) ? 'online' : 'offline'}
          />
          <h1 className="font-display text-3xl font-bold text-star-white mt-4">
            {user.nickname}
          </h1>
          <p className="text-cosmic-cyan/60 text-sm font-display tracking-wide">
            Level {user.level}
          </p>
        </div>

        {/* Action buttons */}
        {!isSelf && (
          <div className="flex items-center justify-center gap-3 flex-wrap mb-6">
            {isBlocked ? (
              <button onClick={handleUnblock} disabled={actionBusy} className="cosmic-btn text-sm">
                ブロック解除
              </button>
            ) : (
              <>
                {isFriend ? (
                  <button
                    onClick={handleRemoveFriend}
                    disabled={actionBusy}
                    className="cosmic-btn text-sm"
                  >
                    フレンド解除
                  </button>
                ) : (
                  <button
                    onClick={handleAddFriend}
                    disabled={actionBusy}
                    className="cosmic-btn cosmic-btn-primary text-sm"
                  >
                    ＋ フレンド追加
                  </button>
                )}
                <Link to={`/chat/${user.id}`} className="cosmic-btn text-sm">
                  💬 メッセージ
                </Link>
                <button
                  onClick={handleBlock}
                  disabled={actionBusy}
                  className="cosmic-btn text-sm"
                  style={{ borderColor: 'rgba(251,113,133,0.3)', color: '#fb7185' }}
                >
                  ブロック
                </button>
              </>
            )}
          </div>
        )}
        {message && (
          <p className="text-center text-sm text-cosmic-cyan/70 mb-4">{message}</p>
        )}

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
