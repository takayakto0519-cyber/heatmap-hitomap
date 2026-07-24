// 新規事業開発のマイルストン・トラック — 仮説出し(NB1)→需要検証(NB2)→MVP設計(NB3)の3段。
// lib/tracks/govOutreach.ts と同じ考え方（進捗は既存カラムから導出、専用テーブルは作らない）。
//
// 【重要】agents/proposal_queue_watch.py に同じ判定ロジックのPython実装がある。
// 片方だけ直すと番人の検知結果と画面表示がずれるので、必ず両方を同時に直すこと。
//
// 新規事業の登録先は必ず biz_model_ideas（.claude/skills/new-biz-hypothesis/SKILL.md に
// 明記された2026-07-23の反省：strategy_proposalsに新規事業カテゴリを重複登録しない）。
// NB1（仮説）はentity_idを持たない提案として生まれ、承認された瞬間にbiz_model_ideasの
// 行が新規作成される。NB2・NB3はその行に対する追加提案。
import type { DeliverableKind } from '@/lib/deliverables';

export type NewBizOwner = 'ai' | 'chairman';

export interface NewBizIdea {
  status?: string | null;      // idea | validating | building | live | shelved
  validation_summary?: string | null;
  mvp_spec_md?: string | null;
}

export interface NewBizMilestone {
  id: string;
  label: string;
  kind: DeliverableKind;
  done: (idea: NewBizIdea) => boolean;
}

const filled = (v: unknown): boolean => typeof v === 'string' && v.trim().length > 0;

/**
 * NB1（仮説）はbiz_model_ideasの行そのものが仮説の実体なので、このトラックには含めない
 * （番人はentity_idを持たない「まだ仮説すら無い」状態を別枠で検知する）。
 * ここに並ぶのは、既に仮説（idea）が存在してから先の2段。
 */
export const NEW_BIZ_TRACK: NewBizMilestone[] = [
  { id: 'NB2', label: '需要検証', kind: 'validation_research', done: i => filled(i.validation_summary) },
  { id: 'NB3', label: 'MVP設計', kind: 'mvp_spec', done: i => filled(i.mvp_spec_md) },
];

/** AIが自動で進めてよい状態か。building以降（会長が着手を決めた案）は触らない。 */
export function isActiveForAutopilot(idea: NewBizIdea): boolean {
  const status = idea.status ?? 'idea';
  return status === 'idea' || status === 'validating';
}

export interface NewBizMilestoneState {
  current: NewBizMilestone | null; // 完了済みなら null
  nextAction: string;
}

export function deriveNewBizMilestone(idea: NewBizIdea): NewBizMilestoneState {
  for (const m of NEW_BIZ_TRACK) {
    if (!m.done(idea)) return { current: m, nextAction: `${m.label}を進める` };
  }
  return { current: null, nextAction: '仮説→MVP設計まで完了（会長の着手判断待ち）' };
}
