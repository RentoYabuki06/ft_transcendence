import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { StarField } from '../components/StarField';
import { api } from '../services/api';

export function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      await login(email, password);
      navigate('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ログインに失敗しました');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center px-4" style={{ background: 'var(--color-space-deep)' }}>
      <StarField />

      <div className="relative z-10 w-full max-w-md animate-slide-in">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link to="/">
            <h1
              className="font-display text-5xl font-bold tracking-wider inline-block"
              style={{
                background: 'linear-gradient(135deg, #00d4ff, #8b5cf6)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                filter: 'drop-shadow(0 0 20px rgba(0,212,255,0.3))',
              }}
            >
              Pong
            </h1>
          </Link>
        </div>

        {/* Login Card */}
        <div className="cosmic-card">
          <h2 className="font-display text-xl text-center text-star-white mb-6 tracking-wide">
            ログイン
          </h2>

          {error && (
            <div className="mb-4 p-3 rounded-lg bg-cosmic-red/10 border border-cosmic-red/30 text-cosmic-red text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm text-star-white/50 mb-1.5 font-medium">メールアドレス</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="cosmic-input"
                placeholder="email@example.com"
                required
              />
            </div>

            <div>
              <label className="block text-sm text-star-white/50 mb-1.5 font-medium">パスワード</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="cosmic-input"
                placeholder="••••••••"
                required
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="cosmic-btn cosmic-btn-primary w-full py-3 disabled:opacity-50"
            >
              {isLoading ? (
                <span className="animate-glow-pulse">接続中...</span>
              ) : (
                'ログイン'
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="flex items-center gap-3 my-6">
            <div className="flex-1 h-px bg-cosmic-cyan/10" />
            <span className="text-xs text-star-white/30 font-display tracking-wider">OR</span>
            <div className="flex-1 h-px bg-cosmic-cyan/10" />
          </div>

          {/* 42 OAuth */}
          <button
            onClick={() => api.oauth42Login()}
            className="cosmic-btn w-full py-3 flex items-center justify-center gap-3"
          >
            <span className="font-bold text-lg">42</span>
            <span>でログイン</span>
          </button>

          {/* Sign up link */}
          <p className="text-center text-sm text-star-white/40 mt-6">
            アカウントをお持ちでない方は{' '}
            <Link to="/signup" className="text-cosmic-cyan hover:text-cosmic-cyan/80 transition-colors">
              新規登録
            </Link>
          </p>
        </div>

        {/* Footer links */}
        <div className="flex items-center justify-center gap-4 mt-6 text-xs text-star-white/30">
          <Link to="/terms" className="hover:text-cosmic-cyan transition-colors">利用規約</Link>
          <span>|</span>
          <Link to="/privacy" className="hover:text-cosmic-cyan transition-colors">プライバシーポリシー</Link>
        </div>
      </div>
    </div>
  );
}
