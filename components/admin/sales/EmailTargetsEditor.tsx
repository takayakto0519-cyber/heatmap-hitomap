'use client';

// 🐢 営業メール送り先（client_leads）の編集。
// 2026-07-23：sales_email_targetsはclient_leadsへ統合した（同一組織が両テーブルに重複登録され、
// メール下書きが片方にしか無くなる事故が起きていたため）。UI・呼び名（会社名・便り）はそのまま、
// 内部の保存先だけclient_leadsに一本化する。
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

// ---------- 営業メール送り先（client_leads、client_type='business'） ----------
interface EmailTarget { id: string; company: string; email: string | null; hook: string | null; drafted: boolean; sent: boolean; }
interface ClientLeadRow { id: string; org_name: string; email: string | null; hook: string | null; drafted: boolean | null; sent: boolean | null; client_type: string; }

function toEmailTarget(l: ClientLeadRow): EmailTarget {
  return { id: l.id, company: l.org_name, email: l.email, hook: l.hook, drafted: Boolean(l.drafted), sent: Boolean(l.sent) };
}

function EmailSection({ jsonHeaders, authHeaders }: Headers) {
  const [items, setItems] = useState<EmailTarget[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ company: '', email: '', hook: '' });

  async function load() {
    setLoading(true);
    const res = await fetch('/api/admin/client-leads', { headers: authHeaders() });
    const data = await res.json();
    // 「便り」＝フックだけで軽く声をかける先。学校・法人台帳の中でも hook が入っている行だけをここに出す。
    if (data.ok) setItems((data.leads ?? []).filter((l: ClientLeadRow) => l.hook).map(toEmailTarget));
    else setMessage(data.error ?? '読み込みに失敗しました');
    setLoading(false);
  }
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  async function create() {
    if (!form.company.trim()) { setMessage('会社名を入力してください'); return; }
    const res = await fetch('/api/admin/client-leads', {
      method: 'POST', headers: jsonHeaders(),
      body: JSON.stringify({ org_name: form.company, email: form.email || null, hook: form.hook || null, client_type: 'business' }),
    });
    const data = await res.json();
    if (!data.ok) { setMessage(data.error ?? '保存に失敗しました'); return; }
    setForm({ company: '', email: '', hook: '' }); setShowForm(false); await load();
  }
  async function patch(id: string, fields: Partial<EmailTarget>) {
    await fetch(`/api/admin/client-leads/${id}`, { method: 'PATCH', headers: jsonHeaders(), body: JSON.stringify(fields) });
    await load();
  }
  async function remove(id: string) {
    if (!window.confirm('削除しますか？')) return;
    await fetch(`/api/admin/client-leads/${id}`, { method: 'DELETE', headers: authHeaders() });
    await load();
  }

  const pending = items.filter((i) => !i.sent);
  const sent = items.filter((i) => i.sent);

  return (
    <div>
      <p style={{ fontSize: 12, color: '#999', margin: '0 0 10px' }}>ここでは送り先の追加・下書き済みチェックのみ行います。実際の送信は「📤 送信キュー」タブで、宛先・事実確認を済ませたうえで行ってください。</p>
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
