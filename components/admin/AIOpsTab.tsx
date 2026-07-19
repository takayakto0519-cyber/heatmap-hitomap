'use client';

// AIエージェント運営タブ — 今回実装したAIエージェント群（収益化イニシアチブ・案件パイプライン・
// 顧問先カルテ・LINE縁ミッション・営業メール送り先）を運営ダッシュボードから直接書き込み・修正できるようにする。
// ローカルのエージェント（agents/配下）は当面ファイルを読み続けるため、完全な自動連携はまだ無い——
// まずは「会長が手で見て・書き込める場所」として用意する。
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

const SECTIONS = [
  { key: 'revenue', label: '🐸 収益化イニシアチブ' },
  { key: 'cases', label: '📇 案件パイプライン' },
  { key: 'dossiers', label: '🤝 顧問先カルテ' },
  { key: 'line', label: '🐇 LINE縁ミッション' },
  { key: 'email', label: '🐢 営業メール送り先' },
] as const;
type Section = typeof SECTIONS[number]['key'];

export default function AIOpsTab({ authHeaders }: { authHeaders: () => HeadersInit }) {
  const [section, setSection] = useState<Section>('revenue');

  function jsonHeaders(): HeadersInit {
    return { ...authHeaders(), 'Content-Type': 'application/json' };
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <h1 style={{ fontSize: 20, fontWeight: 800, margin: 0 }}>AIエージェント運営</h1>
      </div>
      <p style={{ fontSize: 13, color: '#777', margin: '0 0 16px' }}>
        Claude Codeセッションで実装した各エージェントのデータを、ここから直接書き込み・修正できます。
        自動送信は一切行いません（LINE投稿・営業メール送信は必ず会長が別途手動で行ってください）。
      </p>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 18 }}>
        {SECTIONS.map((s) => (
          <div key={s.key} style={pillStyle(section === s.key)} onClick={() => setSection(s.key)}>{s.label}</div>
        ))}
      </div>
      {section === 'revenue' && <RevenueSection jsonHeaders={jsonHeaders} authHeaders={authHeaders} />}
      {section === 'cases' && <CasesSection jsonHeaders={jsonHeaders} authHeaders={authHeaders} />}
      {section === 'dossiers' && <DossiersSection jsonHeaders={jsonHeaders} authHeaders={authHeaders} />}
      {section === 'line' && <LineSection jsonHeaders={jsonHeaders} authHeaders={authHeaders} />}
      {section === 'email' && <EmailSection jsonHeaders={jsonHeaders} authHeaders={authHeaders} />}
    </div>
  );
}

type Headers = { jsonHeaders: () => HeadersInit; authHeaders: () => HeadersInit };

// ---------- 収益化イニシアチブ ----------
interface RevenueInitiative { id: string; title: string; stage: string; next_action: string | null; updated_at: string; }
const REVENUE_STAGES = ['未着手', '進行中', '完了'];

function RevenueSection({ jsonHeaders, authHeaders }: Headers) {
  const [items, setItems] = useState<RevenueInitiative[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: '', stage: '未着手', next_action: '' });

  async function load() {
    setLoading(true);
    const res = await fetch('/api/admin/revenue-initiatives', { headers: authHeaders() });
    const data = await res.json();
    if (data.ok) setItems(data.initiatives ?? []); else setMessage(data.error ?? '読み込みに失敗しました');
    setLoading(false);
  }
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  async function create() {
    if (!form.title.trim()) { setMessage('施策名を入力してください'); return; }
    const res = await fetch('/api/admin/revenue-initiatives', { method: 'POST', headers: jsonHeaders(), body: JSON.stringify(form) });
    const data = await res.json();
    if (data.ok) { setForm({ title: '', stage: '未着手', next_action: '' }); setShowForm(false); await load(); }
    else setMessage(data.error ?? '保存に失敗しました');
  }
  async function patch(id: string, fields: Partial<RevenueInitiative>) {
    await fetch(`/api/admin/revenue-initiatives/${id}`, { method: 'PATCH', headers: jsonHeaders(), body: JSON.stringify(fields) });
    await load();
  }
  async function remove(id: string) {
    if (!window.confirm('削除しますか？')) return;
    await fetch(`/api/admin/revenue-initiatives/${id}`, { method: 'DELETE', headers: authHeaders() });
    await load();
  }

  return (
    <div>
      <button style={btnStyle} onClick={() => setShowForm((v) => !v)}>{showForm ? 'キャンセル' : '+ 新しい施策'}</button>
      {message && <p style={{ fontSize: 13, color: '#E74C3C' }}>{message}</p>}
      {showForm && (
        <div style={cardStyle}>
          <label style={labelStyle}>施策名</label>
          <input style={inputStyle} value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="例：B-1 自治体AI導入代行" />
          <label style={labelStyle}>ステージ</label>
          <select style={inputStyle} value={form.stage} onChange={(e) => setForm((f) => ({ ...f, stage: e.target.value }))}>
            {REVENUE_STAGES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <label style={labelStyle}>次アクション</label>
          <textarea style={{ ...inputStyle, resize: 'vertical' }} rows={2} value={form.next_action} onChange={(e) => setForm((f) => ({ ...f, next_action: e.target.value }))} />
          <div style={{ marginTop: 12 }}><button style={btnStyle} onClick={create}>保存する</button></div>
        </div>
      )}
      {loading ? <p style={{ fontSize: 13, color: '#999' }}>読み込み中…</p> : items.length === 0 ? <p style={{ fontSize: 13, color: '#999' }}>まだ施策がありません</p> : items.map((it) => (
        <div key={it.id} style={cardStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <b style={{ fontSize: 14 }}>{it.title}</b>
            <button onClick={() => remove(it.id)} style={{ fontSize: 11, color: '#E74C3C', background: 'none', border: 'none', cursor: 'pointer' }}>削除</button>
          </div>
          <div style={{ display: 'flex', gap: 6, margin: '8px 0' }}>
            {REVENUE_STAGES.map((s) => (
              <div key={s} onClick={() => patch(it.id, { stage: s })} style={pillStyle(it.stage === s)}>{s}</div>
            ))}
          </div>
          <textarea
            defaultValue={it.next_action ?? ''} rows={2} style={{ ...inputStyle, resize: 'vertical' }}
            placeholder="次アクション" onBlur={(e) => { if (e.target.value !== (it.next_action ?? '')) patch(it.id, { next_action: e.target.value }); }}
          />
        </div>
      ))}
    </div>
  );
}

// ---------- 案件パイプライン ----------
interface BusinessCase { id: string; org_name: string; client_type: string; stage: string; evidence: string | null; proposal_link: string | null; next_action: string | null; }
const CASE_STAGES = ['発案', 'リード', '提案', '承認待ち', '送信済み', '受注', '見送り', '制作', '納品', '請求', 'フォロー'];

function CasesSection({ jsonHeaders, authHeaders }: Headers) {
  const [items, setItems] = useState<BusinessCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ org_name: '', client_type: 'business', stage: '発案' });

  async function load() {
    setLoading(true);
    const res = await fetch('/api/admin/business-cases', { headers: authHeaders() });
    const data = await res.json();
    if (data.ok) setItems(data.cases ?? []); else setMessage(data.error ?? '読み込みに失敗しました');
    setLoading(false);
  }
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  async function create() {
    if (!form.org_name.trim()) { setMessage('組織名を入力してください'); return; }
    const res = await fetch('/api/admin/business-cases', { method: 'POST', headers: jsonHeaders(), body: JSON.stringify(form) });
    const data = await res.json();
    if (data.ok) { setForm({ org_name: '', client_type: 'business', stage: '発案' }); setShowForm(false); await load(); }
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
          <div style={{ marginTop: 12 }}><button style={btnStyle} onClick={create}>保存する</button></div>
        </div>
      )}
      {loading ? <p style={{ fontSize: 13, color: '#999' }}>読み込み中…</p> : items.length === 0 ? <p style={{ fontSize: 13, color: '#999' }}>まだ案件がありません</p> : items.map((it) => (
        <div key={it.id} style={cardStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <b style={{ fontSize: 14 }}>{it.org_name}</b>
            <button onClick={() => remove(it.id)} style={{ fontSize: 11, color: '#E74C3C', background: 'none', border: 'none', cursor: 'pointer' }}>削除</button>
          </div>
          <div style={{ display: 'flex', gap: 6, margin: '8px 0', flexWrap: 'wrap' }}>
            {CASE_STAGES.map((s) => (
              <div key={s} onClick={() => patch(it.id, { stage: s })} style={pillStyle(it.stage === s)}>{s}</div>
            ))}
          </div>
          <label style={labelStyle}>証拠パック</label>
          <textarea defaultValue={it.evidence ?? ''} rows={2} style={{ ...inputStyle, resize: 'vertical' }}
            onBlur={(e) => { if (e.target.value !== (it.evidence ?? '')) patch(it.id, { evidence: e.target.value }); }} />
          <label style={labelStyle}>次アクション</label>
          <textarea defaultValue={it.next_action ?? ''} rows={2} style={{ ...inputStyle, resize: 'vertical' }}
            onBlur={(e) => { if (e.target.value !== (it.next_action ?? '')) patch(it.id, { next_action: e.target.value }); }} />
        </div>
      ))}
    </div>
  );
}

// ---------- 顧問先カルテ ----------
interface ClientDossier { id: string; org_name: string; plan: string | null; monthly_fee: number | null; contact_name: string | null; notes: string | null; }

function DossiersSection({ jsonHeaders, authHeaders }: Headers) {
  const [items, setItems] = useState<ClientDossier[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ org_name: '', plan: '', monthly_fee: '' });

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
      body: JSON.stringify({ org_name: form.org_name, plan: form.plan, monthly_fee: form.monthly_fee ? Number(form.monthly_fee) : null }),
    });
    const data = await res.json();
    if (data.ok) { setForm({ org_name: '', plan: '', monthly_fee: '' }); setShowForm(false); await load(); }
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
          <div style={{ marginTop: 12 }}><button style={btnStyle} onClick={create}>保存する</button></div>
        </div>
      )}
      {loading ? <p style={{ fontSize: 13, color: '#999' }}>読み込み中…</p> : items.length === 0 ? <p style={{ fontSize: 13, color: '#999' }}>まだ顧問先がありません</p> : items.map((it) => (
        <div key={it.id} style={cardStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <b style={{ fontSize: 14 }}>{it.org_name}{it.plan ? `（${it.plan}）` : ''}{it.monthly_fee ? ` — 月${it.monthly_fee.toLocaleString()}円` : ''}</b>
            <button onClick={() => remove(it.id)} style={{ fontSize: 11, color: '#E74C3C', background: 'none', border: 'none', cursor: 'pointer' }}>削除</button>
          </div>
          <label style={labelStyle}>業務の地図・AI活用ルール・気づき（自由記述）</label>
          <textarea defaultValue={it.notes ?? ''} rows={4} style={{ ...inputStyle, resize: 'vertical' }}
            onBlur={(e) => { if (e.target.value !== (it.notes ?? '')) patch(it.id, { notes: e.target.value }); }} />
        </div>
      ))}
    </div>
  );
}

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
