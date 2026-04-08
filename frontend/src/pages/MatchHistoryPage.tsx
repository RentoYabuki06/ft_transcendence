import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { UserAvatar } from '../components/UserAvatar';
import { api } from '../services/api';
import type { MatchHistoryEntry } from '../types';

export function MatchHistoryPage() {
  const [matches, setMatches] = useState<MatchHistoryEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState('date_desc');
  const [filter, setFilter] = useState<'all' | 'win' | 'loss'>('all');
  const [isLoading, setIsLoading] = useState(true);
  const limit = 10;

  useEffect(() => {
    setIsLoading(true);
    api.getMatchHistory({ page, limit, sort })
      .then((res) => {
        let filtered = res.data;
        if (filter === 'win') filtered = filtered.filter((m) => m.result === 'win');
        if (filter === 'loss') filtered = filtered.filter((m) => m.result === 'loss');
        setMatches(filtered);
        setTotal(res.total);
      })
      .catch(console.error)
      .finally(() => setIsLoading(false));
  }, [page, sort, filter]);

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="py-8 animate-slide-in">
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-display text-2xl font-bold text-star-white tracking-wide">
          Match History
        </h1>

        <div className="flex items-center gap-3">
          {/* Filter */}
          <div className="flex items-center gap-1 p-1 rounded-lg bg-space-light/50 border border-cosmic-cyan/10">
            {(['all', 'win', 'loss'] as const).map((f) => (
              <button
                key={f}
                onClick={() => { setFilter(f); setPage(1); }}
                className={`px-3 py-1.5 rounded-md text-xs font-display transition-all ${
                  filter === f
                    ? 'bg-cosmic-cyan/15 text-cosmic-cyan border border-cosmic-cyan/20'
                    : 'text-star-white/40 hover:text-star-white/60'
                }`}
              >
                {f === 'all' ? 'ALL' : f === 'win' ? 'WIN' : 'LOSS'}
              </button>
            ))}
          </div>

          {/* Sort */}
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            className="cosmic-input py-1.5 px-3 text-xs w-auto"
          >
            <option value="date_desc">新しい順</option>
            <option value="date_asc">古い順</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="cosmic-card p-0 overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <span className="font-display text-cosmic-cyan animate-glow-pulse">Loading...</span>
          </div>
        ) : matches.length === 0 ? (
          <div className="text-center py-16 text-star-white/30">対戦履歴がありません</div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-cosmic-cyan/10">
                <th className="text-left py-3 px-4 text-xs font-display text-cosmic-cyan/50 tracking-wider">日付</th>
                <th className="text-left py-3 px-4 text-xs font-display text-cosmic-cyan/50 tracking-wider">対戦相手</th>
                <th className="text-center py-3 px-4 text-xs font-display text-cosmic-cyan/50 tracking-wider">スコア</th>
                <th className="text-center py-3 px-4 text-xs font-display text-cosmic-cyan/50 tracking-wider">結果</th>
              </tr>
            </thead>
            <tbody>
              {matches.map((match) => (
                <tr
                  key={match.id}
                  className="border-b border-white/3 hover:bg-white/2 transition-colors"
                >
                  <td className="py-3 px-4 text-sm text-star-white/50">
                    {new Date(match.date).toLocaleDateString('ja-JP', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </td>
                  <td className="py-3 px-4">
                    <Link to={`/user/${match.opponent.id}`} className="flex items-center gap-2 hover:text-cosmic-cyan transition-colors">
                      <UserAvatar avatarUrl={match.opponent.avatarUrl} nickname={match.opponent.nickname} size="sm" />
                      <span className="text-sm text-star-white">{match.opponent.nickname}</span>
                    </Link>
                  </td>
                  <td className="py-3 px-4 text-center font-display text-sm">
                    <span className={match.result === 'win' ? 'text-cosmic-green' : 'text-star-white/50'}>{match.myScore}</span>
                    <span className="text-star-white/20 mx-2">-</span>
                    <span className={match.result === 'loss' ? 'text-cosmic-red' : 'text-star-white/50'}>{match.opponentScore}</span>
                  </td>
                  <td className="py-3 px-4 text-center">
                    <span className={`text-xs font-display px-2 py-0.5 rounded-full ${
                      match.result === 'win'
                        ? 'bg-cosmic-green/10 text-cosmic-green border border-cosmic-green/20'
                        : 'bg-cosmic-red/10 text-cosmic-red border border-cosmic-red/20'
                    }`}>
                      {match.result === 'win' ? 'WIN' : 'LOSS'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-6">
          <button
            onClick={() => setPage(Math.max(1, page - 1))}
            disabled={page === 1}
            className="cosmic-btn text-xs py-1.5 px-3 disabled:opacity-30"
          >
            前へ
          </button>
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
            <button
              key={p}
              onClick={() => setPage(p)}
              className={`w-8 h-8 rounded-lg text-xs font-display transition-all ${
                page === p
                  ? 'bg-cosmic-cyan/15 text-cosmic-cyan border border-cosmic-cyan/30'
                  : 'text-star-white/30 hover:text-star-white/60 hover:bg-white/5'
              }`}
            >
              {p}
            </button>
          ))}
          <button
            onClick={() => setPage(Math.min(totalPages, page + 1))}
            disabled={page === totalPages}
            className="cosmic-btn text-xs py-1.5 px-3 disabled:opacity-30"
          >
            次へ
          </button>
        </div>
      )}
    </div>
  );
}
