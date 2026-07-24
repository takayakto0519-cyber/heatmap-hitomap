'use client';

// 💰 収益・損益 — 収益化イニシアチブ（施策の進み具合）と事業別損益(P&L)をまとめたタブ。
// もともと AIOpsTab（AIエージェント運営）の中にあったが、営業でも秘書でもない「お金」の
// 文脈なので独立タブにした。中身の挙動は移設前と同じ。
import { useEffect, useState } from 'react';
import { computeMrr, computeCashflow, type DealCase } from '@/lib/dealMetrics';
import { inputStyle as sharedInputStyle } from '@/components/admin/adminShared';

// adminShared.inputStyle には width/boxSizing が無いため、このタブの用途（フォーム全幅）に合わせて足す。
const inputStyle: React.CSSProperties = { ...sharedInputStyle, width: '100%', boxSizing: 'border-box' };
const labelStyle: React.CSSProperties = { fontSize: 12, fontWeight: 700, color: '#555', margin: '12px 0 5px', display: 'block' };
const cardStyle: React.CSSProperties = { background: '#fff', borderRadius: 12, padding: 16, marginBottom: 10, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' };
const btnStyle: React.CSSProperties = { padding: '8px 16px', borderRadius: 8, border: 'none', background: '#38ADA9', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer' };
const pillStyle = (active: boolean): React.CSSProperties => ({
  padding: '6px 14px', borderRadius: 999, fontSize: 12, fontWeight: 700, cursor: 'pointer',
  border: active ? 'none' : '1px solid #ccc', background: active ? '#38ADA9' : 'transparent', color: active ? '#fff' : '#666',
});

type Headers = { jsonHeaders: () => HeadersInit; authHeaders: () => HeadersInit };

const VIEWS = [
  { key: 'cashflow', label: '💴 入金予定' },
  { key: 'revenue', label: '🐸 収益化イニシアチブ' },
  { key: 'pnl', label: '💰 事業別損益(P&L)' },
] as const;
type View = typeof VIEWS[number]['key'];

function yenTop(n: number): string {
  return `${n.toLocaleString()}円`;
}

// 顧問先のMRR・案件の入金予定は、営業タブ（商流ボード）と同じ lib/dealMetrics.ts を使い、
// タブをまたいで数字が食い違わないようにする。
function MoneySummary({ authHeaders }: { authHeaders: () => HeadersInit }) {
  const [mrr, setMrr] = useState<number | null>(null);
  const [cashflow, setCashflow] = useState<ReturnType<typeof computeCashflow> | null>(null);

  useEffect(() => {
    fetch('/api/admin/client-dossiers', { headers: authHeaders() }).then(r => r.json())
      .then(d => { if (d.ok) setMrr(computeMrr(d.dossiers ?? [])); }).catch(() => {});
    fetch('/api/admin/business-cases', { headers: authHeaders() }).then(r => r.json())
      .then(d => { if (d.ok) setCashflow(computeCashflow(d.cases as DealCase[] ?? [])); }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cards = [
    { label: 'MRR（顧問先月額計）', value: mrr === null ? '…' : yenTop(mrr), color: '#27AE60' },
    { label: '今月の受注額', value: cashflow ? yenTop(cashflow.wonThisMonth) : '…', color: '#4A69BD' },
    { label: '今月の入金済み', value: cashflow ? yenTop(cashflow.paidThisMonth) : '…', color: '#38ADA9' },
    { label: '未入金', value: cashflow ? yenTop(cashflow.unpaidTotal) : '…', sub: cashflow && cashflow.overdueTotal > 0 ? `期限超過 ${yenTop(cashflow.overdueTotal)}` : undefined, color: cashflow && cashflow.overdueTotal > 0 ? '#E74C3C' : '#E5A139' },
  ];

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10, marginBottom: 16 }}>
      {cards.map(c => (
        <div key={c.label} style={{ ...cardStyle, marginBottom: 0, padding: '12px 14px', borderTop: `3px solid ${c.color}` }}>
          <p style={{ margin: 0, fontSize: 11, color: '#999', fontWeight: 700 }}>{c.label}</p>
          <p style={{ margin: '4px 0 2px', fontSize: 17, fontWeight: 800, color: '#333' }}>{c.value}</p>
          {c.sub && <p style={{ margin: 0, fontSize: 11, color: '#aaa' }}>{c.sub}</p>}
        </div>
      ))}
    </div>
  );
}

function CashflowSection({ authHeaders }: { authHeaders: () => HeadersInit }) {
  const [cases, setCases] = useState<DealCase[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/admin/business-cases', { headers: authHeaders() }).then(r => r.json())
      .then(d => { if (d.ok) setCases(d.cases ?? []); setLoading(false); }).catch(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) return <p style={{ fontSize: 13, color: '#999' }}>読み込み中…</p>;
  const { unpaid, unpaidTotal, overdueTotal } = computeCashflow(cases);

  return (
    <div>
      <p style={{ fontSize: 12, color: '#999', margin: '0 0 12px' }}>
        商流ボードで「請求」ステージに進んだ案件（invoice_sent_at）のうち、まだ入金確認していないものを期日順に並べています。
        入金確認は商流ボードの案件詳細で「入金確認済み」にチェックしてください。
      </p>
      {unpaid.length === 0 ? (
        <div style={cardStyle}><p style={{ margin: 0, fontSize: 13, color: '#27AE60', fontWeight: 700 }}>未入金の案件はありません</p></div>
      ) : (
        <>
          <div style={{ display: 'flex', gap: 16, marginBottom: 12, fontSize: 13 }}>
            <span>合計 <b>{yenTop(unpaidTotal)}</b></span>
            {overdueTotal > 0 && <span style={{ color: '#E74C3C' }}>うち期限超過 <b>{yenTop(overdueTotal)}</b></span>}
          </div>
          {unpaid.map(r => (
            <div key={r.id} style={{ ...cardStyle, display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderLeft: r.overdue ? '4px solid #E74C3C' : '4px solid transparent' }}>
              <div>
                <b style={{ fontSize: 14 }}>{r.org_name}</b>
                <p style={{ margin: '2px 0 0', fontSize: 12, color: r.overdue ? '#E74C3C' : '#999' }}>
                  {r.payment_due ? `入金期日: ${r.payment_due}${r.overdue ? '（超過）' : ''}` : '入金期日 未設定'}
                </p>
              </div>
              <span style={{ fontSize: 15, fontWeight: 800, color: '#4A69BD' }}>{yenTop(r.amount)}</span>
            </div>
          ))}
        </>
      )}
    </div>
  );
}

export default function MoneyTab({ authHeaders }: { authHeaders: () => HeadersInit }) {
  const [view, setView] = useState<View>('cashflow');
  const jsonHeaders = (): HeadersInit => ({ ...authHeaders(), 'Content-Type': 'application/json' });
  return (
    <div>
      <MoneySummary authHeaders={authHeaders} />
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
        {VIEWS.map(v => (
          <div key={v.key} style={pillStyle(view === v.key)} onClick={() => setView(v.key)}>{v.label}</div>
        ))}
      </div>
      {view === 'cashflow' && <CashflowSection authHeaders={authHeaders} />}
      {view === 'revenue' && <RevenueSection jsonHeaders={jsonHeaders} authHeaders={authHeaders} />}
      {view === 'pnl' && <PnlSection jsonHeaders={jsonHeaders} authHeaders={authHeaders} />}
    </div>
  );
}

// ---------- 収益化イニシアチブ ----------
interface RevenueInitiative { id: string; title: string; code: string | null; stage: string; next_action: string | null; updated_at: string; }
const REVENUE_STAGES = ['未着手', '進行中', '完了'];

function RevenueSection({ jsonHeaders, authHeaders }: Headers) {
  const [items, setItems] = useState<RevenueInitiative[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: '', code: '', stage: '未着手', next_action: '' });

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
    if (data.ok) { setForm({ title: '', code: '', stage: '未着手', next_action: '' }); setShowForm(false); await load(); }
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
          <label style={labelStyle}>施策コード（任意）</label>
          <input style={inputStyle} value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))} placeholder="例：B-1" />
          <label style={labelStyle}>施策名</label>
          <input style={inputStyle} value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="例：自治体AI導入代行" />
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
            <b style={{ fontSize: 14 }}>{it.code && <span style={{ color: '#38ADA9', marginRight: 6 }}>[{it.code}]</span>}{it.title}</b>
            <button onClick={() => remove(it.id)} style={{ fontSize: 11, color: '#E74C3C', background: 'none', border: 'none', cursor: 'pointer' }}>削除</button>
          </div>
          <div style={{ display: 'flex', gap: 6, margin: '8px 0' }}>
            {REVENUE_STAGES.map((s) => (
              <div key={s} onClick={() => patch(it.id, { stage: s })} style={pillStyle(it.stage === s)}>{s}</div>
            ))}
          </div>
          <input
            defaultValue={it.code ?? ''} style={{ ...inputStyle, marginBottom: 8 }}
            placeholder="施策コード（例：B-1）" onBlur={(e) => { if (e.target.value !== (it.code ?? '')) patch(it.id, { code: e.target.value || null }); }}
          />
          <textarea
            defaultValue={it.next_action ?? ''} rows={2} style={{ ...inputStyle, resize: 'vertical' }}
            placeholder="次アクション" onBlur={(e) => { if (e.target.value !== (it.next_action ?? '')) patch(it.id, { next_action: e.target.value }); }}
          />
        </div>
      ))}
    </div>
  );
}




// ---------- 事業別損益(P&L) ----------
interface PnlEntry { id: string; line_key: string; month: string; revenue: number; cost: number; memo: string | null; }
const PNL_LINES = [
  { key: 'advisory', label: '顧問業' },
  { key: 'kit', label: 'キット販売' },
  { key: 'saas', label: 'SaaS' },
  { key: 'recruit', label: '採用商材' },
  { key: 'event', label: 'イベント' },
  { key: 'other', label: 'その他' },
] as const;

function lineLabel(key: string): string {
  return PNL_LINES.find((l) => l.key === key)?.label ?? key;
}

function yen(n: number): string {
  return (n < 0 ? '-' : '') + Math.abs(n).toLocaleString() + '円';
}

function PnlSection({ jsonHeaders, authHeaders }: Headers) {
  const [items, setItems] = useState<PnlEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [showForm, setShowForm] = useState(false);
  const now = new Date();
  const defaultMonth = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
  const [form, setForm] = useState({ line_key: 'advisory', month: defaultMonth, revenue: '', cost: '', memo: '' });

  async function load() {
    setLoading(true);
    const res = await fetch('/api/admin/business-line-pnl', { headers: authHeaders() });
    const data = await res.json();
    if (data.ok) setItems(data.entries ?? []); else setMessage(data.error ?? '読み込みに失敗しました');
    setLoading(false);
  }
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  async function save() {
    if (!form.month) { setMessage('対象月を選んでください'); return; }
    const res = await fetch('/api/admin/business-line-pnl', {
      method: 'POST', headers: jsonHeaders(),
      body: JSON.stringify({
        line_key: form.line_key, month: form.month + '-01',
        revenue: form.revenue ? Number(form.revenue) : 0, cost: form.cost ? Number(form.cost) : 0,
        memo: form.memo || null,
      }),
    });
    const data = await res.json();
    if (data.ok) { setForm((f) => ({ ...f, revenue: '', cost: '', memo: '' })); setShowForm(false); await load(); }
    else setMessage(data.error ?? '保存に失敗しました');
  }
  async function patch(id: string, fields: Partial<PnlEntry>) {
    await fetch(`/api/admin/business-line-pnl/${id}`, { method: 'PATCH', headers: jsonHeaders(), body: JSON.stringify(fields) });
    await load();
  }
  async function remove(id: string) {
    if (!window.confirm('削除しますか？')) return;
    await fetch(`/api/admin/business-line-pnl/${id}`, { method: 'DELETE', headers: authHeaders() });
    await load();
  }

  const totals = PNL_LINES.map((l) => {
    const rows = items.filter((it) => it.line_key === l.key);
    const revenue = rows.reduce((sum, r) => sum + r.revenue, 0);
    const cost = rows.reduce((sum, r) => sum + r.cost, 0);
    return { ...l, revenue, cost, profit: revenue - cost };
  });
  const grandTotal = totals.reduce((sum, l) => sum + l.profit, 0);

  return (
    <div>
      <p style={{ fontSize: 12, color: '#999', margin: '0 0 10px' }}>
        事業ライン×月で1件。同じ組み合わせで保存すると上書きされるので、月末に数字だけ書き直す運用でOKです。
      </p>
      <button style={btnStyle} onClick={() => setShowForm((v) => !v)}>{showForm ? 'キャンセル' : '+ 月次実績を入力'}</button>
      {message && <p style={{ fontSize: 13, color: '#E74C3C' }}>{message}</p>}
      {showForm && (
        <div style={cardStyle}>
          <label style={labelStyle}>事業ライン</label>
          <select style={inputStyle} value={form.line_key} onChange={(e) => setForm((f) => ({ ...f, line_key: e.target.value }))}>
            {PNL_LINES.map((l) => <option key={l.key} value={l.key}>{l.label}</option>)}
          </select>
          <label style={labelStyle}>対象月</label>
          <input style={inputStyle} type="month" value={form.month} onChange={(e) => setForm((f) => ({ ...f, month: e.target.value }))} />
          <label style={labelStyle}>売上（円）</label>
          <input style={inputStyle} type="number" value={form.revenue} onChange={(e) => setForm((f) => ({ ...f, revenue: e.target.value }))} />
          <label style={labelStyle}>原価・経費（円）</label>
          <input style={inputStyle} type="number" value={form.cost} onChange={(e) => setForm((f) => ({ ...f, cost: e.target.value }))} />
          <label style={labelStyle}>メモ</label>
          <textarea style={{ ...inputStyle, resize: 'vertical' }} rows={2} value={form.memo} onChange={(e) => setForm((f) => ({ ...f, memo: e.target.value }))} />
          <div style={{ marginTop: 12 }}><button style={btnStyle} onClick={save}>保存する（同月同ラインは上書き）</button></div>
        </div>
      )}

      <h2 style={{ fontSize: 14, fontWeight: 700, color: '#555', margin: '18px 0 10px' }}>累計サマリー</h2>
      <div style={cardStyle}>
        {totals.filter((t) => t.revenue || t.cost).length === 0 ? (
          <p style={{ fontSize: 13, color: '#999', margin: 0 }}>まだ実績がありません</p>
        ) : (
          <>
            {totals.filter((t) => t.revenue || t.cost).map((t) => (
              <div key={t.key} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '4px 0' }}>
                <span>{t.label}</span>
                <span>売上{yen(t.revenue)} − 原価{yen(t.cost)} = <b style={{ color: t.profit >= 0 ? '#27AE60' : '#E74C3C' }}>{yen(t.profit)}</b></span>
              </div>
            ))}
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, fontWeight: 800, borderTop: '1px solid #eee', marginTop: 8, paddingTop: 8 }}>
              <span>合計損益</span>
              <span style={{ color: grandTotal >= 0 ? '#27AE60' : '#E74C3C' }}>{yen(grandTotal)}</span>
            </div>
          </>
        )}
      </div>

      <h2 style={{ fontSize: 14, fontWeight: 700, color: '#555', margin: '18px 0 10px' }}>月次履歴</h2>
      {loading ? <p style={{ fontSize: 13, color: '#999' }}>読み込み中…</p> : items.length === 0 ? <p style={{ fontSize: 13, color: '#999' }}>まだ入力がありません</p> : items.map((it) => (
        <div key={it.id} style={cardStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <b style={{ fontSize: 14 }}>{lineLabel(it.line_key)} ・ {it.month.slice(0, 7)}</b>
            <button onClick={() => remove(it.id)} style={{ fontSize: 11, color: '#E74C3C', background: 'none', border: 'none', cursor: 'pointer' }}>削除</button>
          </div>
          <div style={{ display: 'flex', gap: 8, margin: '8px 0' }}>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>売上（円）</label>
              <input defaultValue={it.revenue} type="number" style={inputStyle}
                onBlur={(e) => { const v = Number(e.target.value) || 0; if (v !== it.revenue) patch(it.id, { revenue: v }); }} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>原価・経費（円）</label>
              <input defaultValue={it.cost} type="number" style={inputStyle}
                onBlur={(e) => { const v = Number(e.target.value) || 0; if (v !== it.cost) patch(it.id, { cost: v }); }} />
            </div>
          </div>
          <p style={{ fontSize: 12, color: '#999', margin: '0 0 8px' }}>損益：<b style={{ color: (it.revenue - it.cost) >= 0 ? '#27AE60' : '#E74C3C' }}>{yen(it.revenue - it.cost)}</b></p>
          <textarea defaultValue={it.memo ?? ''} rows={2} style={{ ...inputStyle, resize: 'vertical' }}
            placeholder="メモ" onBlur={(e) => { if (e.target.value !== (it.memo ?? '')) patch(it.id, { memo: e.target.value || null }); }} />
        </div>
      ))}
    </div>
  );
}
