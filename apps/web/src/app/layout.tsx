import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Providers } from '../lib/providers';
import { Sidebar } from '../components/layout/sidebar';
import { Header } from '../components/layout/header';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Inventory Management System',
  description: 'Phase 1E Frontend Foundation',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full bg-background antialiased">
      <body className={`${inter.className} h-full`}>
        <Providers>
          <div className="flex min-h-screen">
            <div className="hidden lg:fixed lg:inset-y-0 lg:z-50 lg:flex lg:w-72 lg:flex-col">
              <Sidebar />
            </div>
            <div className="lg:pl-72 flex flex-col flex-1">
              <Header />
              <main className="flex-1 py-10">
                <div className="px-4 sm:px-6 lg:px-8">{children}</div>
              </main>
            </div>
          </div>
        </Providers>
      </body>
    </html>
  );
}
