'use client';

// 縁の司令室 — 営業自動化ダッシュボード。
// ファネル型CRM（候補を「落とす」発想）を捨て、ヒトマップの核心方程式
//   出会い ＝ 事実 × 共感　／　縁 ＝ 出会い ＋ 行動 × 恩返し
// をそのまま実装する。相手ごとに「縁の台帳」（事実・共感・行動・恩返しの記録）を持ち、
// 方程式のどこが欠けているかから「今日の一手」をルールベースで自動導出する（lib/enScore.ts）。
// 外部送信は一切ここからは行わない。自動化するのは「判断の迷い」の除去だけ。
import { useCallback, useEffect, useMemo, useState } from 'react';
import { computeEn, EN_KINDS, type EnKind, type EnRecord, type EnBreakdown } from '@/lib/enScore';
import RelationPopulationTab from '@/components/admin/RelationPopulationTab';

// ---------- データ型（各既存APIと同じ形） ----------
interface ClientLead {
  id: string;
  client_type: 'school' | 'business';
  org_name: string;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  status: string;
  memo: string | null;
  created_at: string;
  updated_at: string;
}
interface BusinessCase {
  id: string; org_name: string; client_type: string; stage: string;
  evidence: string | null; proposal_link: string | null; next_action: string | null; lead_ref: string | null;
}
interface EmailTarget { id: string; company: string; email: string | null; hook: string | null; drafted: boolean; sent: boolean; }
interface ClientDossier {
  id: string; org_name: string; plan: string | null; monthly_fee: number | null;
  contact_name: string | null; start_date: string | null; next_meeting: string | null; notes: string | null;
}
interface MunicipalityProfile {
  id: string; region_name: string; opportunity_level: string; relation_population_initiative: string | null;
  engagement_stage: string; fit_assessment: string | null; opportunity_notes: string | null; evidence_summary: string | null;
  email_sent_at: string | null;
}

// 自治体プロファイル（106件規模）は縁の台帳（client_leads）とは別の台帳のため、
// 素点を縁スコア（0-200）と同じ物差しに換算して1本のランキングにまとめる。
// 「提案余地」の高低＋「関わり方」の進み具合を反映する簡易換算（en scoreの厳密な内訳計算はしない）。
const OPPORTUNITY_SCORE: Record<string, number> = { 高: 140, 中: 80, 低: 30 };
const ENGAGEMENT_BONUS: Record<string, number> = { contracted: 40, proposed: 20, lead: 0, observing: -10 };
function municipalityScore(p: MunicipalityProfile): number {
  const base = OPPORTUNITY_SCORE[p.opportunity_level] ?? 30;
  const bonus = ENGAGEMENT_BONUS[p.engagement_stage] ?? 0;
  return Math.max(0, Math.min(200, base + bonus));
}
function municipalityReason(p: MunicipalityProfile): string {
  return p.fit_assessment?.trim() || p.opportunity_notes?.trim() || p.relation_population_initiative?.trim()
    || p.evidence_summary?.trim() || '詳細は関係人口・自治体プロファイルで確認してください';
}

interface RankedFeedItem {
  key: string;
  kind: 'lead' | 'municipality';
  icon: string;
  name: string;
  score: number;
  badge: string;
  badgeColor: string;
  reason: string;
  leadId?: string; // 縁の台帳カードへスクロール用
  isSent: boolean; // 一度でも接触・送信済みなら true（候補一覧から分けて表示する）
}

// 自治体名の表記ゆれ（「佐野市（栃木県・デジタル推進課）」⇄「佐野市（栃木県）」等）を吸収するため、
// 括弧書きを除いた市区町村・都道府県の芯の部分だけで部分一致させる
function coreRegionName(name: string): string {
  return name.replace(/[（(].*$/, '').trim();
}
// SMOUT（smout.jp）は地域ページのURLが内部IDベース（例: /areas/243/）で自治体名から直接組み立てられないため、
// Google検索経由でその地域のSMOUTページに辿り着けるようにする（存在しないリンクを作らないための代替）
function smoutSearchUrl(name: string): string {
  const core = coreRegionName(name);
  return `https://www.google.com/search?q=${encodeURIComponent(`site:smout.jp ${core}`)}`;
}
function findProfileFor(orgName: string, profiles: MunicipalityProfile[]): MunicipalityProfile | undefined {
  const core = coreRegionName(orgName);
  if (!core) return undefined;
  return profiles.find(p => {
    const pCore = coreRegionName(p.region_name);
    return pCore && (core.includes(pCore) || pCore.includes(core));
  });
}

const LEAD_STATUSES: { key: string; label: string; color: string }[] = [
  { key: 'lead', label: '候補', color: '#999' },
  { key: 'contacted', label: '接触済み', color: '#4A90E2' },
  { key: 'negotiating', label: '商談中', color: '#E5A139' },
  { key: 'contracted', label: '契約中', color: '#27AE60' },
  { key: 'lost', label: '見送り', color: '#E55039' },
];

// ---------- スタイル ----------
const cardStyle: React.CSSProperties = { background: '#fff', borderRadius: 12, padding: 16, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' };
const sectionTitleStyle: React.CSSProperties = { fontSize: 14, fontWeight: 800, color: '#444', margin: '24px 0 10px' };
const inputStyle: React.CSSProperties = {
  padding: '8px 11px', borderRadius: 8, border: '1.5px solid #ddd',
  fontSize: 13, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box',
};
const jumpBtnStyle: React.CSSProperties = {
  padding: '4px 10px', borderRadius: 14, border: '1px solid #38ADA9', background: '#fff',
  color: '#38ADA9', fontSize: 11, fontWeight: 700, cursor: 'pointer', flexShrink: 0,
};

function daysUntil(dateStr: string): number {
  return Math.ceil((new Date(dateStr + 'T00:00:00').getTime() - Date.now()) / 86400000);
}

// 「今日の一手」1件分。priorityが小さいほど上
interface MorningItem {
  priority: number;
  icon: string;
  org: string;
  title: string;
  why: string;
  how: string;
  jumpTab?: string;
  jumpLabel?: string;
  leadId?: string; // 縁の台帳カードへスクロールするため
}

export default function SalesTab({ authHeaders, goTab }: { authHeaders: () => HeadersInit; goTab: (tab: string) => void }) {
  const [leads, setLeads] = useState<ClientLead[]>([]);
  const [records, setRecords] = useState<EnRecord[]>([]);
  const [cases, setCases] = useState<BusinessCase[]>([]);
  const [emails, setEmails] = useState<EmailTarget[]>([]);
  const [dossiers, setDossiers] = useState<ClientDossier[]>([]);
  const [municipalityProfiles, setMunicipalityProfiles] = useState<MunicipalityProfile[]>([]);
  const [needsMigration, setNeedsMigration] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [view, setView] = useState<'ledger' | 'relation'>('ledger');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [leadsRes, recordsRes, casesRes, emailsRes, dossiersRes, profilesRes] = await Promise.all([
        fetch('/api/admin/client-leads', { headers: authHeaders() }).then(r => r.json()),
        fetch('/api/admin/en-records', { headers: authHeaders() }).then(r => r.json()),
        fetch('/api/admin/business-cases', { headers: authHeaders() }).then(r => r.json()),
        fetch('/api/admin/sales-email-targets', { headers: authHeaders() }).then(r => r.json()),
        fetch('/api/admin/client-dossiers', { headers: authHeaders() }).then(r => r.json()),
        fetch('/api/admin/municipality-profiles', { headers: authHeaders() }).then(r => r.json()).catch(() => ({ ok: false })),
      ]);
      if (leadsRes.ok) setLeads(leadsRes.leads ?? []);
      if (recordsRes.ok) {
        setRecords(recordsRes.records ?? []);
        setNeedsMigration(Boolean(recordsRes.needsMigration));
      }
      if (casesRes.ok) setCases(casesRes.cases ?? []);
      if (emailsRes.ok) setEmails(emailsRes.targets ?? []);
      if (dossiersRes.ok) setDossiers(dossiersRes.dossiers ?? []);
      if (profilesRes.ok) setMunicipalityProfiles(profilesRes.profiles ?? []);
      const failed = [leadsRes, recordsRes, casesRes, emailsRes, dossiersRes].find(r => !r.ok);
      if (failed) setError(failed.error ?? '一部のデータの取得に失敗しました');
    } catch {
      setError('通信エラー');
    } finally {
      setLoading(false);
    }
  }, [authHeaders]);

  useEffect(() => { load(); }, [load]);

  function jsonHeaders(): HeadersInit {
    return { ...authHeaders(), 'Content-Type': 'application/json' };
  }
  async function patchLead(id: string, fields: Record<string, unknown>) {
    await fetch(`/api/admin/client-leads/${id}`, { method: 'PATCH', headers: jsonHeaders(), body: JSON.stringify(fields) });
    await load();
  }
  async function patchEmail(id: string, fields: Partial<EmailTarget>) {
    await fetch(`/api/admin/sales-email-targets/${id}`, { method: 'PATCH', headers: jsonHeaders(), body: JSON.stringify(fields) });
    await load();
  }
  async function addRecord(leadId: string, kind: EnKind, note: string, happenedAt: string) {
    const res = await fetch('/api/admin/en-records', {
      method: 'POST', headers: jsonHeaders(),
      body: JSON.stringify({ lead_id: leadId, kind, note, happened_at: happenedAt || undefined }),
    });
    const data = await res.json();
    if (!data.ok) { setError(data.error ?? '記録に失敗しました'); return false; }
    await load();
    return true;
  }
  async function removeRecord(id: string) {
    await fetch(`/api/admin/en-records/${id}`, { method: 'DELETE', headers: authHeaders() });
    await load();
  }

  // ---------- 縁スコアの計算 ----------
  const ledger = useMemo(() => {
    const byLead = new Map<string, EnRecord[]>();
    for (const r of records) {
      const list = byLead.get(r.lead_id) ?? [];
      list.push(r);
      byLead.set(r.lead_id, list);
    }
    return leads.map(lead => ({
      lead,
      records: byLead.get(lead.id) ?? [],
      en: computeEn(lead, byLead.get(lead.id) ?? []),
    }));
  }, [leads, records]);

  const activeLedger = ledger.filter(e => e.lead.status !== 'lost');
  const coldCount = activeLedger.filter(e => e.en.freshness <= 0.65).length;
  const contracted = ledger.filter(e => e.lead.status === 'contracted');
  const monthlyRecurring = dossiers.reduce((sum, d) => sum + (d.monthly_fee ?? 0), 0);
  const pendingApproval = cases.filter(c => c.stage === '承認待ち');
  const draftedUnsent = emails.filter(e => e.drafted && !e.sent);

  // ---------- 朝の一枚（今日の一手）の自動生成 ----------
  const morning = useMemo(() => {
    const items: MorningItem[] = [];

    // 承認待ち＝会長のボール。方程式以前に、止まっているのは自分側
    for (const c of pendingApproval) {
      items.push({
        priority: 0, icon: '✅', org: c.org_name,
        title: '承認待ちの案件があります',
        why: '止まっているボールは相手ではなく自分側にある',
        how: '06_実行待機_Approvalを確認し、送るか差し戻すか決める',
        jumpTab: 'aiops', jumpLabel: '案件を開く',
      });
    }
    // 下書き済み・未送信の便り
    for (const e of draftedUnsent) {
      items.push({
        priority: 0.5, icon: '📮', org: e.company,
        title: '便りが下書きのまま止まっています',
        why: '下書きのままでは相手に届きません',
        how: 'メールソフトから送信し、下の便り一覧で「送った」にする',
      });
    }
    // 顧問先の打合せ（3日以内 or 超過）
    for (const d of dossiers) {
      if (!d.next_meeting) continue;
      const until = daysUntil(d.next_meeting);
      if (until <= 3) {
        items.push({
          priority: until < 0 ? 0 : 1, icon: '🤝', org: d.org_name,
          title: until < 0 ? `打合せ予定が${-until}日過ぎています（${d.next_meeting}）` : until === 0 ? '今日は打合せの日です' : `打合せまであと${until}日（${d.next_meeting}）`,
          why: 'せっかくできた関係を大事にする',
          how: until < 0 ? '日程を組み直し、カルテの次回打合せ日を更新する' : 'カルテを見直し、渡せるもの（お礼になるもの）をひとつ用意して臨む',
          jumpTab: 'aiops', jumpLabel: 'カルテを開く',
        });
      }
    }
    // 縁の台帳から：次の一手（縁の温度が高い順に、方程式が導く一手を並べる）
    const sorted = [...activeLedger].sort((a, b) =>
      a.en.nextMove.priority - b.en.nextMove.priority || b.en.enLive - a.en.enLive
    );
    for (const { lead, en } of sorted) {
      items.push({
        priority: 2 + en.nextMove.priority / 10,
        icon: '🧭', org: lead.org_name,
        title: en.nextMove.title,
        why: en.nextMove.why,
        how: en.nextMove.how,
        leadId: lead.id,
      });
    }
    return items.sort((a, b) => a.priority - b.priority);
  }, [pendingApproval, draftedUnsent, dossiers, activeLedger]);

  const [showAllMorning, setShowAllMorning] = useState(false);
  const visibleMorning = showAllMorning ? morning : morning.slice(0, 6);

  // ---------- 台帳の並び・絞り込み ----------
  const [ledgerFilter, setLedgerFilter] = useState<'active' | 'all'>('active');

  function scrollToLead(leadId: string) {
    document.getElementById(`en-card-${leadId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  const ledgerById = useMemo(() => {
    const map = new Map<string, typeof activeLedger[number]>();
    for (const entry of ledger) map.set(entry.lead.id, entry);
    return map;
  }, [ledger]);

  // ---------- 縁ランキング（縁の台帳＋自治体プロファイルを1本の順位にまとめる） ----------
  // 自治体プロファイル（100件超）は縁の台帳のリード数（数件）とは桁違いに多く、
  // これまでは「学校・法人」に既にリードがある団体にしかタグとして出てこなかった。
  // ここで両方を同じスコアの物差しに乗せ、まとめて順位表示することで、台帳に無い
  // 自治体もすべて営業対象として見えるようにする。
  const rankedFeed = useMemo<RankedFeedItem[]>(() => {
    const items: RankedFeedItem[] = [];
    for (const { lead, en } of activeLedger) {
      items.push({
        key: `lead-${lead.id}`, kind: 'lead', icon: lead.client_type === 'school' ? '🏫' : '🏢',
        name: lead.org_name, score: en.enLive, badge: en.stage, badgeColor: en.stageColor,
        reason: en.nextMove.why, leadId: lead.id,
        isSent: lead.status !== 'lead', // 「候補」から動いていれば、既に接触・送信済みとみなす
      });
    }
    // 既にリードとして台帳にある自治体は、自治体プロファイル側では重複させない
    const leadCoreNames = new Set(leads.map(l => coreRegionName(l.org_name)));
    for (const p of municipalityProfiles) {
      if (leadCoreNames.has(coreRegionName(p.region_name))) continue;
      items.push({
        key: `muni-${p.id}`, kind: 'municipality', icon: '🏛',
        name: p.region_name, score: municipalityScore(p),
        badge: `提案余地 ${p.opportunity_level}`, badgeColor: OPPORTUNITY_COLORS[p.opportunity_level] ?? '#999',
        reason: municipalityReason(p),
        isSent: Boolean(p.email_sent_at),
      });
    }
    return items.sort((a, b) => b.score - a.score);
  }, [activeLedger, leads, municipalityProfiles]);

  const activeRankedFeed = useMemo(() => rankedFeed.filter(item => !item.isSent), [rankedFeed]);
  const sentRankedFeed = useMemo(() => rankedFeed.filter(item => item.isSent), [rankedFeed]);

  const [showAllRanked, setShowAllRanked] = useState(false);
  const visibleRanked = showAllRanked ? activeRankedFeed : activeRankedFeed.slice(0, 15);
  const [showSent, setShowSent] = useState(false);

  if (loading) return <p style={{ fontSize: 13, color: '#999' }}>営業データを読み込み中…</p>;

  return (
    <div>
      {/* ---------- 方程式ヘッダー ---------- */}
      <div style={{ ...cardStyle, background: '#1F2A2A', color: '#fff', padding: '14px 18px' }}>
        <p style={{ margin: 0, fontSize: 13, fontWeight: 800, letterSpacing: 0.5 }}>
          出会い ＝ 事実 × 共感　／　縁 ＝ 出会い ＋ 行動 × 恩返し
        </p>
        <p style={{ margin: '6px 0 0', fontSize: 11, color: 'rgba(255,255,255,0.65)', lineHeight: 1.7 }}>
          営業は縁づくり。相手を「落とす」のではなく、足りない要素を埋めていく。
          何もしないと縁は冷めていきます。ここは迷いを減らすための場所で、送信などの外部への連絡は必ず会長が行います。
        </p>
      </div>

      {/* ---------- 縁の台帳／関係人口 切り替え ---------- */}
      <div style={{ display: 'flex', gap: 6, margin: '14px 0' }}>
        <button onClick={() => setView('ledger')} style={{
          padding: '7px 16px', borderRadius: 16, border: 'none', cursor: 'pointer', fontSize: 12.5, fontWeight: 700,
          background: view === 'ledger' ? '#38ADA9' : '#fff', color: view === 'ledger' ? '#fff' : '#666',
          boxShadow: view === 'ledger' ? 'none' : '0 1px 3px rgba(0,0,0,0.08)',
        }}>🧭 営業</button>
        <button onClick={() => setView('relation')} style={{
          padding: '7px 16px', borderRadius: 16, border: 'none', cursor: 'pointer', fontSize: 12.5, fontWeight: 700,
          background: view === 'relation' ? '#38ADA9' : '#fff', color: view === 'relation' ? '#fff' : '#666',
          boxShadow: view === 'relation' ? 'none' : '0 1px 3px rgba(0,0,0,0.08)',
        }}>🔁 関係人口・自治体プロファイル</button>
      </div>

      {view === 'relation' && <RelationPopulationTab authHeaders={authHeaders} />}

      {view === 'ledger' && <>
      {error && <p style={{ fontSize: 13, color: '#E74C3C', margin: '10px 0 0' }}>{error}</p>}

      {needsMigration && (
        <div style={{ ...cardStyle, marginTop: 10, borderLeft: '4px solid #E5A139' }}>
          <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#B7791F' }}>⚠ 営業データのテーブルがまだ作成されていません</p>
          <p style={{ margin: '4px 0 0', fontSize: 12, color: '#777', lineHeight: 1.7 }}>
            <code style={{ background: '#f4f4f4', padding: '1px 5px', borderRadius: 4 }}>supabase/migrations/20260719_add_en_records.sql</code> を
            SupabaseのSQL Editorで一度実行してください。それまでは証拠パック（メモ）とステータスだけでスコアを仮計算しています。
          </p>
        </div>
      )}

      {/* ---------- 計器盤 ---------- */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(128px, 1fr))', gap: 10, margin: '14px 0 4px' }}>
        {[
          { label: '営業対象', value: `${activeLedger.length}件`, sub: `記録 ${records.length}本`, color: '#4A69BD' },
          { label: '火が消えかけ', value: `${coldCount}件`, sub: '45日以上で❄', color: '#E55039' },
          { label: '承認待ち', value: `${pendingApproval.length}件`, sub: '06番地の確認', color: '#E5A139' },
          { label: '便り（未送信）', value: `${emails.filter(e => !e.sent).length}件`, sub: `下書き済 ${draftedUnsent.length}件`, color: '#8E44AD' },
          { label: '結ばれた縁', value: `${Math.max(contracted.length, dossiers.length)}社`, sub: `月額計 ${monthlyRecurring.toLocaleString()}円`, color: '#27AE60' },
        ].map(kpi => (
          <div key={kpi.label} style={{ ...cardStyle, padding: '12px 14px', borderTop: `3px solid ${kpi.color}` }}>
            <p style={{ margin: 0, fontSize: 11, color: '#999', fontWeight: 700 }}>{kpi.label}</p>
            <p style={{ margin: '4px 0 2px', fontSize: 17, fontWeight: 800, color: '#333' }}>{kpi.value}</p>
            <p style={{ margin: 0, fontSize: 11, color: '#aaa' }}>{kpi.sub}</p>
          </div>
        ))}
      </div>

      {/* ---------- 朝の一枚 ---------- */}
      <h2 style={sectionTitleStyle}>🌅 朝の一枚 — 今日の一手（{morning.length}件）</h2>
      {morning.length === 0 ? (
        <div style={cardStyle}>
          <p style={{ margin: 0, fontSize: 13, color: '#27AE60', fontWeight: 700 }}>打つべき一手はすべて打てています</p>
          <p style={{ margin: '4px 0 0', fontSize: 12, color: '#999' }}>新しい縁の種を探すなら、Claude Codeセッションで「リード探して」（/lead-scout）。</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {visibleMorning.map((m, i) => (
            <div key={i} style={{ ...cardStyle, padding: '12px 14px', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <span style={{ fontSize: 20, flexShrink: 0 }}>{m.icon}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 800, color: '#333' }}>
                  {m.org} <span style={{ color: '#38ADA9' }}>— {m.title}</span>
                </p>
                <p style={{ margin: '3px 0 0', fontSize: 11, color: '#999' }}>なぜ：{m.why}</p>
                <p style={{ margin: '2px 0 0', fontSize: 12, color: '#555' }}>動き：{m.how}</p>
              </div>
              {m.leadId ? (
                <button onClick={() => scrollToLead(m.leadId!)} style={jumpBtnStyle}>営業へ ↓</button>
              ) : m.jumpTab ? (
                <button onClick={() => goTab(m.jumpTab!)} style={jumpBtnStyle}>{m.jumpLabel} →</button>
              ) : null}
            </div>
          ))}
          {morning.length > 6 && (
            <button onClick={() => setShowAllMorning(v => !v)} style={{
              padding: '8px 0', borderRadius: 10, border: '1.5px dashed #ccc', background: 'none',
              color: '#888', fontSize: 12, fontWeight: 700, cursor: 'pointer',
            }}>{showAllMorning ? '折りたたむ' : `残り${morning.length - 6}件も見る`}</button>
          )}
        </div>
      )}

      {/* ---------- 送信済み・対応中（候補一覧から分けて表示） ---------- */}
      {sentRankedFeed.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <button onClick={() => setShowSent(v => !v)} style={{
            display: 'flex', alignItems: 'center', gap: 8, width: '100%', textAlign: 'left',
            padding: '10px 14px', borderRadius: 10, border: '1.5px solid #ddd', background: '#fafafa',
            color: '#666', fontSize: 12, fontWeight: 700, cursor: 'pointer',
          }}>
            <span>{showSent ? '▾' : '▸'}</span>
            <span>📤 送信済み・対応中（{sentRankedFeed.length}件）</span>
          </button>
          {showSent && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 6 }}>
              {sentRankedFeed.map(item => (
                <div key={item.key} style={{ ...cardStyle, padding: '9px 14px', display: 'flex', alignItems: 'center', gap: 10, opacity: 0.75 }}>
                  <span style={{ fontSize: 16, flexShrink: 0 }}>{item.icon}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#333' }}>
                      {item.name}
                      <span style={{ marginLeft: 8, padding: '1px 8px', borderRadius: 10, fontSize: 10, fontWeight: 700, background: item.badgeColor + '18', color: item.badgeColor }}>
                        {item.badge}
                      </span>
                    </p>
                    <p style={{ margin: '2px 0 0', fontSize: 11, color: '#999', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      理由：{item.reason}
                    </p>
                  </div>
                  {item.kind === 'lead' ? (
                    <button onClick={() => scrollToLead(item.leadId!)} style={jumpBtnStyle}>営業へ ↓</button>
                  ) : (
                    <>
                      <a href={smoutSearchUrl(item.name)} target="_blank" rel="noopener noreferrer" style={{ ...jumpBtnStyle, textDecoration: 'none', display: 'inline-block' }}>SMOUT ↗</a>
                      <button onClick={() => setView('relation')} style={jumpBtnStyle}>詳細へ →</button>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ---------- 営業リスト（縁の台帳＋自治体プロファイルを1本の温度順にまとめる） ---------- */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '24px 0 10px' }}>
        <h2 style={{ ...sectionTitleStyle, margin: 0 }}>📖 営業リスト（未接触{activeRankedFeed.length}件・温度順）</h2>
        <button onClick={() => setLedgerFilter(f => (f === 'active' ? 'all' : 'active'))} style={{
          ...jumpBtnStyle, borderColor: '#ccc', color: '#888',
        }}>{ledgerFilter === 'active' ? '見送りも表示' : '見送りを隠す'}</button>
        <button onClick={load} style={{ ...jumpBtnStyle, marginLeft: 'auto' }}>↻ 更新</button>
      </div>
      <p style={{ margin: '0 0 10px', fontSize: 11, color: '#999' }}>
        「学校・法人」のリードと「関係人口・自治体プロファイル」を、営業対象としての温度で1本にまとめた順位です。
        自治体プロファイルは提案余地・関わり方から換算した目安スコアです。理由の欄が、その順位にした根拠です。
        すでに送信・接触済みの相手は下の「📤 送信済み・対応中」に移り、ここには出てきません。
      </p>
      {activeRankedFeed.length === 0 ? (
        <div style={cardStyle}>
          <p style={{ margin: 0, fontSize: 13, color: '#999' }}>
            営業リストが空です。「学校・法人」タブでリードを追加するか、Claude Codeセッションで「リード探して」と頼んでください。
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {visibleRanked.map((item, i) => {
            if (item.kind === 'lead') {
              const entry = ledgerById.get(item.leadId!);
              if (!entry) return null;
              return (
                <EnCard
                  key={item.key} lead={entry.lead} records={entry.records} en={entry.en}
                  onAddRecord={addRecord} onRemoveRecord={removeRecord}
                  onStatusChange={(status) => patchLead(entry.lead.id, { status })}
                  goTab={goTab}
                  municipalityProfile={findProfileFor(entry.lead.org_name, municipalityProfiles)}
                />
              );
            }
            return (
              <div key={item.key} style={{ ...cardStyle, padding: '9px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 12, fontWeight: 800, color: '#bbb', width: 22, textAlign: 'right', flexShrink: 0 }}>{i + 1}</span>
                <span style={{ fontSize: 16, flexShrink: 0 }}>{item.icon}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#333' }}>
                    {item.name}
                    <span style={{ marginLeft: 8, padding: '1px 8px', borderRadius: 10, fontSize: 10, fontWeight: 700, background: item.badgeColor + '18', color: item.badgeColor }}>
                      {item.badge}
                    </span>
                  </p>
                  <p style={{ margin: '2px 0 0', fontSize: 11, color: '#999', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    理由：{item.reason}
                  </p>
                </div>
                <span style={{ fontSize: 13, fontWeight: 800, color: '#B7791F', flexShrink: 0 }}>{item.score}</span>
                <a href={smoutSearchUrl(item.name)} target="_blank" rel="noopener noreferrer" style={{ ...jumpBtnStyle, textDecoration: 'none', display: 'inline-block' }}>SMOUT ↗</a>
                <button onClick={() => setView('relation')} style={jumpBtnStyle}>詳細へ →</button>
              </div>
            );
          })}
          {activeRankedFeed.length > 15 && (
            <button onClick={() => setShowAllRanked(v => !v)} style={{
              padding: '8px 0', borderRadius: 10, border: '1.5px dashed #ccc', background: 'none',
              color: '#888', fontSize: 12, fontWeight: 700, cursor: 'pointer',
            }}>{showAllRanked ? '折りたたむ' : `残り${activeRankedFeed.length - 15}件も見る`}</button>
          )}
          {ledgerFilter === 'all' && ledger.filter(e => e.lead.status === 'lost').map(({ lead, records: leadRecords, en }) => (
            <EnCard
              key={lead.id} lead={lead} records={leadRecords} en={en}
              onAddRecord={addRecord} onRemoveRecord={removeRecord}
              onStatusChange={(status) => patchLead(lead.id, { status })}
              goTab={goTab}
              municipalityProfile={findProfileFor(lead.org_name, municipalityProfiles)}
            />
          ))}
        </div>
      )}

      {/* ---------- 便り（営業メール） ---------- */}
      <h2 style={sectionTitleStyle}>📮 便り（営業メール）の進み具合</h2>
      {emails.filter(e => !e.sent).length === 0 ? (
        <div style={cardStyle}>
          <p style={{ margin: 0, fontSize: 13, color: '#999' }}>
            未送信の便りはありません。送り先の追加はAIエージェント運営タブ、下書きはClaude Codeセッション（/sales-email）で。
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {emails.filter(e => !e.sent).map(e => (
            <div key={e.id} style={{ ...cardStyle, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 160 }}>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#333' }}>{e.company}</p>
                <p style={{ margin: '2px 0 0', fontSize: 11, color: '#999' }}>{e.email || '宛先未記入'}{e.hook ? ` ・ ${e.hook}` : ''}</p>
              </div>
              <button onClick={() => patchEmail(e.id, { drafted: !e.drafted })} style={{
                padding: '4px 10px', borderRadius: 14, fontSize: 11, fontWeight: 700, cursor: 'pointer',
                border: `1.5px solid ${e.drafted ? '#4A90E2' : '#ddd'}`,
                background: e.drafted ? '#4A90E218' : '#fff', color: e.drafted ? '#4A90E2' : '#999',
              }}>{e.drafted ? '✓ 下書き済み' : '下書き未'}</button>
              <button onClick={() => patchEmail(e.id, { sent: true })} style={{
                padding: '4px 10px', borderRadius: 14, fontSize: 11, fontWeight: 700, cursor: 'pointer',
                border: '1.5px solid #38ADA9', background: '#fff', color: '#38ADA9',
              }}>送った</button>
            </div>
          ))}
          <p style={{ margin: 0, fontSize: 11, color: '#bbb' }}>※送信はご自身のメールソフトから。ここは記録だけ。</p>
        </div>
      )}
      </>}
    </div>
  );
}

const OPPORTUNITY_COLORS: Record<string, string> = { 高: '#27AE60', 中: '#E5A139', 低: '#999' };

// ---------- 縁の台帳カード（1リード分） ----------
function EnCard({ lead, records, en, onAddRecord, onRemoveRecord, onStatusChange, goTab, municipalityProfile }: {
  lead: { id: string; client_type: string; org_name: string; contact_name: string | null; email: string | null; phone: string | null; status: string; memo: string | null };
  records: EnRecord[];
  en: EnBreakdown;
  onAddRecord: (leadId: string, kind: EnKind, note: string, happenedAt: string) => Promise<boolean>;
  onRemoveRecord: (id: string) => void;
  onStatusChange: (status: string) => void;
  goTab: (tab: string) => void;
  municipalityProfile?: { id: string; region_name: string; opportunity_level: string; relation_population_initiative: string | null };
}) {
  const [open, setOpen] = useState(false);
  const [addKind, setAddKind] = useState<EnKind | null>(null);
  const [note, setNote] = useState('');
  const [happenedAt, setHappenedAt] = useState('');
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (!addKind || !note.trim()) return;
    setSaving(true);
    const ok = await onAddRecord(lead.id, addKind, note.trim(), happenedAt);
    setSaving(false);
    if (ok) { setNote(''); setHappenedAt(''); setAddKind(null); }
  }

  const bars: { kind: EnKind; value: number }[] = [
    { kind: 'trace', value: en.konseki },
    { kind: 'yohaku', value: en.yohaku },
    { kind: 'action', value: en.kyodo },
    { kind: 'suijo', value: en.suijo },
  ];

  return (
    <div id={`en-card-${lead.id}`} style={cardStyle}>
      {/* 見出し行 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 14, fontWeight: 800, color: '#333' }}>
          {lead.client_type === 'school' ? '🏫' : '🏢'} {lead.org_name}
        </span>
        <span style={{ padding: '2px 9px', borderRadius: 12, fontSize: 10, fontWeight: 700, background: en.stageColor + '18', color: en.stageColor }}>
          {en.stage}
        </span>
        <span style={{ fontSize: 11, color: '#999' }}>{en.freshnessLabel}（{en.daysSinceTouch === 999 ? '接点記録なし' : `${en.daysSinceTouch}日前`}）</span>
        {municipalityProfile && (
          <span
            title={municipalityProfile.relation_population_initiative ?? '関係人口ダッシュボードで詳細を見る'}
            onClick={() => goTab('relation')}
            style={{
              padding: '2px 9px', borderRadius: 12, fontSize: 10, fontWeight: 700, cursor: 'pointer',
              background: (OPPORTUNITY_COLORS[municipalityProfile.opportunity_level] ?? '#999') + '18',
              color: OPPORTUNITY_COLORS[municipalityProfile.opportunity_level] ?? '#999',
            }}
          >🏛 関係人口の提案余地：{municipalityProfile.opportunity_level}</span>
        )}
        <span style={{ marginLeft: 'auto', fontSize: 13, fontWeight: 800, color: '#B7791F' }}>
          縁 {en.enLive}
          <span style={{ fontSize: 10, fontWeight: 400, color: '#bbb' }}>（素点{en.en}×鮮度{en.freshness}）</span>
        </span>
      </div>

      {/* 方程式の内訳バー */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: 8, margin: '10px 0 4px' }}>
        {bars.map(({ kind, value }) => {
          const meta = EN_KINDS[kind];
          return (
            <div key={kind} title={meta.hint}>
              <p style={{ margin: '0 0 3px', fontSize: 10, fontWeight: 700, color: meta.color }}>
                {meta.icon} {meta.label} {value}/10
              </p>
              <div style={{ height: 6, borderRadius: 3, background: '#f0f0f0', overflow: 'hidden' }}>
                <div style={{ width: `${value * 10}%`, height: '100%', background: meta.color, borderRadius: 3 }} />
              </div>
            </div>
          );
        })}
      </div>
      <p style={{ margin: '4px 0 0', fontSize: 10, color: '#bbb' }}>
        出会い {en.deai}/100（事実×共感） ＋ 行動×恩返し {Math.round(en.kyodo * en.suijo)}/100 ＝ 縁 {en.en}/200
      </p>

      {/* 次の一手 */}
      <div style={{ margin: '8px 0 0', padding: '8px 12px', borderRadius: 10, background: '#F4FAF9', border: '1px solid #DDF0EE' }}>
        <p style={{ margin: 0, fontSize: 12, fontWeight: 800, color: '#2A8580' }}>🧭 次の一手：{en.nextMove.title}</p>
        <p style={{ margin: '2px 0 0', fontSize: 11, color: '#777' }}>{en.nextMove.how}</p>
      </div>

      {/* 記録の追加ボタン */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
        {(Object.keys(EN_KINDS) as EnKind[]).map(kind => {
          const meta = EN_KINDS[kind];
          const active = addKind === kind;
          return (
            <button key={kind} title={meta.hint} onClick={() => setAddKind(active ? null : kind)} style={{
              padding: '4px 11px', borderRadius: 14, fontSize: 11, fontWeight: 700, cursor: 'pointer',
              border: `1.5px solid ${meta.color}`, background: active ? meta.color : '#fff',
              color: active ? '#fff' : meta.color,
            }}>＋{meta.icon} {meta.label}</button>
          );
        })}
        <button onClick={() => setOpen(v => !v)} style={{
          padding: '4px 11px', borderRadius: 14, fontSize: 11, cursor: 'pointer',
          border: '1px solid #ddd', background: '#fff', color: '#888', marginLeft: 'auto',
        }}>{open ? '記録を閉じる ▴' : `記録 ${records.length}本を見る ▾`}</button>
      </div>

      {/* 記録の入力フォーム */}
      {addKind && (
        <div style={{ marginTop: 8, padding: 10, borderRadius: 10, background: EN_KINDS[addKind].color + '0D', border: `1px solid ${EN_KINDS[addKind].color}33` }}>
          <p style={{ margin: '0 0 6px', fontSize: 11, color: EN_KINDS[addKind].color }}>{EN_KINDS[addKind].hint}</p>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <input
              value={note} onChange={e => setNote(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') submit(); }}
              placeholder={`${EN_KINDS[addKind].label}をひと言で`}
              style={{ ...inputStyle, flex: '1 1 220px' }} autoFocus
            />
            <input type="date" value={happenedAt} onChange={e => setHappenedAt(e.target.value)} style={{ ...inputStyle, flex: '0 0 auto' }} />
            <button onClick={submit} disabled={saving || !note.trim()} style={{
              padding: '8px 16px', borderRadius: 8, border: 'none', fontSize: 12, fontWeight: 700,
              background: saving || !note.trim() ? '#ccc' : EN_KINDS[addKind].color, color: '#fff', cursor: 'pointer',
            }}>{saving ? '記録中…' : '記録する'}</button>
          </div>
        </div>
      )}

      {/* 記録一覧・ステータス（開いた時だけ） */}
      {open && (
        <div style={{ marginTop: 10, borderTop: '1px solid #f0f0f0', paddingTop: 10 }}>
          {records.length === 0 ? (
            <p style={{ margin: '0 0 8px', fontSize: 12, color: '#bbb' }}>まだ記録がありません。最初の一本は🔍事実から。</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 8 }}>
              {records.map(r => {
                const meta = EN_KINDS[r.kind];
                return (
                  <div key={r.id} style={{ display: 'flex', alignItems: 'baseline', gap: 8, fontSize: 12 }}>
                    <span style={{ color: meta.color, fontWeight: 700, flexShrink: 0 }}>{meta.icon} {meta.label}</span>
                    <span style={{ color: '#444', flex: 1 }}>{r.note}</span>
                    <span style={{ color: '#bbb', fontSize: 10, flexShrink: 0 }}>{r.happened_at}</span>
                    <button onClick={() => onRemoveRecord(r.id)} style={{ border: 'none', background: 'none', color: '#ccc', fontSize: 11, cursor: 'pointer', flexShrink: 0 }}>×</button>
                  </div>
                );
              })}
            </div>
          )}
          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', alignItems: 'center' }}>
            {LEAD_STATUSES.map(s => (
              <button key={s.key} onClick={() => onStatusChange(s.key)} style={{
                padding: '3px 9px', borderRadius: 14, fontSize: 10, cursor: 'pointer',
                border: `1.5px solid ${lead.status === s.key ? s.color : '#ddd'}`,
                background: lead.status === s.key ? s.color + '18' : '#fff',
                color: lead.status === s.key ? s.color : '#999', fontWeight: lead.status === s.key ? 700 : 400,
              }}>{s.label}</button>
            ))}
            <button onClick={() => goTab('leads')} style={{ ...jumpBtnStyle, marginLeft: 'auto' }}>証拠パック・提案書は学校・法人タブ →</button>
          </div>
        </div>
      )}
    </div>
  );
}
