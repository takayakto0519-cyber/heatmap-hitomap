// 「学校・法人」（client_leads）と「関係人口・自治体」（municipality_profiles）を
// 1つの型・1つのスコア物差しに正規化する。SalesTab.tsxの旧rankedFeed（縁ランキング用）と
// 同じロジックをここに集約し、一覧表示（SalesListView）とランキング表示の両方が
// この関数を共有することで、正規化ロジックの二重実装を避ける。
import { scoreLead } from '@/lib/leadTemperature';
import { municipalityScore } from '@/lib/salesScore';
import { coreRegionName } from '@/lib/smout';
import type { Confidence, FactCheckStatus } from '@/components/admin/sales/factCheckUi';

export type SalesEntryKind = 'lead' | 'municipality';

export interface ClientLead {
  id: string;
  client_type: 'school' | 'business' | 'municipality';
  org_name: string;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  status: string;
  memo: string | null;
  created_at: string;
  updated_at: string;
  scheduling_request_detected_at?: string | null;
  origin_note?: string | null;
  email_draft?: string | null;
  email_sent_at?: string | null;
  contact_email_confidence?: Confidence;
  contact_email_source_url?: string | null;
  fact_check_status?: FactCheckStatus;
  fact_check_note?: string | null;
  assigned_to?: string | null;
  evidence_summary?: string | null;
  source_links?: string | null;
}

export interface FundingOpp {
  id: string;
  title: string;
  status: string;
  deadline: string | null;
  url: string | null;
  municipality_profile_id: string | null;
}

export interface MunicipalityProfile {
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
  email_sent_content?: string | null;
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

export interface SalesEntry {
  id: string;                 // 元テーブルのid
  compositeKey: string;       // `${kind}-${id}`。チェックボックス選択・展開状態のキーに使う
  kind: SalesEntryKind;
  icon: string;
  name: string;
  statusLabel: string;
  statusColor: string;
  score: number;
  badge: string;
  badgeColor: string;
  reason: string;
  assignedTo: string | null;
  email: string | null;
  emailDraft: string | null;
  emailSentAt: string | null;
  contactEmailConfidence: Confidence;
  contactEmailSourceUrl: string | null;
  factCheckStatus: FactCheckStatus;
  factCheckNote: string | null;
  evidenceSummary: string | null;
  sourceLinks: string | null;
  originNote: string | null;
  schedulingRequestDetectedAt: string | null;
  lead?: ClientLead;
  municipality?: MunicipalityProfile;
}

export const LEAD_STATUS_LABELS: Record<string, { label: string; color: string }> = {
  lead: { label: '候補', color: '#999' },
  contacted: { label: '接触済み', color: '#4A90E2' },
  negotiating: { label: '商談中', color: '#E5A139' },
  contracted: { label: '契約中', color: '#27AE60' },
  lost: { label: '見送り', color: '#E55039' },
};

const ENGAGEMENT_LABELS: Record<string, string> = {
  observing: '観察', lead: 'リード', proposed: '提案中', contracted: '契約済み',
};

export function municipalityReason(p: MunicipalityProfile): string {
  return p.fit_assessment?.trim() || p.opportunity_notes?.trim() || p.relation_population_initiative?.trim()
    || p.evidence_summary?.trim() || '詳細を記入してください';
}

export function normalizeLead(l: ClientLead): SalesEntry {
  const statusInfo = LEAD_STATUS_LABELS[l.status] ?? LEAD_STATUS_LABELS.lead;
  const temperature = scoreLead(l);
  return {
    id: l.id, compositeKey: `lead-${l.id}`, kind: 'lead',
    icon: l.client_type === 'school' ? '🏫' : l.client_type === 'municipality' ? '🏛' : '🏢',
    name: l.org_name, statusLabel: statusInfo.label, statusColor: statusInfo.color,
    score: temperature.score, badge: `${temperature.temp}（${temperature.score}点）`, badgeColor: '#B7791F',
    reason: temperature.reasons.join('・') || '加点要素なし',
    assignedTo: l.assigned_to ?? null, email: l.email ?? null, emailDraft: l.email_draft ?? null,
    emailSentAt: l.email_sent_at ?? null, contactEmailConfidence: l.contact_email_confidence,
    contactEmailSourceUrl: l.contact_email_source_url ?? null, factCheckStatus: l.fact_check_status,
    factCheckNote: l.fact_check_note ?? null, evidenceSummary: l.evidence_summary ?? null,
    sourceLinks: l.source_links ?? null, originNote: l.origin_note ?? null,
    schedulingRequestDetectedAt: l.scheduling_request_detected_at ?? null,
    lead: l,
  };
}

export function normalizeMunicipality(p: MunicipalityProfile, fundingOpps: FundingOpp[]): SalesEntry {
  const linkedOpps = fundingOpps.filter(o => o.municipality_profile_id === p.id);
  const isRfpActive = linkedOpps.some(o => ['watching', 'preparing'].includes(o.status));
  return {
    id: p.id, compositeKey: `municipality-${p.id}`, kind: 'municipality', icon: '🏛',
    name: p.region_name, statusLabel: ENGAGEMENT_LABELS[p.engagement_stage] ?? p.engagement_stage,
    statusColor: p.engagement_stage === 'contracted' ? '#27AE60' : p.engagement_stage === 'proposed' ? '#E5A139' : '#999',
    score: municipalityScore(p, linkedOpps),
    badge: isRfpActive ? '🔥 公募中' : `提案余地 ${p.opportunity_level}（見立て）`,
    badgeColor: isRfpActive ? '#E55039' : (p.opportunity_level === '高' ? '#27AE60' : p.opportunity_level === '中' ? '#E5A139' : '#999'),
    reason: municipalityReason(p),
    assignedTo: p.assigned_to ?? null, email: p.contact_email ?? null, emailDraft: p.email_draft ?? null,
    emailSentAt: p.email_sent_at ?? null, contactEmailConfidence: p.contact_email_confidence,
    contactEmailSourceUrl: p.contact_email_source_url ?? null, factCheckStatus: p.fact_check_status,
    factCheckNote: p.fact_check_note ?? null, evidenceSummary: p.evidence_summary ?? null,
    sourceLinks: p.source_links ?? null, originNote: p.origin_note ?? null,
    schedulingRequestDetectedAt: p.scheduling_request_detected_at ?? null,
    municipality: p,
  };
}

/**
 * client_leads と municipality_profiles を1本のリストに正規化する。
 * 既にclient_leadsに台帳がある自治体は、municipality_profiles側で重複させない
 * （SalesTab.tsxの旧rankedFeedと同じ除外ロジック）。on_hold中の自治体も除外する。
 */
export function buildSalesEntries(
  leads: ClientLead[],
  municipalityProfiles: MunicipalityProfile[],
  fundingOpps: FundingOpp[],
): SalesEntry[] {
  const entries: SalesEntry[] = leads.map(normalizeLead);
  const leadCoreNames = new Set(leads.map(l => coreRegionName(l.org_name)));
  for (const p of municipalityProfiles) {
    if (p.on_hold) continue;
    if (leadCoreNames.has(coreRegionName(p.region_name))) continue;
    entries.push(normalizeMunicipality(p, fundingOpps));
  }
  return entries.sort((a, b) => b.score - a.score);
}
