import { useState, useEffect, type CSSProperties } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { api } from '../services/api';

export function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [tempToken, setTempToken] = useState<string | null>(null);
  const [otpEmail, setOtpEmail] = useState<string>('');
  const [twoFaCode, setTwoFaCode] = useState('');
  const [resendMsg, setResendMsg] = useState('');
  const { login, complete2FALogin } = useAuth();
  const navigate = useNavigate();

  // OAuth 失敗時に /login?error=oauth_failed に飛んでくるので拾って表示する
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    if (sp.get('error') === 'oauth_failed') {
      setError('42 認証に失敗しました。もう一度お試しください。');
      sp.delete('error');
      const q = sp.toString();
      const newUrl = window.location.pathname + (q ? `?${q}` : '') + window.location.hash;
      window.history.replaceState({}, '', newUrl);
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const result = await login(email, password);
      if (result?.requires2fa) {
        setTempToken(result.tempToken);
        setOtpEmail(result.email);
      } else {
        navigate('/dashboard');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ログインに失敗しました');
    } finally {
      setIsLoading(false);
    }
  };

  const handle2FASubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tempToken || twoFaCode.length !== 6) return;
    setError('');
    setIsLoading(true);
    try {
      await complete2FALogin(tempToken, twoFaCode);
      navigate('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'コード検証に失敗しました');
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

        {/* Login Card */}
        <div className="cosmic-card p-8 md:p-10 lg:p-12">
          <h2 className="font-display text-xl md:text-2xl text-center text-star-white mb-8 md:mb-10 tracking-wide">
            ログイン
          </h2>

          {error && (
            <div className="mb-6 md:mb-8 p-4 rounded-xl bg-cosmic-red/10 border border-cosmic-red/30 text-cosmic-red text-sm">
              {error}
            </div>
          )}

          {tempToken ? (
            <form
              onSubmit={handle2FASubmit}
              style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}
            >
              <p className="text-sm text-star-white/60 text-center">
                {otpEmail || 'メールアドレス'} に確認コードを送信しました。<br />
                メール記載の6桁コードを入力してください。
              </p>
              <input
                type="text"
                inputMode="numeric"
                value={twoFaCode}
                onChange={(e) => setTwoFaCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                className="cosmic-input"
                placeholder="000000"
                autoFocus
                style={{ textAlign: 'center', letterSpacing: '0.4em', fontSize: '1.3rem' }}
              />
              <button
                type="submit"
                disabled={isLoading || twoFaCode.length !== 6}
                className="cosmic-btn cosmic-btn-primary w-full disabled:opacity-50"
                style={{ padding: '0.875rem 1.5rem' }}
              >
                {isLoading ? '検証中...' : '検証'}
              </button>
              {resendMsg && (
                <p className="text-xs text-cosmic-cyan/70 text-center">{resendMsg}</p>
              )}
              <button
                type="button"
                onClick={async () => {
                  if (!tempToken) return;
                  setResendMsg('');
                  try {
                    await api.login2faResend(tempToken);
                    setResendMsg('確認コードを再送しました');
                  } catch (err) {
                    setResendMsg(err instanceof Error ? err.message : '再送に失敗しました');
                  }
                }}
                className="text-xs text-cosmic-cyan/80 hover:text-cosmic-cyan underline"
              >
                コードを再送する
              </button>
              <button
                type="button"
                onClick={() => { setTempToken(null); setTwoFaCode(''); setError(''); setResendMsg(''); }}
                className="text-xs text-star-white/40 hover:text-star-white underline"
              >
                ← メール/パスワードに戻る
              </button>
            </form>
          ) : (
          <form
            onSubmit={handleSubmit}
            style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}
          >
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
                placeholder="••••••••"
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
                <span className="animate-glow-pulse">接続中...</span>
              ) : (
                'ログイン'
              )}
            </button>
          </form>
          )}

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
            <span>でログイン</span>
          </button>

          {/* Sign up link */}
          <p className="text-center text-sm text-star-white/40 mt-8 md:mt-10">
            アカウントをお持ちでない方は{' '}
            <Link to="/signup" className="text-cosmic-cyan hover:text-cosmic-cyan/80 transition-colors">
              新規登録
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
