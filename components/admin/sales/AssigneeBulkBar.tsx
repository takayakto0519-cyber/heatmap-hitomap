'use client';

// 選択中の営業先をまとめて1人の担当者に割り当てるバー。チェックボックス選択と
// 「上位N件を選択」ヘルパー（親のSalesListViewが持つ）とセットで使う。
import { useState } from 'react';

export interface TeamMemberLite { id: string; name: string; is_active: boolean }

export default function AssigneeBulkBar({
  selectedCount, teamMembers, onApply, onClear,
}: {
  selectedCount: number;
  teamMembers: TeamMemberLite[];
  onApply: (assignedTo: string | null) => Promise<void>;
  onClear: () => void;
}) {
  const [assignee, setAssignee] = useState('');
  const [busy, setBusy] = useState(false);
  if (selectedCount === 0) return null;

  return (
    <div style={{
      position: 'sticky', top: 0, zIndex: 5, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
      padding: '10px 14px', borderRadius: 10, background: '#1F2A2A', color: '#fff', marginBottom: 12,
    }}>
      <span style={{ fontSize: 12.5, fontWeight: 700 }}>選択中 {selectedCount}件</span>
      <select value={assignee} onChange={e => setAssignee(e.target.value)} style={{
        padding: '6px 10px', borderRadius: 8, border: 'none', fontSize: 12.5,
      }}>
        <option value="">担当者を選ぶ</option>
        {teamMembers.filter(m => m.is_active).map(m => (
          <option key={m.id} value={m.name}>{m.name}</option>
        ))}
        <option value="__unassign__">未割当に戻す</option>
      </select>
      <button
        disabled={!assignee || busy}
        onClick={async () => {
          setBusy(true);
          try { await onApply(assignee === '__unassign__' ? null : assignee); } finally { setBusy(false); }
        }}
        style={{
          padding: '6px 14px', borderRadius: 8, border: 'none', fontWeight: 700, fontSize: 12.5,
          background: !assignee || busy ? '#666' : '#38ADA9', color: '#fff',
          cursor: !assignee || busy ? 'default' : 'pointer',
        }}
      >{busy ? '割り当て中…' : '一括で割り当てる'}</button>
      <button onClick={onClear} style={{
        padding: '6px 12px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.4)', background: 'none',
        color: '#fff', fontSize: 12, cursor: 'pointer', marginLeft: 'auto',
      }}>選択解除</button>
    </div>
  );
}
