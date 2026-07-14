import { corpColor, corpFont } from './tokens';

const MVV = [
  { label: 'MISSION', ja: '人の生き方を通して、地域を伝える。' },
  { label: 'VISION', ja: 'まちに残る痕跡と感情から、人と人をつなぐ。' },
  { label: 'VALUE', ja: '人を消費せず、関係を育てる。' },
];

export default function CoreEquation() {
  return (
    <section style={{ background: corpColor.white, padding: '72px 24px' }}>
      <div style={{ maxWidth: 960, margin: '0 auto' }}>
        <p
          style={{
            margin: '0 0 40px',
            fontSize: 12,
            letterSpacing: '0.2em',
            color: corpColor.tsuchi,
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
                gap: '8px 28px',
                padding: '22px 0',
                borderTop: i === 0 ? `1px solid ${corpColor.line}` : 'none',
                borderBottom: `1px solid ${corpColor.line}`,
                marginLeft: i * 24, // 非対称：段ごとに右にずらす
              }}
            >
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: '0.15em',
                  color: corpColor.shu,
                  fontFamily: corpFont.body,
                  width: 88,
                  flexShrink: 0,
                }}
              >
                {item.label}
              </span>
              <p
                style={{
                  margin: 0,
                  fontFamily: corpFont.mincho,
                  fontSize: 'clamp(18px, 2.6vw, 24px)',
                  color: corpColor.sumi,
                  fontWeight: 600,
                  lineHeight: 1.7,
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
