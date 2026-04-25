import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../services/api';
import { UserAvatar } from '../components/UserAvatar';
import { useChatNotifications } from '../hooks/useChatNotifications';

interface Conversation {
  partnerId: number;
  nickname: string;
  avatarUrl: string | null;
  lastMessage: { body: string; createdAt: string; fromMe: boolean };
  unreadCount: number;
}

interface Message {
  id: number;
  senderId: number;
  receiverId: number;
  body: string;
  createdAt: string;
  readAt: string | null;
}

export function ChatPage() {
  const { userId } = useParams<{ userId?: string }>();
  const partnerId = userId ? parseInt(userId, 10) : null;

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [partner, setPartner] = useState<{ id: number; nickname: string; avatarUrl: string | null } | null>(null);
  const [input, setInput] = useState('');
  const [error, setError] = useState('');
  const [myId, setMyId] = useState<number | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const { clearUnread, refresh: refreshUnread } = useChatNotifications();

  // 自分のIDを取得
  useEffect(() => {
    api.getMe().then((u) => setMyId(u.id)).catch(() => {});
  }, []);

  // 会話一覧
  const loadConversations = () => {
    api.getConversations().then(setConversations).catch((e) => setError(e.message));
  };

  useEffect(() => {
    loadConversations();
  }, []);

  // 個別会話のメッセージ読み込み
  useEffect(() => {
    if (!partnerId) return;
    setMessages([]);
    api.getMessages(partnerId).then((msgs) => {
      setMessages(msgs);
      clearUnread(partnerId);
      refreshUnread();
    }).catch((e) => setError(e.message));

    // 相手の情報取得
    api.getUser(partnerId).then((u) =>
      setPartner({ id: u.id, nickname: u.nickname, avatarUrl: u.avatarUrl })
    ).catch(() => {});
  }, [partnerId]);

  // WebSocket 接続（リアルタイム受信、自動再接続）
  useEffect(() => {
    const token = sessionStorage.getItem('auth_token');
    if (!token) return;
    let closed = false;
    let retryTimer: number | null = null;

    const connect = () => {
      if (closed) return;
      const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const ws = new WebSocket(`${proto}//${window.location.host}/api/ws/chat?token=${encodeURIComponent(token)}`);
      wsRef.current = ws;
      ws.onmessage = (ev) => {
        try {
          const data = JSON.parse(ev.data);
          if (data.type === 'chat_message') {
            if (partnerId && (data.senderId === partnerId || data.receiverId === partnerId)) {
              setMessages((prev) => [...prev, {
                id: data.id,
                senderId: data.senderId,
                receiverId: data.receiverId,
                body: data.body,
                createdAt: data.createdAt,
                readAt: null,
              }]);
            }
            loadConversations();
          }
        } catch {}
      };
      ws.onclose = () => {
        if (closed) return;
        retryTimer = window.setTimeout(connect, 3000);
      };
    };

    connect();

    return () => {
      closed = true;
      if (retryTimer) clearTimeout(retryTimer);
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, [partnerId]);

  // 自動スクロール
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!partnerId || input.trim().length === 0) return;
    const body = input.trim();
    setInput('');
    try {
      const sent = await api.sendMessage(partnerId, body);
      setMessages((prev) => [...prev, { ...sent, readAt: null }]);
      loadConversations();
    } catch (e) {
      setError(e instanceof Error ? e.message : '送信に失敗しました');
    }
  };

  // 会話一覧ビュー
  if (!partnerId) {
    return (
      <div className="py-8 max-w-3xl mx-auto animate-slide-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        <h1 className="font-display text-2xl font-bold text-star-white tracking-wide">CHAT</h1>

        {error && (
          <div className="p-3 rounded-xl bg-cosmic-red/10 border border-cosmic-red/30 text-cosmic-red text-sm">
            {error}
          </div>
        )}

        <div className="cosmic-card" style={{ padding: '1.25rem 1.5rem' }}>
          <h2 className="font-display text-xs tracking-wider text-cosmic-cyan/60 uppercase mb-3">
            CONVERSATIONS ({conversations.length})
          </h2>
          {conversations.length === 0 ? (
            <p className="text-sm text-star-white/30 text-center py-4">
              会話がありません。<Link to="/friends" className="text-cosmic-cyan underline">フレンド</Link>から開始してください。
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {conversations.map((c) => (
                <Link
                  key={c.partnerId}
                  to={`/chat/${c.partnerId}`}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    padding: '0.625rem 0.875rem',
                    borderRadius: '12px',
                    background: 'rgba(255,255,255,0.02)',
                    border: '1px solid rgba(255,255,255,0.05)',
                    textDecoration: 'none',
                  }}
                >
                  <UserAvatar avatarUrl={c.avatarUrl} nickname={c.nickname} size="sm" />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ color: '#faf5ff', fontSize: '0.9rem', fontWeight: 600 }}>{c.nickname}</div>
                    <div style={{
                      color: 'rgba(250,245,255,0.5)',
                      fontSize: '0.75rem',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}>
                      {c.lastMessage.fromMe ? '自分: ' : ''}{c.lastMessage.body}
                    </div>
                  </div>
                  {c.unreadCount > 0 && (
                    <span style={{
                      background: 'var(--neon-pink, #ff4fd8)',
                      color: '#fff',
                      fontSize: '0.7rem',
                      padding: '0.2rem 0.5rem',
                      borderRadius: '999px',
                      fontWeight: 700,
                    }}>
                      {c.unreadCount}
                    </span>
                  )}
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // 個別会話ビュー
  return (
    <div className="py-8 max-w-3xl mx-auto animate-slide-in" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', height: 'calc(100vh - 8rem)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <Link to="/chat" className="cosmic-btn" style={{ fontSize: '0.75rem', padding: '0.4rem 0.8rem' }}>
          ← 戻る
        </Link>
        {partner && (
          <Link to={`/user/${partner.id}`} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', textDecoration: 'none' }}>
            <UserAvatar avatarUrl={partner.avatarUrl} nickname={partner.nickname} size="sm" />
            <span style={{ color: '#faf5ff', fontWeight: 600 }}>{partner.nickname}</span>
          </Link>
        )}
      </div>

      {error && (
        <div className="p-3 rounded-xl bg-cosmic-red/10 border border-cosmic-red/30 text-cosmic-red text-sm">
          {error}
        </div>
      )}

      <div className="cosmic-card" style={{
        flex: 1,
        padding: '1rem',
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.5rem',
      }}>
        {messages.length === 0 ? (
          <p className="text-sm text-star-white/30 text-center py-4">まだメッセージがありません</p>
        ) : (
          messages.map((m) => {
            const mine = myId !== null && m.senderId === myId;
            return (
              <div
                key={m.id}
                style={{
                  alignSelf: mine ? 'flex-end' : 'flex-start',
                  maxWidth: '75%',
                  padding: '0.5rem 0.875rem',
                  borderRadius: '14px',
                  background: mine ? 'rgba(255,79,216,0.25)' : 'rgba(255,255,255,0.05)',
                  border: `1px solid ${mine ? 'rgba(255,79,216,0.4)' : 'rgba(255,255,255,0.08)'}`,
                  color: '#faf5ff',
                  fontSize: '0.9rem',
                  wordBreak: 'break-word',
                }}
              >
                {m.body}
                <div style={{ fontSize: '0.65rem', opacity: 0.5, marginTop: '0.25rem' }}>
                  {new Date(m.createdAt).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={handleSend} style={{ display: 'flex', gap: '0.5rem' }}>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="メッセージを入力..."
          className="cosmic-input"
          style={{ flex: 1 }}
          maxLength={2000}
        />
        <button type="submit" className="cosmic-btn" disabled={input.trim().length === 0}>
          送信
        </button>
      </form>
    </div>
  );
}
