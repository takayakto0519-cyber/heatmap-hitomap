'use client';

// 🧾 統合ビュー（旧・送信キュー） — 関係人口（自治体プロファイル）・自治体台帳（学校・法人＝client_leads）・
// 送信ドラフトを「1行=1相手」で1画面に統合する。旧SendQueuePanel（送信キュー専用タブ）はここへ統合して廃止した。
// 別タブに分けていたことで、宛先のファクトチェックと送信のたびにタブを行き来する手間があった。
// ここでは相手ごとに「台帳の状況」「縁・自治体スコア」「送信ドラフトの確度・事実確認」を横並びにし、
// 事実確認と送信をこの画面だけで完結できるようにする。送信自体は必ずボタン経由（二重ガードはAPI側）。
import { useCallback, useEffect, useRef, useState } from 'react';
import { computeEn, EN_KINDS, type EnKind, type EnRecord } from '@/lib/enScore';
import { municipalityScore } from '@/lib/salesScore';
import { coreRegionName } from '@/lib/smout';

type Confidence = 'high' | 'medium' | 'low' | null;
type FactCheckStatus = 'verified' | 'unverified' | 'flagged' | null;

interface ClientLead {
  id: string; client_type: 'school' | 'business'; org_name: string; status: string;
  memo: string | null; email: string | null; phone: string | null;
  updated_at: string | null; created_at: string | null;
  email_draft?: string | null; sent?: boolean | null; email_sent_at?: string | null;
  contact_email_confidence?: Confidence; contact_email_source_url?: string | null;
  fact_check_status?: FactCheckStatus; fact_check_note?: string | null; assigned_to?: string | null;
}
interface MunicipalityProfile {
  id: string; region_name: string; opportunity_level: string; engagement_stage: string;
  fit_assessment: string | null; opportunity_notes: string | null; evidence_summary: string | null;
  relation_population_initiative: string | null; on_hold: boolean;
  contact_email?: string | null; email_draft?: string | null; email_sent_at?: string | null;
  contact_email_confidence?: Confidence; contact_email_source_url?: string | null;
  fact_check_status?: FactCheckStatus; fact_check_note?: string | null; assigned_to?: string | null;
}
interface FundingOppLite { id: string; status: string; deadline: string | null; municipality_profile_id: string | null }
interface TeamMember { id: string; name: string; is_active: boolean }

interface QueueInfo {
  source: 'lead' | 'municipality';
  id: string; email: string | null; confidence: Confidence; sourceUrl: string | null;
  factCheckStatus: FactCheckStatus; factCheckNote: string | null; draft: string;
  sendPath: string; patchPath: string; assignedTo: string | null;
}
interface Row {
  key: string; kind: 'lead' | 'municipality'; icon: string; name: string;
  statusLabel: string; statusColor: string;
  scoreLabel: string; scoreColor: string; scoreDetail: string;
  reason: string; queue: QueueInfo | null; rfpActive: boolean; rfpDeadline: string | null;
  leadRecords: EnRecord[];
}

const LEAD_STATUS_META: Record<string, { label: string; color: string }> = {
  lead: { label: '候補', color: '#999' }, contacted: { label: '接触済み', color: '#4A90E2' },
  negotiating: { label: '商談中', color: '#E5A139' }, contracted: { label: '契約中', color: '#27AE60' },
  lost: { label: '見送り', color: '#E55039' },
};
const OPPORTUNITY_COLORS: Record<string, string> = { 高: '#27AE60', 中: '#E5A139', 低: '#999' };
const CONFIDENCE_BADGE: Record<'high' | 'medium' | 'low', { label: string; color: string }> = {
  high: { label: '🟢 確度高', color: '#27AE60' }, medium: { label: '🟡 要確認', color: '#E5A139' },
  low: { label: '🔴 フォームのみ', color: '#E74C3C' },
};
const FACT_CHECK_BADGE: Record<'verified' | 'flagged', { label: string; color: string }> = {
  verified: { label: '✓ 事実確認済み', color: '#27AE60' }, flagged: { label: '⚠ 要修正フラグ', color: '#E74C3C' },
};

const cardStyle: React.CSSProperties = { background: '#fff', borderRadius: 12, padding: 16, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' };

function subjectOf(draft: string): string {
  const line = draft.split('\n').find((l) => /^件名[：:]/.test(l.trim()));
  return line ? line.trim().replace(/^件名[：:]\s*/, '') : '（件名未設定）';
}

function findProfileFor(orgName: string, profiles: MunicipalityProfile[]): MunicipalityProfile | undefined {
  const core = coreRegionName(orgName);
  if (!core) return undefined;
  return profiles.find((p) => {
    const pCore = coreRegionName(p.region_name);
    return pCore && (core.includes(pCore) || pCore.includes(core));
  });
}

export default function IntegratedView({ authHeaders, onOpenMunicipality, onOpenLead }: {
  authHeaders: () => HeadersInit;
  onOpenMunicipality?: (id: string) => void;
  onOpenLead?: (leadId: string) => void;
}) {
  const [leads, setLeads] = useState<ClientLead[]>([]);
  const [records, setRecords] = useState<EnRecord[]>([]);
  const [profiles, setProfiles] = useState<MunicipalityProfile[]>([]);
  const [opps, setOpps] = useState<FundingOppLite[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [queueOnly, setQueueOnly] = useState(false);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [bulkAssignee, setBulkAssignee] = useState('');
  const [assigning, setAssigning] = useState(false);
  const [bulkVerifying, setBulkVerifying] = useState(false);
  const lastCheckedIndexRef = useRef<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [leadsRes, recordsRes, profilesRes, oppsRes, teamRes] = await Promise.all([
        fetch('/api/admin/client-leads', { headers: authHeaders() }).then((r) => r.json()),
        fetch('/api/admin/en-records', { headers: authHeaders() }).then((r) => r.json()).catch(() => ({ ok: false })),
        fetch('/api/admin/municipality-profiles', { headers: authHeaders() }).then((r) => r.json()).catch(() => ({ ok: false })),
        fetch('/api/admin/funding-opportunities', { headers: authHeaders() }).then((r) => r.json()).catch(() => ({ ok: false })),
        fetch('/api/admin/team-members', { headers: authHeaders() }).then((r) => r.json()).catch(() => ({ ok: false })),
      ]);
      if (leadsRes.ok) setLeads(leadsRes.leads ?? []);
      if (recordsRes.ok) setRecords(recordsRes.records ?? []);
      if (profilesRes.ok) setProfiles(profilesRes.profiles ?? []);
      if (oppsRes.ok) setOpps(oppsRes.opportunities ?? []);
      if (teamRes.ok) setTeamMembers((teamRes.members as TeamMember[]).filter((m) => m.is_active));
      if (!leadsRes.ok) setError(leadsRes.error ?? '台帳の取得に失敗しました');
    } catch {
      setError('通信エラー');
    } finally {
      setLoading(false);
    }
  }, [authHeaders]);

  useEffect(() => { load(); }, [load]);

  // ---------- 行の構築：学校・法人（client_leads）を軸に、名前が一致する自治体プロファイルを合流させる ----------
  const rows: Row[] = [];
  const leadCoreNames = new Set(leads.map((l) => coreRegionName(l.org_name)));
  for (const l of leads) {
    const leadRecords = records.filter((r) => r.lead_id === l.id);
    const en = computeEn(l, leadRecords);
    const matched = findProfileFor(l.org_name, profiles);
    const linkedOpps = matched ? opps.filter((o) => o.municipality_profile_id === matched.id) : [];
    const rfpActive = linkedOpps.some((o) => ['watching', 'preparing'].includes(o.status));
    const nearestDeadline = linkedOpps.filter((o) => ['watching', 'preparing'].includes(o.status)).map((o) => o.deadline).filter(Boolean).sort()[0] as string | undefined;

    const leadQueue = l.email_draft?.trim() && !l.sent && !l.email_sent_at;
    const profileQueue = !leadQueue && matched?.email_draft?.trim() && !matched.email_sent_at;
    let queue: QueueInfo | null = null;
    if (leadQueue) {
      queue = {
        source: 'lead', id: l.id, email: l.email, confidence: l.contact_email_confidence ?? null,
        sourceUrl: l.contact_email_source_url ?? null, factCheckStatus: l.fact_check_status ?? 'unverified',
        factCheckNote: l.fact_check_note ?? null, draft: l.email_draft!,
        sendPath: `/api/admin/client-leads/${l.id}/send`, patchPath: `/api/admin/client-leads/${l.id}`,
        assignedTo: l.assigned_to ?? null,
      };
    } else if (profileQueue && matched) {
      queue = {
        source: 'municipality', id: matched.id, email: matched.contact_email ?? null, confidence: matched.contact_email_confidence ?? null,
        sourceUrl: matched.contact_email_source_url ?? null, factCheckStatus: matched.fact_check_status ?? 'unverified',
        factCheckNote: matched.fact_check_note ?? null, draft: matched.email_draft!,
        sendPath: `/api/admin/municipality-profiles/${matched.id}/send`, patchPath: `/api/admin/municipality-profiles/${matched.id}`,
        assignedTo: matched.assigned_to ?? null,
      };
    }

    rows.push({
      key: `lead-${l.id}`, kind: 'lead', icon: l.client_type === 'school' ? '🏫' : '🏢', name: l.org_name,
      statusLabel: LEAD_STATUS_META[l.status]?.label ?? l.status, statusColor: LEAD_STATUS_META[l.status]?.color ?? '#999',
      scoreLabel: `縁 ${en.enLive}`, scoreColor: '#B7791F', scoreDetail: `${en.stage}・${en.freshnessLabel}`,
      reason: matched ? `${en.nextMove.how}（🏛 関係人口の提案余地：${matched.opportunity_level}）` : en.nextMove.how,
      queue, rfpActive, rfpDeadline: nearestDeadline ?? null, leadRecords,
    });
  }
  for (const p of profiles) {
    if (leadCoreNames.has(coreRegionName(p.region_name))) continue; // 既にclient_leads側の行に合流済み
    const linkedOpps = opps.filter((o) => o.municipality_profile_id === p.id);
    const activeOpps = linkedOpps.filter((o) => ['watching', 'preparing'].includes(o.status));
    const rfpActive = activeOpps.length > 0;
    const nearestDeadline = activeOpps.map((o) => o.deadline).filter(Boolean).sort()[0] as string | undefined;
    const queue: QueueInfo | null = p.email_draft?.trim() && !p.email_sent_at ? {
      source: 'municipality', id: p.id, email: p.contact_email ?? null, confidence: p.contact_email_confidence ?? null,
      sourceUrl: p.contact_email_source_url ?? null, factCheckStatus: p.fact_check_status ?? 'unverified',
      factCheckNote: p.fact_check_note ?? null, draft: p.email_draft!,
      sendPath: `/api/admin/municipality-profiles/${p.id}/send`, patchPath: `/api/admin/municipality-profiles/${p.id}`,
      assignedTo: p.assigned_to ?? null,
    } : null;
    const score = municipalityScore(p, linkedOpps);
    rows.push({
      key: `muni-${p.id}`, kind: 'municipality', icon: '🏛', name: p.region_name,
      statusLabel: `提案余地 ${p.opportunity_level}`, statusColor: OPPORTUNITY_COLORS[p.opportunity_level] ?? '#999',
      scoreLabel: `手動評価 ${score}`, scoreColor: '#B7791F', scoreDetail: p.engagement_stage,
      reason: p.fit_assessment?.trim() || p.opportunity_notes?.trim() || p.relation_population_initiative?.trim() || p.evidence_summary?.trim() || '詳細は「関係人口・自治体」で確認してください',
      queue, rfpActive, rfpDeadline: nearestDeadline ?? null, leadRecords: [],
    });
  }

  // 並び順：①送信可能（確度high/medium×事実確認済み）→②送信待ち（下書きあり）→③公募中→④スコア順
  function canSend(q: QueueInfo | null): boolean {
    return Boolean(q?.email) && (q?.confidence === 'high' || q?.confidence === 'medium') && q?.factCheckStatus === 'verified';
  }
  const sortedRows = [...rows].sort((a, b) => {
    const aSendable = canSend(a.queue) ? 0 : a.queue ? 1 : 2;
    const bSendable = canSend(b.queue) ? 0 : b.queue ? 1 : 2;
    if (aSendable !== bSendable) return aSendable - bSendable;
    if (a.rfpActive !== b.rfpActive) return a.rfpActive ? -1 : 1;
    return 0;
  });

  const filteredRows = sortedRows.filter((r) => {
    if (queueOnly && !r.queue) return false;
    if (search.trim() && !r.name.includes(search.trim())) return false;
    return true;
  });

  async function toggleFactCheck(row: Row, status: 'verified' | 'unverified') {
    if (!row.queue) return;
    setBusyKey(row.key);
    setError('');
    try {
      const res = await fetch(row.queue.patchPath, {
        method: 'PATCH', headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ fact_check_status: status, fact_checked_at: new Date().toISOString() }),
      });
      const data = await res.json();
      if (data.ok) await load(); else setError(data.error ?? '更新に失敗しました');
    } catch { setError('通信エラー'); } finally { setBusyKey(null); }
  }

  async function saveEmail(row: Row, rawValue: string) {
    if (!row.queue) return;
    const trimmed = rawValue.trim();
    if (trimmed === (row.queue.email ?? '')) return;
    setBusyKey(row.key);
    setError('');
    try {
      const field = row.queue.source === 'municipality' ? 'contact_email' : 'email';
      const body: Record<string, unknown> = { [field]: trimmed || null };
      if (trimmed) body.contact_email_confidence = 'high';
      const res = await fetch(row.queue.patchPath, {
        method: 'PATCH', headers: { ...authHeaders(), 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.ok) await load(); else setError(data.error ?? '宛先の更新に失敗しました');
    } catch { setError('通信エラー'); } finally { setBusyKey(null); }
  }

  async function send(row: Row) {
    if (!row.queue) return;
    if (!window.confirm(`${row.name} 様（${row.queue.email}）へ、このメールを送信します。取り消せません。よろしいですか？`)) return;
    setBusyKey(row.key);
    setError('');
    try {
      const res = await fetch(row.queue.sendPath, { method: 'POST', headers: authHeaders() });
      const data = await res.json();
      if (data.ok) await load(); else setError(data.error ?? '送信に失敗しました');
    } catch { setError('通信エラー'); } finally { setBusyKey(null); }
  }

  function toggleChecked(key: string, index: number, rangeKeys: string[], shiftKey: boolean) {
    const previousIndex = lastCheckedIndexRef.current;
    lastCheckedIndexRef.current = index;
    setChecked((prev) => {
      const next = new Set(prev);
      if (shiftKey && previousIndex !== null) {
        const [from, to] = [previousIndex, index].sort((a, b) => a - b);
        for (let i = from; i <= to; i++) next.add(rangeKeys[i]);
      } else if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

  async function bulkVerify() {
    if (checked.size === 0) return;
    setBulkVerifying(true);
    setError('');
    try {
      const targets = filteredRows.filter((r) => r.queue && checked.has(r.key));
      const results = await Promise.all(targets.map((r) =>
        fetch(r.queue!.patchPath, {
          method: 'PATCH', headers: { ...authHeaders(), 'Content-Type': 'application/json' },
          body: JSON.stringify({ fact_check_status: 'verified', fact_checked_at: new Date().toISOString() }),
        }).then((res) => res.json()).catch(() => ({ ok: false }))
      ));
      const failed = results.filter((r) => !r.ok).length;
      if (failed > 0) setError(`${failed}件の事実確認済み反映に失敗しました`);
      setChecked(new Set());
      await load();
    } finally { setBulkVerifying(false); }
  }

  async function bulkAssign() {
    if (checked.size === 0) return;
    setAssigning(true);
    setError('');
    try {
      const targets = filteredRows.filter((r) => r.queue && checked.has(r.key));
      const results = await Promise.all(targets.map((r) =>
        fetch(r.queue!.patchPath, {
          method: 'PATCH', headers: { ...authHeaders(), 'Content-Type': 'application/json' },
          body: JSON.stringify({ assigned_to: bulkAssignee || null }),
        }).then((res) => res.json()).catch(() => ({ ok: false }))
      ));
      const failed = results.filter((r) => !r.ok).length;
      if (failed > 0) setError(`${failed}件の割り当てに失敗しました`);
      setChecked(new Set());
      await load();
    } finally { setAssigning(false); }
  }

  if (loading) return <p style={{ fontSize: 13, color: '#999' }}>読み込み中…</p>;

  const rangeKeys = filteredRows.map((r) => r.key);
  const sendableCount = rows.filter((r) => canSend(r.queue)).length;

  return (
    <div>
      <div style={{ ...cardStyle, marginBottom: 12 }}>
        <p style={{ margin: 0, fontSize: 14, fontWeight: 800 }}>🧾 統合ビュー — 送信キュー × 関係人口 × 自治体台帳</p>
        <p style={{ margin: '6px 0 0', fontSize: 11, color: '#999', lineHeight: 1.7 }}>
          相手ごとに1行で、台帳の状況・縁（または自治体の手動評価）・送信ドラフトの確度と事実確認をまとめて表示します。
          事実確認と送信はこの画面から完結できます（AIが自動で送ることはありません）。
          学校・法人（client_leads）を軸に、名前が一致する自治体プロファイルの情報を合流させています。一致しない自治体プロファイルは単独行として表示します。
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 10, alignItems: 'center' }}>
          <input
            value={search} onChange={(e) => setSearch(e.target.value)} placeholder="団体名で絞り込み"
            style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #ddd', fontSize: 12, minWidth: 180 }}
          />
          <label style={{ fontSize: 12, color: '#666', display: 'flex', alignItems: 'center', gap: 4 }}>
            <input type="checkbox" checked={queueOnly} onChange={(e) => setQueueOnly(e.target.checked)} />
            送信ドラフトがある相手のみ
          </label>
          <span style={{ fontSize: 11, color: '#27AE60', fontWeight: 700 }}>送信可能：{sendableCount}件</span>
          <span style={{ fontSize: 11, color: '#999' }}>全{rows.length}件中{filteredRows.length}件表示</span>
        </div>
      </div>

      {error && <p style={{ color: '#E74C3C', fontSize: 12, margin: '0 0 10px' }}>{error}</p>}

      {checked.size > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10, marginBottom: 10, padding: '8px 10px', background: '#F8F6FB', borderRadius: 8 }}>
          <span style={{ fontSize: 11.5, color: '#8E44AD', fontWeight: 700 }}>{checked.size}件を選択中 →</span>
          <button onClick={bulkVerify} disabled={bulkVerifying} style={{
            padding: '4px 12px', borderRadius: 8, border: '1px solid #27AE60', background: '#fff', color: '#27AE60',
            fontWeight: 700, fontSize: 11.5, cursor: bulkVerifying ? 'wait' : 'pointer',
          }}>{bulkVerifying ? '反映中…' : 'まとめて事実確認済みにする'}</button>
          {teamMembers.length > 0 && (
            <>
              <select value={bulkAssignee} onChange={(e) => setBulkAssignee(e.target.value)} style={{ fontSize: 12, padding: '3px 6px', borderRadius: 6, border: '1px solid #ddd' }}>
                <option value="">未割当にする</option>
                {teamMembers.map((m) => <option key={m.id} value={m.name}>{m.name}</option>)}
              </select>
              <button onClick={bulkAssign} disabled={assigning} style={{
                padding: '4px 12px', borderRadius: 8, border: 'none', background: '#8E44AD', color: '#fff',
                fontWeight: 700, fontSize: 11.5, cursor: assigning ? 'wait' : 'pointer',
              }}>{assigning ? '割り当て中…' : 'この範囲を割り当てる'}</button>
            </>
          )}
          <button onClick={() => setChecked(new Set())} style={{
            padding: '4px 10px', borderRadius: 8, border: '1px solid #ddd', background: '#fff', color: '#999', fontSize: 11.5, cursor: 'pointer',
          }}>選択解除</button>
        </div>
      )}

      {filteredRows.length === 0 ? (
        <div style={cardStyle}><p style={{ margin: 0, fontSize: 13, color: '#999' }}>該当する相手がいません。</p></div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filteredRows.map((row, idx) => {
            const expanded = expandedKey === row.key;
            const isChecked = row.queue ? checked.has(row.key) : false;
            const badge = row.queue?.confidence ? CONFIDENCE_BADGE[row.queue.confidence] : null;
            const factBadge = row.queue && (row.queue.factCheckStatus === 'verified' || row.queue.factCheckStatus === 'flagged')
              ? FACT_CHECK_BADGE[row.queue.factCheckStatus] : null;
            const sendable = canSend(row.queue);
            return (
              <div key={row.key} style={{ ...cardStyle, padding: '12px 14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', gap: 8, minWidth: 0, flex: 1 }}>
                    {row.queue && (
                      <input
                        type="checkbox" checked={isChecked}
                        onClick={(e) => toggleChecked(row.key, idx, rangeKeys, e.shiftKey)}
                        onChange={() => {}} title="shiftを押しながらクリックで範囲選択"
                        style={{ marginTop: 3, flexShrink: 0 }}
                      />
                    )}
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <p style={{ margin: 0, fontSize: 13.5, fontWeight: 800, color: '#333' }}>
                        {row.icon} {row.name}
                        <span style={{ marginLeft: 8, padding: '1px 8px', borderRadius: 10, fontSize: 10, fontWeight: 700, background: row.statusColor + '18', color: row.statusColor }}>
                          {row.statusLabel}
                        </span>
                        <span style={{ marginLeft: 6, padding: '1px 8px', borderRadius: 10, fontSize: 10, fontWeight: 700, background: row.scoreColor + '18', color: row.scoreColor }}>
                          {row.scoreLabel}
                        </span>
                        {row.rfpActive && (
                          <span style={{ marginLeft: 6, fontSize: 10, fontWeight: 800, color: '#fff', background: '#E55039', padding: '1px 8px', borderRadius: 10 }}>
                            🔥 公募中{row.rfpDeadline && `・締切${row.rfpDeadline}`}
                          </span>
                        )}
                      </p>
                      <p style={{ margin: '3px 0 0', fontSize: 11, color: '#999' }}>{row.scoreDetail} ・ {row.reason}</p>

                      {row.queue ? (
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 6, flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 11, color: '#38ADA9', fontWeight: 700 }}>📤 {subjectOf(row.queue.draft)}</span>
                          <input
                            key={`email-${row.key}-${row.queue.email ?? ''}`} defaultValue={row.queue.email ?? ''}
                            placeholder="宛先を確認して入力" onBlur={(e) => saveEmail(row, e.target.value)}
                            style={{
                              fontSize: 11.5, color: '#555', minWidth: 190, padding: '2px 6px', borderRadius: 6,
                              border: row.queue.email ? '1px solid transparent' : '1px solid #E5A139',
                              background: row.queue.email ? 'transparent' : '#FFFBEF',
                            }}
                          />
                          {badge && <span style={{ fontSize: 10.5, fontWeight: 700, color: badge.color }}>{badge.label}</span>}
                          {factBadge ? (
                            <span style={{ fontSize: 10.5, fontWeight: 700, color: factBadge.color }}>{factBadge.label}</span>
                          ) : (
                            <span style={{ fontSize: 10.5, fontWeight: 700, color: '#999' }}>○ 事実確認: 未実施</span>
                          )}
                          {row.queue.assignedTo && (
                            <span style={{ fontSize: 10.5, fontWeight: 700, color: '#8E44AD', background: '#F3E9FA', padding: '1px 7px', borderRadius: 20 }}>👤 {row.queue.assignedTo}</span>
                          )}
                          {row.queue.sourceUrl && (
                            <a href={row.queue.sourceUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: 10.5, color: '#38ADA9' }}>出典 ↗</a>
                          )}
                          {row.queue.factCheckNote && (
                            <span style={{ fontSize: 11, color: '#E5A139' }}>{row.queue.factCheckNote}</span>
                          )}
                        </div>
                      ) : (
                        <p style={{ margin: '6px 0 0', fontSize: 11, color: '#bbb' }}>送信ドラフトはまだありません。</p>
                      )}
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0 }}>
                    {(row.leadRecords.length > 0 || (row.queue && row.queue.draft)) && (
                      <button onClick={() => setExpandedKey(expanded ? null : row.key)} style={{
                        padding: '4px 10px', borderRadius: 8, border: '1px solid #ddd', background: '#fff', color: '#666', fontSize: 11, cursor: 'pointer',
                      }}>{expanded ? '閉じる' : '詳細を見る'}</button>
                    )}
                    {row.kind === 'lead' && onOpenLead && (
                      <button onClick={() => onOpenLead(row.key.replace('lead-', ''))} style={{
                        padding: '4px 10px', borderRadius: 8, border: '1px solid #38ADA9', background: '#fff', color: '#38ADA9', fontSize: 11, cursor: 'pointer',
                      }}>営業台帳で見る</button>
                    )}
                    {row.kind === 'municipality' && onOpenMunicipality && (
                      <button onClick={() => onOpenMunicipality(row.key.replace('muni-', ''))} style={{
                        padding: '4px 10px', borderRadius: 8, border: '1px solid #8E44AD', background: '#fff', color: '#8E44AD', fontSize: 11, cursor: 'pointer',
                      }}>自治体台帳で見る</button>
                    )}
                    {row.queue && (
                      <>
                        {row.queue.factCheckStatus === 'verified' ? (
                          <button onClick={() => toggleFactCheck(row, 'unverified')} disabled={busyKey === row.key} style={{
                            padding: '4px 10px', borderRadius: 8, border: '1px solid #ddd', background: '#fff', color: '#999', fontSize: 11, cursor: 'pointer',
                          }}>未確認に戻す</button>
                        ) : (
                          <button onClick={() => toggleFactCheck(row, 'verified')} disabled={busyKey === row.key} style={{
                            padding: '4px 10px', borderRadius: 8, border: '1px solid #27AE60', background: '#fff', color: '#27AE60', fontWeight: 700, fontSize: 11, cursor: 'pointer',
                          }}>事実確認済みにする</button>
                        )}
                        <button onClick={() => send(row)} disabled={!sendable || busyKey === row.key} style={{
                          padding: '6px 14px', borderRadius: 8, border: 'none',
                          background: sendable ? '#38ADA9' : '#ccc', color: '#fff', fontWeight: 700, fontSize: 12,
                          cursor: sendable && busyKey !== row.key ? 'pointer' : 'not-allowed',
                        }}>{busyKey === row.key ? '送信中…' : '送信'}</button>
                      </>
                    )}
                  </div>
                </div>

                {expanded && (
                  <div style={{ marginTop: 10, borderTop: '1px solid #f0f0f0', paddingTop: 10 }}>
                    {row.queue && (
                      <pre style={{
                        padding: 10, background: '#F4F6F5', borderRadius: 8, fontSize: 12, lineHeight: 1.8,
                        whiteSpace: 'pre-wrap', fontFamily: 'inherit', color: '#333', margin: '0 0 8px',
                      }}>{row.queue.draft}</pre>
                    )}
                    {row.leadRecords.length > 0 && (
                      <div>
                        <p style={{ margin: '0 0 6px', fontSize: 11, fontWeight: 700, color: '#666' }}>🧭 縁の履歴（{row.leadRecords.length}本）</p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          {row.leadRecords.slice(-8).reverse().map((r) => {
                            const meta = EN_KINDS[r.kind as EnKind];
                            return (
                              <div key={r.id} style={{ display: 'flex', alignItems: 'baseline', gap: 8, fontSize: 12 }}>
                                <span style={{ color: meta.color, fontWeight: 700, flexShrink: 0 }}>{meta.icon} {meta.label}</span>
                                <span style={{ color: '#444', flex: 1 }}>{r.note}</span>
                                <span style={{ color: '#bbb', fontSize: 10, flexShrink: 0 }}>{r.happened_at}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
