import CorpHeader from '@/components/corp/CorpHeader';
import CorpFooter from '@/components/corp/CorpFooter';
import Hero from '@/components/corp/Hero';
import FeatureCards from '@/components/corp/FeatureCards';
import CoreEquation from '@/components/corp/CoreEquation';
import ServiceFlow from '@/components/corp/ServiceFlow';
import EmotionPalette from '@/components/corp/EmotionPalette';
import RecentTraces from '@/components/corp/RecentTraces';
import CtaBand from '@/components/corp/CtaBand';
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
    <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', background: corpColor.ground }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <CorpHeader />

      {/* 構成はYAMAPトップの骨格（ヒーロー→機能→説明→コミュニティ→事業→CTA帯→多段フッター）を踏襲し、
          トーンはSANU（詩的な一行＋余白のリズム）に寄せている。 */}
      <main style={{ flex: 1 }}>
        <Hero />
        <FeatureCards />
        <ServiceFlow />
        <EmotionPalette />
        <RecentTraces />
        <CoreEquation />

        <section style={{ background: corpColor.white, padding: '56px 24px 72px' }}>
          <div style={{ maxWidth: 960, margin: '0 auto' }}>
            <p
              style={{
                margin: '0 0 28px',
                fontSize: 12,
                letterSpacing: '0.2em',
                color: corpColor.moss,
                fontFamily: corpFont.body,
                fontWeight: 700,
              }}
            >
              事業の三本柱
            </p>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 24 }}>
              {[
                {
                  href: '/service',
                  title: 'ヒトマップ（Webサービス） →',
                  body: 'まちの痕跡と感情を記録する、稼働中の主軸サービス。',
                  offset: 0,
                },
                {
                  href: '/business',
                  title: '法人・行政の方へ →',
                  body: '痕跡から組織の生き様を伝える、解読型の採用・組織ブランディング支援。',
                  offset: 20,
                },
                {
                  href: '/school',
                  title: '学校の方へ →',
                  body: 'クラス単位の実験回コードで、地域理解教育に使う。',
                  offset: 0,
                },
              ].map((card) => (
                <a
                  key={card.href}
                  href={card.href}
                  style={{
                    flex: '1 1 260px',
                    display: 'block',
                    padding: '24px 26px',
                    border: `1px solid ${corpColor.line}`,
                    textDecoration: 'none',
                    marginTop: card.offset, // 非対称に一段ずらす
                  }}
                >
                  <span
                    style={{
                      display: 'inline-block',
                      fontSize: 10,
                      fontWeight: 700,
                      letterSpacing: '0.1em',
                      color: corpColor.moss,
                      border: `1px solid ${corpColor.moss}`,
                      padding: '2px 8px',
                      marginBottom: 12,
                      fontFamily: corpFont.body,
                    }}
                  >
                    稼働中
                  </span>
                  <span
                    style={{
                      display: 'block',
                      fontFamily: corpFont.mincho,
                      fontSize: 17,
                      fontWeight: 600,
                      color: corpColor.ink,
                      marginBottom: 8,
                    }}
                  >
                    {card.title}
                  </span>
                  <span style={{ display: 'block', fontSize: 13, color: corpColor.inkSoft, lineHeight: 1.8, fontFamily: corpFont.body }}>
                    {card.body}
                  </span>
                </a>
              ))}
            </div>
          </div>
        </section>

        <CtaBand />

        <div style={{ maxWidth: 960, margin: '0 auto', padding: '40px 24px' }}>
          <AdSlot />
        </div>
      </main>

      <CorpFooter />
    </div>
  );
}
