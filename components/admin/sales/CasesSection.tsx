'use client';

// 📇 案件パイプライン（business_cases）— 発案からフォローまでのステージ管理。
// もともと AIOpsTab（AIエージェント運営タブ）にあったが、案件は営業の実体なので営業タブへ移設した。
// 営業タブ側でも同じテーブルを読んでおり、読む場所と書く場所が分かれていたのを1箇所に揃える。
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

// ---------- 案件パイプライン ----------
interface BusinessCase {
  id: string; org_name: string; client_type: string; stage: string;
  evidence: string | null; proposal_link: string | null; next_action: string | null; lead_ref: string | null;
}
interface LeadOption { id: string; org_name: string; }
const CASE_STAGES = ['発案', 'リード', '提案', '承認待ち', '送信済み', '受注', '見送り', '制作', '納品', '請求', 'フォロー'];

function CasesSection({ jsonHeaders, authHeaders }: Headers) {
  const [items, setItems] = useState<BusinessCase[]>([]);
  const [leads, setLeads] = useState<LeadOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ org_name: '', client_type: 'business', stage: '発案', evidence: '', proposal_link: '', lead_ref: '' });

  async function load() {
    setLoading(true);
    const res = await fetch('/api/admin/business-cases', { headers: authHeaders() });
    const data = await res.json();
    if (data.ok) setItems(data.cases ?? []); else setMessage(data.error ?? '読み込みに失敗しました');
    setLoading(false);
  }
  useEffect(() => {
    load();
    fetch('/api/admin/client-leads', { headers: authHeaders() })
      .then((r) => r.json())
      .then((d) => { if (d.ok) setLeads((d.leads ?? []).map((l: { id: string; org_name: string }) => ({ id: l.id, org_name: l.org_name }))); })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function create() {
    if (!form.org_name.trim()) { setMessage('組織名を入力してください'); return; }
    const res = await fetch('/api/admin/business-cases', {
      method: 'POST', headers: jsonHeaders(),
      body: JSON.stringify({ ...form, lead_ref: form.lead_ref || null }),
    });
    const data = await res.json();
    if (data.ok) { setForm({ org_name: '', client_type: 'business', stage: '発案', evidence: '', proposal_link: '', lead_ref: '' }); setShowForm(false); await load(); }
    else setMessage(data.error ?? '保存に失敗しました');
  }
  async function patch(id: string, fields: Partial<BusinessCase>) {
    await fetch(`/api/admin/business-cases/${id}`, { method: 'PATCH', headers: jsonHeaders(), body: JSON.stringify(fields) });
    await load();
  }
  async function remove(id: string) {
    if (!window.confirm('削除しますか？')) return;
    await fetch(`/api/admin/business-cases/${id}`, { method: 'DELETE', headers: authHeaders() });
    await load();
  }

  return (
    <div>
      <button style={btnStyle} onClick={() => setShowForm((v) => !v)}>{showForm ? 'キャンセル' : '+ 新しい案件'}</button>
      {message && <p style={{ fontSize: 13, color: '#E74C3C' }}>{message}</p>}
      {showForm && (
        <div style={cardStyle}>
          <label style={labelStyle}>組織名</label>
          <input style={inputStyle} value={form.org_name} onChange={(e) => setForm((f) => ({ ...f, org_name: e.target.value }))} placeholder="例：佐野市（栃木県）" />
          <label style={labelStyle}>種別</label>
          <select style={inputStyle} value={form.client_type} onChange={(e) => setForm((f) => ({ ...f, client_type: e.target.value }))}>
            <option value="business">法人</option><option value="school">学校</option><option value="government">自治体</option>
          </select>
          <label style={labelStyle}>リード（縁のデータベース）と紐付け（任意）</label>
          <select style={inputStyle} value={form.lead_ref} onChange={(e) => setForm((f) => ({ ...f, lead_ref: e.target.value }))}>
            <option value="">（紐付けなし）</option>
            {leads.map((l) => <option key={l.id} value={l.id}>{l.org_name}</option>)}
          </select>
          <label style={labelStyle}>証拠パック</label>
          <textarea style={{ ...inputStyle, resize: 'vertical' }} rows={2} value={form.evidence} onChange={(e) => setForm((f) => ({ ...f, evidence: e.target.value }))} placeholder="なぜこの相手に声をかけるか、痕跡・根拠" />
          <label style={labelStyle}>提案書リンク</label>
          <input style={inputStyle} value={form.proposal_link} onChange={(e) => setForm((f) => ({ ...f, proposal_link: e.target.value }))} placeholder="Google Docs等のURL" />
          <div style={{ marginTop: 12 }}><button style={btnStyle} onClick={create}>保存する</button></div>
        </div>
      )}
      {loading ? <p style={{ fontSize: 13, color: '#999' }}>読み込み中…</p> : items.length === 0 ? <p style={{ fontSize: 13, color: '#999' }}>まだ案件がありません</p> : items.map((it) => (
        <div key={it.id} style={cardStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <b style={{ fontSize: 14 }}>{it.org_name}</b>
            <button onClick={() => remove(it.id)} style={{ fontSize: 11, color: '#E74C3C', background: 'none', border: 'none', cursor: 'pointer' }}>削除</button>
          </div>
          {it.lead_ref && (
            <p style={{ fontSize: 11, color: '#999', margin: '2px 0 0' }}>
              🔗 リード紐付け: {leads.find((l) => l.id === it.lead_ref)?.org_name ?? it.lead_ref}
            </p>
          )}
          <div style={{ display: 'flex', gap: 6, margin: '8px 0', flexWrap: 'wrap' }}>
            {CASE_STAGES.map((s) => (
              <div key={s} onClick={() => patch(it.id, { stage: s })} style={pillStyle(it.stage === s)}>{s}</div>
            ))}
          </div>
          <label style={labelStyle}>証拠パック</label>
          <textarea defaultValue={it.evidence ?? ''} rows={2} style={{ ...inputStyle, resize: 'vertical' }}
            onBlur={(e) => { if (e.target.value !== (it.evidence ?? '')) patch(it.id, { evidence: e.target.value }); }} />
          <label style={labelStyle}>提案書リンク</label>
          <input defaultValue={it.proposal_link ?? ''} style={inputStyle}
            onBlur={(e) => { if (e.target.value !== (it.proposal_link ?? '')) patch(it.id, { proposal_link: e.target.value || null }); }} />
          <label style={labelStyle}>次アクション</label>
          <textarea defaultValue={it.next_action ?? ''} rows={2} style={{ ...inputStyle, resize: 'vertical' }}
            onBlur={(e) => { if (e.target.value !== (it.next_action ?? '')) patch(it.id, { next_action: e.target.value }); }} />
        </div>
      ))}
    </div>
  );
}

export default function CasesSectionWrapper({ authHeaders }: { authHeaders: () => HeadersInit }) {
  const jsonHeaders = (): HeadersInit => ({ ...authHeaders(), 'Content-Type': 'application/json' });
  return <CasesSection jsonHeaders={jsonHeaders} authHeaders={authHeaders} />;
}
