'use client';

// 📇 商流ボード — 案件パイプライン（business_cases）をステージ順に並べ、
// 迷わず「次へ」進められるようにした画面。旧CasesSectionを置き換える。
// D&Dカンバンにはしていない：一人運用では「次へ→」ボタン1クリックの方が速く、
// スマホでの縦スクロール閲覧にも向く。
import { useEffect, useState } from 'react';
import { CASE_STAGES, CASE_STAGE_ORDER, nextStage, nextActionForStage, type DealCase } from '@/lib/dealMetrics';
import SalesKpiRow from './SalesKpiRow';

const inputStyle: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box', padding: '8px 10px', borderRadius: 8,
  border: '1.5px solid #ddd', fontSize: 13, fontFamily: 'inherit',
};
const labelStyle: React.CSSProperties = { fontSize: 11.5, fontWeight: 700, color: '#777', margin: '8px 0 4px', display: 'block' };
const cardStyle: React.CSSProperties = { background: '#fff', borderRadius: 12, padding: 14, marginBottom: 10, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' };
const btnStyle: React.CSSProperties = { padding: '8px 16px', borderRadius: 8, border: 'none', background: '#38ADA9', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer' };

interface BusinessCase extends DealCase {
  client_type: string;
  evidence: string | null;
  proposal_link: string | null;
  next_action: string | null;
  lead_ref: string | null;
}
interface LeadOption { id: string; org_name: string; }
interface ProposalOption { id: string; title: string; body: string }

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Headers = { jsonHeaders: () => HeadersInit; authHeaders: () => HeadersInit };

function yen(n: number | null): string {
  return n ? `${n.toLocaleString()}円` : '未入力';
}

function CaseRow({ c, onPatch, onDelete, leads, proposals }: {
  c: BusinessCase; onPatch: (id: string, fields: Partial<BusinessCase>) => void; onDelete: (id: string) => void;
  leads: LeadOption[]; proposals: Map<string, ProposalOption>;
}) {
  const [expanded, setExpanded] = useState(false);
  const [showProposalBody, setShowProposalBody] = useState(false);
  const next = nextStage(c.stage);
  const isLost = c.stage === '見送り';
  // proposal_linkが経営資料（strategy_proposals）のIDならそちらを正として解決して表示する。
  // 旧データ（生のファイルパス文字列）はそのまま編集可能なテキストとして残す（P1-1統合）。
  const linkedProposal = c.proposal_link && UUID_RE.test(c.proposal_link) ? proposals.get(c.proposal_link) : undefined;

  return (
    <div style={cardStyle}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <b style={{ fontSize: 14 }}>{c.org_name}</b>
          {c.lead_ref && (
            <span style={{ fontSize: 11, color: '#999', marginLeft: 8 }}>
              🔗 {leads.find((l) => l.id === c.lead_ref)?.org_name ?? c.lead_ref}
            </span>
          )}
          <p style={{ margin: '2px 0 0', fontSize: 12.5, color: '#4A69BD', fontWeight: 700 }}>{yen(c.amount)}</p>
        </div>
        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
          {!isLost && next && (
            <button onClick={() => onPatch(c.id, { stage: next })} style={{
              padding: '6px 12px', borderRadius: 8, border: 'none', background: '#38ADA9',
              color: '#fff', fontWeight: 700, fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap',
            }}>次へ：{next} →</button>
          )}
          <button onClick={() => setExpanded((v) => !v)} style={{
            padding: '6px 10px', borderRadius: 8, border: '1px solid #ddd', background: '#fff',
            color: '#666', fontSize: 12, cursor: 'pointer',
          }}>{expanded ? '閉じる' : '詳細'}</button>
        </div>
      </div>

      <p style={{ margin: '8px 0 0', fontSize: 12, color: c.next_action ? '#555' : '#aaa' }}>
        {c.next_action || `（次アクション未記入）${nextActionForStage(c.stage)}`}
      </p>

      {expanded && (
        <div style={{ marginTop: 10, borderTop: '1px solid #f0f0f0', paddingTop: 10 }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {CASE_STAGES.map((s) => (
              <div key={s} onClick={() => onPatch(c.id, { stage: s })} style={{
                padding: '5px 12px', borderRadius: 999, fontSize: 11.5, fontWeight: 700, cursor: 'pointer',
                border: c.stage === s ? 'none' : '1px solid #ccc',
                background: c.stage === s ? '#38ADA9' : 'transparent', color: c.stage === s ? '#fff' : '#666',
              }}>{s}</div>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 8 }}>
            <div>
              <label style={labelStyle}>金額（円）</label>
              <input type="number" defaultValue={c.amount ?? ''} style={inputStyle}
                onBlur={(e) => { const v = e.target.value ? Number(e.target.value) : null; if (v !== c.amount) onPatch(c.id, { amount: v }); }} />
            </div>
            <div>
              <label style={labelStyle}>受注確度（%）</label>
              <input type="number" min={0} max={100} defaultValue={c.probability ?? 50} style={inputStyle}
                onBlur={(e) => { const v = e.target.value ? Number(e.target.value) : 50; if (v !== c.probability) onPatch(c.id, { probability: v }); }} />
            </div>
            <div>
              <label style={labelStyle}>受注見込み日</label>
              <input type="date" defaultValue={c.expected_close_date ?? ''} style={inputStyle}
                onBlur={(e) => { if (e.target.value !== (c.expected_close_date ?? '')) onPatch(c.id, { expected_close_date: e.target.value || null }); }} />
            </div>
            <div>
              <label style={labelStyle}>入金期日</label>
              <input type="date" defaultValue={c.payment_due ?? ''} style={inputStyle}
                onBlur={(e) => { if (e.target.value !== (c.payment_due ?? '')) onPatch(c.id, { payment_due: e.target.value || null }); }} />
            </div>
          </div>

          {c.invoice_sent_at && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: '#555', display: 'flex', alignItems: 'center', gap: 6 }}>
                <input type="checkbox" checked={Boolean(c.paid_at)}
                  onChange={(e) => onPatch(c.id, { paid_at: e.target.checked ? new Date().toISOString().slice(0, 10) : null })} />
                入金確認済み{c.paid_at ? `（${c.paid_at}）` : ''}
              </label>
            </div>
          )}

          {isLost && (
            <div>
              <label style={labelStyle}>見送り理由</label>
              <input defaultValue={c.lost_reason ?? ''} style={inputStyle}
                onBlur={(e) => { if (e.target.value !== (c.lost_reason ?? '')) onPatch(c.id, { lost_reason: e.target.value || null }); }} />
            </div>
          )}

          <label style={labelStyle}>証拠パック</label>
          <textarea defaultValue={c.evidence ?? ''} rows={2} style={{ ...inputStyle, resize: 'vertical' }}
            onBlur={(e) => { if (e.target.value !== (c.evidence ?? '')) onPatch(c.id, { evidence: e.target.value }); }} />
          <label style={labelStyle}>提案書リンク</label>
          {linkedProposal ? (
            <div style={{ background: '#F4F6F5', borderRadius: 8, padding: '8px 10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 12.5, fontWeight: 700, color: '#38ADA9' }}>📁 {linkedProposal.title}</span>
                <button onClick={() => setShowProposalBody((v) => !v)} style={{
                  padding: '3px 9px', borderRadius: 12, border: '1px solid #38ADA9', background: '#fff',
                  color: '#38ADA9', fontSize: 10.5, cursor: 'pointer', whiteSpace: 'nowrap',
                }}>{showProposalBody ? '閉じる' : '本文を見る'}</button>
              </div>
              <p style={{ margin: '4px 0 0', fontSize: 10.5, color: '#999' }}>経営資料タブに登録されている提案書です</p>
              {showProposalBody && (
                <pre style={{ marginTop: 6, padding: 8, background: '#fff', borderRadius: 6, fontSize: 11, whiteSpace: 'pre-wrap', maxHeight: 200, overflow: 'auto' }}>{linkedProposal.body}</pre>
              )}
            </div>
          ) : (
            <input defaultValue={c.proposal_link ?? ''} style={inputStyle}
              onBlur={(e) => { if (e.target.value !== (c.proposal_link ?? '')) onPatch(c.id, { proposal_link: e.target.value || null }); }} />
          )}
          <label style={labelStyle}>次アクション</label>
          <textarea defaultValue={c.next_action ?? ''} rows={2} style={{ ...inputStyle, resize: 'vertical' }}
            onBlur={(e) => { if (e.target.value !== (c.next_action ?? '')) onPatch(c.id, { next_action: e.target.value }); }} />

          <button onClick={() => onDelete(c.id)} style={{
            marginTop: 8, fontSize: 11, color: '#E74C3C', background: 'none', border: 'none', cursor: 'pointer',
          }}>削除</button>
        </div>
      )}
    </div>
  );
}

function FlowBoardInner({ jsonHeaders, authHeaders }: Headers) {
  const [items, setItems] = useState<BusinessCase[]>([]);
  const [leads, setLeads] = useState<LeadOption[]>([]);
  const [proposals, setProposals] = useState<Map<string, ProposalOption>>(new Map());
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [justWonMessage, setJustWonMessage] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ org_name: '', client_type: 'business', amount: '', lead_ref: '' });

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
    // 提案書リンクがstrategy_proposalsのIDを指している場合にタイトル・本文を解決するための一覧（P1-1統合）
    fetch('/api/admin/strategy-proposals', { headers: authHeaders() })
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) {
          const map = new Map<string, ProposalOption>();
          for (const p of d.proposals ?? []) map.set(p.id, { id: p.id, title: p.title, body: p.body ?? '' });
          setProposals(map);
        }
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function create() {
    if (!form.org_name.trim()) { setMessage('組織名を入力してください'); return; }
    const res = await fetch('/api/admin/business-cases', {
      method: 'POST', headers: jsonHeaders(),
      body: JSON.stringify({
        org_name: form.org_name, client_type: form.client_type, stage: '発案',
        amount: form.amount ? Number(form.amount) : null, lead_ref: form.lead_ref || null,
      }),
    });
    const data = await res.json();
    if (data.ok) { setForm({ org_name: '', client_type: 'business', amount: '', lead_ref: '' }); setShowForm(false); await load(); }
    else setMessage(data.error ?? '保存に失敗しました');
  }
  async function patch(id: string, fields: Partial<BusinessCase>) {
    // 受注への遷移を検知したら、伴走支援（オンボーディング）の入口を自動で作る。
    // 「営業して終わり」で止まらないよう、受注の瞬間に次の一手をAIへ依頼しておく。
    const before = items.find((it) => it.id === id);
    const justWon = fields.stage === '受注' && before && before.stage !== '受注';
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...fields } : it)));
    await fetch(`/api/admin/business-cases/${id}`, { method: 'PATCH', headers: jsonHeaders(), body: JSON.stringify(fields) });
    if (justWon && before) {
      await fetch('/api/admin/action-items', {
        method: 'POST', headers: jsonHeaders(),
        body: JSON.stringify({
          title: `伴走支援を開始：${before.org_name}`,
          category: '伴走支援',
          owner: 'AI',
          notes: `${before.org_name}様が受注に至りました。04_人事クライアント管理_HR_Client/オンボーディング手順.md の型で顧問先カルテ（/client-dossier）を作成し、初回30日のオンボーディングを開始してください。`,
        }),
      });
      setJustWonMessage(`${before.org_name}様、受注おめでとうございます。伴走支援の開始タスクを積みました。`);
    }
    await load();
  }
  async function remove(id: string) {
    if (!window.confirm('削除しますか？')) return;
    await fetch(`/api/admin/business-cases/${id}`, { method: 'DELETE', headers: authHeaders() });
    await load();
  }

  const outreach = items
    .filter((c) => c.invoice_sent_at || c.stage !== '発案') // 送信済み以降（=何かしら接触が始まった案件）を母数にする
    .map((c) => ({ sent: CASE_STAGE_ORDER.indexOf(c.stage as typeof CASE_STAGE_ORDER[number]) >= CASE_STAGE_ORDER.indexOf('送信済み'), replied: Boolean(c.won_at) || c.stage === 'フォロー' }));

  return (
    <div>
      <SalesKpiRow cases={items} outreach={outreach} />

      <button style={btnStyle} onClick={() => setShowForm((v) => !v)}>{showForm ? 'キャンセル' : '+ 新しい案件'}</button>
      {message && <p style={{ fontSize: 13, color: '#E74C3C' }}>{message}</p>}
      {justWonMessage && (
        <div style={{ ...cardStyle, background: '#EAFBF3', border: '1.5px solid #27AE60' }}>
          <p style={{ margin: 0, fontSize: 13, fontWeight: 800, color: '#27AE60' }}>🎉 {justWonMessage}</p>
          <p style={{ margin: '4px 0 0', fontSize: 11.5, color: '#666' }}>次のClaude Codeセッションで「顧問先カルテ作って」または/client-dossierと頼むと、オンボーディングの初動を進められます。</p>
        </div>
      )}
      {showForm && (
        <div style={cardStyle}>
          <label style={labelStyle}>組織名</label>
          <input style={inputStyle} value={form.org_name} onChange={(e) => setForm((f) => ({ ...f, org_name: e.target.value }))} placeholder="例：佐野市（栃木県）" />
          <label style={labelStyle}>種別</label>
          <select style={inputStyle} value={form.client_type} onChange={(e) => setForm((f) => ({ ...f, client_type: e.target.value }))}>
            <option value="business">法人</option><option value="school">学校</option><option value="government">自治体</option>
          </select>
          <label style={labelStyle}>想定金額（円・任意）</label>
          <input type="number" style={inputStyle} value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} />
          <label style={labelStyle}>リード（縁のデータベース）と紐付け（任意）</label>
          <select style={inputStyle} value={form.lead_ref} onChange={(e) => setForm((f) => ({ ...f, lead_ref: e.target.value }))}>
            <option value="">（紐付けなし）</option>
            {leads.map((l) => <option key={l.id} value={l.id}>{l.org_name}</option>)}
          </select>
          <div style={{ marginTop: 12 }}><button style={btnStyle} onClick={create}>保存する</button></div>
        </div>
      )}

      {loading ? <p style={{ fontSize: 13, color: '#999' }}>読み込み中…</p> : (
        CASE_STAGES.map((stage) => {
          const stageItems = items.filter((c) => c.stage === stage);
          if (stageItems.length === 0) return null;
          const subtotal = stageItems.reduce((sum, c) => sum + (c.amount ?? 0), 0);
          return (
            <div key={stage} style={{ marginTop: 18 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 6 }}>
                <h3 style={{ fontSize: 13, fontWeight: 800, color: '#444', margin: 0 }}>{stage}</h3>
                <span style={{ fontSize: 11, color: '#999' }}>{stageItems.length}件</span>
                {subtotal > 0 && <span style={{ fontSize: 11, color: '#4A69BD', fontWeight: 700 }}>{yen(subtotal)}</span>}
              </div>
              {stageItems.map((c) => <CaseRow key={c.id} c={c} onPatch={patch} onDelete={remove} leads={leads} proposals={proposals} />)}
            </div>
          );
        })
      )}
      {!loading && items.length === 0 && <p style={{ fontSize: 13, color: '#999', marginTop: 12 }}>まだ案件がありません</p>}
    </div>
  );
}

export default function FlowBoard({ authHeaders }: { authHeaders: () => HeadersInit }) {
  const jsonHeaders = (): HeadersInit => ({ ...authHeaders(), 'Content-Type': 'application/json' });
  return <FlowBoardInner jsonHeaders={jsonHeaders} authHeaders={authHeaders} />;
}
