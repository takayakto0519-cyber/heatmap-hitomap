'use client';

// イベント計画：企画中イベントのメモ。page.tsx monolith分割で切り出し。
import { useCallback, useEffect, useState } from 'react';
import { Card, inputStyle } from '@/components/admin/adminShared';

export interface EventPlan {
  id: string;
  title: string;
  memo: string | null;
  status: string;
  event_date: string | null;
  created_at: string;
  updated_at: string;
}

export const EVENT_STATUS_LABELS: Record<string, { label: string; color: string }> = {
  idea: { label: '💡 アイデア', color: '#8E44AD' },
  planning: { label: '📝 検討中', color: '#F6B93B' },
  confirmed: { label: '✅ 確定', color: '#38ADA9' },
  done: { label: '🏁 完了', color: '#aaa' },
};

export default function EventPlansTab({ authHeaders }: { authHeaders: () => HeadersInit }) {
  const [plans, setPlans] = useState<EventPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDate, setNewDate] = useState('');
  const [saving, setSaving] = useState(false);
  const [editingMemo, setEditingMemo] = useState<Record<string, string>>({});

  const load = useCallback(() => {
    setLoading(true);
    fetch('/api/admin/event-plans', { headers: authHeaders() })
      .then(r => r.json())
      .then(d => {
        if (d.ok) {
          setPlans(d.plans);
          const memoMap: Record<string, string> = {};
          for (const p of d.plans as EventPlan[]) memoMap[p.id] = p.memo ?? '';
          setEditingMemo(memoMap);
        } else setError(d.error ?? '取得に失敗しました');
      })
      .catch(() => setError('通信エラー'))
      .finally(() => setLoading(false));
  }, [authHeaders]);

  useEffect(() => { load(); }, [load]);

  async function createPlan() {
    if (!newTitle.trim()) return;
    setSaving(true);
    try {
      const res = await fetch('/api/admin/event-plans', {
        method: 'POST', headers: authHeaders(),
        body: JSON.stringify({ title: newTitle.trim(), event_date: newDate || null }),
      });
      const data = await res.json();
      if (data.ok) { setNewTitle(''); setNewDate(''); setShowCreate(false); load(); }
      else setError(data.error ?? '作成に失敗しました');
    } finally {
      setSaving(false);
    }
  }

  async function updatePlan(id: string, fields: Record<string, unknown>) {
    const res = await fetch(`/api/admin/event-plans/${id}`, {
      method: 'PATCH', headers: authHeaders(), body: JSON.stringify(fields),
    });
    const data = await res.json();
    if (data.ok) load(); else setError(data.error ?? '更新に失敗しました');
  }

  async function deletePlan(id: string) {
    if (!confirm('このイベント計画を削除しますか？')) return;
    const res = await fetch(`/api/admin/event-plans/${id}`, { method: 'DELETE', headers: authHeaders() });
    const data = await res.json();
    if (data.ok) load(); else setError(data.error ?? '削除に失敗しました');
  }

  if (loading) return <p style={{ color: '#999' }}>読み込み中…</p>;

  return (
    <div>
      <p style={{ fontSize: 12, color: '#999', margin: '0 0 12px' }}>
        今後どんなイベントをやるか、協力者とここでメモを練っていくための計画表です。
      </p>
      {error && <p style={{ color: '#E74C3C', fontSize: 13 }}>{error}</p>}

      {showCreate ? (
        <Card style={{ marginBottom: 14 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <input placeholder="イベント名（例：山手線一周・痕跡リレー）" value={newTitle}
              onChange={e => setNewTitle(e.target.value)} style={inputStyle} />
            <input type="date" value={newDate} onChange={e => setNewDate(e.target.value)} style={inputStyle} />
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={createPlan} disabled={saving || !newTitle.trim()} style={{
                flex: 1, padding: '9px 0', borderRadius: 8, border: 'none',
                background: '#38ADA9', color: '#fff', fontWeight: 700, cursor: 'pointer',
              }}>{saving ? '作成中…' : '追加する'}</button>
              <button onClick={() => setShowCreate(false)} style={{
                flex: 1, padding: '9px 0', borderRadius: 8, border: '1px solid #ddd',
                background: '#fff', color: '#888', cursor: 'pointer',
              }}>キャンセル</button>
            </div>
          </div>
        </Card>
      ) : (
        <button onClick={() => setShowCreate(true)} style={{
          display: 'block', width: '100%', padding: '10px 0', borderRadius: 10, border: '1.5px dashed #38ADA9',
          background: '#fff', color: '#38ADA9', fontWeight: 700, fontSize: 13, cursor: 'pointer', marginBottom: 14,
        }}>＋ 新しいイベント案を追加</button>
      )}

      {plans.length === 0 && <p style={{ color: '#aaa' }}>まだイベント案がありません。</p>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {plans.map(p => {
          const statusInfo = EVENT_STATUS_LABELS[p.status] ?? EVENT_STATUS_LABELS.idea;
          return (
            <Card key={p.id}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                <div>
                  <p style={{ margin: '0 0 4px', fontWeight: 800, fontSize: 15 }}>
                    {p.title}
                    <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 700, color: statusInfo.color }}>{statusInfo.label}</span>
                  </p>
                  {p.event_date && <p style={{ margin: 0, fontSize: 12, color: '#999' }}>📅 {p.event_date}</p>}
                </div>
                <button onClick={() => deletePlan(p.id)} style={{
                  padding: '4px 8px', borderRadius: 8, border: 'none', background: 'none', color: '#ccc', fontSize: 12, cursor: 'pointer',
                }}>削除</button>
              </div>

              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', margin: '8px 0' }}>
                {Object.entries(EVENT_STATUS_LABELS).map(([key, info]) => (
                  <button key={key} onClick={() => updatePlan(p.id, { status: key })} style={{
                    padding: '4px 10px', borderRadius: 16, fontSize: 11, cursor: 'pointer',
                    border: `1.5px solid ${p.status === key ? info.color : '#ddd'}`,
                    background: p.status === key ? info.color + '18' : '#fff',
                    color: p.status === key ? info.color : '#999', fontWeight: p.status === key ? 700 : 400,
                  }}>{info.label}</button>
                ))}
              </div>

              <textarea
                value={editingMemo[p.id] ?? ''}
                onChange={e => setEditingMemo(prev => ({ ...prev, [p.id]: e.target.value }))}
                onBlur={() => { if ((editingMemo[p.id] ?? '') !== (p.memo ?? '')) updatePlan(p.id, { memo: editingMemo[p.id] || null }); }}
                placeholder="協力者と練っているメモ（会場案・企画内容・TODOなど自由に）"
                rows={4}
                style={{ ...inputStyle, width: '100%', boxSizing: 'border-box', resize: 'vertical', fontFamily: 'inherit' }}
              />
              <p style={{ margin: '4px 0 0', fontSize: 10, color: '#ccc' }}>
                最終更新: {new Date(p.updated_at).toLocaleString('ja-JP')}（欄外をタップすると自動保存されます）
              </p>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
