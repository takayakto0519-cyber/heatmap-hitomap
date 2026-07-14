import CorpHeader from '@/components/corp/CorpHeader';
import CorpFooter from '@/components/corp/CorpFooter';
import Hero from '@/components/corp/Hero';
import CoreEquation from '@/components/corp/CoreEquation';
import ServiceFlow from '@/components/corp/ServiceFlow';
import { corpColor, corpFont } from '@/components/corp/tokens';
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
    <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', background: corpColor.kinari }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <CorpHeader />

      <main style={{ flex: 1 }}>
        <Hero />
        <CoreEquation />
        <ServiceFlow />

        <section style={{ background: corpColor.white, padding: '56px 24px 72px' }}>
          <div style={{ maxWidth: 960, margin: '0 auto', display: 'flex', flexWrap: 'wrap', gap: 24 }}>
            <a
              href="/business"
              style={{
                flex: '1 1 280px',
                display: 'block',
                padding: '24px 26px',
                border: `1px solid ${corpColor.line}`,
                textDecoration: 'none',
              }}
            >
              <span
                style={{
                  display: 'block',
                  fontFamily: corpFont.mincho,
                  fontSize: 17,
                  fontWeight: 600,
                  color: corpColor.sumi,
                  marginBottom: 8,
                }}
              >
                法人・行政の方へ →
              </span>
              <span style={{ display: 'block', fontSize: 13, color: corpColor.sumiSoft, lineHeight: 1.8, fontFamily: corpFont.body }}>
                痕跡から組織の生き様を伝える、解読型の採用・組織ブランディング支援。
              </span>
            </a>

            <a
              href="/school"
              style={{
                flex: '1 1 280px',
                display: 'block',
                padding: '24px 26px',
                border: `1px solid ${corpColor.line}`,
                textDecoration: 'none',
                marginTop: 20, // 非対称に一段ずらす
              }}
            >
              <span
                style={{
                  display: 'block',
                  fontFamily: corpFont.mincho,
                  fontSize: 17,
                  fontWeight: 600,
                  color: corpColor.sumi,
                  marginBottom: 8,
                }}
              >
                学校の方へ →
              </span>
              <span style={{ display: 'block', fontSize: 13, color: corpColor.sumiSoft, lineHeight: 1.8, fontFamily: corpFont.body }}>
                クラス単位の実験回コードで、地域理解教育に使う。
              </span>
            </a>
          </div>
        </section>

        <div style={{ maxWidth: 960, margin: '0 auto', padding: '0 24px 40px' }}>
          <AdSlot />
        </div>
      </main>

      <CorpFooter />
    </div>
  );
}
