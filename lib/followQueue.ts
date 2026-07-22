// 統合フォローキュー — 出し先が違うだけで同じ形の「返信待ち」を、1つの優先度付きリストにまとめる。
// これまでは自治体（municipality_profiles）だけが朝の一枚に載り、学校・法人（client_leads）や
// 案件のフォローステージ（business_cases）、顧問先の次回打合せ（client_dossiers）は
// 別々の場所に散らばっていた。lib/followUp.ts の判定基準はそのまま使い、対象を広げるだけ。
import { computeFollowUp, type FollowUpStatus } from '@/lib/followUp';

export type FollowSource = 'client_lead' | 'email_target' | 'municipality' | 'case' | 'dossier';

export interface FollowQueueItem {
  source: FollowSource;
  id: string;
  name: string;
  status: FollowUpStatus;
  daysSince: number;
  label: string;
  suggestedAction: string;
  icon: string;
}

interface LeadInput { id: string; org_name: string; email_sent_at: string | null; email_reply: string | null; followed_up_at: string | null; status?: string; }
interface EmailTargetInput { id: string; company: string; email_sent_at: string | null; email_reply: string | null; followed_up_at: string | null; }
interface MunicipalityInput { id: string; region_name: string; email_sent_at: string | null; email_reply: string | null; followed_up_at: string | null; on_hold?: boolean; }
interface CaseInput { id: string; org_name: string; stage: string; last_contact_at: string | null; }
interface DossierInput { id: string; org_name: string; next_meeting: string | null; }

export interface FollowQueueInput {
  leads: LeadInput[];
  emailTargets: EmailTargetInput[];
  municipalities: MunicipalityInput[];
  cases: CaseInput[];
  dossiers: DossierInput[];
}

const STATUS_PRIORITY: Record<FollowUpStatus, number> = { overdue: 0, due_soon: 1, ok: 2, replied: 3 };

function daysBetween(iso: string, now: number): number {
  return Math.floor((now - new Date(iso).getTime()) / 86400000);
}

export function buildUnifiedFollowQueue(input: FollowQueueInput, now: number = Date.now()): FollowQueueItem[] {
  const items: FollowQueueItem[] = [];

  for (const l of input.leads) {
    if (!l.email_sent_at || l.status === 'contracted' || l.status === 'lost') continue;
    const fu = computeFollowUp(l);
    if (!fu || fu.status === 'ok' || fu.status === 'replied') continue;
    items.push({
      source: 'client_lead', id: l.id, name: l.org_name, status: fu.status, daysSince: fu.daysSince,
      label: fu.label, suggestedAction: '電話・再送でフォローし、学校・法人台帳で記録する', icon: '🎓',
    });
  }

  for (const e of input.emailTargets) {
    const fu = computeFollowUp(e);
    if (!fu || fu.status === 'ok' || fu.status === 'replied') continue;
    items.push({
      source: 'email_target', id: e.id, name: e.company, status: fu.status, daysSince: fu.daysSince,
      label: fu.label, suggestedAction: '便り一覧でフォロー状況を更新する', icon: '📮',
    });
  }

  for (const p of input.municipalities) {
    if (p.on_hold) continue;
    const fu = computeFollowUp(p);
    if (!fu || fu.status === 'ok' || fu.status === 'replied') continue;
    items.push({
      source: 'municipality', id: p.id, name: p.region_name, status: fu.status, daysSince: fu.daysSince,
      label: fu.label, suggestedAction: '関係人口・自治体タブでフォロー済みにする', icon: '🏛',
    });
  }

  // 案件は「フォロー」ステージに来ているのに最終接触が空いている場合だけを対象にする
  // （フォローは受注後の関係維持ステージなので、他の営業チャネルより緩めの基準＝返信有無ではなく単純経過日数）。
  for (const c of input.cases) {
    if (c.stage !== 'フォロー' || !c.last_contact_at) continue;
    const days = daysBetween(c.last_contact_at, now);
    if (days < 14) continue;
    items.push({
      source: 'case', id: c.id, name: c.org_name,
      status: days >= 30 ? 'overdue' : 'due_soon', daysSince: days,
      label: `最終接触から${days}日`, suggestedAction: '商流ボードで次の接点（追加提案・紹介依頼）を決める', icon: '📇',
    });
  }

  for (const d of input.dossiers) {
    if (!d.next_meeting) continue;
    const days = Math.ceil((now - new Date(d.next_meeting + 'T00:00:00').getTime()) / 86400000);
    if (days <= 0) continue; // 未来の予定はここでは対象外（朝の一枚の別ロジックが担当）
    items.push({
      source: 'dossier', id: d.id, name: d.org_name,
      status: 'overdue', daysSince: days,
      label: `打合せ予定が${days}日過ぎています`, suggestedAction: '顧問先カルテで日程を組み直す', icon: '🤝',
    });
  }

  return items.sort((a, b) => STATUS_PRIORITY[a.status] - STATUS_PRIORITY[b.status] || b.daysSince - a.daysSince);
}
