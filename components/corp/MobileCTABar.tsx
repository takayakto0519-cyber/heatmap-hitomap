import { corpColor, corpFont, corpRadius } from './tokens';

// スマホのみ表示する常駐CTAバー。sticky CTAはモバイルのコンバージョン率を
// 大きく押し上げるという知見（Contentsquare等の事例で+15〜30%程度）に基づく。
// デスクトップでは他の導線が十分あるため非表示にする。
export default function MobileCTABar() {
  return (
    <>
      <style
        dangerouslySetInnerHTML={{
          __html: `
.hm-mobile-cta, .hm-mobile-cta-spacer { display: none; }
@media (max-width: 860px) {
  .hm-mobile-cta { display: flex; }
  .hm-mobile-cta-spacer { display: block; height: 62px; }
}
`,
        }}
      />
      <div
        className="hm-mobile-cta"
        style={{
          position: 'fixed',
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 190,
          alignItems: 'center',
          gap: 8,
          padding: '10px 14px calc(10px + env(safe-area-inset-bottom))',
          background: 'rgba(255,255,255,0.92)',
          backdropFilter: 'saturate(1.2) blur(8px)',
          WebkitBackdropFilter: 'saturate(1.2) blur(8px)',
          borderTop: `1px solid ${corpColor.lineSoft}`,
          boxShadow: '0 -6px 20px rgba(35,35,31,0.1)',
        }}
      >
        <a
          href="/company/business"
          style={{
            flex: '0 0 auto',
            fontSize: 11.5,
            color: corpColor.inkSoft,
            textDecoration: 'none',
            fontWeight: 700,
            fontFamily: corpFont.body,
            whiteSpace: 'nowrap',
            padding: '13px 8px',
          }}
        >
          法人・自治体
        </a>
        <a
          href="/start"
          className="hm-btn"
          style={{
            flex: 1,
            textAlign: 'center',
            display: 'block',
            padding: '13px 12px',
            background: corpColor.moss,
            color: corpColor.white,
            textDecoration: 'none',
            fontWeight: 700,
            fontSize: 13.5,
            fontFamily: corpFont.body,
            letterSpacing: '0.03em',
            borderRadius: corpRadius.pill,
          }}
        >
          地図をひらく — 無料
        </a>
      </div>
      <div className="hm-mobile-cta-spacer" />
    </>
  );
}
