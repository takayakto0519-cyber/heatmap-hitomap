import { corpColor, corpFont } from './tokens';

export default function Hero() {
  return (
    <section
      style={{
        background: corpColor.kinari,
        padding: '64px 24px 80px',
      }}
    >
      <div
        style={{
          maxWidth: 960,
          margin: '0 auto',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'flex-end',
          gap: 32,
        }}
      >
        <div style={{ flex: '1 1 480px', minWidth: 280 }}>
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
            HITOMAP
          </p>
          <h1
            style={{
              margin: '0 0 24px',
              fontFamily: corpFont.mincho,
              fontSize: 'clamp(28px, 4.2vw, 44px)',
              lineHeight: 1.6,
              color: corpColor.sumi,
              fontWeight: 600,
            }}
          >
            言葉は取り繕える。
            <br />
            モノに残った痕跡は、取り繕えない。
          </h1>
          <p
            style={{
              margin: '0 0 36px',
              fontSize: 15,
              lineHeight: 2,
              color: corpColor.sumiSoft,
              fontFamily: corpFont.body,
              maxWidth: 480,
            }}
          >
            まちを歩く中で見つけた誰かの生きた証を、地図に記録する。
            記録が積み重なると、その土地の感情がヒートマップとして浮かび上がる。
            名所を見るのではなく、人に会いに行く——それがヒトマップの旅です。
          </p>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'center' }}>
            <a
              href="/start"
              style={{
                display: 'inline-block',
                padding: '15px 32px',
                background: corpColor.sumi,
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
              href="/company/philosophy"
              style={{
                fontSize: 13,
                color: corpColor.shu,
                textDecoration: 'none',
                fontWeight: 700,
                fontFamily: corpFont.body,
                borderBottom: `1px solid ${corpColor.shu}`,
                paddingBottom: 2,
              }}
            >
              思想を読む →
            </a>
          </div>
        </div>

        {/* 非対称の余白づくり：右側にはテキストのみのブロックを縦にずらして配置 */}
        <div
          style={{
            flex: '0 1 220px',
            minWidth: 180,
            marginBottom: 8,
            borderLeft: `1px solid ${corpColor.tsuchiSoft}`,
            paddingLeft: 20,
          }}
        >
          <p style={{ margin: 0, fontSize: 12, lineHeight: 2.1, color: corpColor.sumiSoft, fontFamily: corpFont.body }}>
            修理された椅子。
            <br />
            色あせた看板。
            <br />
            すり減った石段。
            <br />
            <br />
            そこに積もった時間を、
            <br />
            あなたの手で残していく。
          </p>
        </div>
      </div>
    </section>
  );
}
