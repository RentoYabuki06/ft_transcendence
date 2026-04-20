import { Link } from 'react-router-dom';

export function PlayPage() {
  const modes = [
    {
      to: '/matching',
      icon: '⚡',
      title: '1 vs 1',
      subtitle: 'RANDOM MATCH',
      description: 'ランダムな相手とリアルタイム対戦',
      gradient: 'linear-gradient(135deg, rgba(52,211,153,0.25) 0%, rgba(110,231,255,0.2) 100%)',
      border: 'rgba(52,211,153,0.4)',
      color: '#34d399',
    },
    {
      to: '/tournaments',
      icon: '🏆',
      title: 'TOURNAMENT',
      subtitle: 'BRACKET BATTLE',
      description: 'トーナメントを作成・参加してチャンピオンを目指す',
      gradient: 'linear-gradient(135deg, rgba(255,79,216,0.25) 0%, rgba(184,77,255,0.2) 100%)',
      border: 'rgba(255,79,216,0.4)',
      color: '#ff4fd8',
    },
  ];

  return (
    <div className="py-8 max-w-4xl mx-auto animate-slide-in" style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      <div style={{ textAlign: 'center' }}>
        <h1
          className="font-display font-black"
          style={{
            fontSize: 'clamp(1.75rem, 4vw, 2.5rem)',
            background: 'linear-gradient(135deg, #6ee7ff 0%, #ff4fd8 45%, #b84dff 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            filter: 'drop-shadow(0 0 12px rgba(255,79,216,0.4))',
            letterSpacing: '0.05em',
          }}
        >
          SELECT GAME MODE
        </h1>
        <p className="text-sm text-star-white/50 mt-2">プレイするモードを選んでください</p>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '1.5rem',
        }}
      >
        {modes.map((m) => (
          <Link
            key={m.to}
            to={m.to}
            className="cosmic-card"
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '0.75rem',
              padding: '2.5rem 1.5rem',
              textDecoration: 'none',
              background: m.gradient,
              border: `1px solid ${m.border}`,
              transition: 'all 0.22s ease',
              textAlign: 'center',
              position: 'relative',
              overflow: 'hidden',
            }}
            onMouseEnter={(e) => {
              const el = e.currentTarget as HTMLElement;
              el.style.transform = 'translateY(-4px) scale(1.01)';
              el.style.boxShadow = `0 10px 40px ${m.border}`;
            }}
            onMouseLeave={(e) => {
              const el = e.currentTarget as HTMLElement;
              el.style.transform = 'translateY(0) scale(1)';
              el.style.boxShadow = 'none';
            }}
          >
            <div
              style={{
                fontSize: '3.5rem',
                filter: `drop-shadow(0 0 12px ${m.color})`,
                lineHeight: 1,
              }}
            >
              {m.icon}
            </div>
            <div
              className="font-display font-black"
              style={{
                fontSize: '1.6rem',
                color: '#faf5ff',
                letterSpacing: '0.08em',
                textShadow: `0 0 14px ${m.color}`,
              }}
            >
              {m.title}
            </div>
            <div
              className="font-display"
              style={{
                fontSize: '0.7rem',
                color: m.color,
                letterSpacing: '0.25em',
                opacity: 0.7,
              }}
            >
              {m.subtitle}
            </div>
            <p style={{ fontSize: '0.85rem', color: 'rgba(250,245,255,0.6)', marginTop: '0.5rem' }}>
              {m.description}
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}
