import { corpColor, corpFont } from './tokens';

// 「思想」ページはまだ内容を作り込み中のため、ナビゲーションからは一旦外す。
// ページ自体は残しているので、準備ができ次第ここに追加する。
const NAV = [
  { href: '/service', label: 'ヒトマップ' },
  { href: '/business', label: '法人・行政' },
  { href: '/school', label: '学校' },
  { href: '/works', label: '実績' },
  { href: '/team', label: '運営' },
];

export default function CorpHeader() {
  return (
    <header
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 200,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 20,
        padding: '16px 24px',
        background: corpColor.ground,
        borderBottom: `1px solid ${corpColor.line}`,
        fontFamily: corpFont.body,
      }}
    >
      <a href="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none', flexShrink: 0 }}>
        <img src="/logo.png" alt="ヒトマップ" style={{ height: 26, width: 'auto' }} />
        <span style={{ fontSize: 15, fontWeight: 700, color: corpColor.ink, letterSpacing: '0.02em' }}>
          ヒトマップ
        </span>
      </a>

      <div style={{ display: 'flex', alignItems: 'center', gap: 20, minWidth: 0 }}>
        <nav
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '6px 4px',
            justifyContent: 'flex-end',
          }}
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

        <span style={{ width: 1, height: 22, background: corpColor.line, flexShrink: 0 }} />

        <a
          href="/login"
          style={{
            flexShrink: 0,
            display: 'inline-block',
            padding: '9px 18px',
            background: corpColor.ink,
            color: corpColor.white,
            textDecoration: 'none',
            fontWeight: 700,
            fontSize: 13,
            letterSpacing: '0.03em',
            whiteSpace: 'nowrap',
          }}
        >
          ログイン / 地図を開く
        </a>
      </div>
    </header>
  );
}
