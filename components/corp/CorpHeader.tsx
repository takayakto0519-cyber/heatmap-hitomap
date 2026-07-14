import { corpColor, corpFont } from './tokens';

const NAV = [
  { href: '/company/philosophy', label: '思想' },
  { href: '/company/service', label: 'ヒトマップ' },
  { href: '/company/business', label: '法人・行政' },
  { href: '/company/school', label: '学校' },
  { href: '/company/works', label: '実績' },
  { href: '/company/team', label: '運営' },
  { href: '/company/contact', label: 'お問い合わせ' },
];

export default function CorpHeader() {
  return (
    <header
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 16,
        padding: '18px 24px',
        background: corpColor.kinari,
        borderBottom: `1px solid ${corpColor.line}`,
        fontFamily: corpFont.body,
      }}
    >
      <a href="/company" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none', flexShrink: 0 }}>
        <img src="/logo.png" alt="ヒトマップ" style={{ height: 28, width: 'auto' }} />
        <span style={{ fontSize: 15, fontWeight: 700, color: corpColor.sumi, letterSpacing: '0.02em' }}>
          ヒトマップ
        </span>
      </a>

      <nav
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '4px 18px',
          justifyContent: 'flex-end',
        }}
      >
        {NAV.map((item) => (
          <a
            key={item.href}
            href={item.href}
            style={{
              fontSize: 13,
              color: corpColor.sumiSoft,
              textDecoration: 'none',
              fontWeight: 600,
              whiteSpace: 'nowrap',
            }}
          >
            {item.label}
          </a>
        ))}
      </nav>
    </header>
  );
}
