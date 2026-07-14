import type { Metadata } from 'next';
import CorpHeader from '@/components/corp/CorpHeader';
import CorpFooter from '@/components/corp/CorpFooter';
import Hero from '@/components/corp/Hero';
import CoreEquation from '@/components/corp/CoreEquation';
import ServiceFlow from '@/components/corp/ServiceFlow';
import { corpColor, corpFont } from '@/components/corp/tokens';

export const metadata: Metadata = {
  title: 'ヒトマップについて',
  description:
    '人の生き方を通して、地域を伝える。ヒトマップの思想・事業・運営についてのコーポレートサイトです。',
};

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://hitomap.com';

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  '@id': `${SITE_URL}/company#organization`,
  name: 'ヒトマップ',
  url: `${SITE_URL}/company`,
  logo: `${SITE_URL}/logo.png`,
  description: '人の生き方を通して、地域を伝える。まちに残る痕跡と感情から、人と人をつなぐ。',
};

export default function CompanyTopPage() {
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
              href="/company/business"
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
              href="/company/school"
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
      </main>

      <CorpFooter />
    </div>
  );
}
