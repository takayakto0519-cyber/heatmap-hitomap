'use client';

// URLらしき行だけを別タブで開けるリンクにする（複数行・複数URL対応）。
// 元はRelationPopulationTab.tsx内にあった部品を、統合カードの両kind（学校・法人／自治体）で
// 共有できるよう独立ファイルに切り出した。
export default function LinkList({ text }: { text: string }) {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  if (lines.length === 0) return null;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      {lines.map((line, i) => {
        const isUrl = /^https?:\/\//.test(line);
        return isUrl ? (
          <a key={i} href={line} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11.5, color: '#38ADA9', wordBreak: 'break-all' }}>
            🔗 {line}
          </a>
        ) : (
          <span key={i} style={{ fontSize: 11.5, color: '#888' }}>{line}</span>
        );
      })}
    </div>
  );
}
