import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Providers } from '../lib/providers';
import { AppShell } from '../components/layout/app-shell';

const inter = Inter({ subsets: ['latin'] });

const siteUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: 'StockMinistry.com',
    template: '%s | StockMinistry.com',
  },
  description:
    'Real-time enterprise inventory tracking, warehouse logistics, stock replenishment, and multi-warehouse operations management.',
  keywords: [
    'StockMinistry',
    'StockMinistry.com',
    'inventory management system',
    'warehouse management',
    'stock tracking',
    'enterprise inventory',
    'supply chain management',
    'purchase order management',
  ],
  authors: [{ name: 'StockMinistry Team' }],
  creator: 'StockMinistry.com',
  publisher: 'StockMinistry.com',
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/icon.png', type: 'image/png' },
      { url: '/logo-icon.png', type: 'image/png' },
    ],
    apple: [{ url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
    shortcut: '/favicon.ico',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  verification: {
    google: 'googleae0d1329484761a5',
  },
  openGraph: {
    title: 'StockMinistry.com',
    description:
      'Real-time enterprise inventory tracking, warehouse logistics, stock replenishment, and multi-warehouse operations management.',
    url: siteUrl,
    siteName: 'StockMinistry.com',
    locale: 'en_US',
    type: 'website',
    images: [
      {
        url: '/logo.png',
        width: 1024,
        height: 559,
        alt: 'StockMinistry.com',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'StockMinistry.com',
    description:
      'Real-time enterprise inventory tracking, warehouse logistics, and multi-warehouse management.',
    images: ['/logo.png'],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full bg-slate-50 antialiased">
      <body className={`${inter.className} h-full`}>
        <Providers>
          <AppShell>{children}</AppShell>
        </Providers>
      </body>
    </html>
  );
}
