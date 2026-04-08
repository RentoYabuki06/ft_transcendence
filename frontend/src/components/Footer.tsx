import { Link } from 'react-router-dom';

export function Footer() {
  return (
    <footer
      className="relative z-10 py-6 px-6 text-center"
      style={{
        borderTop: '1px solid rgba(0,212,255,0.08)',
        background: 'linear-gradient(0deg, rgba(5,10,24,0.9) 0%, transparent 100%)',
      }}
    >
      <div className="flex items-center justify-center gap-6 text-sm text-star-white/40">
        <Link
          to="/terms"
          className="hover:text-cosmic-cyan transition-colors duration-300"
        >
          利用規約
        </Link>
        <span className="text-star-white/20">|</span>
        <Link
          to="/privacy"
          className="hover:text-cosmic-cyan transition-colors duration-300"
        >
          プライバシーポリシー
        </Link>
      </div>
      <p className="text-xs text-star-white/20 mt-2">
        ft_transcendence - 42 Tokyo
      </p>
    </footer>
  );
}
