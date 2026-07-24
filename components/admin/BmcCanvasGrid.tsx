'use client';

// ビジネスモデルキャンバスを、Osterwalder原典の5列×3行レイアウトで一覧表示する読み取り専用の図。
// 編集は各ブロックのセクションカード（IdeaReportEditor）側で行う——この図は俯瞰用。
import { parseBmcBlocks, BMC_GRID_AREAS, BMC_GRID_TEMPLATE_AREAS } from '@/lib/bmcCanvas';
import { ADMIN_COLORS } from '@/components/admin/adminShared';

export default function BmcCanvasGrid({ reportMd }: { reportMd: string | null | undefined }) {
  const blocks = parseBmcBlocks(reportMd);
  return (
    <div style={{ overflowX: 'auto' }}>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(5, minmax(110px, 1fr))',
        gridTemplateRows: 'minmax(84px, auto) minmax(84px, auto) minmax(56px, auto)',
        gridTemplateAreas: BMC_GRID_TEMPLATE_AREAS,
        gap: 1, background: '#e2e2e2', border: '1px solid #e2e2e2', borderRadius: 10,
        overflow: 'hidden', minWidth: 560,
      }}>
        {blocks.map(b => (
          <div key={b.key} style={{
            gridArea: BMC_GRID_AREAS[b.key], background: '#fff', padding: '7px 9px',
            display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0,
          }}>
            <span style={{ fontWeight: 800, color: ADMIN_COLORS.blue, fontSize: 10 }}>{b.label}</span>
            <span style={{
              color: b.body ? '#333' : '#bbb', fontSize: 11, lineHeight: 1.5,
              whiteSpace: 'pre-wrap', overflowWrap: 'break-word',
            }}>{b.body || b.hint}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
