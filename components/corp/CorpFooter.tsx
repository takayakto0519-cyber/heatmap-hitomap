import { corpColor, corpFont } from './tokens';

export default function CorpFooter() {
  return (
    <footer
      style={{
        borderTop: `1px solid ${corpColor.line}`,
        padding: '32px 24px',
        background: corpColor.kinari,
        fontFamily: corpFont.body,
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
          <img src="/logo.png" alt="ヒトマップ" style={{ height: 20, width: 'auto', opacity: 0.8 }} />
          <span style={{ fontSize: 12, color: corpColor.sumiSoft }}>ヒトマップ</span>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
          <a href="/login" style={{ fontSize: 11, color: corpColor.sumiSoft, textDecoration: 'none' }}>ログイン</a>
          <a href="/terms" style={{ fontSize: 11, color: corpColor.sumiSoft, textDecoration: 'none' }}>利用規約</a>
          <a href="/privacy" style={{ fontSize: 11, color: corpColor.sumiSoft, textDecoration: 'none' }}>プライバシーポリシー</a>
        </div>

        <p style={{ margin: 0, fontSize: 11, color: corpColor.sumiSoft }}>
          © {new Date().getFullYear()} ヒトマップ（加藤貴也・小田太志）
        </p>
      </div>
    </footer>
  );
}
