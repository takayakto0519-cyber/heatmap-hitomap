import { corpColor, corpFont } from './tokens';
import Reveal from './Reveal';
import MapArt from './MapArt';
import CharReveal from './CharReveal';
import Parallax from './Parallax';

// SANU（sa-nu.com）のヒーロー構成を踏襲：
//   全面ビジュアル ＋ 詩的な一行のタグライン ＋ 控えめなサブコピー ＋ 主CTA。
// 写真素材の代わりに、サービスの実体である「感情の地図」をコードで描いて敷く。
// （偽のスクリーンショットや素材写真を使わない＝嘘のない事実だけを見せる）
// MapArt本体はcomponents/corp/MapArt.tsxに切り出し、MVV演出（MVVReveal）でも同じ意匠を再利用する。

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
      <Parallax speed={0.1}>
        <MapArt variant={0} id="hero" />
      </Parallax>

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
        <Reveal immediate y={18}>
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
        </Reveal>

        <CharReveal
          lines={['その色あせも、', '誰かが生きた証。']}
          baseDelay={200}
          charDelay={55}
          style={{
            margin: '0 0 20px',
            fontFamily: corpFont.mincho,
            fontSize: 'clamp(30px, 5vw, 52px)',
            lineHeight: 1.55,
            color: corpColor.ink,
            fontWeight: 600,
            maxWidth: 640,
          }}
        />

        <Reveal immediate delay={350} y={20}>
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
        </Reveal>

        <Reveal immediate delay={550} y={16}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'center' }}>
            <a
              href="/start"
              className="hm-lift"
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
              margin: '28px 0 12px',
              fontSize: 12,
              color: corpColor.inkSoft,
              fontFamily: corpFont.body,
            }}
          >
            ログインしなくても、匿名のまま今日から記録できます。
          </p>

          {/* 個人利用者だけでなく法人・自治体の見込み客も同じ導線を通るため、
              最初の画面で行き先を分岐させる（両者に無関係な証跡を延々スクロールさせない）。 */}
          <a
            href="/business"
            style={{
              fontSize: 12.5,
              color: corpColor.inkSoft,
              textDecoration: 'none',
              fontFamily: corpFont.body,
            }}
          >
            法人・自治体の方はこちら →
          </a>
        </Reveal>
      </div>
    </section>
  );
}
