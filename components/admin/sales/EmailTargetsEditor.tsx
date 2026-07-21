'use client';

// 🐢 営業メール送り先（sales_email_targets）の編集。
// もともと AIOpsTab にあったが、同じテーブルを営業タブの「📮 便り」セクションでも
// 編集できてしまい二重編集になっていた。表示（OutreachStatus）と編集を1箇所に揃えるため、
// 営業タブの便りセクション内の折りたたみへ移設した。中身の挙動は移設前と同じ。
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

// ---------- 営業メール送り先 ----------
interface EmailTarget { id: string; company: string; email: string | null; hook: string | null; drafted: boolean; sent: boolean; }

function EmailSection({ jsonHeaders, authHeaders }: Headers) {
  const [items, setItems] = useState<EmailTarget[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ company: '', email: '', hook: '' });

  async function load() {
    setLoading(true);
    const res = await fetch('/api/admin/sales-email-targets', { headers: authHeaders() });
    const data = await res.json();
    if (data.ok) setItems(data.targets ?? []); else setMessage(data.error ?? '読み込みに失敗しました');
    setLoading(false);
  }
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  async function create() {
    if (!form.company.trim()) { setMessage('会社名を入力してください'); return; }
    const res = await fetch('/api/admin/sales-email-targets', { method: 'POST', headers: jsonHeaders(), body: JSON.stringify(form) });
    const data = await res.json();
    if (data.ok) { setForm({ company: '', email: '', hook: '' }); setShowForm(false); await load(); }
    else setMessage(data.error ?? '保存に失敗しました');
  }
  async function patch(id: string, fields: Partial<EmailTarget>) {
    await fetch(`/api/admin/sales-email-targets/${id}`, { method: 'PATCH', headers: jsonHeaders(), body: JSON.stringify(fields) });
    await load();
  }
  async function remove(id: string) {
    if (!window.confirm('削除しますか？')) return;
    await fetch(`/api/admin/sales-email-targets/${id}`, { method: 'DELETE', headers: authHeaders() });
    await load();
  }

  const pending = items.filter((i) => !i.sent);
  const sent = items.filter((i) => i.sent);

  return (
    <div>
      <p style={{ fontSize: 12, color: '#999', margin: '0 0 10px' }}>送信はここからは行いません。下書き作成後、ご自身のメールソフトから送信し、「送信済み」にチェックしてください。</p>
      <button style={btnStyle} onClick={() => setShowForm((v) => !v)}>{showForm ? 'キャンセル' : '+ 送り先を追加'}</button>
      {message && <p style={{ fontSize: 13, color: '#E74C3C' }}>{message}</p>}
      {showForm && (
        <div style={cardStyle}>
          <label style={labelStyle}>会社名</label>
          <input style={inputStyle} value={form.company} onChange={(e) => setForm((f) => ({ ...f, company: e.target.value }))} />
          <label style={labelStyle}>メールアドレス（分かれば）</label>
          <input style={inputStyle} value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
          <label style={labelStyle}>フック（なぜ声をかけるか、一言）</label>
          <textarea style={{ ...inputStyle, resize: 'vertical' }} rows={2} value={form.hook} onChange={(e) => setForm((f) => ({ ...f, hook: e.target.value }))} />
          <div style={{ marginTop: 12 }}><button style={btnStyle} onClick={create}>保存する</button></div>
        </div>
      )}
      {loading ? <p style={{ fontSize: 13, color: '#999' }}>読み込み中…</p> : (
        <>
          <h2 style={{ fontSize: 14, fontWeight: 700, color: '#555', margin: '16px 0 10px' }}>未送信（{pending.length}）</h2>
          {pending.map((it) => (
            <div key={it.id} style={cardStyle}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <b style={{ fontSize: 14 }}>{it.company}</b>
                <button onClick={() => remove(it.id)} style={{ fontSize: 11, color: '#E74C3C', background: 'none', border: 'none', cursor: 'pointer' }}>削除</button>
              </div>
              <p style={{ fontSize: 12, color: '#777', margin: '4px 0' }}>{it.email || 'メール未記入'}</p>
              <p style={{ fontSize: 13, margin: '4px 0 8px' }}>{it.hook}</p>
              <div style={{ display: 'flex', gap: 8 }}>
                <div onClick={() => patch(it.id, { drafted: !it.drafted })} style={pillStyle(it.drafted)}>下書き済み</div>
                <div onClick={() => patch(it.id, { sent: true })} style={pillStyle(false)}>送信済みにする</div>
              </div>
            </div>
          ))}
          {sent.length > 0 && (
            <>
              <h2 style={{ fontSize: 14, fontWeight: 700, color: '#999', margin: '20px 0 10px' }}>送信済み（{sent.length}）</h2>
              {sent.map((it) => (
                <div key={it.id} style={{ ...cardStyle, opacity: 0.6, display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 13 }}>{it.company}</span>
                  <button onClick={() => patch(it.id, { sent: false })} style={{ fontSize: 11, background: 'none', border: '1px solid #999', borderRadius: 999, padding: '3px 10px', cursor: 'pointer' }}>戻す</button>
                </div>
              ))}
            </>
          )}
        </>
      )}
    </div>
  );
}

export default function EmailTargetsEditor({ authHeaders, onChanged }: { authHeaders: () => HeadersInit; onChanged?: () => void }) {
  const jsonHeaders = (): HeadersInit => ({ ...authHeaders(), 'Content-Type': 'application/json' });
  return (
    <div onBlur={() => onChanged?.()}>
      <EmailSection jsonHeaders={jsonHeaders} authHeaders={authHeaders} />
    </div>
  );
}
