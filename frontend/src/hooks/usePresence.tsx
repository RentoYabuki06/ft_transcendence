import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { useAuth } from './useAuth';

interface PresenceContextType {
  onlineIds: Set<number>;
  isOnline: (userId: number) => boolean;
}

const PresenceContext = createContext<PresenceContextType>({
  onlineIds: new Set(),
  isOnline: () => false,
});

export function PresenceProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth();
  const [onlineIds, setOnlineIds] = useState<Set<number>>(new Set());
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isAuthenticated) {
      setOnlineIds(new Set());
      return;
    }
    const token = sessionStorage.getItem('auth_token');
    if (!token) return;

    let cancelled = false;
    const connect = () => {
      const wsUrl = `${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}/api/ws/presence?token=${token}`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data);
          if (msg.type === 'presence_list' && Array.isArray(msg.onlineUsers)) {
            setOnlineIds(new Set(msg.onlineUsers));
          } else if (msg.type === 'presence') {
            setOnlineIds((prev) => {
              const next = new Set(prev);
              if (msg.status === 'online') next.add(msg.userId);
              else next.delete(msg.userId);
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
  }, [isAuthenticated]);

  return (
    <PresenceContext.Provider value={{ onlineIds, isOnline: (id) => onlineIds.has(id) }}>
      {children}
    </PresenceContext.Provider>
  );
}

export function usePresence() {
  return useContext(PresenceContext);
}
