import type { Metadata } from 'next';
import CorpHeader from '@/components/corp/CorpHeader';
import CorpFooter from '@/components/corp/CorpFooter';
import { corpColor, corpFont } from '@/components/corp/tokens';

export const metadata: Metadata = {
  title: '実績',
  description: 'ヒトマップの実績ページです。準備中のため、後日追加予定です。',
};

export default function WorksPage() {
  return (
    <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', background: corpColor.ground }}>
      <CorpHeader />

      <main style={{ flex: 1, display: 'flex', alignItems: 'center' }}>
        <div style={{ maxWidth: 720, margin: '0 auto', padding: '96px 24px' }}>
          <p style={{ margin: '0 0 18px', fontSize: 12, letterSpacing: '0.2em', color: corpColor.moss, fontFamily: corpFont.body, fontWeight: 700 }}>
            WORKS
          </p>
          <p
            style={{
              margin: 0,
              fontFamily: corpFont.mincho,
              fontSize: 'clamp(20px, 3vw, 26px)',
              lineHeight: 1.9,
              color: corpColor.ink,
              fontWeight: 600,
            }}
          >
            準備中です。後日追加予定です。
          </p>
        </div>
      </main>

      <CorpFooter />
    </div>
  );
}
