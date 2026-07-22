import { corpColor, corpFont, corpRadius, corpShadow, corpSpace } from './tokens';
import Reveal from './Reveal';
import MapArt from './MapArt';
import CharReveal from './CharReveal';
import Parallax from './Parallax';
import { IconWalk, IconCamera, IconLayers, IconBuilding } from './icons';
import { DEFAULT_SITE_SETTINGS, type HeroSettings } from '@/lib/siteSettings';

// SANU（sa-nu.com）のヒーロー構成を踏襲：
//   全面ビジュアル ＋ 詩的な一行のタグライン ＋ 控えめなサブコピー ＋ 主CTA。
// 写真素材の代わりに、サービスの実体である「感情の地図」をコードで描いて敷く。
// （偽のスクリーンショットや素材写真を使わない＝嘘のない事実だけを見せる）
// MapArt本体はcomponents/corp/MapArt.tsxに切り出し、MVV演出（MVVReveal）でも同じ意匠を再利用する。
// 文言は運営ダッシュボード「サイト設定」タブ（site_settings.hero）から編集できる。
//
// 【20260718 白基調ミニマル化＋"一目で組織が分かる"導線】
//   ・背景を白面へ。MapArtは白地に映える淡色で敷き、痕跡ピンが時間差で灯る。
//   ・「歩く → 記録する → 地図に積み重なる」の3ステップで、何をする組織かを即提示。
//   ・個人／自治体・法人の2つの入口を最初の画面で分岐させる。

// 何をする組織かを3語で言い切る（言葉より先に体験で理解させる補助）
// アイコンは絵文字ではなく自作の線画SVG（行政・法人向けの品位のため）
const STEPS = [
  { Icon: IconWalk, label: '歩く', note: 'まちで痕跡に出会う' },
  { Icon: IconCamera, label: '記録する', note: '写真と一言で残す' },
  { Icon: IconLayers, label: '積み重なる', note: '感情の地図になる' },
] as const;

export default function Hero({ settings = DEFAULT_SITE_SETTINGS.hero }: { settings?: HeroSettings }) {
  return (
    <section
      style={{
        position: 'relative',
        background: corpColor.surface,
        overflow: 'hidden',
        borderBottom: `1px solid ${corpColor.lineSoft}`,
      }}
    >
      <Parallax speed={0.1}>
        <MapArt variant={0} id="hero" />
      </Parallax>

      {/* 文字の可読性を保つための、左からの白グラデーション（白基調に合わせて更新） */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: `linear-gradient(90deg, ${corpColor.surface} 20%, rgba(255,255,255,0.82) 56%, rgba(255,255,255,0.28) 100%)`,
        }}
      />

      <div
        style={{
          position: 'relative',
          maxWidth: corpSpace.wide,
          margin: '0 auto',
          padding: '108px 24px 92px',
        }}
      >
        <div style={{ maxWidth: 660 }}>
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
              {settings.eyebrow}
            </p>
          </Reveal>

          <CharReveal
            lines={settings.headline_lines}
            baseDelay={200}
            charDelay={55}
            style={{
              margin: '0 0 20px',
              fontFamily: corpFont.mincho,
              fontSize: 'clamp(34px, 6vw, 64px)',
              lineHeight: 1.5,
              color: corpColor.ink,
              fontWeight: 600,
              letterSpacing: '0.01em',
              maxWidth: 680,
            }}
          />

          <Reveal immediate delay={350} y={20}>
            <p
              style={{
                margin: '0 0 30px',
                fontSize: 15.5,
                lineHeight: 2.1,
                color: corpColor.inkSoft,
                fontFamily: corpFont.body,
                maxWidth: 500,
              }}
            >
              {settings.subcopy}
            </p>
          </Reveal>

          {/* 何をする組織か＝「歩く → 記録する → 積み重なる」を即提示（順次リビール） */}
          <Reveal immediate delay={480} y={16}>
            <div
              style={{
                display: 'flex',
                alignItems: 'stretch',
                gap: 6,
                margin: '0 0 34px',
                flexWrap: 'wrap',
              }}
            >
              {STEPS.map((s, i) => (
                <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: '9px 15px',
                      background: corpColor.white,
                      border: `1px solid ${corpColor.lineSoft}`,
                      borderRadius: corpRadius.pill,
                      boxShadow: corpShadow.card,
                    }}
                  >
                    <s.Icon size={20} color={corpColor.moss} />
                    <span style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.15 }}>
                      <span style={{ fontSize: 13.5, fontWeight: 700, color: corpColor.ink, fontFamily: corpFont.body }}>
                        {s.label}
                      </span>
                      <span style={{ fontSize: 10.5, color: corpColor.inkSoft, fontFamily: corpFont.body }}>
                        {s.note}
                      </span>
                    </span>
                  </div>
                  {i < STEPS.length - 1 && (
                    <span aria-hidden="true" style={{ color: corpColor.moss, fontSize: 14, fontWeight: 700 }}>→</span>
                  )}
                </div>
              ))}
            </div>
          </Reveal>

          <Reveal immediate delay={600} y={16}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'center' }}>
              <a
                href={settings.cta_href}
                className="hm-lift hm-btn"
                style={{
                  display: 'inline-block',
                  padding: '16px 36px',
                  background: corpColor.moss,
                  color: corpColor.white,
                  textDecoration: 'none',
                  fontWeight: 700,
                  fontSize: 14.5,
                  fontFamily: corpFont.body,
                  letterSpacing: '0.04em',
                  borderRadius: corpRadius.pill,
                  boxShadow: corpShadow.card,
                }}
              >
                {settings.cta_label}
              </a>
              <a
                href={settings.sub_link_href}
                className="hm-ul"
                style={{
                  fontSize: 13.5,
                  color: corpColor.moss,
                  fontWeight: 700,
                  fontFamily: corpFont.body,
                  paddingBottom: 2,
                }}
              >
                {settings.sub_link_label}
              </a>
            </div>

            <p
              style={{
                margin: '22px 0 26px',
                fontSize: 12,
                color: corpColor.inkSoft,
                fontFamily: corpFont.body,
              }}
            >
              {settings.note}
            </p>

            {/* 個人利用者と法人・自治体の見込み客が同じ導線を通るため、最初の画面で行き先を分岐させる。
                （両者に無関係な証跡を延々スクロールさせない） */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
              <a
                href={settings.biz_link_href}
                className="hm-lift hm-btn"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '11px 18px',
                  background: corpColor.trustSoft,
                  color: corpColor.trustDeep,
                  textDecoration: 'none',
                  fontSize: 12.5,
                  fontWeight: 700,
                  fontFamily: corpFont.body,
                  border: `1px solid ${corpColor.trust}22`,
                  borderRadius: corpRadius.pill,
                }}
              >
                <IconBuilding size={16} color={corpColor.trustDeep} />
                {settings.biz_link_label}
              </a>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
