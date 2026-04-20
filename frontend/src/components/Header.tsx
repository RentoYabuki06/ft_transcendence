import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export function Header() {
  const [menuOpen, setMenuOpen] = useState(false);
  const { logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    logout();
    navigate('/');
    setMenuOpen(false);
  };

  const navItems = [
    { path: '/dashboard', label: 'DASHBOARD' },
    { path: '/play', label: 'PLAY' },
    { path: '/ranking', label: 'RANKING' },
    { path: '/tournaments', label: 'TOURNAMENTS' },
    { path: '/friends', label: 'FRIENDS' },
    { path: '/chat', label: 'CHAT' },
    { path: '/profile/edit', label: 'PROFILE' },
  ];

  const isActive = (path: string) => location.pathname === path;

  return (
    <header className="fixed top-0 left-0 right-0 z-50">
      <div
        className="flex items-center justify-between px-6 py-3"
        style={{
          background: 'linear-gradient(180deg, rgba(18,5,31,0.96) 0%, rgba(18,5,31,0.82) 100%)',
          borderBottom: '1px solid rgba(255,79,216,0.18)',
          backdropFilter: 'blur(14px)',
          boxShadow: '0 2px 24px rgba(184,77,255,0.12)',
        }}
      >
        {/* Logo */}
        <Link to="/dashboard" className="flex items-center gap-2 group">
          <div
            className="font-display text-2xl font-bold tracking-wider"
          style={{
            background: 'linear-gradient(135deg, #6ee7ff 0%, #ff4fd8 45%, #b84dff 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            filter: 'drop-shadow(0 0 8px rgba(255,79,216,0.5))',
          }}
          >
            Pong
          </div>
          <div className="w-2 h-2 rounded-full bg-cosmic-cyan animate-glow-pulse" />
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden md:flex items-center gap-1">
          {navItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-300 ${
                isActive(item.path)
                  ? 'text-cosmic-cyan bg-cosmic-cyan/10 border border-cosmic-cyan/20'
                  : 'text-star-white/60 hover:text-star-white hover:bg-white/5'
              }`}
            >
              {item.label}
            </Link>
          ))}
          <button
            onClick={handleLogout}
            className="px-4 py-2 rounded-lg text-sm font-medium text-cosmic-red/70 hover:text-cosmic-red hover:bg-cosmic-red/10 transition-all duration-300 ml-2"
          >
            LOGOUT
          </button>
        </nav>

        {/* Hamburger */}
        <button
          className="md:hidden flex flex-col gap-1.5 p-2"
          onClick={() => setMenuOpen(!menuOpen)}
        >
          <span className={`block w-6 h-0.5 bg-cosmic-cyan transition-all duration-300 ${menuOpen ? 'rotate-45 translate-y-2' : ''}`} />
          <span className={`block w-6 h-0.5 bg-cosmic-cyan transition-all duration-300 ${menuOpen ? 'opacity-0' : ''}`} />
          <span className={`block w-6 h-0.5 bg-cosmic-cyan transition-all duration-300 ${menuOpen ? '-rotate-45 -translate-y-2' : ''}`} />
        </button>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div
          className="md:hidden absolute top-full left-0 right-0 animate-slide-in"
          style={{
            background: 'rgba(18,5,31,0.97)',
            borderBottom: '1px solid rgba(255,79,216,0.15)',
            backdropFilter: 'blur(16px)',
          }}
        >
          <nav className="flex flex-col p-4 gap-1">
            {navItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setMenuOpen(false)}
                className={`px-4 py-3 rounded-lg text-sm font-medium transition-all ${
                  isActive(item.path)
                    ? 'text-cosmic-cyan bg-cosmic-cyan/10'
                    : 'text-star-white/60 hover:text-star-white hover:bg-white/5'
                }`}
              >
                {item.label}
              </Link>
            ))}
            <button
              onClick={handleLogout}
              className="px-4 py-3 rounded-lg text-sm font-medium text-cosmic-red/70 hover:text-cosmic-red hover:bg-cosmic-red/10 transition-all text-left"
            >
              LOGOUT
            </button>
          </nav>
        </div>
      )}
    </header>
  );
}
