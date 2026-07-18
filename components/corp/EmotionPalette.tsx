import { EMOTIONS } from '@/lib/emotions';
import { corpColor, corpFont } from './tokens';

// peaceput.com「brand」セクション（ブランドロゴのグリッド＋一言説明）の構成を、
// ヒトマップの実データ（lib/emotions.ts の10種の感情タグ）で再現している。
export default function EmotionPalette() {
  return (
    <section style={{ background: corpColor.surfaceSoft, padding: '88px 24px' }}>
      <div style={{ maxWidth: 960, margin: '0 auto' }}>
        <p
          style={{
            margin: '0 0 12px',
            fontSize: 12,
            letterSpacing: '0.2em',
            color: corpColor.moss,
            fontFamily: corpFont.body,
            fontWeight: 700,
          }}
        >
          EMOTION
        </p>
        <p
          style={{
            margin: '0 0 40px',
            fontFamily: corpFont.mincho,
            fontSize: 'clamp(18px, 2.4vw, 22px)',
            color: corpColor.ink,
            fontWeight: 600,
          }}
        >
          記録するとき、10種類の感情から選ぶ。
        </p>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
            gap: 1,
            background: corpColor.lineSoft,
            border: `1px solid ${corpColor.lineSoft}`,
            borderRadius: 14,
            overflow: 'hidden',
          }}
        >
          {EMOTIONS.map((e) => (
            <div
              key={e.key}
              className="hm-swatch"
              style={{
                background: corpColor.surface,
                padding: '22px 16px',
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
              }}
            >
              <span
                className="hm-dot"
                style={{
                  display: 'inline-block',
                  width: 11,
                  height: 11,
                  borderRadius: '50%',
                  background: e.color,
                }}
              />
              <span style={{ fontSize: 14, fontWeight: 700, color: corpColor.ink, fontFamily: corpFont.body }}>
                {e.label}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
