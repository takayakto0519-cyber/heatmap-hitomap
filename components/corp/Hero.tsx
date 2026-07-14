import { corpColor, corpFont } from './tokens';

// SANU（sa-nu.com）のヒーロー構成を踏襲：
//   全面ビジュアル ＋ 詩的な一行のタグライン ＋ 控えめなサブコピー ＋ 主CTA。
// 写真素材の代わりに、サービスの実体である「感情の地図」をコードで描いて敷く。
// （偽のスクリーンショットや素材写真を使わない＝嘘のない事実だけを見せる）

function MapArt() {
  // 町の街路グリッド＋感情のにじみ（ヒート）＋痕跡ピンを抽象化したSVG。
  return (
    <svg
      viewBox="0 0 720 480"
      preserveAspectRatio="xMidYMid slice"
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
      aria-hidden="true"
    >
      <defs>
        <radialGradient id="heat-a" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={corpColor.moss} stopOpacity="0.34" />
          <stop offset="100%" stopColor={corpColor.moss} stopOpacity="0" />
        </radialGradient>
        <radialGradient id="heat-b" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={corpColor.mossDeep} stopOpacity="0.22" />
          <stop offset="100%" stopColor={corpColor.mossDeep} stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* 街路：不規則な格子。等間隔にしない（実在の町並みの歪みを写す） */}
      <g stroke={corpColor.ink} strokeOpacity="0.13" strokeWidth="1" fill="none">
        <path d="M0 96 L720 74" />
        <path d="M0 182 L720 196" />
        <path d="M0 286 L720 262" />
        <path d="M0 388 L720 402" />
        <path d="M88 0 L112 480" />
        <path d="M214 0 L198 480" />
        <path d="M348 0 L360 480" />
        <path d="M470 0 L452 480" />
        <path d="M598 0 L612 480" />
        {/* 川か旧街道のような曲線を一本 */}
        <path d="M0 330 C 160 300, 300 380, 460 340 S 680 250, 720 268" strokeOpacity="0.2" strokeWidth="1.5" />
      </g>

      {/* 感情のにじみ */}
      <circle cx="205" cy="190" r="150" fill="url(#heat-a)" />
      <circle cx="480" cy="330" r="190" fill="url(#heat-a)" />
      <circle cx="600" cy="120" r="120" fill="url(#heat-b)" />
      <circle cx="120" cy="400" r="110" fill="url(#heat-b)" />

      {/* 痕跡ピン（点） */}
      <g fill={corpColor.mossDeep}>
        <circle cx="205" cy="190" r="4" />
        <circle cx="252" cy="168" r="3" />
        <circle cx="178" cy="238" r="3" />
        <circle cx="480" cy="330" r="4" />
        <circle cx="512" cy="300" r="3" />
        <circle cx="443" cy="356" r="3" />
        <circle cx="600" cy="120" r="3.5" />
        <circle cx="120" cy="400" r="3" />
        <circle cx="352" cy="92" r="2.5" />
      </g>
    </svg>
  );
}

export default function Hero() {
  return (
    <section
      style={{
        position: 'relative',
        background: corpColor.ground,
        overflow: 'hidden',
        borderBottom: `1px solid ${corpColor.line}`,
      }}
    >
      <MapArt />

      {/* 文字の可読性を保つための、左からのグラデーション */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: `linear-gradient(90deg, ${corpColor.ground} 18%, rgba(230,225,211,0.72) 55%, rgba(230,225,211,0.2) 100%)`,
        }}
      />

      <div
        style={{
          position: 'relative',
          maxWidth: 960,
          margin: '0 auto',
          padding: '104px 24px 96px',
        }}
      >
        <p
          style={{
            margin: '0 0 22px',
            fontSize: 12,
            letterSpacing: '0.22em',
            color: corpColor.moss,
            fontFamily: corpFont.body,
            fontWeight: 700,
          }}
        >
          HITOMAP — まちの痕跡と感情の地図
        </p>

        <h1
          style={{
            margin: '0 0 20px',
            fontFamily: corpFont.mincho,
            fontSize: 'clamp(30px, 5vw, 52px)',
            lineHeight: 1.55,
            color: corpColor.ink,
            fontWeight: 600,
            maxWidth: 640,
          }}
        >
          その色あせも、
          <br />
          誰かが生きた証。
        </h1>

        <p
          style={{
            margin: '0 0 40px',
            fontSize: 15,
            lineHeight: 2.1,
            color: corpColor.inkSoft,
            fontFamily: corpFont.body,
            maxWidth: 460,
          }}
        >
          まちで見つけた痕跡を、写真と一言で地図に残す。
          記録が重なると、町ごとの感情の濃淡が浮かび上がる。
          名所を見るのではなく、人に会いに行く旅がここから始まります。
        </p>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'center' }}>
          <a
            href="/start"
            style={{
              display: 'inline-block',
              padding: '16px 36px',
              background: corpColor.ink,
              color: corpColor.white,
              textDecoration: 'none',
              fontWeight: 700,
              fontSize: 14,
              fontFamily: corpFont.body,
              letterSpacing: '0.05em',
            }}
          >
            地図をひらく — 無料
          </a>
          <a
            href="/service"
            style={{
              fontSize: 13,
              color: corpColor.moss,
              textDecoration: 'none',
              fontWeight: 700,
              fontFamily: corpFont.body,
              borderBottom: `1px solid ${corpColor.moss}`,
              paddingBottom: 2,
            }}
          >
            使い方を見る →
          </a>
        </div>

        <p
          style={{
            margin: '28px 0 0',
            fontSize: 12,
            color: corpColor.inkSoft,
            fontFamily: corpFont.body,
          }}
        >
          ログインしなくても、匿名のまま今日から記録できます。
        </p>
      </div>
    </section>
  );
}
