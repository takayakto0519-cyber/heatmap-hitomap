'use client';

// 🐇 LINE縁ミッション設定 — グループID・ミッション間隔・自動投稿のON/OFF・名簿。
// もともと AIOpsTab（AIエージェント運営）にあったが、CRUDではなく「設定」なのでサイト設定タブへ移設した。
// 中身の挙動は移設前と同じ。自動投稿はここでは行わない（設定を保存するだけ）。
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

type Headers = { jsonHeaders: () => HeadersInit; authHeaders: () => HeadersInit };

// ---------- LINE縁ミッション設定 ----------
interface LineMember { name: string; note: string; }
interface LineSettings { group_id: string; mission_interval_days: number; auto_push: boolean; auto_welcome: boolean; members: LineMember[]; }

function LineSection({ jsonHeaders, authHeaders }: Headers) {
  const [s, setS] = useState<LineSettings>({ group_id: '', mission_interval_days: 14, auto_push: false, auto_welcome: false, members: [] });
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  async function load() {
    setLoading(true);
    const res = await fetch('/api/admin/line-settings', { headers: authHeaders() });
    const data = await res.json();
    if (data.ok) setS({ ...data.settings, members: data.settings.members ?? [] }); else setMessage(data.error ?? '読み込みに失敗しました');
    setLoading(false);
  }
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  async function save() {
    const res = await fetch('/api/admin/line-settings', { method: 'PUT', headers: jsonHeaders(), body: JSON.stringify(s) });
    const data = await res.json();
    setMessage(data.ok ? '保存しました ✓' : (data.error ?? '保存に失敗しました'));
  }

  function addMember() { setS((v) => ({ ...v, members: [...v.members, { name: '', note: '' }] })); }
  function updateMember(i: number, field: 'name' | 'note', value: string) {
    setS((v) => ({ ...v, members: v.members.map((m, idx) => (idx === i ? { ...m, [field]: value } : m)) }));
  }
  function removeMember(i: number) { setS((v) => ({ ...v, members: v.members.filter((_, idx) => idx !== i) })); }

  if (loading) return <p style={{ fontSize: 13, color: '#999' }}>読み込み中…</p>;

  return (
    <div style={cardStyle}>
      <p style={{ fontSize: 12, color: '#999', margin: '0 0 10px' }}>
        botの実際の稼働にはLINE Developers Consoleでのトークン等の設定が別途必要です（agents/line_bot/README.md参照）。ここは名簿とミッション間隔の管理用。
      </p>
      {message && <p style={{ fontSize: 13, color: message.includes('✓') ? '#27AE60' : '#E74C3C' }}>{message}</p>}
      <label style={labelStyle}>グループID</label>
      <input style={inputStyle} value={s.group_id} onChange={(e) => setS((v) => ({ ...v, group_id: e.target.value }))} placeholder="LINE Developers Consoleで確認" />
      <label style={labelStyle}>ミッション間隔（日）</label>
      <input style={inputStyle} type="number" value={s.mission_interval_days} onChange={(e) => setS((v) => ({ ...v, mission_interval_days: Number(e.target.value) }))} />
      <label style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: 8 }}>
        <input type="checkbox" checked={s.auto_push} onChange={(e) => setS((v) => ({ ...v, auto_push: e.target.checked }))} />
        自動投稿を有効にする（オフ推奨：会長が送るまでは下書きのみ）
      </label>
      <label style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: 8 }}>
        <input type="checkbox" checked={s.auto_welcome} onChange={(e) => setS((v) => ({ ...v, auto_welcome: e.target.checked }))} />
        新規参加者への自動返信を有効にする
      </label>
      <label style={labelStyle}>名簿（縁ミッションの対象者）</label>
      {s.members.map((m, i) => (
        <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
          <input style={{ ...inputStyle, flex: '0 0 120px' }} value={m.name} onChange={(e) => updateMember(i, 'name', e.target.value)} placeholder="名前" />
          <input style={inputStyle} value={m.note} onChange={(e) => updateMember(i, 'note', e.target.value)} placeholder="メモ（活動地域・興味等）" />
          <button onClick={() => removeMember(i)} style={{ fontSize: 11, color: '#E74C3C', background: 'none', border: 'none', cursor: 'pointer', flexShrink: 0 }}>削除</button>
        </div>
      ))}
      <button onClick={addMember} style={{ fontSize: 12, color: '#38ADA9', background: 'none', border: '1px dashed #38ADA9', borderRadius: 8, padding: '6px 12px', cursor: 'pointer', marginTop: 4 }}>+ 名簿に追加</button>
      <div style={{ marginTop: 16 }}><button style={btnStyle} onClick={save}>保存する</button></div>
    </div>
  );
}



export default function LineSettingsSection({ authHeaders }: { authHeaders: () => HeadersInit }) {
  const jsonHeaders = (): HeadersInit => ({ ...authHeaders(), 'Content-Type': 'application/json' });
  return <LineSection jsonHeaders={jsonHeaders} authHeaders={authHeaders} />;
}
