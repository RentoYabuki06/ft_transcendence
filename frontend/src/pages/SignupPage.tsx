import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { StarField } from '../components/StarField';
import { api } from '../services/api';

export function SignupPage() {
  const [nickname, setNickname] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { signup } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== passwordConfirm) {
      setError('パスワードが一致しません');
      return;
    }

    if (password.length < 8) {
      setError('パスワードは8文字以上で入力してください');
      return;
    }

    setIsLoading(true);

    try {
      await signup({ nickname, email, password });
      navigate('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : '登録に失敗しました');
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

        {/* Signup Card */}
        <div className="cosmic-card">
          <h2 className="font-display text-xl text-center text-star-white mb-6 tracking-wide">
            新規登録
          </h2>

          {error && (
            <div className="mb-4 p-3 rounded-lg bg-cosmic-red/10 border border-cosmic-red/30 text-cosmic-red text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm text-star-white/50 mb-1.5 font-medium">ニックネーム</label>
              <input
                type="text"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                className="cosmic-input"
                placeholder="SpacePilot"
                required
                minLength={2}
                maxLength={20}
              />
            </div>

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
                placeholder="8文字以上"
                required
                minLength={8}
              />
            </div>

            <div>
              <label className="block text-sm text-star-white/50 mb-1.5 font-medium">パスワード（確認）</label>
              <input
                type="password"
                value={passwordConfirm}
                onChange={(e) => setPasswordConfirm(e.target.value)}
                className="cosmic-input"
                placeholder="パスワードを再入力"
                required
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="cosmic-btn cosmic-btn-primary w-full py-3 disabled:opacity-50"
            >
              {isLoading ? (
                <span className="animate-glow-pulse">登録中...</span>
              ) : (
                '登録する'
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
            <span>で登録</span>
          </button>

          {/* Login link */}
          <p className="text-center text-sm text-star-white/40 mt-6">
            既にアカウントをお持ちの方は{' '}
            <Link to="/login" className="text-cosmic-cyan hover:text-cosmic-cyan/80 transition-colors">
              ログイン
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
