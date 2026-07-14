import { corpColor, corpFont } from './tokens';

// YAMAP／Strava式：フッター直前でもう一度だけ主CTAを繰り返す帯。
export default function CtaBand() {
  return (
    <section style={{ background: corpColor.ink, padding: '64px 24px' }}>
      <div
        style={{
          maxWidth: 960,
          margin: '0 auto',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 24,
        }}
      >
        <div>
          <h2
            style={{
              margin: '0 0 10px',
              fontFamily: corpFont.mincho,
              fontSize: 'clamp(22px, 3.2vw, 30px)',
              fontWeight: 600,
              color: corpColor.white,
              lineHeight: 1.6,
            }}
          >
            まず、ひとつの町から。
          </h2>
          <p style={{ margin: 0, fontSize: 13, color: corpColor.line, fontFamily: corpFont.body, lineHeight: 1.9 }}>
            痕跡は、町の縮尺でこそ生きた証になる。登録なしで、今日から歩けます。
          </p>
        </div>
        <a
          href="/start"
          style={{
            display: 'inline-block',
            padding: '16px 40px',
            background: corpColor.white,
            color: corpColor.ink,
            textDecoration: 'none',
            fontWeight: 700,
            fontSize: 14,
            fontFamily: corpFont.body,
            letterSpacing: '0.05em',
            flexShrink: 0,
          }}
        >
          地図をひらく — 無料
        </a>
      </div>
    </section>
  );
}
