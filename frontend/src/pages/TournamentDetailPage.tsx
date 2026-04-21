import { useEffect, useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { UserAvatar } from '../components/UserAvatar';

interface Participant {
  id: number;
  userId: number;
  alias: string;
  nickname?: string;
  avatarUrl?: string | null;
}

interface BracketGame {
  id: number;
  round: number;
  order: number;
  status?: string;
  winnerId: number | null;
  players: Array<{ userId: number; nickname?: string; score: number | null; isWinner: boolean | null }>;
}

interface TournamentDetail {
  id: number;
  name: string;
  createdBy: number;
  maxParticipants: number;
  status: { id: number; name: string } | null;
  participants: Participant[];
  bracket: BracketGame[];
  createdAt: string;
  updatedAt: string;
}

export function TournamentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const tournamentId = id ? parseInt(id, 10) : null;
  const [detail, setDetail] = useState<TournamentDetail | null>(null);
  const [myId, setMyId] = useState<number | null>(null);
  const [alias, setAlias] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = () => {
    if (!tournamentId) return;
    api.getTournament(tournamentId).then(setDetail).catch((e) => setError(e.message));
  };

  useEffect(() => {
    api.getMe().then((u) => setMyId(u.id)).catch(() => {});
  }, []);

  useEffect(() => {
    load();
  }, [tournamentId]);

  if (!tournamentId) return <div className="py-8 text-center">無効なIDです</div>;
  if (!detail) return <div className="py-8 text-center text-star-white/50">読み込み中...</div>;

  const isOwner = myId === detail.createdBy;
  const alreadyJoined = detail.participants.some((p) => p.userId === myId);
  const isPending = detail.status?.name === 'pending';
  const canJoin = isPending && !alreadyJoined && detail.participants.length < detail.maxParticipants;
  const canStart = isOwner && isPending && detail.participants.length >= 4;

  const handleJoin = async () => {
    setBusy(true);
    setError('');
    try {
      await api.joinTournament(tournamentId, alias.trim() || undefined);
      setAlias('');
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : '参加に失敗しました');
    } finally {
      setBusy(false);
    }
  };

  const handleLeave = async () => {
    const confirmMsg = isOwner
      ? 'このトーナメントを解散しますか？全参加者が削除されます。'
      : 'このトーナメントから抜けますか？';
    if (!confirm(confirmMsg)) return;
    setBusy(true);
    setError('');
    try {
      const res = await api.leaveTournament(tournamentId);
      if (res.deleted) {
        navigate('/tournaments');
      } else {
        load();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : '退出に失敗しました');
    } finally {
      setBusy(false);
    }
  };

  const handleStart = async () => {
    if (!confirm('トーナメントを開始しますか？開始後は参加できません。')) return;
    setBusy(true);
    setError('');
    try {
      await api.startTournament(tournamentId);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : '開始に失敗しました');
    } finally {
      setBusy(false);
    }
  };

  // ラウンドごとにグルーピング
  const rounds = detail.bracket.reduce<Map<number, BracketGame[]>>((acc, g) => {
    const arr = acc.get(g.round) ?? [];
    arr.push(g);
    acc.set(g.round, arr);
    return acc;
  }, new Map());
  const sortedRounds = [...rounds.entries()].sort(([a], [b]) => a - b);

  return (
    <div className="py-8 max-w-4xl mx-auto animate-slide-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <Link to="/tournaments" className="cosmic-btn" style={{ fontSize: '0.75rem', padding: '0.4rem 0.8rem' }}>
          ← 一覧
        </Link>
        <h1 className="font-display text-2xl font-bold text-star-white tracking-wide">{detail.name}</h1>
        <span style={{
          fontSize: '0.7rem',
          padding: '0.2rem 0.6rem',
          borderRadius: '999px',
          background: 'rgba(255,255,255,0.05)',
          color: '#ff4fd8',
          border: '1px solid rgba(255,79,216,0.4)',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          fontWeight: 700,
        }}>
          {detail.status?.name}
        </span>
      </div>

      {error && (
        <div className="p-3 rounded-xl bg-cosmic-red/10 border border-cosmic-red/30 text-cosmic-red text-sm">
          {error}
        </div>
      )}

      {/* 参加者 */}
      <div className="cosmic-card" style={{ padding: '1.25rem 1.5rem' }}>
        <h2 className="font-display text-xs tracking-wider text-cosmic-cyan/60 uppercase mb-3">
          PARTICIPANTS ({detail.participants.length} / {detail.maxParticipants})
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '0.5rem' }}>
          {detail.participants.map((p) => (
            <div
              key={p.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.5rem 0.75rem',
                borderRadius: '10px',
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.05)',
              }}
            >
              <UserAvatar avatarUrl={p.avatarUrl ?? null} nickname={p.nickname ?? p.alias} size="sm" />
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ color: '#faf5ff', fontSize: '0.85rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {p.alias}
                </div>
                {p.nickname && p.nickname !== p.alias && (
                  <div style={{ color: 'rgba(250,245,255,0.4)', fontSize: '0.7rem' }}>@{p.nickname}</div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* アクション */}
        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
          {canJoin && (
            <>
              <input
                type="text"
                value={alias}
                onChange={(e) => setAlias(e.target.value)}
                placeholder="大会内表示名 (任意)"
                className="cosmic-input"
                style={{ flex: 1, minWidth: '200px' }}
                maxLength={30}
              />
              <button onClick={handleJoin} className="cosmic-btn" disabled={busy}>
                参加
              </button>
            </>
          )}
          {canStart && (
            <button onClick={handleStart} className="cosmic-btn" disabled={busy} style={{ marginLeft: 'auto' }}>
              トーナメント開始
            </button>
          )}
          {alreadyJoined && isPending && (
            <>
              <span className="text-xs text-cosmic-cyan/60">参加済み</span>
              <button
                onClick={handleLeave}
                className="cosmic-btn"
                disabled={busy}
                style={{ fontSize: '0.75rem', padding: '0.4rem 1rem', borderColor: 'rgba(251,113,133,0.3)', color: '#fb7185' }}
              >
                {isOwner ? 'トーナメントを解散' : 'トーナメントから抜ける'}
              </button>
            </>
          )}
        </div>
      </div>

      {/* ブラケット */}
      {detail.bracket.length > 0 && (
        <div className="cosmic-card" style={{ padding: '1.25rem 1.5rem' }}>
          <h2 className="font-display text-xs tracking-wider text-cosmic-cyan/60 uppercase mb-3">BRACKET</h2>
          <div style={{ display: 'flex', gap: '1rem', overflowX: 'auto', paddingBottom: '0.5rem' }}>
            {sortedRounds.map(([round, games]) => (
              <div key={round} style={{ minWidth: '220px', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <div style={{ fontSize: '0.7rem', color: 'rgba(250,245,255,0.5)', letterSpacing: '0.1em', fontWeight: 700 }}>
                  ROUND {round}
                </div>
                {games.sort((a, b) => a.order - b.order).map((g) => {
                  const isMyGame = myId !== null && g.players.some((p) => p.userId === myId);
                  const isPlayable = isMyGame && g.status === 'pending';
                  const content = (
                    <>
                      {g.players.map((pl, idx) => (
                        <div
                          key={idx}
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            fontSize: '0.8rem',
                            color: pl.isWinner ? '#ff4fd8' : '#faf5ff',
                            fontWeight: pl.isWinner ? 700 : 400,
                          }}
                        >
                          <span>{pl.nickname ?? `#${pl.userId}`}</span>
                          <span>{pl.score ?? '-'}</span>
                        </div>
                      ))}
                      <div style={{ fontSize: '0.65rem', color: 'rgba(250,245,255,0.4)' }}>
                        {g.status}
                        {isPlayable && <span style={{ color: '#ff4fd8', marginLeft: '0.5rem', fontWeight: 700 }}>▶ あなたの番</span>}
                      </div>
                    </>
                  );
                  const commonStyle: React.CSSProperties = {
                    padding: '0.5rem 0.75rem',
                    borderRadius: '10px',
                    background: isPlayable ? 'rgba(255,79,216,0.1)' : 'rgba(255,255,255,0.03)',
                    border: `1px solid ${isPlayable ? 'rgba(255,79,216,0.4)' : 'rgba(255,255,255,0.08)'}`,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.25rem',
                    textDecoration: 'none',
                  };
                  return isPlayable ? (
                    <Link key={g.id} to={`/game/${g.id}`} style={commonStyle}>{content}</Link>
                  ) : (
                    <div key={g.id} style={commonStyle}>{content}</div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
