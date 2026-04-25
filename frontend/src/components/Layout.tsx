import type { ReactNode } from 'react';
import { Header } from './Header';
import { Footer } from './Footer';

export function Layout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col relative">
      <Header />
      <main
        className="flex-1 relative z-10 max-w-7xl mx-auto w-full"
        style={{ paddingTop: '5rem', paddingBottom: '1rem', paddingLeft: '2rem', paddingRight: '2rem' }}
      >
        {children}
      </main>
      <Footer />
    </div>
  );
}
