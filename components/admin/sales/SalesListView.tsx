'use client';

// 🧾 営業台帳 — 学校・法人（client_leads）と自治体（municipality_profiles）を1本のリストに統合する。
// 以前はClientLeadsTab／RelationPopulationTabの2タブに分かれていたが、分ける必要性が分からず
// 画面がごちゃごちゃするという指摘を受け、salesEntry.tsで正規化した1つのSalesEntry[]として表示する。
import { useCallback, useEffect, useMemo, useState } from 'react';
import { promoteToCase } from '@/lib/promoteToCase';
import {
  buildSalesEntries,
  type ClientLead, type MunicipalityProfile, type FundingOpp, type SalesEntry,
} from '@/components/admin/sales/salesEntry';
import SalesEntryCard, { type MunicipalityExtras } from '@/components/admin/sales/SalesEntryCard';
import AssigneeBulkBar, { type TeamMemberLite } from '@/components/admin/sales/AssigneeBulkBar';
import type { FactCheckFlag } from '@/components/admin/sales/FactCheckWatchBadge';

const inputStyle: React.CSSProperties = {
  padding: '9px 12px', borderRadius: 8, border: '1.5px solid #ddd',
  fontSize: 13, outline: 'none', fontFamily: 'inherit',
};

interface BusinessCaseLite { id: string; lead_ref?: string | null; municipality_profile_id?: string | null }

export default function SalesListView({ authHeaders, focusMunicipalityId, onFocusMunicipalityHandled }: {
  authHeaders: () => HeadersInit;
  focusMunicipalityId?: string | null;
  onFocusMunicipalityHandled?: () => void;
}) {
  const [leads, setLeads] = useState<ClientLead[]>([]);
  const [profiles, setProfiles] = useState<MunicipalityProfile[]>([]);
  const [opps, setOpps] = useState<FundingOpp[]>([]);
  const [cases, setCases] = useState<BusinessCaseLite[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMemberLite[]>([]);
  const [factCheckFlags, setFactCheckFlags] = useState<FactCheckFlag[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [kindFilter, setKindFilter] = useState<'all' | 'lead' | 'municipality'>('all');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [topN, setTopN] = useState(10);
  const [caseBusyId, setCaseBusyId] = useState<string | null>(null);
  const [sendBusy, setSendBusy] = useState<Record<string, boolean>>({});
  const [sendError, setSendError] = useState<Record<string, string>>({});
  const [dashboardUrls, setDashboardUrls] = useState<Record<string, string>>({});
  const [dashboardBusy, setDashboardBusy] = useState<Record<string, boolean>>({});
  const [dashboardError, setDashboardError] = useState<Record<string, string>>({});
  const [popStatsLoading, setPopStatsLoading] = useState<Record<string, boolean>>({});
  const [popStatsError, setPopStatsError] = useState<Record<string, string>>({});

  function jsonHeaders(): HeadersInit { return { ...authHeaders(), 'Content-Type': 'application/json' }; }
  function adminPassword(): string { return (authHeaders() as Record<string, string>)['x-admin-password'] ?? ''; }

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [leadsRes, profilesRes, oppsRes, casesRes, membersRes, flagsRes] = await Promise.all([
        fetch('/api/admin/client-leads', { headers: authHeaders() }),
        fetch('/api/admin/municipality-profiles', { headers: authHeaders() }),
        fetch('/api/admin/funding-opportunities', { headers: authHeaders() }),
        fetch('/api/admin/business-cases', { headers: authHeaders() }),
        fetch('/api/admin/team-members', { headers: authHeaders() }),
        fetch('/api/admin/fact-check-watch', { headers: authHeaders() }),
      ]);
      const [leadsData, profilesData, oppsData, casesData, membersData, flagsData] = await Promise.all([
        leadsRes.json().catch(() => ({ ok: false })),
        profilesRes.json().catch(() => ({ ok: false })),
        oppsRes.json().catch(() => ({ ok: false })),
        casesRes.json().catch(() => ({ ok: false })),
        membersRes.json().catch(() => ({ ok: false })),
        flagsRes.json().catch(() => ({ ok: false })),
      ]);
      if (leadsData.ok) setLeads(leadsData.leads ?? []); else setError(leadsData.error ?? '学校・法人の取得に失敗しました');
      if (profilesData.ok) setProfiles(profilesData.profiles ?? []);
      if (oppsData.ok) setOpps(oppsData.opportunities ?? []);
      if (casesData.ok) setCases(casesData.cases ?? []);
      if (membersData.ok) setTeamMembers(membersData.members ?? []);
      if (flagsData.ok) setFactCheckFlags(flagsData.flags ?? []);
    } catch {
      setError('通信エラー');
    } finally {
      setLoading(false);
    }
  }, [authHeaders]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!focusMunicipalityId) return;
    setKindFilter('all');
    setSearchQuery('');
    onFocusMunicipalityHandled?.();
  }, [focusMunicipalityId, onFocusMunicipalityHandled]);

  async function patchLead(id: string, patch: Record<string, unknown>) {
    const res = await fetch(`/api/admin/client-leads/${id}`, { method: 'PATCH', headers: jsonHeaders(), body: JSON.stringify(patch) });
    const data = await res.json().catch(() => ({ ok: false }));
    if (data.ok) load(); else setError(data.error ?? '更新に失敗しました');
  }
  async function patchMunicipality(id: string, patch: Record<string, unknown>) {
    const res = await fetch(`/api/admin/municipality-profiles/${id}`, { method: 'PATCH', headers: jsonHeaders(), body: JSON.stringify(patch) });
    const data = await res.json().catch(() => ({ ok: false }));
    if (data.ok) load(); else setError(data.error ?? '更新に失敗しました');
  }
  function patchFor(entry: SalesEntry) {
    return (patch: Record<string, unknown>) => (entry.kind === 'lead' ? patchLead(entry.id, patch) : patchMunicipality(entry.id, patch));
  }

  // 送信済み・未送信を混在させると「もう送った相手にまた声をかけてしまう」事故につながるため
  // （会長からの指摘、2026-07-24）、ここで明確に2本のリストへ分ける。未送信を常に上に出し、
  // 送信済みは折りたたんで目立たなくする（SalesTab.tsxのledgerビューと同じ考え方）。
  const [showSentSection, setShowSentSection] = useState(false);
  const entries = useMemo(() => buildSalesEntries(leads, profiles, opps), [leads, profiles, opps]);
  const visibleEntries = useMemo(() => {
    let list = entries;
    if (kindFilter !== 'all') list = list.filter(e => e.kind === kindFilter);
    if (searchQuery.trim()) list = list.filter(e => e.name.includes(searchQuery.trim()));
    return list;
  }, [entries, kindFilter, searchQuery]);
  const unsentEntries = useMemo(() => visibleEntries.filter(e => !e.emailSentAt), [visibleEntries]);
  const sentEntries = useMemo(() => visibleEntries.filter(e => e.emailSentAt), [visibleEntries]);

  function toggleSelect(key: string) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }
  function selectTopN() {
    setSelected(new Set(visibleEntries.slice(0, topN).map(e => e.compositeKey)));
  }

  async function applyBulkAssign(assignedTo: string | null) {
    const items = Array.from(selected).map(key => {
      const entry = entries.find(e => e.compositeKey === key)!;
      return { kind: entry.kind, id: entry.id };
    });
    const res = await fetch('/api/admin/sales-entries/bulk-assign', {
      method: 'PATCH', headers: jsonHeaders(), body: JSON.stringify({ items, assignedTo }),
    });
    const data = await res.json().catch(() => ({ ok: false }));
    if (data.ok) { setSelected(new Set()); load(); } else setError(data.error ?? '一括割り当てに失敗しました');
  }

  async function caseify(entry: SalesEntry) {
    setCaseBusyId(entry.compositeKey);
    const result = await promoteToCase({
      orgName: entry.name,
      clientType: entry.kind === 'lead' ? 'business' : 'municipality',
      leadRef: entry.kind === 'lead' ? entry.id : undefined,
      municipalityProfileId: entry.kind === 'municipality' ? entry.id : undefined,
      evidence: entry.kind === 'lead' ? entry.lead?.memo : entry.evidenceSummary,
    }, cases, adminPassword());
    setCaseBusyId(null);
    if (!result.ok) { setError(result.error ?? '案件化に失敗しました'); return; }
    const res = await fetch('/api/admin/business-cases', { headers: authHeaders() });
    const data = await res.json().catch(() => ({ ok: false }));
    if (data.ok) setCases(data.cases ?? []);
  }

  async function sendEmail(entry: SalesEntry) {
    if (!window.confirm(`${entry.name} 様（${entry.email}）へ、このメールを送信します。取り消せません。よろしいですか？`)) return;
    setSendBusy(prev => ({ ...prev, [entry.compositeKey]: true }));
    setSendError(prev => ({ ...prev, [entry.compositeKey]: '' }));
    try {
      const path = entry.kind === 'lead' ? `/api/admin/client-leads/${entry.id}/send` : `/api/admin/municipality-profiles/${entry.id}/send`;
      const res = await fetch(path, { method: 'POST', headers: authHeaders() });
      const data = await res.json();
      if (data.ok) load(); else setSendError(prev => ({ ...prev, [entry.compositeKey]: data.error ?? '送信に失敗しました' }));
    } catch {
      setSendError(prev => ({ ...prev, [entry.compositeKey]: '通信エラー' }));
    } finally {
      setSendBusy(prev => ({ ...prev, [entry.compositeKey]: false }));
    }
  }

  async function issueDashboardUrl(entry: SalesEntry) {
    if (entry.kind !== 'lead') return;
    setDashboardBusy(prev => ({ ...prev, [entry.compositeKey]: true }));
    setDashboardError(prev => ({ ...prev, [entry.compositeKey]: '' }));
    try {
      const res = await fetch(`/api/admin/client-leads/${entry.id}/dashboard-token`, {
        method: 'POST', headers: jsonHeaders(), body: JSON.stringify({ region: entry.name }),
      });
      const data = await res.json();
      if (data.ok) setDashboardUrls(prev => ({ ...prev, [entry.compositeKey]: data.url }));
      else setDashboardError(prev => ({ ...prev, [entry.compositeKey]: data.error ?? '発行に失敗しました' }));
    } catch {
      setDashboardError(prev => ({ ...prev, [entry.compositeKey]: '通信エラー' }));
    } finally {
      setDashboardBusy(prev => ({ ...prev, [entry.compositeKey]: false }));
    }
  }

  async function fetchPopulationStats(entry: SalesEntry) {
    if (entry.kind !== 'municipality') return;
    setPopStatsLoading(prev => ({ ...prev, [entry.compositeKey]: true }));
    setPopStatsError(prev => ({ ...prev, [entry.compositeKey]: '' }));
    try {
      const res = await fetch(`/api/admin/municipality-profiles/${entry.id}/population-stats`, { method: 'POST', headers: authHeaders() });
      const data = await res.json();
      if (!data.ok) { setPopStatsError(prev => ({ ...prev, [entry.compositeKey]: data.error ?? '取得に失敗しました' })); return; }
      load();
    } catch {
      setPopStatsError(prev => ({ ...prev, [entry.compositeKey]: '通信エラー' }));
    } finally {
      setPopStatsLoading(prev => ({ ...prev, [entry.compositeKey]: false }));
    }
  }

  async function registerRfp(entry: SalesEntry, title: string, deadline: string) {
    if (!title.trim()) return;
    await fetch('/api/admin/funding-opportunities', {
      method: 'POST', headers: jsonHeaders(),
      body: JSON.stringify({
        title: title.trim(), organizer: entry.name, opp_type: 'municipal_support',
        region: entry.name, deadline: deadline || null, status: 'watching',
        municipality_profile_id: entry.id,
      }),
    });
    const res = await fetch('/api/admin/funding-opportunities', { headers: authHeaders() });
    const data = await res.json().catch(() => ({ ok: false }));
    if (data.ok) setOpps(data.opportunities ?? []);
  }

  const counts = {
    all: entries.length,
    lead: entries.filter(e => e.kind === 'lead').length,
    municipality: entries.filter(e => e.kind === 'municipality').length,
  };

  function renderCard(entry: SalesEntry) {
    const linkedCase = cases.find(c => (entry.kind === 'lead' ? c.lead_ref === entry.id : c.municipality_profile_id === entry.id));
    const flags = factCheckFlags.filter(f => f.profile_id === entry.id && f.kind === entry.kind);
    const municipality: MunicipalityExtras | undefined = entry.kind === 'municipality' && entry.municipality ? {
      smoutSentAt: entry.municipality.smout_sent_at,
      smoutReply: entry.municipality.smout_reply,
      onHold: entry.municipality.on_hold,
      isPriorityPick: entry.municipality.is_priority_pick,
      municipalityCode: entry.municipality.municipality_code ?? null,
      populationStats: entry.municipality.population_stats ?? null,
      populationStatsFetchedAt: entry.municipality.population_stats_fetched_at ?? null,
      followedUpAt: entry.municipality.followed_up_at,
      linkedOpps: opps.filter(o => o.municipality_profile_id === entry.id),
      popStatsLoading: Boolean(popStatsLoading[entry.compositeKey]),
      popStatsError: popStatsError[entry.compositeKey],
      onMarkSmoutSent: () => patchMunicipality(entry.id, { smout_sent_at: new Date().toISOString() }),
      onUnmarkSmoutSent: () => patchMunicipality(entry.id, { smout_sent_at: null }),
      onSaveSmoutReply: v => { if (v !== (entry.municipality?.smout_reply ?? '')) patchMunicipality(entry.id, { smout_reply: v || null }); },
      onToggleOnHold: () => patchMunicipality(entry.id, { on_hold: !entry.municipality?.on_hold }),
      onTogglePriorityPick: () => patchMunicipality(entry.id, { is_priority_pick: !entry.municipality?.is_priority_pick }),
      onSaveMunicipalityCode: v => patchMunicipality(entry.id, { municipality_code: v || null }),
      onFetchPopulationStats: () => fetchPopulationStats(entry),
      onMarkFollowedUp: () => patchMunicipality(entry.id, { followed_up_at: new Date().toISOString() }),
      onRegisterRfp: (title, deadline) => registerRfp(entry, title, deadline),
    } : undefined;

    return (
      <SalesEntryCard
        key={entry.compositeKey}
        entry={entry}
        selected={selected.has(entry.compositeKey)}
        onToggleSelect={() => toggleSelect(entry.compositeKey)}
        factCheckFlags={flags}
        isCaseified={Boolean(linkedCase)}
        caseId={linkedCase?.id}
        caseBusy={caseBusyId === entry.compositeKey}
        onSetStatus={status => patchFor(entry)(entry.kind === 'lead' ? { status } : { engagement_stage: status })}
        onSetOpportunityLevel={level => patchMunicipality(entry.id, { opportunity_level: level })}
        onSaveMemo={v => patchFor(entry)(entry.kind === 'lead' ? { memo: v || null } : { evidence_summary: v || null })}
        onSaveEvidence={v => patchMunicipality(entry.id, { fit_assessment: v || null })}
        onSaveSourceLinks={v => patchFor(entry)({ source_links: v || null })}
        onSaveEmail={v => {
          const trimmed = v.trim();
          if (trimmed === (entry.email ?? '')) return;
          const body: Record<string, unknown> = entry.kind === 'lead' ? { email: trimmed || null } : { contact_email: trimmed || null };
          if (trimmed) body.contact_email_confidence = 'high';
          patchFor(entry)(body);
        }}
        onSaveDraft={v => { if (v !== (entry.emailDraft ?? '')) patchFor(entry)({ email_draft: v || null }); }}
        onToggleFactCheck={status => patchFor(entry)({ fact_check_status: status, fact_checked_at: new Date().toISOString() })}
        onSend={() => sendEmail(entry)}
        sendBusy={Boolean(sendBusy[entry.compositeKey])}
        sendError={sendError[entry.compositeKey]}
        onCaseify={() => caseify(entry)}
        onIssueDashboardUrl={entry.kind === 'lead' ? () => issueDashboardUrl(entry) : undefined}
        dashboardUrl={dashboardUrls[entry.compositeKey]}
        dashboardBusy={Boolean(dashboardBusy[entry.compositeKey])}
        dashboardError={dashboardError[entry.compositeKey]}
        municipality={municipality}
      />
    );
  }

  return (
    <div>
      <div style={{ background: '#fff', borderRadius: 12, padding: '12px 16px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', marginBottom: 16 }}>
        <p style={{ margin: 0, fontWeight: 800, fontSize: 14 }}>🧾 営業台帳</p>
        <p style={{ margin: '4px 0 0', fontSize: 11.5, color: '#999', lineHeight: 1.7 }}>
          学校・法人と自治体を1本のリストにまとめました。スコア順に並び、証拠パック・出典URL・事実確認・送信までここで完結します（送信は必ずボタンを押した時だけ・AIが自動で送ることはありません）。
        </p>
      </div>

      {error && <p style={{ color: '#E74C3C', fontSize: 13, marginBottom: 10 }}>{error}</p>}

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 10 }}>
        <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="団体名で絞り込み" style={{ ...inputStyle, maxWidth: 200 }} />
        {([['all', `すべて（${counts.all}）`], ['lead', `🎓 学校・法人（${counts.lead}）`], ['municipality', `🏛 自治体（${counts.municipality}）`]] as [typeof kindFilter, string][]).map(([id, label]) => (
          <button key={id} onClick={() => setKindFilter(id)} style={{
            padding: '7px 14px', borderRadius: 16, border: 'none', cursor: 'pointer',
            background: kindFilter === id ? '#38ADA9' : '#fff', color: kindFilter === id ? '#fff' : '#666',
            fontWeight: 700, fontSize: 12, boxShadow: kindFilter === id ? 'none' : '0 1px 3px rgba(0,0,0,0.08)',
          }}>{label}</button>
        ))}
        <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
          <input type="number" min={1} value={topN} onChange={e => setTopN(Number(e.target.value) || 1)} style={{ ...inputStyle, width: 56 }} />
          <button onClick={selectTopN} style={{
            padding: '7px 12px', borderRadius: 14, border: '1px solid #38ADA9', background: '#fff',
            color: '#38ADA9', fontSize: 11.5, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap',
          }}>上位{topN}件を選択</button>
        </span>
      </div>

      <AssigneeBulkBar
        selectedCount={selected.size}
        teamMembers={teamMembers}
        onApply={applyBulkAssign}
        onClear={() => setSelected(new Set())}
      />

      {loading ? <p style={{ color: '#999' }}>読み込み中…</p> : (
        <>
          {visibleEntries.length === 0 && <p style={{ color: '#aaa' }}>該当する営業先がありません。</p>}

          {/* 未送信を常に上・目立つ位置に出す。ここに無い＝まだ一度も送っていない、を一目で分かるようにする。 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {unsentEntries.map(entry => renderCard(entry))}
          </div>

          {/* 送信済みは折りたたみ、開いても薄い表示にして「もう送った」ことが誤操作を誘わないようにする
              （会長からの二重送信防止の指摘、2026-07-24。SalesTab.tsxのledgerビューと同じ設計）。 */}
          {sentEntries.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <button onClick={() => setShowSentSection(v => !v)} style={{
                width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '10px 14px', borderRadius: 10, border: '1px solid #ddd', background: '#fafafa',
                cursor: 'pointer', fontFamily: 'inherit',
              }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: '#666' }}>✓ 送信済み・対応中（{sentEntries.length}件）</span>
                <span style={{ fontSize: 11, color: '#999' }}>{showSentSection ? '▲ 閉じる' : '▼ 開く'}</span>
              </button>
              {showSentSection && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 10, opacity: 0.75 }}>
                  {sentEntries.map(entry => renderCard(entry))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
