export default function SiteHeader() {
  return (
    <header style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '14px 20px', background: '#fff', borderBottom: '1px solid #f0f0f0',
    }}>
      <a href="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
        <img src="/logo.png" alt="ヒトマップ" style={{ height: 32, width: 'auto' }} />
        <span style={{ fontSize: 15, fontWeight: 800, color: '#222' }}>ヒトマップ</span>
      </a>
    </header>
  );
}
