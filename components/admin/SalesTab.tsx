'use client';

// 縁の司令室 — 営業自動化ダッシュボード。
// ファネル型CRM（候補を「落とす」発想）を捨て、ヒトマップの核心方程式
//   出会い ＝ 事実 × 共感　／　縁 ＝ 出会い ＋ 行動 × 恩返し
// をそのまま実装する。相手ごとに「縁の台帳」（事実・共感・行動・恩返しの記録）を持ち、
// 方程式のどこが欠けているかから「今日の一手」をルールベースで自動導出する（lib/enScore.ts）。
// 外部送信は一切ここからは行わない。自動化するのは「判断の迷い」の除去だけ。
import { useCallback, useEffect, useMemo, useState } from 'react';
import { computeEn, EN_KINDS, type EnKind, type EnRecord, type EnBreakdown } from '@/lib/enScore';
import { computeFollowUp } from '@/lib/followUp';
import { scoreLead } from '@/lib/leadTemperature';
import { municipalityScore, SALES_SCORE_CRITERIA } from '@/lib/salesScore';
import { coreRegionName, smoutSearchUrl } from '@/lib/smout';
import { computeMrr } from '@/lib/dealMetrics';
import { buildUnifiedFollowQueue, type FollowQueueItem } from '@/lib/followQueue';
import RelationPopulationTab from '@/components/admin/RelationPopulationTab';
import OutreachStatus from '@/components/admin/OutreachStatus';
import ClientLeadsTab from '@/components/admin/ClientLeadsTab';
import FlowBoard from '@/components/admin/sales/FlowBoard';
import SendQueuePanel from '@/components/admin/sales/SendQueuePanel';
import DossiersSection from '@/components/admin/sales/DossiersSection';
import EmailTargetsEditor from '@/components/admin/sales/EmailTargetsEditor';

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
  email_sent_at?: string | null; email_reply?: string | null; followed_up_at?: string | null; reply_handled_at?: string | null;
}
interface BusinessCase {
  id: string; org_name: string; client_type: string; stage: string;
  evidence: string | null; proposal_link: string | null; next_action: string | null; lead_ref: string | null;
  last_contact_at?: string | null;
}
interface EmailTarget {
  id: string; company: string; email: string | null; hook: string | null; drafted: boolean; sent: boolean;
  updated_at?: string | null;
  email_sent_at?: string | null; email_reply?: string | null; followed_up_at?: string | null; reply_handled_at?: string | null;
}
interface ClientDossier {
  id: string; org_name: string; plan: string | null; monthly_fee: number | null;
  contact_name: string | null; start_date: string | null; next_meeting: string | null; notes: string | null;
}
interface MunicipalityProfile {
  id: string; region_name: string; opportunity_level: string; relation_population_initiative: string | null;
  engagement_stage: string; fit_assessment: string | null; opportunity_notes: string | null; evidence_summary: string | null;
  email_sent_at: string | null; email_reply: string | null; followed_up_at: string | null; on_hold: boolean;
  reply_handled_at?: string | null;
}
interface CalendarEvent {
  title: string; start: string | null; end: string | null; all_day: boolean; location: string; html_link: string;
}

// 自治体プロファイルのスコア換算は lib/salesScore.ts に集約（縁スコアと同じ0-200の物差しだが
// 「手動評価ベースの見立て」であり意味が違うため、ランキングでは種別バッジを付けて区別する）。
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
  switchView?: SalesView; // ledger/relationのタブ自体を切り替えるため（jumpTabとは別物）
}

// 営業タブ内のサブビュー。いずれも独立タブではないので、ページのタブ切替（page.tsxのgoTab）に
// 流してはいけない（TAB_METAに存在せず、コンテンツ領域が空になる）。goTabOrSwitchViewで横取りする。
const SALES_VIEWS = ['ledger', 'relation', 'leads', 'cases', 'dossiers', 'sendqueue'] as const;
type SalesView = typeof SALES_VIEWS[number];

// サブビューを「見る画面」と「書く画面（台帳）」に分けて並べる。
// 案件・顧問先は AIOpsTab（AIエージェント運営）から移設したもの。
const VIEW_GROUPS: { label: string; views: { key: SalesView; label: string }[] }[] = [
  { label: '見る', views: [
    { key: 'ledger', label: '🧭 営業' },
    { key: 'relation', label: '🔁 関係人口・自治体' },
    { key: 'sendqueue', label: '📤 送信キュー' },
  ] },
  { label: '台帳', views: [
    { key: 'leads', label: '🎓 学校・法人' },
    { key: 'cases', label: '📇 商流ボード' },
    { key: 'dossiers', label: '🤝 顧問先' },
  ] },
];

export default function SalesTab({ authHeaders, goTab }: { authHeaders: () => HeadersInit; goTab: (tab: string) => void }) {
  const [leads, setLeads] = useState<ClientLead[]>([]);
  const [records, setRecords] = useState<EnRecord[]>([]);
  const [cases, setCases] = useState<BusinessCase[]>([]);
  const [emails, setEmails] = useState<EmailTarget[]>([]);
  const [dossiers, setDossiers] = useState<ClientDossier[]>([]);
  const [municipalityProfiles, setMunicipalityProfiles] = useState<MunicipalityProfile[]>([]);
  const [calendarToday, setCalendarToday] = useState<CalendarEvent[]>([]);
  const [needsMigration, setNeedsMigration] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  // ナビ整理で独立タブ「学校・法人」を廃止し、営業ハブのサブビューに吸収（サイドバー整理2026-07-20）
  const [view, setView] = useState<SalesView>('ledger');
  const [showEmailEditor, setShowEmailEditor] = useState(false);
  // EnCard内の「学校・法人へ」「関係人口へ」ボタン用：これらは独立タブではなくこのタブのサブビューなので、
  // ページ遷移ではなくローカルのview切替に差し替える（他の宛先はそのままpage.tsxのgoTabへ）。
  // 'relation' を横取りし損ねると page.tsx 側に該当タブが無く画面が真っ白になるため、配列で一括判定する。
  const goTabOrSwitchView = useCallback((target: string) => {
    if ((SALES_VIEWS as readonly string[]).includes(target)) { setView(target as SalesView); return; }
    goTab(target);
  }, [goTab]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [leadsRes, recordsRes, casesRes, emailsRes, dossiersRes, profilesRes, calendarRes] = await Promise.all([
        fetch('/api/admin/client-leads', { headers: authHeaders() }).then(r => r.json()),
        fetch('/api/admin/en-records', { headers: authHeaders() }).then(r => r.json()),
        fetch('/api/admin/business-cases', { headers: authHeaders() }).then(r => r.json()),
        fetch('/api/admin/sales-email-targets', { headers: authHeaders() }).then(r => r.json()),
        fetch('/api/admin/client-dossiers', { headers: authHeaders() }).then(r => r.json()),
        fetch('/api/admin/municipality-profiles', { headers: authHeaders() }).then(r => r.json()).catch(() => ({ ok: false })),
        fetch('/api/admin/calendar', { headers: authHeaders() }).then(r => r.json()).catch(() => ({ ok: false, connected: false, today: [] })),
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
      if (calendarRes.ok && calendarRes.connected) setCalendarToday(calendarRes.today ?? []);
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
    const res = await fetch(`/api/admin/client-leads/${id}`, { method: 'PATCH', headers: jsonHeaders(), body: JSON.stringify(fields) });
    const data = await res.json().catch(() => ({ ok: false }));
    if (!data.ok) { setError(data.error ?? '更新に失敗しました'); return false; }
    await load();
    return true;
  }
  async function patchEmail(id: string, fields: Partial<EmailTarget>) {
    const res = await fetch(`/api/admin/sales-email-targets/${id}`, { method: 'PATCH', headers: jsonHeaders(), body: JSON.stringify(fields) });
    const data = await res.json().catch(() => ({ ok: false }));
    if (!data.ok) { setError(data.error ?? '更新に失敗しました'); return false; }
    await load();
    return true;
  }
  async function patchMunicipality(id: string, fields: Partial<MunicipalityProfile>) {
    const res = await fetch(`/api/admin/municipality-profiles/${id}`, { method: 'PATCH', headers: jsonHeaders(), body: JSON.stringify(fields) });
    const data = await res.json().catch(() => ({ ok: false }));
    if (!data.ok) { setError(data.error ?? '更新に失敗しました'); return false; }
    await load();
    return true;
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
  const monthlyRecurring = computeMrr(dossiers);
  const pendingApproval = cases.filter(c => c.stage === '承認待ち');
  const draftedUnsent = emails.filter(e => e.drafted && !e.sent);
  // 統合フォローキュー：学校・法人／便り／自治体／案件（フォロー段階）／顧問先を同じ基準で並べる。
  // ⏰要フォローのKPIカードと朝の一枚（client_lead/email_target/caseの3ソース）の両方がこれを使う。
  const followQueue: FollowQueueItem[] = useMemo(() => buildUnifiedFollowQueue({
    leads: leads.map(l => ({ id: l.id, org_name: l.org_name, email_sent_at: l.email_sent_at ?? null, email_reply: l.email_reply ?? null, followed_up_at: l.followed_up_at ?? null, status: l.status })),
    emailTargets: emails.map(e => ({ id: e.id, company: e.company, email_sent_at: e.email_sent_at ?? null, email_reply: e.email_reply ?? null, followed_up_at: e.followed_up_at ?? null })),
    municipalities: municipalityProfiles.map(p => ({ id: p.id, region_name: p.region_name, email_sent_at: p.email_sent_at, email_reply: p.email_reply, followed_up_at: p.followed_up_at, on_hold: p.on_hold })),
    cases: cases.map(c => ({ id: c.id, org_name: c.org_name, stage: c.stage, last_contact_at: c.last_contact_at ?? null })),
    dossiers: dossiers.map(d => ({ id: d.id, org_name: d.org_name, next_meeting: d.next_meeting })),
  }), [leads, emails, municipalityProfiles, cases, dossiers]);
  const overdueFollowUps = useMemo(() => followQueue.filter(i => i.status === 'overdue'), [followQueue]);

  // ---------- 返信あり専用導線 ----------
  // 返信は来ているのにダッシュボード上で「返信が来た案件だけ」を集めて見る場所が無く、
  // Discord通知を流し見るだけになっていた。email_replyがあってreply_handled_atが未設定のものを
  // 3ソース横断でここに集める。「対応済みにする」を押すと一覧から消える。
  interface ReplyInboxItem {
    source: 'lead' | 'email_target' | 'municipality';
    id: string; name: string; reply: string; icon: string;
    onHandle: () => void; switchView?: SalesView;
  }
  const replyInbox: ReplyInboxItem[] = useMemo(() => {
    const items: ReplyInboxItem[] = [];
    for (const l of leads) {
      if (l.email_reply && !l.reply_handled_at) {
        items.push({
          source: 'lead', id: l.id, name: l.org_name, reply: l.email_reply, icon: '🎓',
          onHandle: () => patchLead(l.id, { reply_handled_at: new Date().toISOString() }), switchView: 'leads',
        });
      }
    }
    for (const e of emails) {
      if (e.email_reply && !e.reply_handled_at) {
        items.push({
          source: 'email_target', id: e.id, name: e.company, reply: e.email_reply, icon: '📮',
          onHandle: () => patchEmail(e.id, { reply_handled_at: new Date().toISOString() }),
        });
      }
    }
    for (const p of municipalityProfiles) {
      if (p.email_reply && !p.reply_handled_at) {
        items.push({
          source: 'municipality', id: p.id, name: p.region_name, reply: p.email_reply, icon: '🏛',
          onHandle: () => patchMunicipality(p.id, { reply_handled_at: new Date().toISOString() }), switchView: 'relation',
        });
      }
    }
    return items;
  }, [leads, emails, municipalityProfiles]);

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
        switchView: 'cases', jumpLabel: '案件を開く',
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
    // 返信が無いまま日数が経った自治体（送った後も使えるダッシュボードにするための要フォロー）
    for (const p of municipalityProfiles) {
      if (p.on_hold) continue;
      const fu = computeFollowUp(p);
      if (fu?.status !== 'overdue') continue;
      items.push({
        priority: 0.7, icon: '⏰', org: p.region_name,
        title: `返信が無いまま${fu.daysSince}日経っています`,
        why: '送った後のフォローがないと、せっかくの出会いが冷めてしまいます',
        how: '電話・再送などでフォローし、関係人口タブで「フォロー済みにする」を押す',
        switchView: 'relation',
      });
    }
    // 統合フォローキューのうち、自治体・顧問先以外（学校・法人／便り／案件のフォロー段階）は
    // ここに専用の一手が無かったので追加する。自治体・顧問先は上の2ループが個別の文言で既に扱っている。
    for (const item of followQueue) {
      if (item.source !== 'client_lead' && item.source !== 'email_target' && item.source !== 'case') continue;
      items.push({
        priority: item.status === 'overdue' ? 0.7 : 1.5,
        icon: item.icon, org: item.name,
        title: item.label,
        why: '送った後のフォローがないと、せっかくの出会いが冷めてしまいます',
        how: item.suggestedAction,
        switchView: item.source === 'client_lead' ? 'leads' : item.source === 'case' ? 'cases' : undefined,
      });
    }
    // 今日のカレンダー予定と営業対象の名前を突き合わせ、一致するものだけ朝の一枚に載せる
    const salesNames = [...leads.map(l => l.org_name), ...municipalityProfiles.map(p => p.region_name)];
    for (const ev of calendarToday) {
      const matched = salesNames.find(name => ev.title.includes(coreRegionName(name)));
      if (!matched) continue;
      const time = ev.all_day ? '終日' : (ev.start ? new Date(ev.start).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' }) : '');
      items.push({
        priority: 0.2, icon: '🗓', org: matched,
        title: `今日${time ? time + '　' : ''}「${ev.title}」`,
        why: 'カレンダーの予定と営業対象が一致しました',
        how: '予定前にカルテ・台帳を見直し、渡せるものをひとつ用意する',
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
          switchView: 'dossiers', jumpLabel: 'カルテを開く',
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
  }, [pendingApproval, draftedUnsent, dossiers, activeLedger, municipalityProfiles, calendarToday, leads, followQueue]);

  const [showAllMorning, setShowAllMorning] = useState(false);
  const visibleMorning = showAllMorning ? morning : morning.slice(0, 6);

  // ---------- 台帳の並び・絞り込み ----------
  const [ledgerFilter, setLedgerFilter] = useState<'active' | 'all'>('active');

  function scrollToLead(leadId: string) {
    // 営業リストは上位15件のみ表示（折りたたみ）のため、スコアが低くまだ折りたたみの外にいる
    // リード（追加直後で記録が無いものなど）はDOMに存在せず、そのままではスクロールが反応しない。
    // 先に「すべて表示」を開いたうえで、対象の要素が実際にDOMへ挿入されるまで
    // MutationObserverで監視してからスクロールする（83件規模の再描画は固定時間のポーリングでは
    // 環境によって間に合わないことがあるため、時間ではなく「挿入イベント」を待つ）。
    // behaviorは'smooth'ではなく'auto'（瞬時）にする：挿入直後は残りのリスト（68件超）の
    // 再描画がまだ主スレッドで続いており、smoothのアニメーションがその途中で
    // ブラウザにキャンセルされ、何も起きなかったように見える不具合を実測で確認したため。
    setShowAllRanked(true);
    setLedgerFilter('all');
    const targetId = `en-card-${leadId}`;

    const scrollIfFound = (): boolean => {
      const el = document.getElementById(targetId);
      if (!el) return false;
      el.scrollIntoView({ behavior: 'auto', block: 'center' });
      return true;
    };

    if (scrollIfFound()) return;
    const observer = new MutationObserver(() => {
      if (scrollIfFound()) observer.disconnect();
    });
    observer.observe(document.body, { childList: true, subtree: true });
    setTimeout(() => observer.disconnect(), 8000); // 保険：8秒で監視終了
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
      if (p.on_hold) continue;
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
  const [showCriteria, setShowCriteria] = useState(false);

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

      {/* ---------- サブビュー切り替え ----------
          「見る画面」と「書く画面（台帳）」の2群に分ける。ピルが5つ横並びだとスマホで
          はみ出すため、群ごとに改行し flexWrap も付ける。 */}
      <div style={{ margin: '14px 0' }}>
        {VIEW_GROUPS.map(group => (
          <div key={group.label} style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginBottom: 6 }}>
            <span style={{ fontSize: 10.5, color: '#aaa', fontWeight: 700, flexShrink: 0, width: 42 }}>{group.label}</span>
            {group.views.map(v => (
              <button key={v.key} onClick={() => setView(v.key)} style={{
                padding: '7px 14px', borderRadius: 16, border: 'none', cursor: 'pointer', fontSize: 12.5, fontWeight: 700,
                background: view === v.key ? '#38ADA9' : '#fff', color: view === v.key ? '#fff' : '#666',
                boxShadow: view === v.key ? 'none' : '0 1px 3px rgba(0,0,0,0.08)', fontFamily: 'inherit',
              }}>{v.label}</button>
            ))}
          </div>
        ))}
      </div>

      {view === 'relation' && <RelationPopulationTab authHeaders={authHeaders} />}
      {view === 'leads' && <ClientLeadsTab authHeaders={authHeaders} />}
      {view === 'cases' && <FlowBoard authHeaders={authHeaders} />}
      {view === 'dossiers' && <DossiersSection authHeaders={authHeaders} />}
      {view === 'sendqueue' && <SendQueuePanel authHeaders={authHeaders} />}

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

      {/* ---------- 返信あり専用導線 ---------- */}
      {replyInbox.length > 0 && (
        <div style={{ marginTop: 14 }}>
          <h2 style={{ ...sectionTitleStyle, margin: '0 0 10px', color: '#8E44AD' }}>
            📬 返信あり — 対応待ち（{replyInbox.length}件）
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {replyInbox.map(item => (
              <div key={`${item.source}-${item.id}`} style={{ ...cardStyle, borderLeft: '4px solid #8E44AD' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                  <div style={{ minWidth: 0 }}>
                    <b style={{ fontSize: 13.5 }}>{item.icon} {item.name}</b>
                    <p style={{ margin: '6px 0 0', fontSize: 12.5, color: '#555', lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>
                      {item.reply.length > 220 ? `${item.reply.slice(0, 220)}…` : item.reply}
                    </p>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0 }}>
                    {item.switchView && (
                      <button onClick={() => setView(item.switchView!)} style={jumpBtnStyle}>台帳を開く</button>
                    )}
                    <button onClick={item.onHandle} style={{
                      padding: '4px 10px', borderRadius: 14, border: 'none', background: '#8E44AD',
                      color: '#fff', fontSize: 11, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap',
                    }}>対応済みにする</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ---------- 計器盤 ---------- */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(128px, 1fr))', gap: 10, margin: '14px 0 4px' }}>
        {[
          { label: '営業対象', value: `${activeLedger.length}件`, sub: `記録 ${records.length}本`, color: '#4A69BD' },
          { label: '火が消えかけ', value: `${coldCount}件`, sub: '45日以上で❄', color: '#E55039' },
          { label: '送信待ち', value: `${pendingApproval.length}件`, sub: '会長の確認待ち', color: '#E5A139' },
          { label: '便り（未送信）', value: `${emails.filter(e => !e.sent).length}件`, sub: `下書き済 ${draftedUnsent.length}件`, color: '#8E44AD' },
          { label: '結ばれた縁', value: `${Math.max(contracted.length, dossiers.length)}社`, sub: `月額計 ${monthlyRecurring.toLocaleString()}円`, color: '#27AE60' },
        ].map(kpi => (
          <div key={kpi.label} style={{ ...cardStyle, padding: '12px 14px', borderTop: `3px solid ${kpi.color}` }}>
            <p style={{ margin: 0, fontSize: 11, color: '#999', fontWeight: 700 }}>{kpi.label}</p>
            <p style={{ margin: '4px 0 2px', fontSize: 17, fontWeight: 800, color: '#333' }}>{kpi.value}</p>
            <p style={{ margin: 0, fontSize: 11, color: '#aaa' }}>{kpi.sub}</p>
          </div>
        ))}
        <button onClick={() => {
          setShowSent(true);
          requestAnimationFrame(() => document.getElementById('sent-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
        }} style={{
          ...cardStyle, padding: '12px 14px', borderTop: '3px solid #999', textAlign: 'left',
          border: 'none', cursor: sentRankedFeed.length > 0 ? 'pointer' : 'default', fontFamily: 'inherit',
        }}>
          <p style={{ margin: 0, fontSize: 11, color: '#999', fontWeight: 700 }}>📤 送信済み・対応中</p>
          <p style={{ margin: '4px 0 2px', fontSize: 17, fontWeight: 800, color: '#333' }}>{sentRankedFeed.length}件</p>
          <p style={{ margin: 0, fontSize: 11, color: '#38ADA9', fontWeight: 700 }}>{sentRankedFeed.length > 0 ? 'クリックで表示 ↓' : '一覧の下に表示されます'}</p>
        </button>
        <button onClick={() => setView('relation')} style={{
          ...cardStyle, padding: '12px 14px', borderTop: '3px solid #E74C3C', textAlign: 'left',
          border: 'none', cursor: 'pointer', fontFamily: 'inherit',
        }}>
          <p style={{ margin: 0, fontSize: 11, color: '#999', fontWeight: 700 }}>⏰ 要フォロー</p>
          <p style={{ margin: '4px 0 2px', fontSize: 17, fontWeight: 800, color: '#333' }}>{overdueFollowUps.length}件</p>
          <p style={{ margin: 0, fontSize: 11, color: '#E74C3C', fontWeight: 700 }}>返信10日以上待ち</p>
        </button>
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
              ) : m.switchView ? (
                <button onClick={() => setView(m.switchView!)} style={jumpBtnStyle}>詳細へ →</button>
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
        <div id="sent-section" style={{ marginTop: 16 }}>
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
        <h2 style={{ ...sectionTitleStyle, margin: 0 }}>📖 営業リスト（未接触{activeRankedFeed.length}件・価値の高い順）</h2>
        <button onClick={() => setLedgerFilter(f => (f === 'active' ? 'all' : 'active'))} style={{
          ...jumpBtnStyle, borderColor: '#ccc', color: '#888',
        }}>{ledgerFilter === 'active' ? '見送りも表示' : '見送りを隠す'}</button>
        <button onClick={load} style={{ ...jumpBtnStyle, marginLeft: 'auto' }}>↻ 更新</button>
      </div>
      <p style={{ margin: '0 0 8px', fontSize: 11, color: '#999' }}>
        「学校・法人」のリードと「関係人口・自治体プロファイル」を、営業対象としての価値で1本にまとめた順位です。
        リードは<b>縁スコア</b>（積み上げて稼いだ関係の深さ）、自治体は<b>手動評価</b>（提案余地タグからの見立て）で、
        同じ数値でも意味が違います。理由の欄が、その順位にした根拠です。
        すでに送信・接触済みの相手は下の「📤 送信済み・対応中」に移り、ここには出てきません。
      </p>

      {/* ---------- スコアの見方（基準の明示。docs/営業スコアの基準_20260720.md と同じ内容） ---------- */}
      <button onClick={() => setShowCriteria(v => !v)} style={{
        ...jumpBtnStyle, borderColor: '#B7791F', color: '#B7791F', marginBottom: 10,
      }}>{showCriteria ? '▲ スコアの見方を閉じる' : '▼ スコアの見方（何を根拠に順位を付けているか）'}</button>
      {showCriteria && (
        <div style={{ ...cardStyle, marginBottom: 12, background: '#FffdF7' }}>
          <p style={{ margin: '0 0 10px', fontSize: 12, color: '#777', lineHeight: 1.7 }}>
            営業リストの並び順は「意味の違う2種類のスコア（縁＝稼いだ深さ／手動評価＝見立て）」を同じ0〜200の物差しで並べたものです。
            各行の色バッジで種別が分かります。以下が全スコアの配点基準です。
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {SALES_SCORE_CRITERIA.map(block => (
              <div key={block.key}>
                <p style={{ margin: '0 0 3px', fontSize: 12.5, fontWeight: 800, color: '#444' }}>{block.icon} {block.title}</p>
                <p style={{ margin: '0 0 5px', fontSize: 11, color: '#999', lineHeight: 1.6 }}>{block.meaning}</p>
                <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '2px 10px', fontSize: 11, color: '#666' }}>
                  {block.rows.map((r, ri) => (
                    <div key={ri} style={{ display: 'contents' }}>
                      <span style={{ color: '#888', whiteSpace: 'nowrap' }}>{r.when}</span>
                      <span style={{ fontWeight: 600 }}>{r.points}</span>
                    </div>
                  ))}
                </div>
                {block.note && <p style={{ margin: '4px 0 0', fontSize: 10.5, color: '#B7791F' }}>※ {block.note}</p>}
              </div>
            ))}
          </div>
        </div>
      )}
      {activeRankedFeed.length === 0 ? (
        <div style={cardStyle}>
          <p style={{ margin: 0, fontSize: 13, color: '#999' }}>
            営業リストが空です。上の「🎓 学校・法人（台帳）」でリードを追加するか、Claude Codeセッションで「リード探して」と頼んでください。
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
                  goTab={goTabOrSwitchView}
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
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', flexShrink: 0 }}>
                  <span style={{ fontSize: 13, fontWeight: 800, color: '#B7791F' }}>{item.score}</span>
                  <span style={{ fontSize: 9, fontWeight: 700, color: '#B7791F', background: '#B7791F14', padding: '1px 5px', borderRadius: 8 }}>手動評価</span>
                </div>
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
              goTab={goTabOrSwitchView}
              municipalityProfile={findProfileFor(lead.org_name, municipalityProfiles)}
            />
          ))}
        </div>
      )}

      {/* ---------- 便り（営業メール）：送信後まで1つのライフサイクルで管理 ---------- */}
      <h2 style={sectionTitleStyle}>📮 便り（営業メール）の進み具合</h2>
      {/* 送り先の追加・編集はAIエージェント運営タブにあったが、同じテーブルを2箇所で
          編集できる状態だったため、表示（下の一覧）と同じ場所へ折りたたみで内包した */}
      <button onClick={() => setShowEmailEditor(v => !v)} style={{
        ...jumpBtnStyle, marginBottom: 8,
      }}>{showEmailEditor ? '▴ 送り先の編集を閉じる' : '▾ 送り先を追加・編集する'}</button>
      {showEmailEditor && (
        <div style={{ ...cardStyle, marginBottom: 10 }}>
          <EmailTargetsEditor authHeaders={authHeaders} onChanged={load} />
        </div>
      )}
      {(() => {
        // 送信時刻(email_sent_at)を正とし、旧sent(bool)だけの行はupdated_atで補完する
        const effSentAt = (e: EmailTarget) => e.email_sent_at ?? (e.sent ? (e.updated_at ?? null) : null);
        const isReplied = (e: EmailTarget) => Boolean(e.email_reply && e.email_reply.trim());
        const unsent = emails.filter(e => !effSentAt(e));
        const awaiting = emails.filter(e => effSentAt(e) && !isReplied(e));

        function markSent(e: EmailTarget) { patchEmail(e.id, { sent: true, email_sent_at: new Date().toISOString() }); }
        function markFollowedUp(e: EmailTarget) { patchEmail(e.id, { followed_up_at: new Date().toISOString() }); }
        function markReplied(e: EmailTarget) { patchEmail(e.id, { email_reply: '（返信あり）' }); }
        function unsend(e: EmailTarget) { patchEmail(e.id, { sent: false, email_sent_at: null }); }

        const row = (e: EmailTarget, sentAt: string | null) => (
          <div key={e.id} style={{ ...cardStyle, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 160 }}>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#333' }}>{e.company}</p>
              <p style={{ margin: '2px 0 0', fontSize: 11, color: '#999' }}>{e.email || '宛先未記入'}{e.hook ? ` ・ ${e.hook}` : ''}</p>
            </div>
            <OutreachStatus
              state={{ drafted: e.drafted, email_sent_at: sentAt, email_reply: e.email_reply, followed_up_at: e.followed_up_at }}
              onMarkDrafted={() => patchEmail(e.id, { drafted: !e.drafted })}
              onMarkSent={() => markSent(e)}
              onMarkFollowedUp={() => markFollowedUp(e)}
              onMarkReplied={() => markReplied(e)}
              onUnsend={() => unsend(e)}
            />
          </div>
        );

        if (unsent.length === 0 && awaiting.length === 0) {
          return (
            <div style={cardStyle}>
              <p style={{ margin: 0, fontSize: 13, color: '#999' }}>
                便りはありません。送り先の追加・下書きはClaude Codeセッション（/sales-email）で。
              </p>
            </div>
          );
        }
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {unsent.length > 0 && (
              <p style={{ margin: '0 0 -2px', fontSize: 12, fontWeight: 700, color: '#666' }}>未送信（{unsent.length}）</p>
            )}
            {unsent.map(e => row(e, null))}
            {awaiting.length > 0 && (
              <p style={{ margin: '10px 0 -2px', fontSize: 12, fontWeight: 700, color: '#666' }}>送信済み・返信待ち（{awaiting.length}）</p>
            )}
            {awaiting.map(e => row(e, effSentAt(e)))}
            <p style={{ margin: 0, fontSize: 11, color: '#bbb' }}>※下書き（email_draft）が入っているものは「📤 送信キュー」タブから宛先確認・事実確認のうえ送信できます。ここは進捗の記録用で、ダッシュボード外で送った分もここに反映してください。返信が来たら「返信きた」を押すと一覧から下がります。</p>
          </div>
        );
      })()}
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

  const temp = scoreLead(lead);
  const tempColor = temp.temp === '🔥熱い' ? '#E55039' : temp.temp === '🌤ふつう' ? '#E5A139' : '#8fa3b0';

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
        <span
          title={temp.reasons.length ? `手がかり：${temp.reasons.join('・')}（計${temp.score}点）` : '証拠パック（メモ）に手がかりがまだありません'}
          style={{ padding: '2px 9px', borderRadius: 12, fontSize: 10, fontWeight: 700, background: tempColor + '18', color: tempColor }}
        >{temp.temp}</span>
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
            <button onClick={() => goTab('leads')} style={{ ...jumpBtnStyle, marginLeft: 'auto' }}>証拠パック・提案書は「🎓 学校・法人（台帳）」へ →</button>
          </div>
        </div>
      )}
    </div>
  );
}
