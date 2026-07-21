'use client';

// 📋 作業状況（action_items）の追加・編集セクション。
//
// もともと AIOpsTab（AIエージェント運営タブ）の中にあり、秘書タブは一覧表示だけで
// 「To-Doの追加・詳細編集はAIエージェント運営タブから」と別タブへ誘導していた。
// 会長が今日やることを見ている画面でそのまま追加できないのは不便なので、秘書タブへ移設した。
// 中身の挙動は移設前と同じ（AIOpsTabからそのまま移動）。
import { useEffect, useState } from 'react';

const inputStyle: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box', padding: '9px 11px', borderRadius: 8,
  border: '1.5px solid #ddd', fontSize: 13, fontFamily: 'inherit',
};
const labelStyle: React.CSSProperties = { fontSize: 12, fontWeight: 700, color: '#555', margin: '12px 0 5px', display: 'block' };
const cardStyle: React.CSSProperties = { background: '#fff', borderRadius: 12, padding: 16, marginBottom: 10, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' };
const btnStyle: React.CSSProperties = { padding: '8px 16px', borderRadius: 8, border: 'none', background: '#38ADA9', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer' };
const pillStyle = (active: boolean): React.CSSProperties => ({
  padding: '6px 14px', borderRadius: 999, fontSize: 12, fontWeight: 700, cursor: 'pointer',
  border: active ? 'none' : '1px solid #ccc', background: active ? '#38ADA9' : 'transparent', color: active ? '#fff' : '#666',
});

interface ActionItem {
  id: string; title: string; category: string; status: string; owner: string;
  file_ref: string | null; notes: string | null; due_date: string | null; updated_at: string;
}
const ACTION_STATUSES = [
  { key: 'todo', label: '未着手', color: '#999' },
  { key: 'done', label: 'AI完了', color: '#27AE60' },
  { key: 'manual_required', label: '会長作業待ち', color: '#E67E22' },
  { key: 'blocked', label: '保留', color: '#999' },
] as const;
const statusMeta = (s: string) => ACTION_STATUSES.find((x) => x.key === s) ?? ACTION_STATUSES[0];

export default function ActionItemsSection({
  authHeaders, onChanged,
}: {
  authHeaders: () => HeadersInit;
  /** 追加・更新・削除のあと、呼び出し側（秘書タブの「今日やること」）にも取り直させる */
  onChanged?: () => void;
}) {
  const [items, setItems] = useState<ActionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [filter, setFilter] = useState<string>('all');
  const [form, setForm] = useState({ title: '', category: 'マキチャレ2026', owner: 'AI', file_ref: '', notes: '' });

  function jsonHeaders(): HeadersInit {
    return { ...authHeaders(), 'Content-Type': 'application/json' };
  }

  async function load() {
    setLoading(true);
    const res = await fetch('/api/admin/action-items', { headers: authHeaders() });
    const data = await res.json();
    if (data.ok) setItems(data.items ?? []); else setMessage(data.error ?? '読み込みに失敗しました');
    setLoading(false);
  }
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  async function reloadAll() {
    await load();
    onChanged?.();
  }

  async function create() {
    if (!form.title.trim()) { setMessage('タイトルを入力してください'); return; }
    const res = await fetch('/api/admin/action-items', { method: 'POST', headers: jsonHeaders(), body: JSON.stringify(form) });
    const data = await res.json();
    if (data.ok) { setForm({ title: '', category: form.category, owner: 'AI', file_ref: '', notes: '' }); setShowForm(false); await reloadAll(); }
    else setMessage(data.error ?? '保存に失敗しました');
  }
  async function patch(id: string, fields: Partial<ActionItem>) {
    await fetch(`/api/admin/action-items/${id}`, { method: 'PATCH', headers: jsonHeaders(), body: JSON.stringify(fields) });
    await reloadAll();
  }
  async function remove(id: string) {
    if (!window.confirm('削除しますか？')) return;
    await fetch(`/api/admin/action-items/${id}`, { method: 'DELETE', headers: authHeaders() });
    await reloadAll();
  }

  const categories = ['all', ...Array.from(new Set(items.map((i) => i.category)))];
  const visible = filter === 'all' ? items : items.filter((i) => i.category === filter);
  const counts = ACTION_STATUSES.map((s) => ({ ...s, n: items.filter((i) => i.status === s.key).length }));

  return (
    <div>
      <p style={{ fontSize: 12, color: '#999', margin: '0 0 10px' }}>
        各案件の「次のアクション」を横断で見える化する場所。AIが完了した作業と、会長の手が必要な作業を色分けしています。
      </p>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', margin: '0 0 14px' }}>
        {counts.map((c) => (
          <div key={c.key} style={{ fontSize: 12, fontWeight: 700, color: c.color }}>{c.label} {c.n}</div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
        {categories.map((c) => (
          <div key={c} onClick={() => setFilter(c)} style={pillStyle(filter === c)}>{c === 'all' ? 'すべて' : c}</div>
        ))}
      </div>
      <button style={btnStyle} onClick={() => setShowForm((v) => !v)}>{showForm ? 'キャンセル' : '+ 作業項目を追加'}</button>
      {message && <p style={{ fontSize: 13, color: '#E74C3C' }}>{message}</p>}
      {showForm && (
        <div style={cardStyle}>
          <label style={labelStyle}>タイトル</label>
          <input style={inputStyle} value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="例：市担当課への事前相談アポ打診" />
          <label style={labelStyle}>カテゴリ</label>
          <input style={inputStyle} value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))} placeholder="例：マキチャレ2026 / B-1牧之原市" />
          <label style={labelStyle}>担当</label>
          <select style={inputStyle} value={form.owner} onChange={(e) => setForm((f) => ({ ...f, owner: e.target.value }))}>
            <option value="AI">AI</option>
            <option value="会長">会長</option>
            <option value="会長+小田">会長+小田</option>
          </select>
          <label style={labelStyle}>関連ファイル（任意）</label>
          <input style={inputStyle} value={form.file_ref} onChange={(e) => setForm((f) => ({ ...f, file_ref: e.target.value }))} placeholder="例：06_実行待機_Approval/提案書_牧之原市_20260719.md" />
          <label style={labelStyle}>メモ（任意）</label>
          <textarea style={{ ...inputStyle, resize: 'vertical' }} rows={2} value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
          <div style={{ marginTop: 12 }}><button style={btnStyle} onClick={create}>保存する</button></div>
        </div>
      )}
      {loading ? <p style={{ fontSize: 13, color: '#999' }}>読み込み中…</p> : visible.length === 0 ? <p style={{ fontSize: 13, color: '#999' }}>作業項目がありません</p> : visible.map((it) => {
        const meta = statusMeta(it.status);
        return (
          <div key={it.id} style={cardStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
              <div style={{ minWidth: 0 }}>
                <span style={{ fontSize: 11, color: '#999', marginRight: 6 }}>[{it.category}]</span>
                <b style={{ fontSize: 14 }}>{it.title}</b>
              </div>
              <button onClick={() => remove(it.id)} style={{ fontSize: 11, color: '#E74C3C', background: 'none', border: 'none', cursor: 'pointer', flexShrink: 0 }}>削除</button>
            </div>
            <div style={{ display: 'flex', gap: 6, margin: '8px 0', flexWrap: 'wrap', alignItems: 'center' }}>
              {ACTION_STATUSES.map((s) => (
                <div key={s.key} onClick={() => patch(it.id, { status: s.key })} style={{
                  ...pillStyle(it.status === s.key),
                  ...(it.status === s.key ? { background: s.color } : {}),
                }}>{s.label}</div>
              ))}
              <span style={{ fontSize: 11, color: '#999', marginLeft: 4 }}>担当：{it.owner}</span>
            </div>
            {it.file_ref && <p style={{ fontSize: 12, color: '#38ADA9', fontFamily: 'monospace', margin: '4px 0' }}>{it.file_ref}</p>}
            {it.notes && <p style={{ fontSize: 13, color: '#555', margin: '4px 0' }}>{it.notes}</p>}
          </div>
        );
      })}
    </div>
  );
}
