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
    default: 'IMS - Enterprise Inventory Management System',
    template: '%s | IMS',
  },
  description:
    'Real-time enterprise inventory tracking, warehouse logistics, stock replenishment, and multi-warehouse operations management.',
  keywords: [
    'inventory management system',
    'warehouse management',
    'stock tracking',
    'enterprise inventory',
    'supply chain management',
    'purchase order management',
  ],
  authors: [{ name: 'Inventory Management Team' }],
  creator: 'Inventory Management System',
  publisher: 'Inventory Management System',
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
    title: 'IMS - Enterprise Inventory Management System',
    description:
      'Real-time enterprise inventory tracking, warehouse logistics, stock replenishment, and multi-warehouse operations management.',
    url: siteUrl,
    siteName: 'Inventory Management System',
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'IMS - Enterprise Inventory Management System',
    description:
      'Real-time enterprise inventory tracking, warehouse logistics, and multi-warehouse management.',
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
