'use client';

import { useEffect, useState } from 'react';
import { corpColor, corpFont } from './tokens';
import ReadingProgress from './ReadingProgress';

// 「思想」ページはまだ内容を作り込み中のため、ナビゲーションからは一旦外す。
// ページ自体は残しているので、準備ができ次第ここに追加する。
const NAV = [
  { href: '/service', label: 'ヒトマップ' },
  { href: '/business', label: '法人・行政' },
  { href: '/school', label: '学校' },
  { href: '/works', label: '実績' },
  { href: '/blog', label: 'ブログ' },
  { href: '/team', label: '運営' },
];

// スマホ幅ではナビが折り返して226px超まで肥大化していた（NN/g等の推奨は48-56px）。
// 860px以下ではリンクをハンバーガー内に格納し、ロゴ＋CTA＋開閉ボタンの1行に固定する。
export default function CorpHeader() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  return (
    <>
      <style
        dangerouslySetInnerHTML={{
          __html: `
.hm-header-nav, .hm-header-sep { display: flex; }
.hm-header-burger { display: none; }
.hm-header-cta-full { display: inline; }
@media (max-width: 860px) {
  .hm-header-nav, .hm-header-sep { display: none; }
  .hm-header-burger { display: inline-flex; }
  .hm-header-cta-full { display: none; }
}
`,
        }}
      />
      <header
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 200,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
          padding: '12px 20px',
          background: corpColor.ground,
          borderBottom: `1px solid ${corpColor.line}`,
          fontFamily: corpFont.body,
        }}
      >
        <ReadingProgress />
        <a href="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none', flexShrink: 0 }}>
          <img src="/logo.png" alt="ヒトマップ" style={{ height: 24, width: 'auto' }} />
          <span style={{ fontSize: 14, fontWeight: 700, color: corpColor.ink, letterSpacing: '0.02em' }}>
            ヒトマップ
          </span>
        </a>

        <div style={{ display: 'flex', alignItems: 'center', gap: 16, minWidth: 0 }}>
          <nav
            className="hm-header-nav"
            style={{ alignItems: 'center', gap: '6px 4px', flexWrap: 'wrap', justifyContent: 'flex-end' }}
          >
            {NAV.map((item) => (
              <a
                key={item.href}
                href={item.href}
                style={{
                  fontSize: 13,
                  color: corpColor.inkSoft,
                  textDecoration: 'none',
                  fontWeight: 600,
                  whiteSpace: 'nowrap',
                  padding: '6px 10px',
                  borderRadius: 3,
                }}
              >
                {item.label}
              </a>
            ))}
            <a
              href="/contact"
              style={{
                fontSize: 13,
                color: corpColor.moss,
                textDecoration: 'none',
                fontWeight: 700,
                whiteSpace: 'nowrap',
                padding: '6px 10px',
                borderRadius: 3,
                border: `1px solid ${corpColor.moss}`,
              }}
            >
              お問い合わせ
            </a>
          </nav>

          <span className="hm-header-sep" style={{ width: 1, height: 22, background: corpColor.line, flexShrink: 0 }} />

          <a
            href="/login"
            style={{
              flexShrink: 0,
              display: 'inline-block',
              padding: '9px 16px',
              background: corpColor.ink,
              color: corpColor.white,
              textDecoration: 'none',
              fontWeight: 700,
              fontSize: 13,
              letterSpacing: '0.03em',
              whiteSpace: 'nowrap',
            }}
          >
            <span className="hm-header-cta-full">ログイン / </span>地図を開く
          </a>

          <button
            type="button"
            className="hm-header-burger"
            aria-label={open ? 'メニューを閉じる' : 'メニューを開く'}
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
            style={{
              alignItems: 'center',
              justifyContent: 'center',
              width: 38,
              height: 38,
              flexShrink: 0,
              background: 'transparent',
              border: `1px solid ${corpColor.line}`,
              cursor: 'pointer',
              padding: 0,
            }}
          >
            <span style={{ position: 'relative', width: 16, height: 11, display: 'inline-block' }}>
              <span
                style={{
                  position: 'absolute', left: 0, right: 0, top: open ? 4.5 : 0, height: 1.6,
                  background: corpColor.ink, transition: 'all .2s', transform: open ? 'rotate(45deg)' : 'none',
                }}
              />
              <span
                style={{
                  position: 'absolute', left: 0, right: 0, top: 4.5, height: 1.6,
                  background: corpColor.ink, opacity: open ? 0 : 1, transition: 'all .2s',
                }}
              />
              <span
                style={{
                  position: 'absolute', left: 0, right: 0, top: open ? 4.5 : 9, height: 1.6,
                  background: corpColor.ink, transition: 'all .2s', transform: open ? 'rotate(-45deg)' : 'none',
                }}
              />
            </span>
          </button>
        </div>
      </header>

      <div
        role="dialog"
        aria-modal="true"
        onClick={() => setOpen(false)}
        style={{
          display: open ? 'flex' : 'none',
          position: 'fixed',
          inset: 0,
          top: 63,
          zIndex: 199,
          background: corpColor.ground,
          flexDirection: 'column',
        }}
      >
        <nav style={{ display: 'flex', flexDirection: 'column', padding: '8px 24px' }} onClick={(e) => e.stopPropagation()}>
          {NAV.map((item) => (
            <a
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              style={{
                padding: '17px 4px',
                fontSize: 17,
                fontFamily: corpFont.mincho,
                color: corpColor.ink,
                textDecoration: 'none',
                fontWeight: 600,
                borderBottom: `1px solid ${corpColor.line}`,
              }}
            >
              {item.label}
            </a>
          ))}
          <a
            href="/contact"
            onClick={() => setOpen(false)}
            style={{ padding: '17px 4px', fontSize: 17, fontFamily: corpFont.mincho, color: corpColor.moss, textDecoration: 'none', fontWeight: 600 }}
          >
            お問い合わせ
          </a>
        </nav>
      </div>
    </>
  );
}
