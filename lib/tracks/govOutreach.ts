// 自治体営業のマイルストン・トラック — 初回接触からMVPデモ提示、見積、契約引き継ぎまでの11段。
// 進捗は専用テーブルを持たず municipality_profiles の既存カラムから導出する（純粋関数）。
// 二重管理を避けるための設計で、gmail_watch.py 等が既存カラムをPATCHしてもここは自動で追従する。
//
// 【重要】agents/proposal_queue_watch.py に同じ判定ロジックのPython実装がある。
// 片方だけ直すと番人の検知結果と画面表示がずれるので、必ず両方を同時に直すこと。
// （lib/leadTemperature.ts ↔ agents/lead_temperature.py と同じ既存の割り切り）
import { computeFollowUp } from '@/lib/followUp';

/** AIが作れる成果物の種類。ai_deliverables.kind と autopilot スキルの振り分けキーを兼ねる。 */
export type DeliverableKind =
  | 'evidence' | 'contact' | 'email_draft' | 'followup_draft' | 'reply_draft'
  | 'requirements' | 'mvp_content' | 'quote_research';

/** 誰の手番か。'ai' はオートパイロットが動く、'chairman' は会長待ちでAIの出番なし。 */
export type Owner = 'ai' | 'chairman';

export interface OutreachTarget {
  evidence_summary?: string | null;
  contact_email?: string | null;
  email_draft?: string | null;
  fact_check_status?: string | null;
  email_sent_at?: string | null;
  email_reply?: string | null;
  followed_up_at?: string | null;
  reply_handled_at?: string | null;
  hearing_at?: string | null;
  requirements_memo?: string | null;
  mvp_shown_at?: string | null;
  quoted_at?: string | null;
  on_hold?: boolean | null;
}

export interface Milestone {
  id: string;
  label: string;
  owner: Owner;
  /** この段のためにAIが作る成果物（会長の手番の段は undefined）。 */
  kind?: DeliverableKind;
  /** 達成済みか。既存カラムから導出する。 */
  done: (t: OutreachTarget) => boolean;
}

const filled = (v: unknown): boolean => typeof v === 'string' && v.trim().length > 0;

/**
 * フェーズ0（ショーケース確立）からフェーズ1（MVP）を経て契約手前までの11段。
 * M9のMVPデモは新規開発ではなく、/region/[name] に痕跡データが入っていれば
 * そのページ自体がデモ画面になる（app/region/[name]/page.tsx）。
 */
export const GOV_OUTREACH_TRACK: Milestone[] = [
  { id: 'M1', label: '調査', owner: 'ai', kind: 'evidence', done: t => filled(t.evidence_summary) },
  { id: 'M2', label: '宛先確保', owner: 'ai', kind: 'contact', done: t => filled(t.contact_email) },
  { id: 'M3', label: '提案メール下書き', owner: 'ai', kind: 'email_draft', done: t => filled(t.email_draft) },
  { id: 'M4', label: '事実確認', owner: 'chairman', done: t => t.fact_check_status === 'verified' },
  { id: 'M5', label: '初回送信', owner: 'chairman', done: t => filled(t.email_sent_at) },
  { id: 'M6', label: '反応・フォロー', owner: 'ai', kind: 'followup_draft', done: t => filled(t.email_reply) },
  { id: 'M7', label: 'ヒアリング面談', owner: 'chairman', done: t => filled(t.hearing_at) },
  { id: 'M8', label: '要件メモ', owner: 'ai', kind: 'requirements', done: t => filled(t.requirements_memo) },
  { id: 'M9', label: 'MVPデモ提示', owner: 'ai', kind: 'mvp_content', done: t => filled(t.mvp_shown_at) },
  { id: 'M10', label: '見積提出', owner: 'chairman', kind: 'quote_research', done: t => filled(t.quoted_at) },
  { id: 'M11', label: '契約', owner: 'chairman', done: () => false }, // 以降は business_cases（商流ボード）へ引き継ぐ
];

/** フェーズ1（MVP）到達とみなす段。ここまで来たら事業ラインのphaseを1に上げられる。 */
export const MVP_MILESTONE_INDEX = 8; // M9

export interface MilestoneState {
  /** 達成済みの段数（先頭から連続して達成した数）。0 = まだ何も達成していない。 */
  reached: number;
  /** いま取り組むべき段。全段達成済みなら null。 */
  current: Milestone | null;
  onHold: boolean;
  owner: Owner | null;
  /** AIが次に作るべき成果物。会長の手番・保留中は null。 */
  nextKind: DeliverableKind | null;
  /** 画面と番人の両方で使う「次の一手」の一文。 */
  nextAction: string;
}

/**
 * いま何段目で、次に誰が何をすべきかを返す。
 * 先頭から順に見て最初の未達の段を「現在地」とする（飛び級は扱わない＝抜けを見逃さないため）。
 */
export function deriveMilestone(t: OutreachTarget, now: number = Date.now()): MilestoneState {
  if (t.on_hold) {
    return { reached: 0, current: null, onHold: true, owner: null, nextKind: null, nextAction: '保留中' };
  }

  let reached = 0;
  while (reached < GOV_OUTREACH_TRACK.length && GOV_OUTREACH_TRACK[reached].done(t)) reached++;
  const current = GOV_OUTREACH_TRACK[reached] ?? null;

  if (!current) {
    return { reached, current: null, onHold: false, owner: null, nextKind: null, nextAction: '完了' };
  }

  // M6（反応待ち）だけは二値でなく経過日数で手番が変わる。既存の computeFollowUp に委譲する。
  if (current.id === 'M6') {
    const fu = computeFollowUp(
      { email_sent_at: t.email_sent_at ?? null, email_reply: t.email_reply ?? null, followed_up_at: t.followed_up_at ?? null },
      now,
    );
    if (fu?.status === 'overdue' || fu?.status === 'due_soon') {
      return { reached, current, onHold: false, owner: 'ai', nextKind: 'followup_draft', nextAction: `フォロー文案を作る（${fu.daysSince}日経過）` };
    }
    return { reached, current, onHold: false, owner: 'chairman', nextKind: null, nextAction: fu?.label ?? '送信後の反応を待つ' };
  }

  // 返信が届いていて、まだ会長が捌いていないなら、返答案を作るのが最優先。
  if (filled(t.email_reply) && !filled(t.reply_handled_at)) {
    return { reached, current, onHold: false, owner: 'ai', nextKind: 'reply_draft', nextAction: '届いた返信への返答案を作る' };
  }

  if (current.owner === 'ai' && current.kind) {
    return { reached, current, onHold: false, owner: 'ai', nextKind: current.kind, nextAction: `${current.label}を作る` };
  }
  return { reached, current, onHold: false, owner: 'chairman', nextKind: null, nextAction: `${current.label}（会長の手番）` };
}

/** 「いま会長が送れる」状態か。事実確認済みなのにまだ送っていない行を拾う。 */
export function isReadyToSend(t: OutreachTarget): boolean {
  return !t.on_hold && t.fact_check_status === 'verified' && filled(t.email_draft) && !filled(t.email_sent_at);
}
