import type { Metadata } from 'next';
import CorpHeader from '@/components/corp/CorpHeader';
import CorpFooter from '@/components/corp/CorpFooter';
import { corpColor, corpFont } from '@/components/corp/tokens';

export const metadata: Metadata = {
  title: '思想',
  description:
    'ヒトマップの思想。まちに残る痕跡と、そこで動いた感情を地図に記録する——その根底にある考え方について。',
};

const TERMS = [
  {
    q: '人中心型アニミズム とは',
    a: '道端の石も、使い込まれた椅子も、ただの物体ではありません。そこには必ず、誰かの労働・迷い・優しさという「人間の必然」が積み重なっています。ヒトマップは、モノに宿ったその痕跡を通して人を見る、という立場をとっています。',
  },
  {
    q: '推譲 とは',
    a: '見返りを求めずに先に与えること。ヒトマップが目指す関係は、記録してすぐに何かが返ってくるものではありません。痕跡を残し、誰かがそれを見つけ、時間差でつながっていく——そういう長い時間軸の関係を前提にしています。',
  },
  {
    q: '核心方程式',
    a: '出会い＝【生きた証（嘘のない事実・痕跡）】×【自分を重ねる余白】\n縁＝（出会い）＋【共に取り組む行動】×【互いの価値の承認】。偶然の出会いを、必然の縁へと育てていく設計の考え方です。',
  },
];

export default function PhilosophyPage() {
  return (
    <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', background: corpColor.kinari }}>
      <CorpHeader />

      <main style={{ flex: 1 }}>
        <section style={{ padding: '64px 24px 48px' }}>
          <div style={{ maxWidth: 720, margin: '0 auto' }}>
            <p
              style={{
                margin: '0 0 18px',
                fontSize: 12,
                letterSpacing: '0.2em',
                color: corpColor.tsuchi,
                fontFamily: corpFont.body,
                fontWeight: 700,
              }}
            >
              PHILOSOPHY
            </p>

            <h1
              style={{
                margin: '0 0 36px',
                fontFamily: corpFont.mincho,
                fontSize: 'clamp(24px, 3.6vw, 32px)',
                lineHeight: 1.9,
                color: corpColor.sumi,
                fontWeight: 600,
              }}
            >
              長く使われた道具や、誰かが立ち止まった場所には、
              <br />
              その人の生きた証が残っています。
            </h1>

            <div
              style={{
                fontFamily: corpFont.body,
                fontSize: 15,
                lineHeight: 2.1,
                color: corpColor.sumiSoft,
              }}
            >
              <p style={{ margin: '0 0 24px' }}>
                ヒトマップは、まちを歩く中で見つけたその「痕跡」と、そのとき動いた感情を
                地図に記録するサービスです。記録は一人のものでは終わりません。
              </p>
              <p style={{ margin: '0 0 24px' }}>
                同じ痕跡に心を動かされた人同士がつながり、誰かが歩いた足跡を、また別の誰かが歩く。
              </p>
              <p
                style={{
                  margin: '0 0 24px',
                  fontFamily: corpFont.mincho,
                  fontSize: 18,
                  color: corpColor.sumi,
                  fontWeight: 600,
                }}
              >
                名所を見るのではなく、人に会いに行く。それが私たちの旅のかたちです。
              </p>
            </div>
          </div>
        </section>

        <section style={{ background: corpColor.white, padding: '56px 24px 72px', borderTop: `1px solid ${corpColor.line}` }}>
          <div style={{ maxWidth: 720, margin: '0 auto' }}>
            <p
              style={{
                margin: '0 0 24px',
                fontSize: 12,
                letterSpacing: '0.2em',
                color: corpColor.tsuchi,
                fontFamily: corpFont.body,
                fontWeight: 700,
              }}
            >
              もっと知りたい方へ
            </p>

            {TERMS.map((t) => (
              <details
                key={t.q}
                style={{
                  borderTop: `1px solid ${corpColor.line}`,
                  padding: '18px 0',
                }}
              >
                <summary
                  style={{
                    cursor: 'pointer',
                    fontFamily: corpFont.mincho,
                    fontSize: 16,
                    fontWeight: 600,
                    color: corpColor.sumi,
                  }}
                >
                  {t.q}
                </summary>
                <p
                  style={{
                    margin: '14px 0 0',
                    fontSize: 14,
                    lineHeight: 2,
                    color: corpColor.sumiSoft,
                    fontFamily: corpFont.body,
                    whiteSpace: 'pre-line',
                  }}
                >
                  {t.a}
                </p>
              </details>
            ))}
          </div>
        </section>

        <section style={{ padding: '48px 24px 72px' }}>
          <div style={{ maxWidth: 720, margin: '0 auto', textAlign: 'right' }}>
            <p
              style={{
                margin: 0,
                fontFamily: corpFont.mincho,
                fontSize: 18,
                color: corpColor.shu,
                fontWeight: 600,
              }}
            >
              あなたの愛用品には、どんな痕跡が刻まれていますか。
            </p>
          </div>
        </section>
      </main>

      <CorpFooter />
    </div>
  );
}
