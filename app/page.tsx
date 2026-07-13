import SiteHeader from '@/components/SiteHeader';
import AdSlot from '@/components/AdSlot';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://hitomap.com';

const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'Organization',
      '@id': `${SITE_URL}/#organization`,
      name: 'ヒトマップ',
      url: SITE_URL,
      logo: `${SITE_URL}/logo.png`,
      description: '町を歩いて見つけた誰かの生きた証（痕跡）を記録し、地図に積み重ねていくコミュニティサービス',
    },
    {
      '@type': 'WebSite',
      '@id': `${SITE_URL}/#website`,
      name: 'ヒトマップ',
      alternateName: 'HitoMap',
      url: SITE_URL,
      publisher: { '@id': `${SITE_URL}/#organization` },
      inLanguage: 'ja',
      description:
        'データ分析用の「ヒートマップ」ツールではありません。町を歩いて見つけた誰かの生きた証を、写真と言葉で記録するコミュニティサービスです。',
    },
  ],
};

export default function HomePage() {
  return (
    <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', background: '#fafafa' }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <SiteHeader />

      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '40px 24px' }}>
        <div style={{ width: '100%', maxWidth: 480 }}>
          <h1 style={{ fontSize: 24, fontWeight: 800, margin: '0 0 12px', textAlign: 'center' }}>
            言葉は嘘をつける。<br />しかし、モノの痕跡は嘘をつかない。
          </h1>
          <p style={{ fontSize: 14, color: '#666', textAlign: 'center', lineHeight: 1.8, margin: '0 0 28px' }}>
            ヒトマップは、町を歩いて見つけた「誰かが生きた証」を記録し、
            地図の上に積み重ねていくサービスです。
            修理された椅子、色あせた看板——そこに積もった時間を、
            あなたの手で残していきます。
          </p>

          <a href="/start" style={{
            display: 'block', width: '100%', boxSizing: 'border-box', padding: '15px', borderRadius: 12,
            background: '#222', textAlign: 'center',
            color: '#fff', fontWeight: 800, fontSize: 16, textDecoration: 'none', marginBottom: 14,
          }}>はじめる</a>

          <p style={{ textAlign: 'center', margin: 0 }}>
            <a href="/login" style={{ fontSize: 13, color: '#38ADA9', fontWeight: 700, textDecoration: 'none' }}>
              ログイン / 新規登録
            </a>
          </p>

          <section style={{ marginTop: 40, padding: 20, background: '#fff', borderRadius: 14, border: '1px solid #f0f0f0' }}>
            <h2 style={{ fontSize: 14, fontWeight: 800, margin: '0 0 8px' }}>ヒトマップとは</h2>
            <p style={{ fontSize: 13, color: '#777', lineHeight: 1.8, margin: 0 }}>
              地図データの分析ツール（いわゆる「ヒートマップ」ツール）ではありません。
              位置情報の分析・解析を行うサービスではなく、
              個人が町を歩いて記録した痕跡を、その人自身の言葉と写真で残すコミュニティサービスです。
              ログインしなくても匿名のまま利用を始められます。
            </p>
          </section>

          <a href="/business" style={{
            display: 'block', marginTop: 14, padding: '16px 18px', borderRadius: 14,
            background: '#fff', border: '1px solid #eee', textDecoration: 'none',
          }}>
            <span style={{ display: 'block', fontSize: 13, fontWeight: 800, color: '#222', marginBottom: 4 }}>
              法人・行政の方へ →
            </span>
            <span style={{ display: 'block', fontSize: 12, color: '#888', lineHeight: 1.7 }}>
              痕跡から組織の生き様を伝える、採用・組織ブランディング支援を行っています。
            </span>
          </a>

          <div style={{ display: 'flex', justifyContent: 'center', gap: 14, marginTop: 24 }}>
            <a href="/school" style={{ fontSize: 11, color: '#bbb', textDecoration: 'none' }}>学校でのご利用</a>
            <a href="/terms" style={{ fontSize: 11, color: '#bbb', textDecoration: 'none' }}>利用規約</a>
            <a href="/privacy" style={{ fontSize: 11, color: '#bbb', textDecoration: 'none' }}>プライバシーポリシー</a>
          </div>

          <AdSlot />
        </div>
      </main>
    </div>
  );
}
