'use client';

// 関係人口ダッシュボード：agents/relation_population.py（AIエージェント63）と同じ考え方を
// サイト本体からライブに見る画面。データは /api/admin/relation-population（lib/relationPopulation.ts）。
// 複数の実験回に関わった人＝関係人口の芽、また来たいと答えた人＝関係の温度。
// 個人を特定できる値は一切表示せず、少人数（5人未満）の地域は非表示にする。
import { useEffect, useMemo, useState } from 'react';
import { computeFollowUp } from '@/lib/followUp';
import { smoutSearchUrl } from '@/lib/smout';
import { rfpBonus } from '@/lib/salesScore';
import { promoteToCase } from '@/lib/promoteToCase';
import { CONFIDENCE_BADGE, FACT_CHECK_BADGE, canSendDraft, type Confidence, type FactCheckStatus } from '@/components/admin/sales/factCheckUi';

interface RelationStats {
  totalContributors: number;
  repeatContributors: number;
  repeatRate: number;
  wantRevisitPeople: number;
  wantRevisitRate: number;
}

interface OverallResult {
  ok: boolean;
  generatedAt?: string;
  overall?: RelationStats;
  topRegions?: ({ region: string; suppressed: true } | ({ region: string; suppressed: false } & RelationStats))[];
  error?: string;
}

interface RegionResult {
  ok: boolean;
  region: string;
  suppressed: boolean;
  stats?: RelationStats;
  error?: string;
}

interface MunicipalityProfile {
  id: string;
  region_name: string;
  engagement_stage: string;
  evidence_summary: string | null;
  relation_population_initiative: string | null;
  fit_assessment: string | null;
  opportunity_level: string;
  opportunity_notes: string | null;
  source_links: string | null;
  contact_email: string | null;
  email_draft: string | null;
  email_sent_at: string | null;
  email_sent_content: string | null;
  email_reply: string | null;
  followed_up_at: string | null;
  smout_sent_at: string | null;
  smout_reply: string | null;
  on_hold: boolean;
  is_priority_pick: boolean;
  contact_email_confidence?: Confidence;
  contact_email_source_url?: string | null;
  fact_check_status?: FactCheckStatus;
  fact_check_note?: string | null;
  fact_checked_at?: string | null;
  assigned_to?: string | null;
  scheduling_request_detected_at?: string | null;
  municipality_code?: string | null;
  population_stats?: { dayNightRatio?: number; statsYear?: string; statsDataId?: string; fetchedAt?: string } | null;
  population_stats_fetched_at?: string | null;
  origin_note?: string | null;
  updated_at: string;
}

interface FundingOpp {
  id: string;
  title: string;
  status: string;
  deadline: string | null;
  url: string | null;
  municipality_profile_id: string | null;
}

interface BusinessCaseLite {
  id: string;
  lead_ref?: string | null;
  municipality_profile_id?: string | null;
}

const ENGAGEMENT_STAGES = [
  { key: 'observing', label: '観察' },
  { key: 'lead', label: 'リード' },
  { key: 'proposed', label: '提案中' },
  { key: 'contracted', label: '契約済み' },
];
const OPPORTUNITY_LEVELS = ['高', '中', '低'];
const OPPORTUNITY_RANK: Record<string, number> = { 高: 0, 中: 1, 低: 2 };
const OPPORTUNITY_COLORS: Record<string, string> = { 高: '#27AE60', 中: '#E5A139', 低: '#999' };

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ background: '#fff', borderRadius: 12, padding: 16, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', ...style }}>
      {children}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  padding: '9px 12px', borderRadius: 8, border: '1.5px solid #ddd',
  fontSize: 13, outline: 'none', fontFamily: 'inherit', flex: 1,
};
const labelStyle: React.CSSProperties = { fontSize: 12, fontWeight: 700, color: '#555', margin: '10px 0 4px', display: 'block' };
const pillStyle = (active: boolean, color = '#38ADA9'): React.CSSProperties => ({
  padding: '5px 12px', borderRadius: 999, fontSize: 11.5, fontWeight: 700, cursor: 'pointer',
  border: active ? 'none' : '1px solid #ccc', background: active ? color : 'transparent', color: active ? '#fff' : '#666',
});

function StatTile({ label, value, hint, color }: { label: string; value: string; hint: string; color: string }) {
  return (
    <div style={{ flex: 1, minWidth: 120, textAlign: 'center', padding: '12px 8px', borderRadius: 10, background: '#fafafa' }}>
      <div style={{ fontSize: 22, fontWeight: 800, color }}>{value}</div>
      <div style={{ fontSize: 12, fontWeight: 700, color: '#666', marginTop: 2 }}>{label}</div>
      <div style={{ fontSize: 10.5, color: '#aaa', marginTop: 4, lineHeight: 1.5 }}>{hint}</div>
    </div>
  );
}

function StatsRow({ stats }: { stats: RelationStats }) {
  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
      <StatTile label="関わった人" value={`${stats.totalContributors}人`} hint="ニックネーム単位の延べ人数" color="#38ADA9" />
      <StatTile label="関係人口の芽" value={`${stats.repeatContributors}人（${stats.repeatRate}%）`} hint="複数の実験回に関わった人" color="#4A69BD" />
      <StatTile label="また来たい" value={`${stats.wantRevisitPeople}人（${stats.wantRevisitRate}%）`} hint="関係の温度" color="#E5A139" />
    </div>
  );
}

// URLらしき行だけを別タブで開けるリンクにする（複数行・複数URL対応）
function LinkList({ text }: { text: string }) {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  if (lines.length === 0) return null;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      {lines.map((line, i) => {
        const isUrl = /^https?:\/\//.test(line);
        return isUrl ? (
          <a key={i} href={line} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11.5, color: '#38ADA9', wordBreak: 'break-all' }}>
            🔗 {line}
          </a>
        ) : (
          <span key={i} style={{ fontSize: 11.5, color: '#888' }}>{line}</span>
        );
      })}
    </div>
  );
}

type SortKey = 'rank_desc' | 'rank_asc' | 'name' | 'population_asc';

export default function RelationPopulationTab({ authHeaders, focusProfileId, onFocusHandled }: {
  authHeaders: () => HeadersInit;
  // 送信キューの「調べた内容を台帳で見る」から飛んできたとき、絞り込み・並び順を無視して
  // 該当の自治体プロファイルまでスクロールし、一瞬ハイライトする。
  focusProfileId?: string | null;
  onFocusHandled?: () => void;
}) {
  const [overall, setOverall] = useState<OverallResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [regionInput, setRegionInput] = useState('');
  const [regionResult, setRegionResult] = useState<RegionResult | null>(null);
  const [regionLoading, setRegionLoading] = useState(false);

  const [profiles, setProfiles] = useState<MunicipalityProfile[]>([]);
  const [profilesLoading, setProfilesLoading] = useState(true);
  const [showProfileForm, setShowProfileForm] = useState(false);
  const [profileForm, setProfileForm] = useState({ region_name: '', engagement_stage: 'lead', opportunity_level: '中' });
  const [sortKey, setSortKey] = useState<SortKey>('rank_desc');
  const [nameFilter, setNameFilter] = useState('');
  const [levelFilter, setLevelFilter] = useState<'all' | '高' | '中' | '低'>('all');
  const [newFrontierOnly, setNewFrontierOnly] = useState(false);
  const [justFocusedId, setJustFocusedId] = useState<string | null>(null);
  const [opps, setOpps] = useState<FundingOpp[]>([]);
  const [cases, setCases] = useState<BusinessCaseLite[]>([]);
  const [rfpFormFor, setRfpFormFor] = useState<string | null>(null);
  const [rfpForm, setRfpForm] = useState({ title: '', deadline: '' });
  const [promoting, setPromoting] = useState<string | null>(null);

  function jsonHeaders(): HeadersInit {
    return { ...authHeaders(), 'Content-Type': 'application/json' };
  }
  function adminPassword(): string {
    return (authHeaders() as Record<string, string>)['x-admin-password'] ?? '';
  }

  async function loadOppsAndCases() {
    const [oRes, cRes] = await Promise.all([
      fetch('/api/admin/funding-opportunities', { headers: authHeaders() }),
      fetch('/api/admin/business-cases', { headers: authHeaders() }),
    ]);
    const oData = await oRes.json().catch(() => ({ ok: false }));
    const cData = await cRes.json().catch(() => ({ ok: false }));
    if (oData.ok) setOpps(oData.opportunities ?? []);
    if (cData.ok) setCases(cData.cases ?? []);
  }

  async function registerRfp(profileId: string, regionName: string) {
    if (!rfpForm.title.trim()) return;
    await fetch('/api/admin/funding-opportunities', {
      method: 'POST', headers: jsonHeaders(),
      body: JSON.stringify({
        title: rfpForm.title.trim(), organizer: regionName, opp_type: 'municipal_support',
        region: regionName, deadline: rfpForm.deadline || null, status: 'watching',
        municipality_profile_id: profileId,
      }),
    });
    setRfpForm({ title: '', deadline: '' });
    setRfpFormFor(null);
    await loadOppsAndCases();
  }

  async function handlePromote(p: MunicipalityProfile) {
    setPromoting(p.id);
    const result = await promoteToCase(
      { orgName: p.region_name, clientType: 'municipality', municipalityProfileId: p.id, evidence: p.evidence_summary },
      cases, adminPassword(),
    );
    setPromoting(null);
    if (!result.ok) { setError(result.error ?? '案件化に失敗しました'); return; }
    await loadOppsAndCases();
  }

  async function loadProfiles() {
    setProfilesLoading(true);
    const res = await fetch('/api/admin/municipality-profiles', { headers: authHeaders() });
    const data = await res.json();
    if (data.ok) setProfiles(data.profiles ?? []);
    setProfilesLoading(false);
  }

  useEffect(() => {
    setLoading(true);
    fetch('/api/admin/relation-population', { headers: authHeaders() })
      .then(r => r.json())
      .then(d => { if (d.ok) setOverall(d); else setError(d.error ?? '取得に失敗しました'); })
      .catch(() => setError('通信エラー'))
      .finally(() => setLoading(false));
    loadProfiles();
    loadOppsAndCases();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function createProfile() {
    if (!profileForm.region_name.trim()) return;
    await fetch('/api/admin/municipality-profiles', { method: 'POST', headers: jsonHeaders(), body: JSON.stringify(profileForm) });
    setProfileForm({ region_name: '', engagement_stage: 'lead', opportunity_level: '中' });
    setShowProfileForm(false);
    await loadProfiles();
  }
  async function patchProfile(id: string, fields: Partial<MunicipalityProfile>) {
    const res = await fetch(`/api/admin/municipality-profiles/${id}`, { method: 'PATCH', headers: jsonHeaders(), body: JSON.stringify(fields) });
    const data = await res.json().catch(() => ({ ok: false, error: '通信エラー' }));
    if (!data.ok) { setError(data.error ?? '更新に失敗しました'); return; }
    await loadProfiles();
  }
  async function removeProfile(id: string) {
    if (!window.confirm('削除しますか？')) return;
    await fetch(`/api/admin/municipality-profiles/${id}`, { method: 'DELETE', headers: authHeaders() });
    await loadProfiles();
  }
  async function unmarkSent(id: string) {
    await patchProfile(id, { email_sent_at: null });
  }
  const [sendBusy, setSendBusy] = useState<Record<string, boolean>>({});
  const [sendError, setSendError] = useState<Record<string, string>>({});
  async function toggleFactCheck(p: MunicipalityProfile, status: 'verified' | 'unverified') {
    setSendBusy(prev => ({ ...prev, [p.id]: true }));
    try {
      await patchProfile(p.id, { fact_check_status: status, fact_checked_at: new Date().toISOString() });
    } finally {
      setSendBusy(prev => ({ ...prev, [p.id]: false }));
    }
  }
  async function saveContactEmail(p: MunicipalityProfile, rawValue: string) {
    const trimmed = rawValue.trim();
    if (trimmed === (p.contact_email ?? '')) return;
    const body: Partial<MunicipalityProfile> = { contact_email: trimmed || null };
    // 会長が手入力した宛先＝目視確認済みとみなし、確度を「高」に引き上げる（フォームのみ🔴のまま残さない）。
    if (trimmed) body.contact_email_confidence = 'high';
    await patchProfile(p.id, body);
  }
  async function sendEmailNow(p: MunicipalityProfile) {
    if (!window.confirm(`${p.region_name} 様（${p.contact_email}）へ、このメールを送信します。取り消せません。よろしいですか？`)) return;
    setSendBusy(prev => ({ ...prev, [p.id]: true }));
    setSendError(prev => ({ ...prev, [p.id]: '' }));
    try {
      const res = await fetch(`/api/admin/municipality-profiles/${p.id}/send`, { method: 'POST', headers: authHeaders() });
      const data = await res.json();
      if (data.ok) await loadProfiles(); else setSendError(prev => ({ ...prev, [p.id]: data.error ?? '送信に失敗しました' }));
    } catch {
      setSendError(prev => ({ ...prev, [p.id]: '通信エラー' }));
    } finally {
      setSendBusy(prev => ({ ...prev, [p.id]: false }));
    }
  }
  async function markFollowedUp(id: string) {
    await patchProfile(id, { followed_up_at: new Date().toISOString() });
  }
  async function markSmoutSent(id: string) {
    await patchProfile(id, { smout_sent_at: new Date().toISOString() });
  }
  async function unmarkSmoutSent(id: string) {
    await patchProfile(id, { smout_sent_at: null });
  }

  const [popStatsLoading, setPopStatsLoading] = useState<Record<string, boolean>>({});
  const [popStatsError, setPopStatsError] = useState<Record<string, string>>({});
  async function fetchPopulationStats(id: string) {
    setPopStatsLoading(prev => ({ ...prev, [id]: true }));
    setPopStatsError(prev => ({ ...prev, [id]: '' }));
    try {
      const res = await fetch(`/api/admin/municipality-profiles/${id}/population-stats`, { method: 'POST', headers: authHeaders() });
      const data = await res.json();
      if (!data.ok) { setPopStatsError(prev => ({ ...prev, [id]: data.error ?? '取得に失敗しました' })); return; }
      await loadProfiles();
    } catch {
      setPopStatsError(prev => ({ ...prev, [id]: '通信エラー' }));
    } finally {
      setPopStatsLoading(prev => ({ ...prev, [id]: false }));
    }
  }

  async function lookupRegion(region: string) {
    if (!region.trim()) return;
    setRegionLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/admin/relation-population?region=${encodeURIComponent(region.trim())}`, { headers: authHeaders() });
      const d = await res.json();
      setRegionResult(d);
      if (!d.ok && d.error) setError(d.error);
    } catch {
      setError('通信エラー');
    } finally {
      setRegionLoading(false);
    }
  }

  const unsent = useMemo(() => profiles.filter(p => !p.email_sent_at), [profiles]);
  const FOLLOWUP_RANK: Record<string, number> = { overdue: 0, due_soon: 1, ok: 2, replied: 3 };
  const sent = useMemo(
    () => profiles.filter(p => p.email_sent_at).sort((a, b) => {
      const fa = computeFollowUp(a); const fb = computeFollowUp(b);
      const ra = FOLLOWUP_RANK[fa?.status ?? ''] ?? 9; const rb = FOLLOWUP_RANK[fb?.status ?? ''] ?? 9;
      if (ra !== rb) return ra - rb;
      return (fb?.daysSince ?? 0) - (fa?.daysSince ?? 0);
    }),
    [profiles]
  );
  const [viewMode, setViewMode] = useState<'unsent' | 'sent'>('unsent');
  const baseList = viewMode === 'unsent' ? unsent : sent;

  useEffect(() => {
    if (!focusProfileId || profilesLoading) return;
    const target = profiles.find(p => p.id === focusProfileId);
    if (!target) return;
    // 絞り込み・並び替えの外に隠れていても必ず見えるように、フィルタを一旦解除する。
    setNameFilter('');
    setLevelFilter('all');
    setViewMode(target.email_sent_at ? 'sent' : 'unsent');
    setJustFocusedId(target.id);
    const targetElId = `muni-card-${target.id}`;
    const scrollIfFound = (): boolean => {
      const el = document.getElementById(targetElId);
      if (!el) return false;
      // カード1枚が調べた内容・メール文案・人口統計まで含めて縦に長く、画面の高さを超えることが
      // 多いため、'center'だと肝心の見出し（自治体名）が画面外に出てしまう。'start'で頭から見せる。
      el.scrollIntoView({ behavior: 'auto', block: 'start' });
      return true;
    };
    scrollIfFound();
    // 直後の再スクロール1回だけでは、フィルタ切り替え後の残りのカード（100件超）の描画が
    // まだ主スレッドで続いていて位置がずれることがあるため、少し待って再度合わせ直す。
    const settle = setTimeout(() => { scrollIfFound(); }, 300);
    const observer = new MutationObserver(() => { scrollIfFound(); });
    observer.observe(document.body, { childList: true, subtree: true });
    const disconnectTimer = setTimeout(() => observer.disconnect(), 1500);
    onFocusHandled?.();
    const clearHighlight = setTimeout(() => setJustFocusedId(null), 4000);
    return () => { clearTimeout(settle); clearTimeout(disconnectTimer); clearTimeout(clearHighlight); observer.disconnect(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusProfileId, profilesLoading]);

  const priorityPicks = useMemo(
    () => (viewMode === 'unsent' ? unsent.filter(p => p.is_priority_pick).sort((a, b) => a.region_name.localeCompare(b.region_name, 'ja')) : []),
    [unsent, viewMode]
  );

  const visibleProfiles = useMemo(() => {
    let list = viewMode === 'unsent' ? baseList.filter(p => !p.is_priority_pick) : baseList;
    if (levelFilter !== 'all') list = list.filter(p => p.opportunity_level === levelFilter);
    if (newFrontierOnly) list = list.filter(p => !p.relation_population_initiative?.trim());
    if (nameFilter.trim()) {
      const q = nameFilter.trim();
      list = list.filter(p => p.region_name.includes(q));
    }
    const sorted = [...list];
    if (sortKey === 'name') {
      sorted.sort((a, b) => a.region_name.localeCompare(b.region_name, 'ja'));
    } else if (sortKey === 'population_asc') {
      // 昼夜間人口比率が低い（流出が深刻な）自治体ほど上に来るようにする。
      // 未取得は判断材料がないので末尾に回す（0扱いで上位に来ると誤解を招くため）。
      sorted.sort((a, b) => {
        const ra = a.population_stats?.dayNightRatio;
        const rb = b.population_stats?.dayNightRatio;
        if (ra == null && rb == null) return 0;
        if (ra == null) return 1;
        if (rb == null) return -1;
        return ra - rb;
      });
    } else {
      const dir = sortKey === 'rank_desc' ? 1 : -1;
      sorted.sort((a, b) => dir * ((OPPORTUNITY_RANK[a.opportunity_level] ?? 9) - (OPPORTUNITY_RANK[b.opportunity_level] ?? 9)));
    }
    return sorted;
  }, [baseList, viewMode, sortKey, nameFilter, levelFilter, newFrontierOnly]);

  const levelCounts = {
    高: baseList.filter(p => p.opportunity_level === '高').length,
    中: baseList.filter(p => p.opportunity_level === '中').length,
    低: baseList.filter(p => p.opportunity_level === '低').length,
  };
  const newFrontierCount = baseList.filter(p => !p.relation_population_initiative?.trim()).length;

  function ProfileCard({ p, highlight }: { p: MunicipalityProfile; highlight?: boolean }) {
    // gmail_watch.pyの日程調整検知（直近5日以内なら強調表示）
    const schedulingDetected = p.scheduling_request_detected_at
      && (Date.now() - new Date(p.scheduling_request_detected_at).getTime()) < 5 * 86400000;
    const justFocused = justFocusedId === p.id;
    const linkedOpps = opps.filter(o => o.municipality_profile_id === p.id);
    const activeOpps = linkedOpps.filter(o => ['watching', 'preparing'].includes(o.status));
    const isRfpActive = rfpBonus(activeOpps) > 0;
    const linkedCaseId = cases.find(c => c.municipality_profile_id === p.id)?.id;
    return (
      <div id={`muni-card-${p.id}`} style={{
        padding: 14, borderRadius: 10,
        border: justFocused ? '2px solid #8E44AD' : highlight ? '2px solid #E5A139' : '1px solid #eee',
        background: justFocused ? '#F8F0FC' : highlight ? '#FFFBF2' : '#fff',
        transition: 'background 0.6s, border-color 0.6s',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
          <b style={{ fontSize: 14 }}>
            {highlight && '🌟 '}{p.on_hold && '⏸ '}{p.region_name}
            {isRfpActive && (
              <span title={activeOpps.map(o => `${o.title}${o.deadline ? `（締切${o.deadline}）` : ''}`).join(' / ')} style={{
                marginLeft: 8, fontSize: 11, fontWeight: 700, color: '#fff',
                background: '#E55039', padding: '1px 8px', borderRadius: 10,
              }}>🔥 公募中</span>
            )}
            {schedulingDetected && (
              <span title="Gmail AIエージェントが日程調整を求める返信を検知しました" style={{
                marginLeft: 8, fontSize: 11, fontWeight: 700, color: '#4A69BD',
                background: '#4A69BD18', padding: '1px 8px', borderRadius: 10,
              }}>📅 日程調整依頼あり</span>
            )}
            {p.population_stats?.dayNightRatio != null && (
              <span title="昼夜間人口比率（国勢調査）。100%未満＝夜間人口の方が多い＝人口流出傾向" style={{
                marginLeft: 8, fontSize: 11, fontWeight: 700,
                color: p.population_stats.dayNightRatio < 100 ? '#B7791F' : '#2E5FA3',
                background: (p.population_stats.dayNightRatio < 100 ? '#E5A139' : '#2E5FA3') + '18',
                padding: '1px 8px', borderRadius: 10,
              }}>🏙 昼夜{p.population_stats.dayNightRatio}%</span>
            )}
            {p.relation_population_initiative?.trim() ? (
              <span title="既存の関係人口・移住定住施策あり" style={{
                marginLeft: 8, fontSize: 11, fontWeight: 700, color: '#4A69BD', background: '#4A69BD18', padding: '1px 8px', borderRadius: 10,
              }}>🏛 相乗り型（既存施策あり）</span>
            ) : (
              <span title="先行事例が見当たらない自治体。既存の関係人口予算枠が無い分、提案の切り口を変える必要がある" style={{
                marginLeft: 8, fontSize: 11, fontWeight: 700, color: '#8E44AD', background: '#8E44AD18', padding: '1px 8px', borderRadius: 10,
              }}>🆕 新規開拓（先行事例なし）</span>
            )}
          </b>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span onClick={() => patchProfile(p.id, { is_priority_pick: !p.is_priority_pick })} style={{
              fontSize: 11, cursor: 'pointer', color: p.is_priority_pick ? '#E5A139' : '#ccc', fontWeight: 700,
            }} title="営業価値の高い最優先自治体としてピン留め">{p.is_priority_pick ? '★ 最優先' : '☆ ピン留め'}</span>
            <button onClick={() => patchProfile(p.id, { on_hold: !p.on_hold })} style={{
              fontSize: 11, color: p.on_hold ? '#fff' : '#888', fontWeight: 700, cursor: 'pointer',
              background: p.on_hold ? '#999' : 'none', border: '1px solid #ccc', borderRadius: 999, padding: '3px 10px',
            }} title="メール送信・フォローを一時的に止める（削除はしない）">{p.on_hold ? '再開する' : 'メール送信を保留にする'}</button>
            {linkedCaseId ? (
              <a href={`/admin/case/${linkedCaseId}`} target="_blank" rel="noopener noreferrer" style={{
                fontSize: 11, fontWeight: 700, color: '#8E44AD', border: '1px solid #8E44AD', borderRadius: 999, padding: '3px 10px', textDecoration: 'none',
              }}>📊 案件化済み →</a>
            ) : (
              <button onClick={() => handlePromote(p)} disabled={promoting === p.id} style={{
                fontSize: 11, fontWeight: 700, color: '#fff', background: '#8E44AD', border: 'none', borderRadius: 999, padding: '3px 10px', cursor: 'pointer',
              }}>{promoting === p.id ? '処理中…' : '📇 案件化する'}</button>
            )}
            <button onClick={() => setRfpFormFor(rfpFormFor === p.id ? null : p.id)} style={{
              fontSize: 11, fontWeight: 700, color: '#E55039', background: 'none', border: '1px solid #E55039', borderRadius: 999, padding: '3px 10px', cursor: 'pointer',
            }}>🔥 公募を登録</button>
            <button onClick={() => removeProfile(p.id)} style={{ fontSize: 11, color: '#E74C3C', background: 'none', border: 'none', cursor: 'pointer' }}>削除</button>
          </div>
        </div>

        {p.origin_note && (
          <p style={{ margin: '4px 0 0', fontSize: 11.5, color: '#4A69BD', background: '#EEF1FB', padding: '4px 10px', borderRadius: 8 }}>
            💡 この営業先の由来：{p.origin_note}
          </p>
        )}

        {linkedOpps.length > 0 && (
          <div style={{ margin: '6px 0 0', display: 'flex', flexDirection: 'column', gap: 3 }}>
            {linkedOpps.map(o => (
              <p key={o.id} style={{ margin: 0, fontSize: 11.5, color: '#B7791F' }}>
                🏛 {o.title}{o.deadline && ` ・ 締切${o.deadline}`}{o.url && <a href={o.url} target="_blank" rel="noopener noreferrer" style={{ marginLeft: 4, color: '#38ADA9' }}>↗</a>}
              </p>
            ))}
          </div>
        )}

        {rfpFormFor === p.id && (
          <div style={{ margin: '8px 0 0', padding: 10, borderRadius: 8, background: '#FFF4F2', border: '1px solid #FBD9D2' }}>
            <label style={labelStyle}>公募タイトル</label>
            <input style={{ ...inputStyle, width: '100%', boxSizing: 'border-box' }} value={rfpForm.title}
              onChange={e => setRfpForm(f => ({ ...f, title: e.target.value }))} placeholder={`例：${p.region_name} 関係人口創出事業プロポーザル`} />
            <label style={labelStyle}>締切</label>
            <input type="date" style={inputStyle} value={rfpForm.deadline} onChange={e => setRfpForm(f => ({ ...f, deadline: e.target.value }))} />
            <div style={{ marginTop: 8 }}>
              <button onClick={() => registerRfp(p.id, p.region_name)} style={{
                padding: '6px 14px', borderRadius: 8, border: 'none', background: '#E55039', color: '#fff', fontWeight: 700, fontSize: 12, cursor: 'pointer',
              }}>登録する</button>
            </div>
          </div>
        )}
        <div style={{ display: 'flex', gap: 12, margin: '8px 0', flexWrap: 'wrap' }}>
          <div>
            <span style={{ fontSize: 10.5, color: '#999', marginRight: 6 }}>関わり方</span>
            {ENGAGEMENT_STAGES.map(s => (
              <span key={s.key} onClick={() => patchProfile(p.id, { engagement_stage: s.key })}
                style={{ ...pillStyle(p.engagement_stage === s.key), marginRight: 4 }}>{s.label}</span>
            ))}
          </div>
          <div>
            <span style={{ fontSize: 10.5, color: '#999', marginRight: 6 }}>提案余地</span>
            {OPPORTUNITY_LEVELS.map(o => (
              <span key={o} onClick={() => patchProfile(p.id, { opportunity_level: o })}
                style={{ ...pillStyle(p.opportunity_level === o, OPPORTUNITY_COLORS[o]), marginRight: 4 }}>{o}</span>
            ))}
          </div>
        </div>

        <label style={labelStyle}>調べた内容（証拠パック）</label>
        <textarea defaultValue={p.evidence_summary ?? ''} rows={2} style={{ ...inputStyle, width: '100%', boxSizing: 'border-box', resize: 'vertical' }}
          onBlur={e => { if (e.target.value !== (p.evidence_summary ?? '')) patchProfile(p.id, { evidence_summary: e.target.value || null }); }} />

        <label style={labelStyle}>関係人口創出・新規実証の受け入れ実績</label>
        <textarea defaultValue={p.relation_population_initiative ?? ''} rows={2} style={{ ...inputStyle, width: '100%', boxSizing: 'border-box', resize: 'vertical' }}
          placeholder="具体的な施策名・内容（なければ「確認できず」等）"
          onBlur={e => { if (e.target.value !== (p.relation_population_initiative ?? '')) patchProfile(p.id, { relation_population_initiative: e.target.value || null }); }} />

        <label style={labelStyle}>ヒトマップとの親和性・提案余地の理由</label>
        <textarea defaultValue={p.fit_assessment ?? ''} rows={2} style={{ ...inputStyle, width: '100%', boxSizing: 'border-box', resize: 'vertical' }}
          onBlur={e => { if (e.target.value !== (p.fit_assessment ?? '')) patchProfile(p.id, { fit_assessment: e.target.value || null }); }} />

        <label style={labelStyle}>次の一手・メモ</label>
        <textarea defaultValue={p.opportunity_notes ?? ''} rows={2} style={{ ...inputStyle, width: '100%', boxSizing: 'border-box', resize: 'vertical' }}
          onBlur={e => { if (e.target.value !== (p.opportunity_notes ?? '')) patchProfile(p.id, { opportunity_notes: e.target.value || null }); }} />

        <label style={labelStyle}>情報源（クリックで開けます）</label>
        {p.source_links ? (
          <div style={{ padding: '8px 10px', background: '#fafafa', borderRadius: 8, marginBottom: 6 }}>
            <LinkList text={p.source_links} />
          </div>
        ) : null}
        <textarea defaultValue={p.source_links ?? ''} rows={2} style={{ ...inputStyle, width: '100%', boxSizing: 'border-box', resize: 'vertical' }}
          placeholder="URLを1行に1つ貼り付け"
          onBlur={e => { if (e.target.value !== (p.source_links ?? '')) patchProfile(p.id, { source_links: e.target.value || null }); }} />

        {/* 🔍 根拠・出典：事実確認する時に「何を調べて」「どこで裏取りしたか」を1箇所で見比べられるように、
            証拠パック(evidence_summary)・情報源リンク・事実確認メモをここへ集約表示する（読む用の要約。編集は上のtextarea側で行う）。 */}
        {(p.evidence_summary?.trim() || p.source_links?.trim() || p.fact_check_note?.trim()) && (
          <div style={{ marginTop: 10, padding: 10, borderRadius: 8, background: '#FBF9F3', border: '1px solid #F0EAD6' }}>
            <p style={{ margin: '0 0 6px', fontSize: 12, fontWeight: 800, color: '#8A6D3B' }}>🔍 根拠・出典（事実確認用まとめ）</p>
            {p.evidence_summary?.trim() && (
              <p style={{ margin: '0 0 6px', fontSize: 12, color: '#555', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{p.evidence_summary}</p>
            )}
            {p.source_links?.trim() && <LinkList text={p.source_links} />}
            {p.fact_check_note?.trim() && (
              <p style={{ margin: '6px 0 0', fontSize: 11, color: '#E5A139' }}>📝 {p.fact_check_note}</p>
            )}
          </div>
        )}

        <div style={{ marginTop: 10, padding: 10, borderRadius: 8, background: '#F4FAF9', border: '1px solid #DDF0EE' }}>
          <p style={{ margin: '0 0 6px', fontSize: 12, fontWeight: 800, color: '#2A8580' }}>📮 営業メール</p>
          <label style={labelStyle}>宛先メールアドレス</label>
          <input
            key={`contact-email-${p.id}-${p.contact_email ?? ''}`} defaultValue={p.contact_email ?? ''}
            style={{ ...inputStyle, width: '100%', boxSizing: 'border-box' }}
            placeholder="判明していれば入力"
            onBlur={e => saveContactEmail(p, e.target.value)} />
          <label style={labelStyle}>メール文案（下書き・編集可）</label>
          <textarea defaultValue={p.email_draft ?? ''} rows={6} style={{ ...inputStyle, width: '100%', boxSizing: 'border-box', resize: 'vertical', fontFamily: 'inherit' }}
            onBlur={e => { if (e.target.value !== (p.email_draft ?? '')) patchProfile(p.id, { email_draft: e.target.value || null }); }} />

          <div style={{ display: 'flex', gap: 8, alignItems: 'center', margin: '8px 0 4px', flexWrap: 'wrap' }}>
            {p.contact_email_confidence && (
              <span style={{ fontSize: 10.5, fontWeight: 700, color: CONFIDENCE_BADGE[p.contact_email_confidence].color }}>
                {CONFIDENCE_BADGE[p.contact_email_confidence].label}
              </span>
            )}
            {p.fact_check_status === 'verified' || p.fact_check_status === 'flagged' ? (
              <span style={{ fontSize: 10.5, fontWeight: 700, color: FACT_CHECK_BADGE[p.fact_check_status].color }}>
                {FACT_CHECK_BADGE[p.fact_check_status].label}
              </span>
            ) : (
              <span style={{ fontSize: 10.5, fontWeight: 700, color: '#999' }}>○ 事実確認: 未実施</span>
            )}
            {p.contact_email_source_url && (
              <a href={p.contact_email_source_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 10.5, color: '#38ADA9' }}>出典 ↗</a>
            )}
            {p.assigned_to && (
              <span style={{ fontSize: 10.5, fontWeight: 700, color: '#8E44AD', background: '#F3E9FA', padding: '1px 7px', borderRadius: 20 }}>👤 {p.assigned_to}</span>
            )}
          </div>

          <div style={{ display: 'flex', gap: 8, alignItems: 'center', margin: '4px 0', flexWrap: 'wrap' }}>
            {p.email_sent_at ? (
              <>
                <span style={{ fontSize: 11.5, color: '#27AE60', fontWeight: 700 }}>✓ 送信済み（{new Date(p.email_sent_at).toLocaleDateString('ja-JP')}）</span>
                {(() => {
                  const fu = computeFollowUp(p);
                  return fu ? (
                    <span style={{ fontSize: 11, fontWeight: 700, color: fu.color, padding: '2px 9px', borderRadius: 10, background: fu.color + '18' }}>
                      {fu.label}
                    </span>
                  ) : null;
                })()}
                {p.followed_up_at && (
                  <span style={{ fontSize: 10.5, color: '#999' }}>最終フォロー：{new Date(p.followed_up_at).toLocaleDateString('ja-JP')}</span>
                )}
                <button onClick={() => markFollowedUp(p.id)} style={{ fontSize: 11, background: 'none', border: '1px solid #38ADA9', color: '#38ADA9', borderRadius: 999, padding: '3px 10px', cursor: 'pointer' }}>フォロー済みにする</button>
                <button onClick={() => unmarkSent(p.id)} style={{ fontSize: 11, background: 'none', border: '1px solid #ccc', borderRadius: 999, padding: '3px 10px', cursor: 'pointer' }}>取り消す</button>
              </>
            ) : (
              <>
                {p.fact_check_status === 'verified' ? (
                  <button onClick={() => toggleFactCheck(p, 'unverified')} disabled={sendBusy[p.id]} style={{
                    padding: '4px 10px', borderRadius: 8, border: '1px solid #ddd', background: '#fff', color: '#999', fontSize: 11, cursor: 'pointer',
                  }}>未確認に戻す</button>
                ) : (
                  <button onClick={() => toggleFactCheck(p, 'verified')} disabled={sendBusy[p.id]} style={{
                    padding: '4px 10px', borderRadius: 8, border: '1px solid #27AE60', background: '#fff', color: '#27AE60', fontWeight: 700, fontSize: 11, cursor: 'pointer',
                  }}>事実確認済みにする</button>
                )}
                <button onClick={() => sendEmailNow(p)} disabled={!canSendDraft(p.contact_email, p.contact_email_confidence, p.fact_check_status) || sendBusy[p.id]} style={{
                  padding: '6px 14px', borderRadius: 8, border: 'none',
                  background: canSendDraft(p.contact_email, p.contact_email_confidence, p.fact_check_status) ? '#38ADA9' : '#ccc', color: '#fff', fontWeight: 700, fontSize: 12,
                  cursor: canSendDraft(p.contact_email, p.contact_email_confidence, p.fact_check_status) && !sendBusy[p.id] ? 'pointer' : 'not-allowed',
                }}>{sendBusy[p.id] ? '送信中…' : '送信'}</button>
              </>
            )}
          </div>
          {sendError[p.id] && <p style={{ margin: '4px 0 0', fontSize: 11, color: '#E74C3C' }}>{sendError[p.id]}</p>}
          {p.email_sent_content && (
            <>
              <label style={labelStyle}>Gmailで実際に送信した本文（gmail_watch AIエージェントが自動取得・読み取り専用）</label>
              <div style={{ padding: '8px 10px', background: '#fafafa', borderRadius: 8, fontSize: 12, color: '#555', whiteSpace: 'pre-wrap', maxHeight: 200, overflowY: 'auto' }}>
                {p.email_sent_content}
              </div>
            </>
          )}
          <label style={labelStyle}>届いた返信（貼り付けて保存）</label>
          <textarea defaultValue={p.email_reply ?? ''} rows={3} style={{ ...inputStyle, width: '100%', boxSizing: 'border-box', resize: 'vertical' }}
            placeholder="返信メールの本文を貼り付けておくと、ここに残ります"
            onBlur={e => { if (e.target.value !== (p.email_reply ?? '')) patchProfile(p.id, { email_reply: e.target.value || null }); }} />
        </div>

        <div style={{ marginTop: 10, padding: 10, borderRadius: 8, background: '#FBF6EE', border: '1px solid #F0E4CE' }}>
          <p style={{ margin: '0 0 6px', fontSize: 12, fontWeight: 800, color: '#B7791F' }}>
            📣 SMOUT
            <span style={{ fontWeight: 400, color: '#aaa', marginLeft: 6, fontSize: 10.5 }}>公式APIが無いため手動記録</span>
          </p>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', margin: '4px 0', flexWrap: 'wrap' }}>
            {p.smout_sent_at ? (
              <>
                <span style={{ fontSize: 11.5, color: '#27AE60', fontWeight: 700 }}>✓ 送信済み（{new Date(p.smout_sent_at).toLocaleDateString('ja-JP')}）</span>
                {(() => {
                  const fu = computeFollowUp({ email_sent_at: p.smout_sent_at, email_reply: p.smout_reply, followed_up_at: p.followed_up_at });
                  return fu ? (
                    <span style={{ fontSize: 11, fontWeight: 700, color: fu.color, padding: '2px 9px', borderRadius: 10, background: fu.color + '18' }}>
                      {fu.label}
                    </span>
                  ) : null;
                })()}
                <button onClick={() => markFollowedUp(p.id)} style={{ fontSize: 11, background: 'none', border: '1px solid #B7791F', color: '#B7791F', borderRadius: 999, padding: '3px 10px', cursor: 'pointer' }}>フォロー済みにする</button>
                <button onClick={() => unmarkSmoutSent(p.id)} style={{ fontSize: 11, background: 'none', border: '1px solid #ccc', borderRadius: 999, padding: '3px 10px', cursor: 'pointer' }}>取り消す</button>
              </>
            ) : (
              <button onClick={() => markSmoutSent(p.id)} style={{ fontSize: 11.5, fontWeight: 700, background: '#E5A139', color: '#fff', border: 'none', borderRadius: 999, padding: '5px 12px', cursor: 'pointer' }}>
                SMOUTで送信済みにする
              </button>
            )}
            <a href={smoutSearchUrl(p.region_name)} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, color: '#B7791F' }}>SMOUT ↗</a>
          </div>
          <label style={labelStyle}>届いた返信（貼り付けて保存）</label>
          <textarea defaultValue={p.smout_reply ?? ''} rows={3} style={{ ...inputStyle, width: '100%', boxSizing: 'border-box', resize: 'vertical' }}
            placeholder="SMOUT上で届いた返信を貼り付けておくと、ここに残ります"
            onBlur={e => { if (e.target.value !== (p.smout_reply ?? '')) patchProfile(p.id, { smout_reply: e.target.value || null }); }} />
        </div>

        <div style={{ marginTop: 10, padding: 10, borderRadius: 8, background: '#F2F6FB', border: '1px solid #DDE8F5' }}>
          <p style={{ margin: '0 0 6px', fontSize: 12, fontWeight: 800, color: '#2E5FA3' }}>
            📊 人口統計（e-Stat）
            <span style={{ fontWeight: 400, color: '#aaa', marginLeft: 6, fontSize: 10.5 }}>感情ヒートマップと比べるための自治体単位の公的統計</span>
          </p>
          <label style={labelStyle}>全国地方公共団体コード（5桁）</label>
          <input defaultValue={p.municipality_code ?? ''} style={{ ...inputStyle, width: '100%', boxSizing: 'border-box' }}
            placeholder="例：092010（e-Statの地域コード検索で調べる）"
            onBlur={e => { if (e.target.value !== (p.municipality_code ?? '')) patchProfile(p.id, { municipality_code: e.target.value || null }); }} />
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', margin: '8px 0 4px', flexWrap: 'wrap' }}>
            {p.population_stats?.dayNightRatio != null ? (
              <span style={{ fontSize: 11.5, color: '#2E5FA3', fontWeight: 700 }}>
                昼夜間人口比率 {p.population_stats.dayNightRatio}%（{p.population_stats.statsYear ?? '年不明'}・国勢調査）
              </span>
            ) : (
              <span style={{ fontSize: 11.5, color: '#aaa' }}>まだ取得されていません</span>
            )}
            <button onClick={() => fetchPopulationStats(p.id)} disabled={!p.municipality_code || popStatsLoading[p.id]} style={{
              fontSize: 11, fontWeight: 700, background: '#2E5FA3', color: '#fff', border: 'none', borderRadius: 999,
              padding: '4px 12px', cursor: p.municipality_code ? 'pointer' : 'not-allowed', opacity: p.municipality_code ? 1 : 0.5,
            }}>{popStatsLoading[p.id] ? '取得中…' : '人口統計を取得'}</button>
          </div>
          {p.population_stats_fetched_at && (
            <p style={{ margin: '2px 0 0', fontSize: 10.5, color: '#aaa' }}>最終取得：{new Date(p.population_stats_fetched_at).toLocaleString('ja-JP')}</p>
          )}
          {popStatsError[p.id] && <p style={{ margin: '4px 0 0', fontSize: 11, color: '#E74C3C' }}>{popStatsError[p.id]}</p>}
        </div>
      </div>
    );
  }

  return (
    <div>
      <Card>
        <p style={{ margin: '0 0 4px', fontWeight: 800, fontSize: 15 }}>🔁 関係人口ダッシュボード</p>
        <p style={{ margin: 0, fontSize: 12, color: '#888', lineHeight: 1.7 }}>
          複数の実験回（イベント・地域）に関わった人＝「関係人口の芽」を数えます。<br />
          自治体向け提案書・レポートの一次データとして使えます。個人を特定できる値は表示しません。
          総数が5人未満の地域は非表示にします。
        </p>
      </Card>

      {error && <p style={{ margin: '12px 0 0', fontSize: 13, color: '#E74C3C' }}>{error}</p>}

      <p style={{ margin: '20px 0 8px', fontWeight: 800, fontSize: 14 }}>📊 全体</p>
      <Card>
        {loading ? (
          <p style={{ margin: 0, fontSize: 13, color: '#999' }}>集計中…</p>
        ) : overall?.overall ? (
          <StatsRow stats={overall.overall} />
        ) : (
          <p style={{ margin: 0, fontSize: 13, color: '#aaa' }}>データがありません。</p>
        )}
      </Card>

      <p style={{ margin: '24px 0 8px', fontWeight: 800, fontSize: 14 }}>🏘 地域ランキング（上位10）</p>
      <Card>
        {loading ? (
          <p style={{ margin: 0, fontSize: 13, color: '#999' }}>集計中…</p>
        ) : !overall?.topRegions || overall.topRegions.length === 0 ? (
          <p style={{ margin: 0, fontSize: 13, color: '#aaa' }}>地域が記録された投稿がまだありません。</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {overall.topRegions.map(r => (
              <div key={r.region} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '8px 10px', borderRadius: 8, background: '#fafafa',
              }}>
                <span style={{ fontSize: 13, fontWeight: 700 }}>{r.region}</span>
                {r.suppressed ? (
                  <span style={{ fontSize: 11.5, color: '#B7791F' }}>少人数のため非表示</span>
                ) : (
                  <span style={{ fontSize: 12, color: '#666' }}>
                    {r.totalContributors}人 ・ 関係人口の芽 {r.repeatContributors}人（{r.repeatRate}%）
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>

      <p style={{ margin: '24px 0 8px', fontWeight: 800, fontSize: 14 }}>🔍 地域を指定して詳細を見る</p>
      <Card>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            placeholder="例：佐野市（栃木県）"
            value={regionInput}
            onChange={e => setRegionInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && lookupRegion(regionInput)}
            style={inputStyle}
          />
          <button
            onClick={() => lookupRegion(regionInput)}
            disabled={regionLoading || !regionInput.trim()}
            style={{ padding: '9px 16px', borderRadius: 8, border: 'none', background: '#38ADA9', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}
          >{regionLoading ? '集計中…' : '集計する'}</button>
        </div>
        <p style={{ margin: '6px 0 0', fontSize: 11, color: '#aaa' }}>投稿時に保存された自治体名と完全一致で検索します。</p>

        {regionResult && regionResult.suppressed && (
          <p style={{ marginTop: 14, fontSize: 12.5, color: '#B7791F', background: '#FFF8E8', padding: 10, borderRadius: 8 }}>
            「{regionResult.region}」は関わった人数が5人未満のため、個人特定を避けて非表示にしています。
          </p>
        )}
        {regionResult && regionResult.ok && !regionResult.suppressed && regionResult.stats && (
          <div key={regionResult.region}>
            <StatsRow stats={regionResult.stats} />
          </div>
        )}
        {regionResult && !regionResult.ok && (
          <p style={{ marginTop: 14, fontSize: 12.5, color: '#E74C3C' }}>{regionResult.error}</p>
        )}
      </Card>

      <p style={{ margin: '24px 0 8px', fontWeight: 800, fontSize: 14 }}>🏛 自治体プロファイル（関係人口創出・スタートアップ受け入れの取り組みと提案余地）</p>
      <Card>
        <div style={{ fontSize: 12, color: '#888', lineHeight: 1.8, marginBottom: 12 }}>
          <p style={{ margin: '0 0 6px' }}>
            営業対象・実証先の自治体を、①どんなデータを調べたか（証拠パック）、②関係人口創出やスタートアップ受け入れの取り組みが実際にあるか、③ヒトマップの体験型サービスとの相性、④営業として攻める価値（提案余地：高・中・低）の4点でまとめています。
          </p>
          <p style={{ margin: '0 0 6px' }}>
            データソースは2種類です。（A）自治体の総合戦略・提案準備状況から個別に深掘りしたもの（既存の営業リード12件）と、（B）総務省「関係人口創出・拡大事業」モデル事業（2018〜2020年度・全国約93自治体）＋内閣府「スタートアップエコシステム拠点都市」等の公的認定リスト（約14自治体）から一次評価したものです。後者は要約情報からのルールベース判定のため、提案前に個別の裏取りをおすすめします。
          </p>
          <p style={{ margin: 0 }}>
            メール文案は下書きの自動生成です。送信前に必ず内容をご確認ください。送信・返信の記録はここに手動で残す運用です（自動送信は一切行いません）。
          </p>
        </div>

        <button onClick={() => setShowProfileForm(v => !v)} style={{
          padding: '8px 16px', borderRadius: 8, border: 'none', background: '#38ADA9', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer', marginBottom: 12,
        }}>{showProfileForm ? 'キャンセル' : '+ 自治体を追加'}</button>

        {showProfileForm && (
          <div style={{ padding: 12, borderRadius: 10, background: '#fafafa', marginBottom: 14 }}>
            <label style={labelStyle}>自治体名</label>
            <input style={{ ...inputStyle, width: '100%', boxSizing: 'border-box' }} value={profileForm.region_name}
              onChange={e => setProfileForm(f => ({ ...f, region_name: e.target.value }))} placeholder="例：佐野市（栃木県）" />
            <div style={{ marginTop: 10 }}><button onClick={createProfile} style={{
              padding: '8px 16px', borderRadius: 8, border: 'none', background: '#38ADA9', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer',
            }}>保存する</button></div>
          </div>
        )}

        {profilesLoading ? (
          <p style={{ margin: 0, fontSize: 13, color: '#999' }}>読み込み中…</p>
        ) : (
          <>
            {priorityPicks.length > 0 && (
              <>
                <p style={{ margin: '4px 0 8px', fontWeight: 800, fontSize: 13, color: '#B7791F' }}>🌟 営業価値の高い最優先自治体（{priorityPicks.length}）</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
                  {priorityPicks.map(p => <ProfileCard key={p.id} p={p} highlight />)}
                </div>
              </>
            )}

            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', margin: '4px 0 12px' }}>
              <input value={nameFilter} onChange={e => setNameFilter(e.target.value)} placeholder="自治体名で絞り込み"
                style={{ ...inputStyle, maxWidth: 220 }} />
              <div style={{ display: 'flex', gap: 4 }}>
                <span onClick={() => setViewMode('unsent')} style={pillStyle(viewMode === 'unsent', '#38ADA9')}>
                  未送信（{unsent.length}）
                </span>
                <span onClick={() => setViewMode('sent')} style={pillStyle(viewMode === 'sent', '#999')}>
                  📤 送信済み（{sent.length}）
                </span>
              </div>
              <div style={{ display: 'flex', gap: 4 }}>
                {(['all', '高', '中', '低'] as const).map(lv => (
                  <span key={lv} onClick={() => setLevelFilter(lv)}
                    style={pillStyle(levelFilter === lv, lv === 'all' ? '#38ADA9' : OPPORTUNITY_COLORS[lv])}>
                    {lv === 'all' ? `すべて（${baseList.length}）` : `${lv}（${levelCounts[lv]}）`}
                  </span>
                ))}
              </div>
              <span onClick={() => setNewFrontierOnly(v => !v)} style={pillStyle(newFrontierOnly, '#8E44AD')} title="relation_population_initiativeが空＝先行事例が見当たらない自治体だけに絞り込みます">
                🆕 新規開拓のみ（{newFrontierCount}）
              </span>
              <div style={{ display: 'flex', gap: 4, marginLeft: 'auto' }}>
                <span style={{ fontSize: 10.5, color: '#999', alignSelf: 'center' }}>並び順</span>
                <span onClick={() => setSortKey('rank_desc')} style={pillStyle(sortKey === 'rank_desc')}>提案余地 高→低</span>
                <span onClick={() => setSortKey('rank_asc')} style={pillStyle(sortKey === 'rank_asc')}>提案余地 低→高</span>
                <span onClick={() => setSortKey('name')} style={pillStyle(sortKey === 'name')}>自治体名</span>
                <span onClick={() => setSortKey('population_asc')} style={pillStyle(sortKey === 'population_asc', '#2E5FA3')} title="昼夜間人口比率が低い（人口流出が深刻な）自治体を上位に">人口流出 大→小</span>
              </div>
            </div>

            {visibleProfiles.length === 0 ? (
              <p style={{ margin: 0, fontSize: 13, color: '#aaa' }}>
                {viewMode === 'sent' ? '送信済みの自治体プロファイルがありません。' : '該当する自治体プロファイルがありません。'}
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {visibleProfiles.map(p => <ProfileCard key={p.id} p={p} />)}
              </div>
            )}
          </>
        )}
      </Card>
    </div>
  );
}
