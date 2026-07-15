import { corpColor, corpFont } from './tokens';
import { PinIcon, SparkleIcon, MapIcon } from '@/components/icons';
import type { IconProps } from '@/components/icons';

// YAMAP（yamap.com）トップの「3つの機能カード」構成を踏襲。
// AllTrails 同様、各カードの末尾で主CTA（地図をひらく）を繰り返す。

const FEATURES: {
  Icon: (p: IconProps) => React.ReactElement;
  title: string;
  body: string;
}[] = [
  {
    Icon: PinIcon,
    title: '痕跡を記録する',
    body: '修理された椅子、色あせた看板。まちで気になったモノを、写真と一言で地図に残す。文章が苦手でも、撮ってタップするだけ。',
  },
  {
    Icon: SparkleIcon,
    title: '感情を一緒に残す',
    body: 'ときめき、なつかしさ、切なさ——。10種類の感情から選んで、「なぜ心が動いたのか」まで痕跡に刻む。',
  },
  {
    Icon: MapIcon,
    title: '感情の地図が育つ',
    body: '記録が積み重なると、町ごとの感情の濃淡がヒートマップとして浮かび上がる。あなたの記録が、町の見え方を変えていく。',
  },
];

export default function FeatureCards() {
  return (
    <section style={{ background: corpColor.white, padding: '72px 24px' }}>
      <div style={{ maxWidth: 960, margin: '0 auto' }}>
        <p
          style={{
            margin: '0 0 36px',
            fontSize: 12,
            letterSpacing: '0.2em',
            color: corpColor.moss,
            fontFamily: corpFont.body,
            fontWeight: 700,
          }}
        >
          ヒトマップでできること
        </p>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 24 }}>
          {FEATURES.map(({ Icon, title, body }, i) => (
            <div
              key={title}
              className="hm-lift hm-tilt"
              style={{
                flex: '1 1 260px',
                border: `1px solid ${corpColor.line}`,
                padding: '28px 26px',
                background: corpColor.white,
                display: 'flex',
                flexDirection: 'column',
                gap: 14,
                marginTop: i === 1 ? 20 : 0, // 中央だけ一段ずらし、均等グリッドを崩す
              }}
            >
              <span style={{ color: corpColor.moss, display: 'inline-flex' }}>
                <Icon size={30} />
              </span>
              <h3
                style={{
                  margin: 0,
                  fontFamily: corpFont.mincho,
                  fontSize: 19,
                  fontWeight: 600,
                  color: corpColor.ink,
                }}
              >
                {title}
              </h3>
              <p
                style={{
                  margin: 0,
                  fontSize: 13.5,
                  lineHeight: 2,
                  color: corpColor.inkSoft,
                  fontFamily: corpFont.body,
                  flex: 1,
                }}
              >
                {body}
              </p>
              <a
                href="/start"
                style={{
                  fontSize: 12.5,
                  color: corpColor.moss,
                  textDecoration: 'none',
                  fontWeight: 700,
                  fontFamily: corpFont.body,
                }}
              >
                地図をひらく →
              </a>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
