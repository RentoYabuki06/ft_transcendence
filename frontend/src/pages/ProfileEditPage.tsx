import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { UserAvatar } from '../components/UserAvatar';
import { api } from '../services/api';

export function ProfileEditPage() {
  const { user, updateUser, logout, refreshUser } = useAuth();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [nickname, setNickname] = useState(user?.nickname || '');
  const [email, setEmail] = useState(user?.email || '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  // const [link42Busy, setLink42Busy] = useState(false);

  // 2FA (email OTP)
  const [twoFaSetupStarted, setTwoFaSetupStarted] = useState(false);
  const [twoFaSentTo, setTwoFaSentTo] = useState<string>('');
  const [twoFaCode, setTwoFaCode] = useState('');
  const [twoFaBusy, setTwoFaBusy] = useState(false);

  // OAuth コールバックから戻ってきた時のフィードバック表示
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    const linked = sp.get('linked');
    const error = sp.get('error');
    let consumed = false;
    if (linked === '42') {
      setMessage({ type: 'success', text: '42 アカウントを連携しました' });
      refreshUser();
      consumed = true;
    } else if (error === 'already_linked_other') {
      setMessage({ type: 'error', text: 'この 42 アカウントは別ユーザーに連携済みです' });
      consumed = true;
    } else if (error === 'oauth_failed') {
      setMessage({ type: 'error', text: '42 連携に失敗しました。もう一度お試しください' });
      consumed = true;
    }
    if (consumed) {
      // 1 度表示したらクエリは消す（リロード時に再表示されないように）
      sp.delete('linked');
      sp.delete('error');
      const q = sp.toString();
      const newUrl = window.location.pathname + (q ? `?${q}` : '') + window.location.hash;
      window.history.replaceState({}, '', newUrl);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!user) return null;

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const res = await api.uploadAvatar(file);
      updateUser({ ...user, avatarUrl: res.avatarUrl });
      setMessage({ type: 'success', text: 'アバターを更新しました' });
    } catch {
      setMessage({ type: 'error', text: 'アバターの更新に失敗しました' });
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    setIsLoading(true);

    try {
      // プロフィール情報更新（ニックネーム・メール）
      if (nickname !== user.nickname || email !== user.email) {
        const updated = await api.updateMe({ nickname, email });
        updateUser(updated);
      }

      // パスワード変更
      if (currentPassword || newPassword) {
        if (!currentPassword || !newPassword) {
          throw new Error('現在のパスワードと新しいパスワードを両方入力してください');
        }
        await api.changePassword(currentPassword, newPassword);
        setCurrentPassword('');
        setNewPassword('');
      }

      setMessage({ type: 'success', text: 'プロフィールを更新しました' });
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : '更新に失敗しました' });
    } finally {
      setIsLoading(false);
    }
  };

  const handle2FASetup = async () => {
    setTwoFaBusy(true);
    setMessage(null);
    try {
      const res = await api.setup2FA();
      setTwoFaSetupStarted(true);
      setTwoFaSentTo(res.email);
    } catch (e) {
      setMessage({ type: 'error', text: e instanceof Error ? e.message : '2FA設定の開始に失敗しました' });
    } finally {
      setTwoFaBusy(false);
    }
  };

  const handle2FAVerify = async () => {
    if (!twoFaCode) return;
    setTwoFaBusy(true);
    setMessage(null);
    try {
      await api.verify2FA(twoFaCode);
      updateUser({ ...user, isTwoFactorEnabled: true });
      setTwoFaSetupStarted(false);
      setTwoFaCode('');
      setMessage({ type: 'success', text: '2FAを有効化しました' });
    } catch (e) {
      setMessage({ type: 'error', text: e instanceof Error ? e.message : 'コードの検証に失敗しました' });
    } finally {
      setTwoFaBusy(false);
    }
  };

  const handle2FADisable = async () => {
    if (!confirm('2FAを無効にしますか？')) return;
    setTwoFaBusy(true);
    setMessage(null);
    try {
      await api.disable2FA();
      updateUser({ ...user, isTwoFactorEnabled: false });
      setMessage({ type: 'success', text: '2FAを無効化しました' });
    } catch (e) {
      setMessage({ type: 'error', text: e instanceof Error ? e.message : '無効化に失敗しました' });
    } finally {
      setTwoFaBusy(false);
    }
  };

  return (
    <div className="py-8 max-w-2xl mx-auto animate-slide-in">
      <h1 className="font-display text-2xl font-bold text-star-white mb-8 tracking-wide">
        プロフィール編集
      </h1>

      <div className="cosmic-card">
        {/* Avatar Section */}
        <div className="flex flex-col items-center mb-8">
          <UserAvatar avatarUrl={user.avatarUrl} nickname={user.nickname} size="xl" showRing />
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleAvatarUpload}
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="cosmic-btn text-xs mt-4"
          >
            画像をアップロード
          </button>
        </div>

        {/* Message */}
        {message && (
          <div className={`mb-6 p-3 rounded-lg text-sm ${
            message.type === 'success'
              ? 'bg-cosmic-green/10 border border-cosmic-green/30 text-cosmic-green'
              : 'bg-cosmic-red/10 border border-cosmic-red/30 text-cosmic-red'
          }`}>
            {message.text}
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-5">
          <div>
            <label className="block text-sm text-star-white/50 mb-1.5 font-medium">ニックネーム</label>
            <input
              type="text"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              className="cosmic-input"
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
              required
            />
          </div>

          {/* Divider */}
          <div className="flex items-center gap-3 py-2">
            <div className="flex-1 h-px bg-cosmic-cyan/10" />
            <span className="text-xs text-star-white/30 font-display tracking-wider">パスワード変更</span>
            <div className="flex-1 h-px bg-cosmic-cyan/10" />
          </div>

          <div>
            <label className="block text-sm text-star-white/50 mb-1.5 font-medium">現在のパスワード</label>
            <input
              type={showPassword ? 'text' : 'password'}
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="cosmic-input"
              placeholder="変更する場合のみ入力"
              autoComplete="current-password"
            />
          </div>

          <div>
            <label className="block text-sm text-star-white/50 mb-1.5 font-medium">新しいパスワード</label>
            <input
              type={showPassword ? 'text' : 'password'}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="cosmic-input"
              placeholder="8文字以上"
              minLength={8}
              autoComplete="new-password"
            />
          </div>

          <label className="flex items-center gap-2 text-xs text-star-white/40 cursor-pointer">
            <input
              type="checkbox"
              checked={showPassword}
              onChange={(e) => setShowPassword(e.target.checked)}
            />
            パスワードを表示
          </label>

          {/* 42 OAuth 連携 — 一時的に非表示 (新規登録/ログイン画面の 42 ボタンから連携可能なため、設定画面では割愛)
          <div className="flex items-center gap-3 p-3 rounded-lg bg-white/3 border border-white/5">
            <span className="font-display font-bold text-lg text-cosmic-cyan">42</span>
            <span className="text-sm text-star-white/50">OAuth連携</span>
            <span className={`ml-2 text-xs px-2 py-0.5 rounded-full ${
              user.is42Linked
                ? 'bg-cosmic-green/10 text-cosmic-green'
                : 'bg-white/5 text-star-white/30'
            }`}>
              {user.is42Linked ? '連携済み' : '未連携'}
            </span>
            <div className="ml-auto" onClick={(e) => e.stopPropagation()}>
              {user.is42Linked ? (
                <button
                  type="button"
                  disabled={link42Busy}
                  onClick={async (e) => {
                    e.preventDefault();
                    if (!confirm('42 連携を解除しますか？\nパスワードでのログインは引き続き可能です。')) return;
                    setLink42Busy(true);
                    setMessage(null);
                    try {
                      await api.unlink42();
                      updateUser({ ...user, is42Linked: false });
                      setMessage({ type: 'success', text: '42 連携を解除しました' });
                    } catch (err) {
                      setMessage({
                        type: 'error',
                        text: err instanceof Error ? err.message : '解除に失敗しました',
                      });
                    } finally {
                      setLink42Busy(false);
                    }
                  }}
                  className="cosmic-btn"
                  style={{
                    fontSize: '0.75rem',
                    padding: '0.4rem 0.9rem',
                    borderColor: 'rgba(251,113,133,0.3)',
                    color: '#fb7185',
                  }}
                >
                  {link42Busy ? '...' : '解除'}
                </button>
              ) : (
                <button
                  type="button"
                  disabled={link42Busy}
                  onClick={async (e) => {
                    e.preventDefault();
                    setLink42Busy(true);
                    setMessage(null);
                    try {
                      await api.start42Link();
                      // ここでブラウザは 42 にリダイレクトされる
                    } catch (err) {
                      setLink42Busy(false);
                      setMessage({
                        type: 'error',
                        text: err instanceof Error ? err.message : '連携を開始できませんでした',
                      });
                    }
                  }}
                  className="cosmic-btn"
                  style={{ fontSize: '0.75rem', padding: '0.4rem 0.9rem' }}
                >
                  {link42Busy ? '...' : '42を連携'}
                </button>
              )}
            </div>
          </div>
          */}

          <button
            type="submit"
            disabled={isLoading}
            className="cosmic-btn cosmic-btn-primary w-full py-3 disabled:opacity-50"
          >
            {isLoading ? <span className="animate-glow-pulse">保存中...</span> : '保存'}
          </button>
        </form>
      </div>

      {/* 2FA セクション */}
      <div className="cosmic-card" style={{ marginTop: '1.25rem', padding: '1.5rem' }}>
        <h2 className="font-display text-sm tracking-wider text-cosmic-cyan/70 uppercase mb-3">
          2段階認証 (2FA)
        </h2>

        {user.isTwoFactorEnabled ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <p className="text-sm text-cosmic-green">
              ✓ 2FAは有効です
            </p>
            <button
              onClick={handle2FADisable}
              disabled={twoFaBusy}
              className="cosmic-btn"
              style={{ alignSelf: 'flex-start', borderColor: 'rgba(251,113,133,0.3)', color: '#fb7185' }}
            >
              2FAを無効にする
            </button>
          </div>
        ) : twoFaSetupStarted ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', alignItems: 'center' }}>
            <p className="text-sm text-star-white/60 text-center">
              {twoFaSentTo} に確認コードを送信しました。<br />
              メールに記載されている6桁のコードを入力してください。
            </p>
            <input
              type="text"
              inputMode="numeric"
              value={twoFaCode}
              onChange={(e) => setTwoFaCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="6桁のコード"
              className="cosmic-input"
              style={{ maxWidth: 200, textAlign: 'center', letterSpacing: '0.3em', fontSize: '1.2rem' }}
            />
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                onClick={handle2FAVerify}
                disabled={twoFaBusy || twoFaCode.length !== 6}
                className="cosmic-btn cosmic-btn-primary"
              >
                有効化する
              </button>
              <button
                onClick={handle2FASetup}
                disabled={twoFaBusy}
                className="cosmic-btn"
              >
                コードを再送
              </button>
              <button
                onClick={() => { setTwoFaSetupStarted(false); setTwoFaCode(''); }}
                className="cosmic-btn"
              >
                キャンセル
              </button>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <p className="text-sm text-star-white/60">
              認証アプリを使ってログイン時のセキュリティを強化できます。
            </p>
            <button
              onClick={handle2FASetup}
              disabled={twoFaBusy}
              className="cosmic-btn cosmic-btn-primary"
              style={{ alignSelf: 'flex-start' }}
            >
              {twoFaBusy ? '準備中...' : '2FAを設定する'}
            </button>
          </div>
        )}
      </div>

      {/* GDPR セクション */}
      <div className="cosmic-card" style={{ marginTop: '1.25rem', padding: '1.5rem' }}>
        <h2 className="font-display text-sm tracking-wider text-cosmic-cyan/70 uppercase mb-3">
          データ管理 (GDPR)
        </h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <p className="text-sm text-star-white/60">
            あなたのアカウントに関する全データをエクスポート、または削除できます。
          </p>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={async () => {
                try {
                  await api.exportMyData();
                  setMessage({ type: 'success', text: 'データをダウンロードしました' });
                } catch (e) {
                  setMessage({ type: 'error', text: e instanceof Error ? e.message : 'エクスポートに失敗しました' });
                }
              }}
              className="cosmic-btn"
            >
              データをエクスポート (JSON)
            </button>
            <button
              type="button"
              onClick={async () => {
                if (!confirm('本当にアカウントを削除しますか？\nこの操作は取り消せません。')) return;
                if (!confirm('最終確認: すべてのメッセージ・フレンド・実績が削除されます。続行しますか？')) return;
                try {
                  await api.deleteMyAccount();
                  logout();
                  navigate('/');
                } catch (e) {
                  setMessage({ type: 'error', text: e instanceof Error ? e.message : '削除に失敗しました' });
                }
              }}
              className="cosmic-btn"
              style={{ borderColor: 'rgba(251,113,133,0.3)', color: '#fb7185' }}
            >
              アカウントを削除
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
