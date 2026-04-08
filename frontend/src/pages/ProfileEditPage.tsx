import { useState, useRef } from 'react';
import { useAuth } from '../hooks/useAuth';
import { UserAvatar } from '../components/UserAvatar';
import { api } from '../services/api';

export function ProfileEditPage() {
  const { user, updateUser } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [nickname, setNickname] = useState(user?.nickname || '');
  const [email, setEmail] = useState(user?.email || '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isLoading, setIsLoading] = useState(false);

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
      const updated = await api.updateMe({ nickname, email });
      updateUser(updated);
      setMessage({ type: 'success', text: 'プロフィールを更新しました' });
      setCurrentPassword('');
      setNewPassword('');
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : '更新に失敗しました' });
    } finally {
      setIsLoading(false);
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
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="cosmic-input"
              placeholder="変更する場合のみ入力"
            />
          </div>

          <div>
            <label className="block text-sm text-star-white/50 mb-1.5 font-medium">新しいパスワード</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="cosmic-input"
              placeholder="8文字以上"
              minLength={8}
            />
          </div>

          {/* 42 OAuth Status */}
          <div className="flex items-center gap-3 p-3 rounded-lg bg-white/3 border border-white/5">
            <span className="font-display font-bold text-lg text-cosmic-cyan">42</span>
            <span className="text-sm text-star-white/50">OAuth連携</span>
            <span className={`ml-auto text-xs px-2 py-0.5 rounded-full ${
              false ? 'bg-cosmic-green/10 text-cosmic-green' : 'bg-white/5 text-star-white/30'
            }`}>
              未連携
            </span>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="cosmic-btn cosmic-btn-primary w-full py-3 disabled:opacity-50"
          >
            {isLoading ? <span className="animate-glow-pulse">保存中...</span> : '保存'}
          </button>
        </form>
      </div>
    </div>
  );
}
