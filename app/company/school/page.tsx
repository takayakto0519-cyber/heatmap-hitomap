import type { Metadata } from 'next';
import CorpHeader from '@/components/corp/CorpHeader';
import CorpFooter from '@/components/corp/CorpFooter';
import { corpColor, corpFont } from '@/components/corp/tokens';

export const metadata: Metadata = {
  title: '学校・総合学習でのご利用',
  description: '総合学習の「町探検」「地域学習」にヒトマップを使う先生方向けのご案内です。',
};

const STEPS = [
  {
    title: 'クラス専用のコードを発行',
    body: '運営が「実験回コード」をクラスごとに発行します。生徒はこのコードを使って記録すると、クラスの記録だけをまとめて振り返れます。',
  },
  {
    title: '町を歩いて痕跡を記録',
    body: '生徒はスマートフォンやタブレットで、気になったモノ・場所を写真と一言で記録します。文章が苦手な子でも、写真とタップだけで参加できます。',
  },
  {
    title: 'クラスの地図として振り返る',
    body: '記録が集まると、クラスだけの地域理解レポートができあがります。どこにみんなの関心が集まったかが一目で分かり、発表や作文のもとになります。',
  },
];

export default function CompanySchoolPage() {
  return (
    <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', background: corpColor.ground }}>
      <CorpHeader />

      <main style={{ flex: 1 }}>
        <section style={{ padding: '64px 24px 40px' }}>
          <div style={{ maxWidth: 720, margin: '0 auto' }}>
            <p style={{ margin: '0 0 18px', fontSize: 12, letterSpacing: '0.2em', color: corpColor.moss, fontFamily: corpFont.body, fontWeight: 700 }}>
              FOR SCHOOL
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
              言葉は嘘をつける。しかしモノの痕跡は嘘をつかない。
            </h1>
            <p style={{ margin: 0, fontSize: 15, lineHeight: 2, color: corpColor.inkSoft, fontFamily: corpFont.body, maxWidth: 560 }}>
              ヒトマップは、生徒が実際に町を歩いて見つけた「痕跡」を写真と一言で記録していく学習教材として使えます。
              文章にまとめるのが苦手な子でも、写真を撮ってタップするだけで参加できます。
              ヒトマップを用いたこの取り組みは始まったばかりで、導入実績はまだありません。
            </p>
          </div>
        </section>

        <section style={{ background: corpColor.white, padding: '8px 24px 72px' }}>
          <div style={{ maxWidth: 720, margin: '0 auto' }}>
            {STEPS.map((s, i) => (
              <div
                key={s.title}
                style={{
                  display: 'flex',
                  gap: 20,
                  alignItems: 'flex-start',
                  padding: '28px 0',
                  borderTop: `1px solid ${corpColor.line}`,
                  marginLeft: i % 2 === 1 ? 28 : 0,
                }}
              >
                <div
                  style={{
                    flexShrink: 0,
                    width: 44,
                    height: 44,
                    borderRadius: '50%',
                    border: `1.5px solid ${corpColor.moss}`,
                    color: corpColor.moss,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontFamily: corpFont.mincho,
                    fontSize: 17,
                    fontWeight: 700,
                  }}
                >
                  {i + 1}
                </div>
                <div>
                  <p style={{ margin: '0 0 8px', fontFamily: corpFont.mincho, fontSize: 17, fontWeight: 600, color: corpColor.ink }}>
                    {s.title}
                  </p>
                  <p style={{ margin: 0, fontSize: 14, color: corpColor.inkSoft, lineHeight: 1.9, fontFamily: corpFont.body, maxWidth: 500 }}>
                    {s.body}
                  </p>
                </div>
              </div>
            ))}

            <div style={{ borderTop: `1px solid ${corpColor.line}`, padding: '28px 0 0' }}>
              <p style={{ margin: '0 0 8px', fontFamily: corpFont.mincho, fontSize: 17, fontWeight: 600, color: corpColor.ink }}>
                費用について
              </p>
              <p style={{ margin: '0 0 24px', fontSize: 14, color: corpColor.inkSoft, lineHeight: 1.9, fontFamily: corpFont.body }}>
                学校・教育機関でのご利用は、個別にご相談のうえ決めさせていただいています。まずはお気軽にお問い合わせください。
              </p>

              <a
                href="/contact"
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
                学校での利用を問い合わせる
              </a>

              <p style={{ marginTop: 20, fontSize: 12, color: corpColor.inkSoft, fontFamily: corpFont.body }}>
                クラス専用コードの発行後、生徒はアプリの記録画面で「実験回コード」欄に入力するだけで使えます。
              </p>
            </div>
          </div>
        </section>
      </main>

      <CorpFooter />
    </div>
  );
}
