import { useState, type CSSProperties } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
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

  const pongTitleStyle: CSSProperties = {
    background: 'linear-gradient(135deg, #6ee7ff 0%, #ff4fd8 45%, #b84dff 100%)',
    backgroundSize: '200% 200%',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    animation: 'glow-pulse 2s ease-in-out infinite',
    filter:
      'drop-shadow(0 0 24px rgba(255,79,216,0.45)) drop-shadow(0 0 48px rgba(184,77,255,0.35)) drop-shadow(0 0 64px rgba(110,231,255,0.2))',
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center px-4 py-10 sm:px-8 lg:px-12">
      <div className="relative z-10 w-full max-w-md sm:max-w-lg md:max-w-xl lg:max-w-2xl animate-slide-in">
        {/* Logo（LandingPage の Pong と同じ配色） */}
        <div className="text-center" style={{ marginBottom: '3.5rem' }}>
          <Link to="/">
            <h1
              className="font-display text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-black tracking-widest inline-block"
              style={pongTitleStyle}
            >
              Pong
            </h1>
          </Link>
        </div>

        {/* Signup Card */}
        <div className="cosmic-card p-8 md:p-10 lg:p-12">
          <h2 className="font-display text-xl md:text-2xl text-center text-star-white mb-8 md:mb-10 tracking-wide">
            新規登録
          </h2>

          {error && (
            <div className="mb-6 md:mb-8 p-4 rounded-xl bg-cosmic-red/10 border border-cosmic-red/30 text-cosmic-red text-sm">
              {error}
            </div>
          )}

          <form
            onSubmit={handleSubmit}
            style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}
          >
            <div>
              <label className="block text-sm text-star-white/50 font-medium" style={{ marginBottom: '0.625rem' }}>ニックネーム</label>
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
              <label className="block text-sm text-star-white/50 font-medium" style={{ marginBottom: '0.625rem' }}>メールアドレス</label>
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
              <label className="block text-sm text-star-white/50 font-medium" style={{ marginBottom: '0.625rem' }}>パスワード</label>
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
              <label className="block text-sm text-star-white/50 font-medium" style={{ marginBottom: '0.625rem' }}>パスワード（確認）</label>
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
              className="cosmic-btn cosmic-btn-primary w-full disabled:opacity-50"
              style={{ padding: '0.875rem 1.5rem', marginTop: '1rem' }}
            >
              {isLoading ? (
                <span className="animate-glow-pulse">登録中...</span>
              ) : (
                '登録する'
              )}
            </button>
          </form>

          {/* Divider */}
          <div
            className="flex items-center gap-4"
            style={{ marginTop: '3rem', marginBottom: '3rem' }}
          >
            <div className="flex-1 h-px bg-cosmic-cyan/10" />
            <span className="text-xs text-star-white/30 font-display tracking-wider">OR</span>
            <div className="flex-1 h-px bg-cosmic-cyan/10" />
          </div>

          {/* 42 OAuth */}
          <button
            type="button"
            onClick={() => api.oauth42Login()}
            className="cosmic-btn w-full py-3.5 md:py-4 flex items-center justify-center gap-3"
          >
            <span className="font-bold text-lg">42</span>
            <span>で登録</span>
          </button>

          {/* Login link */}
          <p className="text-center text-sm text-star-white/40 mt-8 md:mt-10">
            既にアカウントをお持ちの方は{' '}
            <Link to="/login" className="text-cosmic-cyan hover:text-cosmic-cyan/80 transition-colors">
              ログイン
            </Link>
          </p>
        </div>

        {/* Footer links */}
        <div className="flex items-center justify-center gap-6 mt-8 md:mt-10 text-xs text-star-white/30">
          <Link to="/terms" className="hover:text-cosmic-cyan transition-colors">利用規約</Link>
          <span>|</span>
          <Link to="/privacy" className="hover:text-cosmic-cyan transition-colors">プライバシーポリシー</Link>
        </div>
      </div>
    </div>
  );
}
