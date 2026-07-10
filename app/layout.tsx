import type { Metadata, Viewport } from 'next';
import ServiceWorkerRegister from '@/components/ServiceWorkerRegister';

// 本番では Vercel の環境変数に NEXT_PUBLIC_SITE_URL（実際の公開ドメイン）を設定すること。
// 未設定時はローカル開発用にフォールバックする（OGP画像の絶対URL解決に必要）。
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
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
      </body>
    </html>
  );
}
