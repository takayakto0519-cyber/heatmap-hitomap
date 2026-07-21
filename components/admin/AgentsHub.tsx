'use client';

// 🤖 AIエージェント（統合ハブ）— これまで別々だった「AIエージェント運営（データ入力）」と
// 「稼働状況（番人＋スキル名簿）」を1タブに統合し、上部ピルで切り替える。
// ナビの重複を減らし、エージェント関連を1箇所に集約する。
import { useState } from 'react';
import AgentStatusTab from '@/components/admin/AgentStatusTab';
import AIOpsTab from '@/components/admin/AIOpsTab';

const VIEWS = [
  { key: 'status', label: '🏢 稼働状況・名簿' },
  { key: 'ops', label: '📇 運営データ' },
] as const;
type View = typeof VIEWS[number]['key'];

const pillStyle = (active: boolean): React.CSSProperties => ({
  padding: '7px 16px', borderRadius: 16, border: 'none', cursor: 'pointer', fontSize: 12.5, fontWeight: 700,
  background: active ? '#38ADA9' : '#fff', color: active ? '#fff' : '#666',
  boxShadow: active ? 'none' : '0 1px 3px rgba(0,0,0,0.08)',
});

export default function AgentsHub({ authHeaders, initialView }: { authHeaders: () => HeadersInit; initialView?: View }) {
  const [view, setView] = useState<View>(initialView ?? 'status');
  return (
    <div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
        {VIEWS.map(v => (
          <button key={v.key} onClick={() => setView(v.key)} style={pillStyle(view === v.key)}>{v.label}</button>
        ))}
      </div>
      {view === 'status' && <AgentStatusTab authHeaders={authHeaders} />}
      {view === 'ops' && <AIOpsTab authHeaders={authHeaders} />}
    </div>
  );
}
