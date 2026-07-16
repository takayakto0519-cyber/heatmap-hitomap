import type { Metadata } from 'next';
import CorpHeader from '@/components/corp/CorpHeader';
import CorpFooter from '@/components/corp/CorpFooter';
import Reveal from '@/components/corp/Reveal';
import { corpColor, corpFont } from '@/components/corp/tokens';

export const metadata: Metadata = {
  title: 'お問い合わせ',
  description: 'ヒトマップへのお問い合わせはこちらから。',
  alternates: { canonical: '/company/contact' },
};

export default function ContactPage() {
  return (
    <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', background: corpColor.ground }}>
      <CorpHeader />

      <main style={{ flex: 1, display: 'flex', alignItems: 'center' }}>
        <div style={{ maxWidth: 560, margin: '0 auto', padding: '80px 24px', width: '100%' }}>
          <Reveal immediate y={16}>
            <p style={{ margin: '0 0 18px', fontSize: 12, letterSpacing: '0.2em', color: corpColor.moss, fontFamily: corpFont.body, fontWeight: 700 }}>
              CONTACT
            </p>
          </Reveal>
          <Reveal immediate delay={120} y={18}>
            <h1
              style={{
                margin: '0 0 24px',
                fontFamily: corpFont.mincho,
                fontSize: 'clamp(22px, 3.2vw, 28px)',
                lineHeight: 1.8,
                color: corpColor.ink,
                fontWeight: 600,
              }}
            >
              まずは、お気軽にご連絡ください。
            </h1>
            <p style={{ margin: '0 0 36px', fontSize: 14, lineHeight: 2, color: corpColor.inkSoft, fontFamily: corpFont.body }}>
              法人・行政・学校でのご利用、取材・提携のご相談など、内容にかかわらずご連絡ください。
            </p>

            <a
              href="mailto:hitomap.info@gmail.com"
              className="hm-lift"
              style={{
                display: 'block',
                width: '100%',
                boxSizing: 'border-box',
                padding: '18px',
                background: corpColor.ink,
                textAlign: 'center',
                color: corpColor.white,
                fontWeight: 700,
                fontSize: 15,
                fontFamily: corpFont.body,
                textDecoration: 'none',
                letterSpacing: '0.05em',
              }}
            >
              メールでお問い合わせ
            </a>
            <p style={{ textAlign: 'center', fontSize: 12, color: corpColor.inkSoft, marginTop: 14, fontFamily: corpFont.body }}>
              hitomap.info@gmail.com
            </p>
          </Reveal>
        </div>
      </main>

      <CorpFooter />
    </div>
  );
}
