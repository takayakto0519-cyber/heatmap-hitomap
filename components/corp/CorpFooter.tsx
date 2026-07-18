import { corpColor, corpFont } from './tokens';

// YAMAP／AllTrails式の多段カラムフッター。
// 個人・法人/行政・運営・規約の4系統に導線を整理し、サイトの全体像を最後に一望できるようにする。
const COLUMNS: { heading: string; links: { href: string; label: string }[] }[] = [
  {
    heading: 'サービス',
    links: [
      { href: '/start', label: '地図をひらく' },
      { href: '/company/service', label: '使い方' },
      { href: '/company/school', label: '学校でのご利用' },
    ],
  },
  {
    heading: '法人・行政',
    links: [
      { href: '/company/business', label: '法人・行政の方へ' },
      { href: '/company/works', label: '実績' },
      { href: '/company/contact', label: 'お問い合わせ' },
    ],
  },
  {
    heading: '運営',
    links: [
      { href: '/company/team', label: '運営メンバー' },
      { href: '/login', label: 'ログイン / 新規登録' },
    ],
  },
  {
    heading: '規約',
    links: [
      { href: '/terms', label: '利用規約' },
      { href: '/privacy', label: 'プライバシーポリシー' },
    ],
  },
];

export default function CorpFooter() {
  return (
    <footer
      style={{
        borderTop: `1px solid ${corpColor.lineSoft}`,
        background: corpColor.surfaceSoft,
        fontFamily: corpFont.body,
      }}
    >
      <div
        style={{
          maxWidth: 960,
          margin: '0 auto',
          padding: '48px 24px 28px',
          display: 'flex',
          flexWrap: 'wrap',
          gap: '32px 48px',
        }}
      >
        {COLUMNS.map(col => (
          <div key={col.heading} style={{ minWidth: 140 }}>
            <p
              style={{
                margin: '0 0 12px',
                fontSize: 11,
                letterSpacing: '0.15em',
                fontWeight: 700,
                color: corpColor.moss,
              }}
            >
              {col.heading}
            </p>
            <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 9 }}>
              {col.links.map(l => (
                <li key={l.href}>
                  <a href={l.href} className="hm-ul" style={{ fontSize: 12.5, color: corpColor.inkSoft }}>
                    {l.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div
        style={{
          borderTop: `1px solid ${corpColor.lineSoft}`,
          padding: '18px 24px',
        }}
      >
        <div
          style={{
            maxWidth: 960,
            margin: '0 auto',
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <img src="/logo.png" alt="ヒトマップ" style={{ height: 20, width: 'auto', opacity: 0.85 }} />
            <span style={{ fontSize: 12, color: corpColor.inkSoft }}>ヒトマップ</span>
          </div>
          <p style={{ margin: 0, fontSize: 11, color: corpColor.inkSoft }}>
            © {new Date().getFullYear()} ヒトマップ（加藤貴也・小田太志）
          </p>
        </div>
      </div>
    </footer>
  );
}
