'use client';

// 🤝 顧問先カルテ（client_dossiers）— 契約プラン・月額・次回面談などの台帳。
// もともと AIOpsTab にあったが、顧問先は営業の続きなので営業タブへ移設した。
// 中身の挙動は移設前と同じ。
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

// AIOpsTab から移設した際に props の受け口をそのまま持ち込んでいる。
// authHeaders だけ受け取り、JSON用ヘッダは内部で組み立てる。
type Headers = { jsonHeaders: () => HeadersInit; authHeaders: () => HeadersInit };

// ---------- 顧問先カルテ ----------
interface ClientDossier {
  id: string; org_name: string; plan: string | null; monthly_fee: number | null;
  contact_name: string | null; start_date: string | null; next_meeting: string | null; notes: string | null;
}

function DossiersSection({ jsonHeaders, authHeaders }: Headers) {
  const [items, setItems] = useState<ClientDossier[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ org_name: '', plan: '', monthly_fee: '', contact_name: '', start_date: '', next_meeting: '' });

  async function load() {
    setLoading(true);
    const res = await fetch('/api/admin/client-dossiers', { headers: authHeaders() });
    const data = await res.json();
    if (data.ok) setItems(data.dossiers ?? []); else setMessage(data.error ?? '読み込みに失敗しました');
    setLoading(false);
  }
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  async function create() {
    if (!form.org_name.trim()) { setMessage('組織名を入力してください'); return; }
    const res = await fetch('/api/admin/client-dossiers', {
      method: 'POST', headers: jsonHeaders(),
      body: JSON.stringify({
        org_name: form.org_name, plan: form.plan, monthly_fee: form.monthly_fee ? Number(form.monthly_fee) : null,
        contact_name: form.contact_name || null, start_date: form.start_date || null, next_meeting: form.next_meeting || null,
      }),
    });
    const data = await res.json();
    if (data.ok) { setForm({ org_name: '', plan: '', monthly_fee: '', contact_name: '', start_date: '', next_meeting: '' }); setShowForm(false); await load(); }
    else setMessage(data.error ?? '保存に失敗しました');
  }
  async function patch(id: string, fields: Partial<ClientDossier>) {
    await fetch(`/api/admin/client-dossiers/${id}`, { method: 'PATCH', headers: jsonHeaders(), body: JSON.stringify(fields) });
    await load();
  }
  async function remove(id: string) {
    if (!window.confirm('削除しますか？')) return;
    await fetch(`/api/admin/client-dossiers/${id}`, { method: 'DELETE', headers: authHeaders() });
    await load();
  }

  return (
    <div>
      <button style={btnStyle} onClick={() => setShowForm((v) => !v)}>{showForm ? 'キャンセル' : '+ 新しい顧問先'}</button>
      {message && <p style={{ fontSize: 13, color: '#E74C3C' }}>{message}</p>}
      {showForm && (
        <div style={cardStyle}>
          <label style={labelStyle}>組織名</label>
          <input style={inputStyle} value={form.org_name} onChange={(e) => setForm((f) => ({ ...f, org_name: e.target.value }))} />
          <label style={labelStyle}>契約プラン</label>
          <input style={inputStyle} value={form.plan} onChange={(e) => setForm((f) => ({ ...f, plan: e.target.value }))} placeholder="例：AI導入・活用 顧問プラン" />
          <label style={labelStyle}>月額（円）</label>
          <input style={inputStyle} type="number" value={form.monthly_fee} onChange={(e) => setForm((f) => ({ ...f, monthly_fee: e.target.value }))} />
          <label style={labelStyle}>担当者名</label>
          <input style={inputStyle} value={form.contact_name} onChange={(e) => setForm((f) => ({ ...f, contact_name: e.target.value }))} />
          <label style={labelStyle}>契約開始日</label>
          <input style={inputStyle} type="date" value={form.start_date} onChange={(e) => setForm((f) => ({ ...f, start_date: e.target.value }))} />
          <label style={labelStyle}>次回打合せ日</label>
          <input style={inputStyle} type="date" value={form.next_meeting} onChange={(e) => setForm((f) => ({ ...f, next_meeting: e.target.value }))} />
          <div style={{ marginTop: 12 }}><button style={btnStyle} onClick={create}>保存する</button></div>
        </div>
      )}
      {loading ? <p style={{ fontSize: 13, color: '#999' }}>読み込み中…</p> : items.length === 0 ? <p style={{ fontSize: 13, color: '#999' }}>まだ顧問先がありません</p> : items.map((it) => (
        <div key={it.id} style={cardStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <b style={{ fontSize: 14 }}>{it.org_name}{it.plan ? `（${it.plan}）` : ''}{it.monthly_fee ? ` — 月${it.monthly_fee.toLocaleString()}円` : ''}</b>
            <button onClick={() => remove(it.id)} style={{ fontSize: 11, color: '#E74C3C', background: 'none', border: 'none', cursor: 'pointer' }}>削除</button>
          </div>
          <div style={{ display: 'flex', gap: 8, margin: '8px 0' }}>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>担当者名</label>
              <input defaultValue={it.contact_name ?? ''} style={inputStyle}
                onBlur={(e) => { if (e.target.value !== (it.contact_name ?? '')) patch(it.id, { contact_name: e.target.value || null }); }} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>契約開始日</label>
              <input defaultValue={it.start_date ?? ''} type="date" style={inputStyle}
                onBlur={(e) => { if (e.target.value !== (it.start_date ?? '')) patch(it.id, { start_date: e.target.value || null }); }} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>次回打合せ日</label>
              <input defaultValue={it.next_meeting ?? ''} type="date" style={inputStyle}
                onBlur={(e) => { if (e.target.value !== (it.next_meeting ?? '')) patch(it.id, { next_meeting: e.target.value || null }); }} />
            </div>
          </div>
          <label style={labelStyle}>業務の地図・AI活用ルール・気づき（自由記述）</label>
          <textarea defaultValue={it.notes ?? ''} rows={4} style={{ ...inputStyle, resize: 'vertical' }}
            onBlur={(e) => { if (e.target.value !== (it.notes ?? '')) patch(it.id, { notes: e.target.value }); }} />
        </div>
      ))}
    </div>
  );
}

export default function DossiersSectionWrapper({ authHeaders }: { authHeaders: () => HeadersInit }) {
  const jsonHeaders = (): HeadersInit => ({ ...authHeaders(), 'Content-Type': 'application/json' });
  return <DossiersSection jsonHeaders={jsonHeaders} authHeaders={authHeaders} />;
}
