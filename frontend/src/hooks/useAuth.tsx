import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import type { User } from '../types';
import { api } from '../services/api';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<{ requires2fa: true; tempToken: string; email: string } | undefined>;
  complete2FALogin: (tempToken: string, code: string) => Promise<void>;
  signup: (data: { nickname: string; email: string; password: string }) => Promise<void>;
  logout: () => void;
  updateUser: (user: User) => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // 42 OAuth コールバックは /dashboard?token=XXX に戻ってくる。
    // 最初に URL から token を拾って sessionStorage に保存し、
    // クエリは履歴から消す（リロード時に再消費されるのを防ぐため）。
    try {
      const sp = new URLSearchParams(window.location.search);
      const urlToken = sp.get('token');
      if (urlToken) {
        sessionStorage.setItem('auth_token', urlToken);
        sp.delete('token');
        const newSearch = sp.toString();
        const newUrl =
          window.location.pathname +
          (newSearch ? `?${newSearch}` : '') +
          window.location.hash;
        window.history.replaceState({}, '', newUrl);
      }
    } catch {
      // URL 操作に失敗しても致命的ではない
    }

    const token = sessionStorage.getItem('auth_token');
    if (token) {
      api.getMe()
        .then(setUser)
        .catch(() => {
          sessionStorage.removeItem('auth_token');
        })
        .finally(() => setIsLoading(false));
    } else {
      setIsLoading(false);
    }
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const res = await api.login(email, password);
    if ('requires2fa' in res) {
      return { requires2fa: true as const, tempToken: res.tempToken, email: res.email };
    }
    sessionStorage.setItem('auth_token', res.token);
    setUser(res.user);
    return undefined;
  }, []);

  const complete2FALogin = useCallback(async (tempToken: string, code: string) => {
    const res = await api.login2faChallenge(tempToken, code);
    sessionStorage.setItem('auth_token', res.token);
    setUser(res.user);
  }, []);

  const signup = useCallback(async (data: { nickname: string; email: string; password: string }) => {
    const res = await api.signup(data);
    sessionStorage.setItem('auth_token', res.token);
    setUser(res.user);
  }, []);

  const logout = useCallback(() => {
    sessionStorage.removeItem('auth_token');
    setUser(null);
  }, []);

  const updateUser = useCallback((u: User) => {
    setUser(u);
  }, []);

  const refreshUser = useCallback(async () => {
    const token = sessionStorage.getItem('auth_token');
    if (!token) return;
    try {
      const fresh = await api.getMe();
      setUser(fresh);
    } catch {
      // ignore
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        login,
        complete2FALogin,
        signup,
        logout,
        updateUser,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
