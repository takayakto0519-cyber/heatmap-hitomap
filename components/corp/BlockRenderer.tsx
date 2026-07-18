import { corpColor, corpFont, corpRadius, corpShadow } from './tokens';
import Reveal from './Reveal';
import MVVReveal from './MVVReveal';
import type { SiteBlock, BlockCardItem, BlockQuoteItem } from '@/lib/siteBlocks';

// 運営が /admin/blocks から自由に追加・並び替えできるサイトブロックの描画。
// 既存の固定セクション（Hero・EmotionPalette・RecentTraces）と視覚的に馴染むよう、
// 同じcorpColorトークン・白/生成りの交互背景・非対称オフセットのルールを踏襲する。

function isQuoteItems(items: (BlockCardItem | BlockQuoteItem)[]): items is BlockQuoteItem[] {
  return items.length > 0 && 'comment' in items[0];
}

// CTAが連続しても中盤が「暗いスラブ」にならないよう、CTAは墨→苔→淡色の3種を巡回させる。
// （MVVの暗色没入は演出として残しつつ、CTAの重なりで暗くなりすぎるのを防ぐ）
const CTA_BG = [corpColor.ink, corpColor.moss, corpColor.surfaceSoft] as const;

export default function BlockRenderer({ blocks }: { blocks: SiteBlock[] }) {
  let ctaSeen = 0;
  return (
    <>
      {blocks.map((block, i) => {
        // MVVは全幅・sticky積み重ね演出のため、他ブロックと違い余白付きsectionで包まない
        if (block.block_type === 'mvv') {
          return <MVVReveal key={block.id} eyebrow={block.eyebrow} items={block.items as BlockCardItem[]} />;
        }
        const alt = i % 2 === 1;
        let bg: string;
        let ctaVariant = 0;
        if (block.block_type === 'cta') {
          ctaVariant = ctaSeen % CTA_BG.length;
          ctaSeen += 1;
          bg = CTA_BG[ctaVariant];
        } else {
          // 白基調の交互リズム：白面 ↔ わずかに沈めたsurfaceSoft
          bg = alt ? corpColor.surfaceSoft : corpColor.surface;
        }
        return (
          <Reveal key={block.id}>
            <section style={{ background: bg, padding: block.block_type === 'cta' ? '64px 24px' : '84px 24px' }}>
              <div style={{ maxWidth: 960, margin: '0 auto' }}>
                {renderBlockBody(block, ctaVariant)}
              </div>
            </section>
          </Reveal>
        );
      })}
    </>
  );
}

function Eyebrow({ children, light }: { children: React.ReactNode; light?: boolean }) {
  if (!children) return null;
  return (
    <p style={{
      margin: '0 0 28px', fontSize: 12, letterSpacing: '0.2em', fontWeight: 700,
      color: light ? corpColor.line : corpColor.moss, fontFamily: corpFont.body,
    }}>
      {children}
    </p>
  );
}

function renderBlockBody(block: SiteBlock, ctaVariant = 0) {
  switch (block.block_type) {
    case 'heading':
      return (
        <>
          <Eyebrow>{block.eyebrow}</Eyebrow>
          <h2 style={{ margin: 0, fontFamily: corpFont.mincho, fontSize: 'clamp(22px,3.2vw,30px)', fontWeight: 600, color: corpColor.ink, lineHeight: 1.7 }}>
            {block.heading}
          </h2>
        </>
      );

    case 'text':
      return (
        <>
          <Eyebrow>{block.eyebrow}</Eyebrow>
          {block.heading && (
            <h2 style={{ margin: '0 0 16px', fontFamily: corpFont.mincho, fontSize: 'clamp(20px,2.8vw,26px)', fontWeight: 600, color: corpColor.ink, lineHeight: 1.7 }}>
              {block.heading}
            </h2>
          )}
          {block.body && (
            <p style={{ margin: 0, fontSize: 14.5, lineHeight: 2.1, color: corpColor.inkSoft, fontFamily: corpFont.body, whiteSpace: 'pre-wrap', maxWidth: 640 }}>
              {block.body}
            </p>
          )}
        </>
      );

    case 'image':
      return (
        <div>
          {block.image_url && (
            <div className="hm-photo-zoom" style={{ maxHeight: 480 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={block.image_url} alt={block.body ?? ''} style={{ width: '100%', maxHeight: 480, objectFit: 'cover', display: 'block' }} />
            </div>
          )}
          {block.body && (
            <p style={{ margin: '14px 0 0', fontSize: 12.5, color: corpColor.inkSoft, fontFamily: corpFont.body }}>{block.body}</p>
          )}
        </div>
      );

    case 'cards': {
      const items = block.items as BlockCardItem[];
      return (
        <>
          <Eyebrow>{block.eyebrow}</Eyebrow>
          {block.heading && (
            <h2 style={{ margin: '0 0 28px', fontFamily: corpFont.mincho, fontSize: 22, fontWeight: 600, color: corpColor.ink }}>{block.heading}</h2>
          )}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 24 }}>
            {items.map((item, i) => {
              const Wrapper = item.href ? 'a' : 'div';
              return (
                <Wrapper
                  key={i}
                  {...(item.href ? { href: item.href } : {})}
                  className="hm-lift hm-tilt"
                  style={{
                    flex: '1 1 240px', display: 'block', padding: '24px 26px',
                    border: `1px solid ${corpColor.lineSoft}`, background: corpColor.surface,
                    borderRadius: corpRadius.md, boxShadow: corpShadow.card, overflow: 'hidden',
                    textDecoration: 'none', marginTop: i === 1 ? 20 : 0,
                  }}
                >
                  {item.badge && (
                    <span style={{
                      display: 'inline-block', fontSize: 10, fontWeight: 700, letterSpacing: '0.1em',
                      color: corpColor.moss, border: `1px solid ${corpColor.moss}`, padding: '2px 8px',
                      marginBottom: 12, fontFamily: corpFont.body,
                    }}>{item.badge}</span>
                  )}
                  {item.image_url && (
                    <div className="hm-photo-zoom" style={{ height: 130, marginBottom: 12 }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={item.image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                    </div>
                  )}
                  <span style={{ display: 'block', fontFamily: corpFont.mincho, fontSize: 17, fontWeight: 600, color: corpColor.ink, marginBottom: 8 }}>
                    {item.title}{item.href && ' →'}
                  </span>
                  <span style={{ display: 'block', fontSize: 13, color: corpColor.inkSoft, lineHeight: 1.8, fontFamily: corpFont.body }}>
                    {item.body}
                  </span>
                </Wrapper>
              );
            })}
          </div>
        </>
      );
    }

    case 'quote': {
      const items = isQuoteItems(block.items) ? block.items : [];
      return (
        <>
          <Eyebrow>{block.eyebrow ?? '声'}</Eyebrow>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {items.map((t, i) => (
              <figure key={i} style={{
                margin: 0, borderLeft: `3px solid ${corpColor.moss}`, background: corpColor.surfaceSoft,
                borderRadius: `0 ${corpRadius.md}px ${corpRadius.md}px 0`,
                padding: '18px 22px', marginLeft: i % 2 === 1 ? 24 : 0,
              }}>
                <blockquote style={{ margin: '0 0 10px', fontFamily: corpFont.mincho, fontSize: 15, lineHeight: 2, color: corpColor.ink, whiteSpace: 'pre-wrap' }}>
                  {t.comment}
                </blockquote>
                <figcaption style={{ fontSize: 12, color: corpColor.inkSoft, fontFamily: corpFont.body }}>— {t.name}</figcaption>
              </figure>
            ))}
          </div>
        </>
      );
    }

    case 'cta': {
      // 0=墨(暗) / 1=苔 / 2=淡色。背景の明暗に合わせて文字・ボタン色を切り替える。
      const onDark = ctaVariant === 0 || ctaVariant === 1;
      const headColor = onDark ? corpColor.white : corpColor.ink;
      const bodyColor = ctaVariant === 0 ? corpColor.line : ctaVariant === 1 ? 'rgba(255,255,255,0.85)' : corpColor.inkSoft;
      const btnBg = onDark ? corpColor.white : corpColor.moss;
      const btnColor = ctaVariant === 0 ? corpColor.ink : ctaVariant === 1 ? corpColor.moss : corpColor.white;
      return (
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 24 }}>
          <div>
            {block.heading && (
              <h2 style={{ margin: '0 0 10px', fontFamily: corpFont.mincho, fontSize: 'clamp(22px,3.2vw,30px)', fontWeight: 600, color: headColor, lineHeight: 1.6 }}>
                {block.heading}
              </h2>
            )}
            {block.body && (
              <p style={{ margin: 0, fontSize: 13, color: bodyColor, fontFamily: corpFont.body, lineHeight: 1.9 }}>{block.body}</p>
            )}
          </div>
          {block.cta_label && block.cta_href && (
            <a href={block.cta_href} className="hm-lift hm-btn" style={{
              display: 'inline-block', padding: '16px 40px', background: btnBg, color: btnColor,
              textDecoration: 'none', fontWeight: 700, fontSize: 14, fontFamily: corpFont.body, letterSpacing: '0.05em', flexShrink: 0,
              borderRadius: corpRadius.sm, boxShadow: corpShadow.card,
            }}>
              {block.cta_label}
            </a>
          )}
        </div>
      );
    }

    default:
      return null;
  }
}
