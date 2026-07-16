import { corpColor, corpFont } from './tokens';

const MVV = [
  { label: 'MISSION', ja: '人の生き方を通して、地域をお伝えします。' },
  { label: 'VISION', ja: 'まちに残る痕跡と感情から、人と人をつなぎます。' },
  { label: 'VALUE', ja: '人を消費せず、関係を育てます。' },
];

// ページ内で一番強く主張したい箇所（MVV）なので、地の墨色を反転させた帯で
// 前後のセクションから視覚的に切り離し、ここだけボールドさを使う。
export default function CoreEquation() {
  return (
    <section style={{ background: corpColor.ink, padding: '80px 24px' }}>
      <div style={{ maxWidth: 960, margin: '0 auto' }}>
        <p
          style={{
            margin: '0 0 44px',
            fontSize: 12,
            letterSpacing: '0.28em',
            color: corpColor.moss,
            fontFamily: corpFont.body,
            fontWeight: 700,
          }}
        >
          MISSION / VISION / VALUE
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          {MVV.map((item, i) => (
            <div
              key={item.label}
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'baseline',
                gap: '10px 32px',
                padding: '28px 0',
                borderTop: i === 0 ? `1px solid rgba(251,250,246,0.16)` : 'none',
                borderBottom: `1px solid rgba(251,250,246,0.16)`,
                marginLeft: i * 28, // 非対称：段ごとに右にずらす
              }}
            >
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: '0.18em',
                  color: corpColor.moss,
                  fontFamily: corpFont.body,
                  width: 96,
                  flexShrink: 0,
                }}
              >
                {item.label}
              </span>
              <p
                style={{
                  margin: 0,
                  fontFamily: corpFont.mincho,
                  fontSize: 'clamp(22px, 3.4vw, 32px)',
                  color: corpColor.white,
                  fontWeight: 600,
                  lineHeight: 1.6,
                }}
              >
                {item.ja}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
