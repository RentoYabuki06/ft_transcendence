import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/api';

interface TournamentItem {
  id: number;
  name: string;
  createdBy: number;
  maxParticipants: number;
  participantCount: number;
  status: { id: number; name: string } | null;
  createdAt: string;
}

export function TournamentListPage() {
  const [tournaments, setTournaments] = useState<TournamentItem[]>([]);
  const [name, setName] = useState('');
  const [maxParticipants, setMaxParticipants] = useState<4 | 8>(4);
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);

  const load = () => {
    api.getTournaments().then(setTournaments).catch((e) => setError(e.message));
  };

  useEffect(() => {
    load();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim().length === 0) {
      setError('トーナメント名を入力してください');
      return;
    }
    setCreating(true);
    setError('');
    try {
      await api.createTournament(name.trim(), maxParticipants);
      setName('');
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : '作成に失敗しました');
    } finally {
      setCreating(false);
    }
  };

  const statusColor = (name?: string) => {
    if (name === 'ongoing') return '#6ee7ff';
    if (name === 'finished') return 'rgba(250,245,255,0.4)';
    return '#ff4fd8';
  };

  return (
    <div className="py-8 max-w-3xl mx-auto animate-slide-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <h1 className="font-display text-2xl font-bold text-star-white tracking-wide">TOURNAMENTS</h1>

      {error && (
        <div className="p-3 rounded-xl bg-cosmic-red/10 border border-cosmic-red/30 text-cosmic-red text-sm">
          {error}
        </div>
      )}

      {/* 作成フォーム */}
      <form onSubmit={handleCreate} className="cosmic-card" style={{ padding: '1.25rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        <h2 className="font-display text-xs tracking-wider text-cosmic-cyan/60 uppercase">CREATE TOURNAMENT</h2>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="トーナメント名"
          className="cosmic-input"
          maxLength={50}
        />
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <span style={{ fontSize: '0.8rem', color: 'rgba(250,245,255,0.6)' }}>定員:</span>
          {[4, 8].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setMaxParticipants(n as 4 | 8)}
              className="cosmic-btn"
              style={{
                fontSize: '0.75rem',
                padding: '0.4rem 0.9rem',
                opacity: maxParticipants === n ? 1 : 0.4,
                borderColor: maxParticipants === n ? 'rgba(255,79,216,0.6)' : undefined,
              }}
            >
              {n}人
            </button>
          ))}
          <button type="submit" className="cosmic-btn" disabled={creating} style={{ marginLeft: 'auto' }}>
            {creating ? '作成中...' : '作成'}
          </button>
        </div>
      </form>

      {/* 一覧 */}
      <div className="cosmic-card" style={{ padding: '1.25rem 1.5rem' }}>
        <h2 className="font-display text-xs tracking-wider text-cosmic-cyan/60 uppercase mb-3">
          ALL TOURNAMENTS ({tournaments.length})
        </h2>
        {tournaments.length === 0 ? (
          <p className="text-sm text-star-white/30 text-center py-4">トーナメントがありません</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {tournaments.map((t) => (
              <Link
                key={t.id}
                to={`/tournaments/${t.id}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  padding: '0.75rem 0.875rem',
                  borderRadius: '12px',
                  background: 'rgba(255,255,255,0.02)',
                  border: '1px solid rgba(255,255,255,0.05)',
                  textDecoration: 'none',
                }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ color: '#faf5ff', fontSize: '0.95rem', fontWeight: 600 }}>{t.name}</div>
                  <div style={{ fontSize: '0.72rem', color: 'rgba(250,245,255,0.5)', marginTop: '0.2rem' }}>
                    {t.participantCount} / {t.maxParticipants} 人 ・ {new Date(t.createdAt).toLocaleString('ja-JP')}
                  </div>
                </div>
                <span style={{
                  fontSize: '0.7rem',
                  padding: '0.2rem 0.6rem',
                  borderRadius: '999px',
                  background: 'rgba(255,255,255,0.05)',
                  color: statusColor(t.status?.name),
                  border: `1px solid ${statusColor(t.status?.name)}55`,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  fontWeight: 700,
                }}>
                  {t.status?.name ?? 'unknown'}
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
