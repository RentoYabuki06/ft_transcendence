import type { ReactNode } from 'react';
import { Header } from './Header';
import { Footer } from './Footer';
import { StarField } from './StarField';

export function Layout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col relative">
      <StarField />
      <Header />
      <main className="flex-1 relative z-10 pt-16 pb-4 px-4 md:px-8 max-w-7xl mx-auto w-full">
        {children}
      </main>
      <Footer />
    </div>
  );
}
