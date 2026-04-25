interface UserAvatarProps {
  avatarUrl: string | null;
  nickname: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  onlineStatus?: 'online' | 'offline' | 'in-game' | null;
  showRing?: boolean;
}

const sizeMap = {
  sm: 'w-8 h-8 text-xs',
  md: 'w-12 h-12 text-sm',
  lg: 'w-20 h-20 text-xl',
  xl: 'w-28 h-28 text-3xl',
};

const statusColorMap = {
  online: 'bg-cosmic-green',
  offline: 'bg-gray-500',
  'in-game': 'bg-cosmic-gold',
};

export function UserAvatar({ avatarUrl, nickname, size = 'md', onlineStatus = null, showRing = false }: UserAvatarProps) {
  const initials = nickname.slice(0, 2).toUpperCase();

  return (
    <div className="relative inline-flex">
      {showRing && (
        <div
          className="absolute -inset-1 rounded-full animate-spin"
          style={{
            animationDuration: '8s',
            background: 'conic-gradient(from 0deg, transparent, rgba(0,212,255,0.4), transparent, rgba(139,92,246,0.4), transparent)',
          }}
        />
      )}
      <div
        className={`${sizeMap[size]} rounded-full flex items-center justify-center overflow-hidden relative`}
        style={{
          background: avatarUrl
            ? 'transparent'
            : 'linear-gradient(135deg, rgba(0,212,255,0.2), rgba(139,92,246,0.2))',
          border: '2px solid rgba(0,212,255,0.2)',
        }}
      >
        {avatarUrl ? (
          <img src={avatarUrl} alt={nickname} className="w-full h-full object-cover" />
        ) : (
          <span className="font-display font-bold text-cosmic-cyan">{initials}</span>
        )}
      </div>
      {onlineStatus && (
        <div
          className={`absolute bottom-0 right-0 w-3 h-3 rounded-full ${statusColorMap[onlineStatus]} border-2 border-space-deep`}
        />
      )}
    </div>
  );
}
