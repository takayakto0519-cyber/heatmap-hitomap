import type { Metadata, Viewport } from 'next';
import Script from 'next/script';
import { Analytics } from '@vercel/analytics/react';
import ServiceWorkerRegister from '@/components/ServiceWorkerRegister';

// 本番ドメインを既定値にする（Vercel側でNEXT_PUBLIC_SITE_URLを設定していなくても正しいOGP絶対URLが解決される）。
// ローカル開発時のみ .env.local で NEXT_PUBLIC_SITE_URL=http://localhost:3000 を設定して上書きする。
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://hitomap.com';

const TITLE_DEFAULT = 'ヒトマップ - まちの痕跡を記録するコミュニティ';
const DESCRIPTION =
  'データ分析用の「ヒートマップ」ツールではありません。町を歩いて見つけた誰かの生きた証（痕跡）を、写真と言葉で記録し、地図に積み重ねていくコミュニティサービスです。';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: TITLE_DEFAULT,
    template: '%s | ヒトマップ',
  },
  description: DESCRIPTION,
  keywords: ['ヒトマップ', '痕跡', '町歩き', 'まち歩き', '地域コミュニティ', '観察日記', '記録アプリ'],
  manifest: '/manifest.json',
  icons: {
    icon: '/icon.svg',
    apple: '/logo.png',
  },
  alternates: {
    canonical: '/',
  },
  openGraph: {
    type: 'website',
    locale: 'ja_JP',
    siteName: 'ヒトマップ',
    url: SITE_URL,
    title: TITLE_DEFAULT,
    description: '町を歩いて見つけた誰かの生きた証を記録するコミュニティサービス',
    images: ['/logo.png'],
  },
  twitter: {
    card: 'summary_large_image',
    title: TITLE_DEFAULT,
    description: '町を歩いて見つけた誰かの生きた証を記録するコミュニティサービス',
    images: ['/logo.png'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
    },
  },
  verification: {
    google: 'wc1_CRniwn8qkeHAGGEguLo-LGQm3p0HFqVM1Tl-7ds',
  },
  appleWebApp: {
    capable: true,
    title: 'ヒトマップ',
    statusBarStyle: 'default',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: '#FF6B9D',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <head>
        <Script
          async
          src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-9756247463388625"
          crossOrigin="anonymous"
          strategy="afterInteractive"
        />
      </head>
      <body
        style={{
          margin: 0,
          fontFamily: 'system-ui, -apple-system, "Hiragino Sans", "Noto Sans JP", sans-serif',
          background: '#fafafa',
          color: '#222',
        }}
      >
        <ServiceWorkerRegister />
        {children}
        <Analytics />
      </body>
    </html>
  );
}
