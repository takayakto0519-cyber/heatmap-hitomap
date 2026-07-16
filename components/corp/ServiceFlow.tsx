import { corpColor, corpFont } from './tokens';

const STEPS = [
  { n: '壱', title: '痕跡を記録する', body: 'まちで見つけたモノ・場所と、そこで動いた感情を残せます。' },
  { n: '弐', title: '感情がヒートマップになる', body: '記録が積み重なり、まちごとの感情の地図が育ちます。' },
  { n: '参', title: '似た感情の人とつながる', body: '同じものに心を動かされた人をフォローし、メッセージを送ることができます。' },
  { n: '四', title: '実際に会いに行く', body: '誰かが歩いた足跡を、自分の足で辿ることができます。' },
];

export default function ServiceFlow() {
  return (
    <section style={{ background: corpColor.ground, padding: '72px 24px' }}>
      <div style={{ maxWidth: 960, margin: '0 auto' }}>
        <p
          style={{
            margin: '0 0 40px',
            fontSize: 12,
            letterSpacing: '0.2em',
            color: corpColor.moss,
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
                  border: `1.5px solid ${corpColor.moss}`,
                  color: corpColor.moss,
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
                    color: corpColor.ink,
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
                    color: corpColor.inkSoft,
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
