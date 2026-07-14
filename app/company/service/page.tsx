import type { Metadata } from 'next';
import CorpHeader from '@/components/corp/CorpHeader';
import CorpFooter from '@/components/corp/CorpFooter';
import ServiceFlow from '@/components/corp/ServiceFlow';
import { corpColor, corpFont } from '@/components/corp/tokens';

export const metadata: Metadata = {
  title: 'ヒトマップの使い方',
  description: 'ヒトマップアプリの使い方と、体験の流れについて。記録・ヒートマップ・つながる・歩く、の4段階で説明します。',
};

export default function ServicePage() {
  return (
    <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', background: corpColor.ground }}>
      <CorpHeader />

      <main style={{ flex: 1 }}>
        <section style={{ padding: '64px 24px 40px' }}>
          <div style={{ maxWidth: 720, margin: '0 auto' }}>
            <p
              style={{
                margin: '0 0 18px',
                fontSize: 12,
                letterSpacing: '0.2em',
                color: corpColor.moss,
                fontFamily: corpFont.body,
                fontWeight: 700,
              }}
            >
              SERVICE
            </p>
            <h1
              style={{
                margin: '0 0 24px',
                fontFamily: corpFont.mincho,
                fontSize: 'clamp(24px, 3.6vw, 32px)',
                lineHeight: 1.8,
                color: corpColor.ink,
                fontWeight: 600,
              }}
            >
              地図は、あなたが見つけた痕跡でできている。
            </h1>
            <p style={{ margin: 0, fontSize: 15, lineHeight: 2, color: corpColor.inkSoft, fontFamily: corpFont.body, maxWidth: 560 }}>
              ヒトマップは、位置情報を分析するツールではありません。
              一人ひとりが町を歩いて見つけた「誰かが生きた証」を、写真と言葉で記録していくコミュニティサービスです。
              ログインしなくても、匿名のまま記録を始められます。
            </p>
          </div>
        </section>

        <ServiceFlow />

        <section style={{ background: corpColor.white, padding: '56px 24px 72px' }}>
          <div style={{ maxWidth: 720, margin: '0 auto', display: 'flex', flexWrap: 'wrap', gap: 16 }}>
            <a
              href="/start"
              style={{
                display: 'inline-block',
                padding: '15px 32px',
                background: corpColor.ink,
                color: corpColor.white,
                textDecoration: 'none',
                fontWeight: 700,
                fontSize: 14,
                fontFamily: corpFont.body,
                letterSpacing: '0.05em',
              }}
            >
              地図をひらく
            </a>
            <a
              href="/login"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                fontSize: 13,
                color: corpColor.inkSoft,
                textDecoration: 'none',
                fontWeight: 600,
                fontFamily: corpFont.body,
              }}
            >
              ログイン / 新規登録
            </a>
          </div>
        </section>
      </main>

      <CorpFooter />
    </div>
  );
}
