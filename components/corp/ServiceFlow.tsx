import { corpColor, corpFont } from './tokens';

const STEPS = [
  { n: '壱', title: '記録する', body: 'まちで見つけた痕跡と、そのとき動いた感情を、写真と言葉で地図に残す。' },
  { n: '弐', title: 'ヒートマップになる', body: '記録が積み重なると、地域ごとの感情の濃淡がヒートマップとして浮かび上がる。' },
  { n: '参', title: 'つながる', body: '似た感情を記録した人とは、フォローやメッセージでつながることができる。' },
  { n: '四', title: '歩く', body: '誰かが歩いた足跡を、また別の誰かが自分の足で辿る。' },
];

export default function ServiceFlow() {
  return (
    <section style={{ background: corpColor.kinari, padding: '72px 24px' }}>
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
          体験の流れ
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          {STEPS.map((step, i) => (
            <div
              key={step.title}
              style={{
                display: 'flex',
                gap: 24,
                alignItems: 'flex-start',
                padding: '28px 0',
                borderTop: `1px solid ${corpColor.line}`,
                // 交互にわずかにインデントをずらし、均等グリッドを崩す
                marginLeft: i % 2 === 0 ? 0 : 36,
              }}
            >
              <div
                style={{
                  flexShrink: 0,
                  width: 52,
                  height: 52,
                  borderRadius: '50%',
                  border: `1.5px solid ${corpColor.shu}`,
                  color: corpColor.shu,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontFamily: corpFont.mincho,
                  fontSize: 20,
                  fontWeight: 700,
                }}
              >
                {step.n}
              </div>
              <div>
                <h3
                  style={{
                    margin: '4px 0 8px',
                    fontFamily: corpFont.mincho,
                    fontSize: 19,
                    color: corpColor.sumi,
                    fontWeight: 600,
                  }}
                >
                  {step.title}
                </h3>
                <p
                  style={{
                    margin: 0,
                    fontSize: 14,
                    lineHeight: 1.9,
                    color: corpColor.sumiSoft,
                    fontFamily: corpFont.body,
                    maxWidth: 520,
                  }}
                >
                  {step.body}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
