import type { Metadata, Viewport } from 'next';

export const metadata: Metadata = {
  title: 'ヒトマップ',
  description: 'まちの痕跡を記録し、地域の暮らしを読み解く',
  manifest: '/manifest.json',
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
        <link rel="apple-touch-icon" href="/icon.svg" />
      </head>
      <body
        style={{
          margin: 0,
          fontFamily: 'system-ui, -apple-system, "Hiragino Sans", "Noto Sans JP", sans-serif',
          background: '#fafafa',
          color: '#222',
        }}
      >
        {children}
      </body>
    </html>
  );
}
