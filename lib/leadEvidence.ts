// 学校・法人リード向けの"証"（既存の痕跡データ）をまとめて取得する共通処理。
// /enrich（証拠パック生成）と /draft-proposal（提案書ドラフト生成）の両方から使う。
import type { SupabaseClient } from '@supabase/supabase-js';
import { summarizeValence } from '@/lib/emotions';

export interface RegionalEvidence {
  regionGuess: string;
  traceCount: number;
  valence: { positive: number; negative: number; neutral: number; total: number };
}

// 団体名から地域名をざっくり推定し（例：「浪速区役所」→「浪速」）、
// 該当地域の全国公開済み投稿数・感情の内訳を"証"として集める。無ければ0件のまま正直に返す。
export async function getRegionalEvidence(
  supabaseServer: SupabaseClient,
  orgName: string
): Promise<RegionalEvidence> {
  const regionGuess = orgName.replace(/(市役所|区役所|町役場|村役場|教育委員会|株式会社|有限会社)$/u, '').replace(/[市区町村県]$/u, '');

  const { data: traces, count } = await supabaseServer
    .from('traces')
    .select('emotion_key', { count: 'exact' })
    .eq('is_deleted', false)
    .eq('visibility', 'public')
    .ilike('region', `%${regionGuess}%`);

  const valence = summarizeValence((traces ?? []).map((t) => t.emotion_key));

  return { regionGuess, traceCount: count ?? 0, valence };
}

export function formatEvidenceForPrompt(evidence: RegionalEvidence): string {
  if (evidence.traceCount === 0) {
    return `ヒトマップの既存データ: 「${evidence.regionGuess}」周辺の全国公開済み投稿は現時点で0件（まだ実績データがない）`;
  }
  const pct = (n: number) => Math.round((n / evidence.valence.total) * 100);
  return [
    `ヒトマップの既存データ: 「${evidence.regionGuess}」周辺に全国公開済みの痕跡投稿が${evidence.traceCount}件`,
    evidence.valence.total > 0
      ? `感情の内訳: 好意的${pct(evidence.valence.positive)}% ・ 中立${pct(evidence.valence.neutral)}% ・ 否定的${pct(evidence.valence.negative)}%（感情タグ付きの投稿${evidence.valence.total}件から算出）`
      : null,
  ].filter(Boolean).join('\n');
}
