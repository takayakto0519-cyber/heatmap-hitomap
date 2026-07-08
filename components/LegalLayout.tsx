interface Props {
  title: string;
  updatedAt: string;
  children: React.ReactNode;
}

export default function LegalLayout({ title, updatedAt, children }: Props) {
  return (
    <div style={{ minHeight: '100dvh', background: '#fafafa', padding: '24px 20px 60px' }}>
      <div style={{ maxWidth: 640, margin: '0 auto' }}>
        <a href="/" style={{ fontSize: 13, color: '#38ADA9', textDecoration: 'none', fontWeight: 700 }}>← ヒトマップに戻る</a>
        <h1 style={{ fontSize: 22, fontWeight: 800, margin: '16px 0 4px' }}>{title}</h1>
        <p style={{ fontSize: 12, color: '#aaa', margin: '0 0 24px' }}>最終更新日：{updatedAt}</p>
        <div style={{
          background: '#fff', border: '1px solid #eee', borderRadius: 14,
          padding: '24px 22px', fontSize: 14, lineHeight: 1.9, color: '#333',
        }}>
          {children}
        </div>
      </div>
    </div>
  );
}
