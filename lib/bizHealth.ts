// 「ビジネスモデル強化」タブが使う純粋関数群。
// lib/dealMetrics.ts と同じ思想：計算はここに1箇所だけ置き、タブ間で数字が食い違わないようにする。
// 新テーブルは使わず、既存の biz_model_ideas / ai_deliverables / strategy_proposals /
// business_line_pnl の組み合わせだけで「磨き込み度」を導出する。

export interface BizModelIdeaForHealth {
  id: string;
  title: string;
  status: string;
  phase?: number | null;
  validation_summary?: string | null;
  mvp_spec_md?: string | null;
  report_md?: string | null;
  updated_at: string;
}

export interface DeliverableForHealth {
  id: string;
  entity_type: string;
  entity_id: string | null;
  status: string;
  created_at: string;
}

export interface ProposalForHealth {
  id: string;
  status: string;
  linked_biz_model_idea_id: string | null;
}

export interface PnlEntryForHealth {
  line_key: string;
  month: string; // 'YYYY-MM-DD'
  revenue: number;
  cost: number;
}

export type IdeaRank = 'A' | 'B' | 'C';

export interface IdeaScoreBreakdown {
  phase: boolean;   // フェーズが1つでも進んでいるか
  validation: boolean;
  mvp: boolean;
  freshness: boolean; // 14日以内に更新
  plan: boolean;      // report_md あり
}

export interface IdeaScore {
  score: number; // 0-100
  rank: IdeaRank;
  breakdown: IdeaScoreBreakdown;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * 事業案1件の「磨き込み度」を0-100点で採点する。
 * フェーズ0（ショーケース確立）の段階ではMVPを要求せず満点扱いにし、
 * まだ着手していない段階で不当に低スコアにならないようにする。
 */
export function computeIdeaScore(idea: BizModelIdeaForHealth, now: Date = new Date()): IdeaScore {
  const phase = idea.phase ?? 0;
  const phaseScore = Math.round((Math.min(phase, 3) / 3) * 25);
  const hasValidation = !!idea.validation_summary?.trim();
  const validationScore = hasValidation ? 25 : 0;
  const hasMvp = !!idea.mvp_spec_md?.trim();
  const mvpScore = phase === 0 ? 20 : (hasMvp ? 20 : 0);
  const daysSinceUpdate = (now.getTime() - new Date(idea.updated_at).getTime()) / DAY_MS;
  const isFresh = daysSinceUpdate <= 14;
  const freshnessScore = isFresh ? 15 : 0;
  const hasPlan = !!idea.report_md?.trim();
  const planScore = hasPlan ? 15 : 0;

  const score = phaseScore + validationScore + mvpScore + freshnessScore + planScore;
  const rank: IdeaRank = score >= 75 ? 'A' : score >= 45 ? 'B' : 'C';

  return {
    score,
    rank,
    breakdown: { phase: phase > 0, validation: hasValidation, mvp: phase === 0 ? true : hasMvp, freshness: isFresh, plan: hasPlan },
  };
}

export type WeaknessAction =
  | { type: 'copyPrompt'; text: string }
  | { type: 'openDashboard'; ideaId: string }
  | { type: 'goTab'; tab: string };

export interface Weakness {
  ideaId: string;
  ideaTitle: string;
  severity: 1 | 2 | 3; // 3が最も優先度高い
  label: string;
  action: WeaknessAction;
}

/**
 * 事業案・AI提案の滞留・提案の未読状況から「次の一手」を検出する。
 * AI APIは呼ばず、ルールベースの検出のみ。coypPrompt はチャット/autopilot運用に渡す定型文。
 */
export function detectWeaknesses(
  ideas: BizModelIdeaForHealth[],
  deliverables: DeliverableForHealth[],
  proposals: ProposalForHealth[],
  now: Date = new Date(),
): Weakness[] {
  const weaknesses: Weakness[] = [];

  for (const idea of ideas) {
    const phase = idea.phase ?? 0;
    const daysSinceUpdate = (now.getTime() - new Date(idea.updated_at).getTime()) / DAY_MS;

    if (idea.status === 'validating' && !idea.validation_summary?.trim()) {
      weaknesses.push({
        ideaId: idea.id, ideaTitle: idea.title, severity: 3,
        label: '需要検証が未記録（検証中ステータスなのにvalidation_summaryが空）',
        action: { type: 'copyPrompt', text: `この事業案『${idea.title}』(id: ${idea.id})の需要検証をNB2トラックで実行して。` },
      });
    }

    if (phase >= 1 && !idea.mvp_spec_md?.trim()) {
      weaknesses.push({
        ideaId: idea.id, ideaTitle: idea.title, severity: 2,
        label: 'MVP仕様がまだない（フェーズは進んでいるのにmvp_spec_mdが空）',
        action: { type: 'copyPrompt', text: `この事業案『${idea.title}』(id: ${idea.id})のMVP仕様書を/mvp-specで作って。` },
      });
    }

    const staleDeliverables = deliverables.filter(d =>
      d.entity_type === 'new_biz' && d.entity_id === idea.id &&
      (d.status === 'proposed' || d.status === 'revise') &&
      (now.getTime() - new Date(d.created_at).getTime()) / DAY_MS > 7,
    );
    if (staleDeliverables.length > 0) {
      weaknesses.push({
        ideaId: idea.id, ideaTitle: idea.title, severity: 2,
        label: `AI提案の確認待ちが${staleDeliverables.length}件、7日以上滞留`,
        action: { type: 'openDashboard', ideaId: idea.id },
      });
    }

    if (daysSinceUpdate > 14 && idea.status !== 'shelved') {
      weaknesses.push({
        ideaId: idea.id, ideaTitle: idea.title, severity: 1,
        label: `${Math.floor(daysSinceUpdate)}日間、更新がない`,
        action: { type: 'openDashboard', ideaId: idea.id },
      });
    }

    const unreadLinked = proposals.some(p => p.linked_biz_model_idea_id === idea.id && p.status === 'unread');
    if (unreadLinked) {
      weaknesses.push({
        ideaId: idea.id, ideaTitle: idea.title, severity: 1,
        label: '紐付く競合・価格インサイトに未読あり',
        action: { type: 'goTab', tab: 'proposals' },
      });
    }
  }

  return weaknesses.sort((a, b) => b.severity - a.severity);
}

export interface LineTrend {
  key: string;
  label: string;
  latestMonth: string | null;
  latestRevenue: number;
  latestProfit: number;
  prevProfit: number | null;
  recordedThisMonth: boolean;
}

const PNL_LINE_LABELS: Record<string, string> = {
  advisory: '顧問業', kit: 'キット販売', saas: 'SaaS', recruit: '採用商材', event: 'イベント', other: 'その他',
};

/** 事業ライン×月のPnLを、ラインごとの直近月・前月比に整形する。 */
export function computeLineTrend(entries: PnlEntryForHealth[], now: Date = new Date()): LineTrend[] {
  const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  return Object.keys(PNL_LINE_LABELS).map(key => {
    const rows = entries.filter(e => e.line_key === key).sort((a, b) => b.month.localeCompare(a.month));
    const latest = rows[0];
    const prev = rows[1];
    const recordedThisMonth = !!latest && latest.month.slice(0, 7) === currentMonthKey;
    return {
      key,
      label: PNL_LINE_LABELS[key] ?? key,
      latestMonth: latest ? latest.month.slice(0, 7) : null,
      latestRevenue: latest ? latest.revenue : 0,
      latestProfit: latest ? latest.revenue - latest.cost : 0,
      prevProfit: prev ? prev.revenue - prev.cost : null,
      recordedThisMonth,
    };
  });
}
