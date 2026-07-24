import type { Metadata, Viewport } from 'next';
import Script from 'next/script';
import { Noto_Serif_JP, Zen_Kaku_Gothic_New } from 'next/font/google';
import { Analytics } from '@vercel/analytics/react';
import ServiceWorkerRegister from '@/components/ServiceWorkerRegister';

// 見た目の統一のため日本語WEBフォントを軽量読込（会長承認済み・20260718）。
// weight/サブセットを絞り、preload:false + display:swap で初期表示をブロックしない。
// tokens.ts が var(--font-serif) / var(--font-gothic) を先頭に参照する。
const fontSerif = Noto_Serif_JP({
  weight: ['600'],
  subsets: ['latin'],
  display: 'swap',
  preload: false,
  variable: '--font-serif',
});
const fontGothic = Zen_Kaku_Gothic_New({
  weight: ['400', '700'],
  subsets: ['latin'],
  display: 'swap',
  preload: false,
  variable: '--font-gothic',
});

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
  themeColor: '#FBFAF6',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja" className={`${fontSerif.variable} ${fontGothic.variable}`}>
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
          fontFamily: 'var(--font-gothic), system-ui, -apple-system, "Hiragino Sans", "Noto Sans JP", sans-serif',
          background: '#FFFFFF',
          color: '#23231F',
        }}
      >
        {/* サイト全体の演出用ユーティリティ（SANU/YAMAP風のホバー・漂いアニメ）。reduced-motionでは全て無効化 */}
        <style
          dangerouslySetInnerHTML={{
            __html: `
.hm-lift { transition: transform .3s cubic-bezier(.22,1,.36,1), box-shadow .3s cubic-bezier(.22,1,.36,1); }
.hm-lift:hover { transform: translateY(-4px); box-shadow: 0 14px 34px -16px rgba(35,35,31,.3); }
.hm-photo-zoom { overflow: hidden; }
.hm-photo-zoom img { transition: transform .6s cubic-bezier(.22,1,.36,1); }
.hm-photo-zoom:hover img { transform: scale(1.045); }
@keyframes hm-drift { 0% { transform: translate(0,0); } 50% { transform: translate(10px,-8px); } 100% { transform: translate(0,0); } }
.hm-drift { animation: hm-drift 14s ease-in-out infinite; }
.hm-drift-slow { animation: hm-drift 22s ease-in-out infinite reverse; }
::selection { background: #566246; color: #FBFAF6; }
h1, h2, h3 { font-feature-settings: "palt" 1; }
.hm-tilt { transform-style: preserve-3d; }

/* --- 20260718 モーション基盤の拡張（recent/1GUU級の"動き"を白基調の上で） --- */
/* ボタンの押下・ホバー反応の統一 */
.hm-btn { transition: transform .14s ease, box-shadow .3s cubic-bezier(.22,1,.36,1), background .2s, color .2s; }
.hm-btn:active { transform: translateY(1px) scale(.995); }
/* リンク下線をホバーで左から引く（1GUU的な上品さ） */
.hm-ul { background-image: linear-gradient(currentColor, currentColor); background-size: 0% 1px; background-position: 0 100%; background-repeat: no-repeat; text-decoration: none; transition: background-size .35s cubic-bezier(.22,1,.36,1); }
.hm-ul:hover { background-size: 100% 1px; }
/* 流れる痕跡帯（マーキー）。1組を複製して -50% 送り、無限ループに見せる */
@keyframes hm-marquee { from { transform: translateX(0); } to { transform: translateX(-50%); } }
.hm-marquee { display: flex; width: max-content; animation: hm-marquee 48s linear infinite; }
.hm-marquee:hover { animation-play-state: paused; }
/* ピンや現在地の脈動（共感が集まる場所の鼓動） */
@keyframes hm-pulse { 0% { box-shadow: 0 0 0 0 rgba(86,98,70,.35); } 70% { box-shadow: 0 0 0 12px rgba(86,98,70,0); } 100% { box-shadow: 0 0 0 0 rgba(86,98,70,0); } }
.hm-pulse { animation: hm-pulse 2.6s ease-out infinite; }
/* 要素の"ポップ"登場（ピン出現・バッジ用） */
@keyframes hm-pop { from { opacity: 0; transform: translateY(6px) scale(.92); } to { opacity: 1; transform: none; } }
.hm-pop { animation: hm-pop .5s cubic-bezier(.22,1,.36,1) both; }
/* 苔の淡い明滅（MapArtの痕跡が"灯る"） */
@keyframes hm-glow { 0%,100% { opacity: .35; } 50% { opacity: 1; } }
.hm-glow { animation: hm-glow 3.2s ease-in-out infinite; }
/* 20260724: CTAボタンのマグネット追従（カーソルに数px引き寄せられる） */
.hm-magnet { transition: transform .18s cubic-bezier(.22,1,.36,1); }
/* 感情パレットのセル：ホバーでドットが膨らむ微演出 */
.hm-swatch { transition: background .25s ease; }
.hm-swatch:hover { background: #FAF9F6; }
.hm-swatch .hm-dot { transition: transform .35s cubic-bezier(.22,1,.36,1); }
.hm-swatch:hover .hm-dot { transform: scale(1.45); }
/* アクセシビリティ：キーボード操作時のフォーカスリング */
a:focus-visible, button:focus-visible, [role="button"]:focus-visible { outline: 2px solid #566246; outline-offset: 3px; border-radius: 4px; }

/* --- 20260718 Leaflet地図のブランド化（白基調ミニマル） --- */
/* 淡色タイルを無彩色寄りに整える（継ぎ目回避のためpane単位）。
   20260724: 国土地理院タイルは行政信頼性のため差し替えず維持。無彩色寄りの色調はそのままに、
   ごくわずかな暖色(生成り)を足してブランドの苔・生成りトーンに馴染ませる。 */
.leaflet-tile-pane { filter: saturate(.85) contrast(1.02) sepia(.05) hue-rotate(-6deg); }
/* ズーム/現在地などのコントロールを白・角丸・淡い影・ブランド調に */
.leaflet-bar { border: none !important; border-radius: 12px !important; box-shadow: 0 4px 16px -6px rgba(35,35,31,.28) !important; overflow: hidden; }
.leaflet-bar a, .leaflet-bar a:hover { background: #FBFAF6; color: #23231F; border-bottom: 1px solid #E9E6DD; width: 34px; height: 34px; line-height: 34px; font-weight: 700; transition: background .2s; }
.leaflet-bar a:hover { background: #EFEDE6; }
.leaflet-bar a:last-child { border-bottom: none; }
.leaflet-control-attribution { background: rgba(251,250,246,.82) !important; color: #8C8677 !important; font-size: 10px !important; border-radius: 8px 0 0 0; }
.leaflet-control-attribution a { color: #566246 !important; }
/* ポップアップの意匠統一：角丸・柔らかい影・ブランドフォント */
.leaflet-popup-content-wrapper { border-radius: 14px !important; box-shadow: 0 10px 34px -12px rgba(35,35,31,.34) !important; border: 1px solid #E9E6DD; font-family: var(--font-gothic), "Yu Gothic", sans-serif; }
.leaflet-popup-content { margin: 12px 14px !important; line-height: 1.6; }
.leaflet-popup-tip { box-shadow: 0 10px 34px -12px rgba(35,35,31,.34); }
.leaflet-container a.leaflet-popup-close-button { color: #8C8677; }
/* 20260724: ピンをタップした瞬間、吹き出しがふわっと立ち上がる（開閉のたび同じ動きで馴染ませる） */
@keyframes hm-popup-in { from { opacity: 0; transform: translateY(6px) scale(.96); } to { opacity: 1; transform: none; } }
.leaflet-popup-content-wrapper, .leaflet-popup-tip { animation: hm-popup-in .28s cubic-bezier(.22,1,.36,1) both; }
/* 写真つき投稿：ポップアップ上端いっぱいに写真を敷く（TracePopupContentのhm-popup-photoと対） */
.leaflet-popup-content .hm-popup-photo { margin: -12px -14px 8px; width: calc(100% + 28px); border-radius: 13px 13px 0 0; display: block; }

@media (prefers-reduced-motion: reduce) {
  .hm-lift, .hm-photo-zoom img, .hm-btn { transition: none; }
  .hm-lift:hover { transform: none; box-shadow: none; }
  .leaflet-popup-content-wrapper, .leaflet-popup-tip { animation: none; }
  .hm-drift, .hm-drift-slow, .hm-marquee, .hm-pulse, .hm-pop, .hm-glow { animation: none; }
  .hm-pop { opacity: 1; transform: none; }
  .hm-glow { opacity: 1; }
}
`,
          }}
        />
        {/* カードのカーソル追従チルト（最大約2度）。タッチ端末・reduced-motionでは無効 */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
(function(){
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if (window.matchMedia('(pointer: coarse)').matches) return;
  var MAX = 2.2;
  document.addEventListener('pointermove', function(e){
    var el = e.target && e.target.closest ? e.target.closest('.hm-tilt') : null;
    if (!el) return;
    var r = el.getBoundingClientRect();
    var px = (e.clientX - r.left) / r.width - 0.5;
    var py = (e.clientY - r.top) / r.height - 0.5;
    el.style.transform = 'translateY(-4px) rotateX(' + (-py * MAX) + 'deg) rotateY(' + (px * MAX) + 'deg)';
  }, { passive: true });
  document.addEventListener('pointerout', function(e){
    var el = e.target && e.target.closest ? e.target.closest('.hm-tilt') : null;
    if (!el) return;
    if (e.relatedTarget && el.contains(e.relatedTarget)) return;
    el.style.transform = '';
  }, { passive: true });
  // 20260724: CTAボタンのマグネット追従。ボタン中心からのカーソル距離の一部だけ動かす（最大10px）
  var MAG_MAX = 10;
  document.addEventListener('pointermove', function(e){
    var el = e.target && e.target.closest ? e.target.closest('.hm-magnet') : null;
    if (!el) return;
    var r = el.getBoundingClientRect();
    var dx = e.clientX - (r.left + r.width / 2);
    var dy = e.clientY - (r.top + r.height / 2);
    var mx = Math.max(-MAG_MAX, Math.min(MAG_MAX, dx * 0.3));
    var my = Math.max(-MAG_MAX, Math.min(MAG_MAX, dy * 0.3));
    el.style.transform = 'translate(' + mx.toFixed(1) + 'px,' + my.toFixed(1) + 'px)';
  }, { passive: true });
  document.addEventListener('pointerout', function(e){
    var el = e.target && e.target.closest ? e.target.closest('.hm-magnet') : null;
    if (!el) return;
    if (e.relatedTarget && el.contains(e.relatedTarget)) return;
    el.style.transform = '';
  }, { passive: true });
})();
`,
          }}
        />
        <ServiceWorkerRegister />
        {children}
        <Analytics />
      </body>
    </html>
  );
}
