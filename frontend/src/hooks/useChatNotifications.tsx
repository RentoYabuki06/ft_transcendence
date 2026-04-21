import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { useAuth } from './useAuth';

interface ChatNotificationsContextType {
  unreadBySender: Map<number, number>;
  unreadFrom: (userId: number) => number;
  clearUnread: (userId: number) => void;
  refresh: () => Promise<void>;
}

const ChatNotificationsContext = createContext<ChatNotificationsContextType>({
  unreadBySender: new Map(),
  unreadFrom: () => 0,
  clearUnread: () => {},
  refresh: async () => {},
});

export function ChatNotificationsProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth();
  const [unreadBySender, setUnread] = useState<Map<number, number>>(new Map());
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectRef = useRef<number | null>(null);

  const refresh = useCallback(async () => {
    const token = sessionStorage.getItem('auth_token');
    if (!token) return;
    try {
      const res = await fetch('/api/messages/conversations', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const data: Array<{ partnerId: number; unreadCount: number }> = await res.json();
      const next = new Map<number, number>();
      for (const c of data) {
        if (c.unreadCount > 0) next.set(c.partnerId, c.unreadCount);
      }
      setUnread(next);
    } catch {}
  }, []);

  const clearUnread = useCallback((userId: number) => {
    setUnread((prev) => {
      if (!prev.has(userId)) return prev;
      const next = new Map(prev);
      next.delete(userId);
      return next;
    });
  }, []);

  useEffect(() => {
    if (!isAuthenticated) {
      setUnread(new Map());
      return;
    }
    const token = sessionStorage.getItem('auth_token');
    if (!token) return;

    refresh();

    let cancelled = false;
    const connect = () => {
      const wsUrl = `${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}/api/ws/chat?token=${token}`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data);
          if (msg.type === 'chat_message' && typeof msg.senderId === 'number') {
            setUnread((prev) => {
              const next = new Map(prev);
              next.set(msg.senderId, (next.get(msg.senderId) ?? 0) + 1);
              return next;
            });
          }
        } catch {}
      };

      ws.onclose = () => {
        if (cancelled) return;
        reconnectRef.current = window.setTimeout(connect, 3000);
      };
      ws.onerror = () => ws.close();
    };

    connect();

    return () => {
      cancelled = true;
      if (reconnectRef.current) window.clearTimeout(reconnectRef.current);
      wsRef.current?.close();
    };
  }, [isAuthenticated, refresh]);

  return (
    <ChatNotificationsContext.Provider
      value={{
        unreadBySender,
        unreadFrom: (id) => unreadBySender.get(id) ?? 0,
        clearUnread,
        refresh,
      }}
    >
      {children}
    </ChatNotificationsContext.Provider>
  );
}

export function useChatNotifications() {
  return useContext(ChatNotificationsContext);
}
