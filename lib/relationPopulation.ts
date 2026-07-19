// ============================================================
// 関係人口計測層：agents/relation_population.py（番人63）と同じ考え方を
// サイト本体からもライブに読めるようにしたもの。
//
// ニックネーム（匿名可）を人の単位とし、複数の実験回（session_code）に
// 関わった人＝「関係人口の芽」、また来たいと答えた人＝「関係の温度」として数える。
// lib/attachment.ts と同じ設計原則：service_role クライアントは呼び出し元から注入、
// 個人を特定できる値は返さず件数・割合のみ。少人数の地域は suppressed にする。
// ============================================================
import type { SupabaseClient } from '@supabase/supabase-js';

const SUPPRESS_THRESHOLD = 5;

interface TraceRow {
  nickname: string | null;
  session_code: string | null;
  want_revisit: boolean;
  region: string | null;
}

interface RelationStats {
  totalContributors: number;
  repeatContributors: number;
  repeatRate: number;
  wantRevisitPeople: number;
  wantRevisitRate: number;
}

export interface RelationPopulationOverall {
  ok: true;
  generatedAt: string;
  overall: RelationStats;
  topRegions: ({ region: string; suppressed: true } | ({ region: string; suppressed: false } & RelationStats))[];
}

export interface RelationPopulationRegion {
  ok: boolean;
  generatedAt: string;
  region: string;
  suppressed: boolean;
  stats?: RelationStats;
  error?: string;
}

function summarize(rows: TraceRow[]): RelationStats {
  const sessionsByPerson = new Map<string, Set<string>>();
  const revisitPeople = new Set<string>();

  for (const r of rows) {
    const nick = (r.nickname ?? '').trim();
    if (!nick) continue;
    if (!sessionsByPerson.has(nick)) sessionsByPerson.set(nick, new Set());
    sessionsByPerson.get(nick)!.add(r.session_code ?? 'unknown');
    if (r.want_revisit) revisitPeople.add(nick);
  }

  const totalContributors = sessionsByPerson.size;
  let repeatContributors = 0;
  for (const sessions of sessionsByPerson.values()) {
    if (sessions.size >= 2) repeatContributors++;
  }

  return {
    totalContributors,
    repeatContributors,
    repeatRate: totalContributors ? Math.round((repeatContributors / totalContributors) * 1000) / 10 : 0,
    wantRevisitPeople: revisitPeople.size,
    wantRevisitRate: totalContributors ? Math.round((revisitPeople.size / totalContributors) * 1000) / 10 : 0,
  };
}

async function fetchRows(supabaseServer: SupabaseClient): Promise<TraceRow[]> {
  const { data, error } = await supabaseServer
    .from('traces')
    .select('nickname, session_code, want_revisit, region')
    .eq('is_deleted', false)
    .not('nickname', 'is', null)
    .limit(20000);
  if (error) throw new Error(error.message);
  return (data ?? []) as TraceRow[];
}

// 会長・自治体向けの全体像：総数＋地域別ランキング（上位10、少人数は非表示）
export async function computeRelationPopulationOverall(
  supabaseServer: SupabaseClient
): Promise<RelationPopulationOverall | { ok: false; generatedAt: string; error: string }> {
  const generatedAt = new Date().toISOString();
  let rows: TraceRow[];
  try {
    rows = await fetchRows(supabaseServer);
  } catch (e) {
    return { ok: false, generatedAt, error: e instanceof Error ? e.message : '取得エラー' };
  }

  const overall = summarize(rows);

  const byRegion = new Map<string, TraceRow[]>();
  for (const r of rows) {
    const region = (r.region ?? '').trim();
    if (!region) continue;
    if (!byRegion.has(region)) byRegion.set(region, []);
    byRegion.get(region)!.push(r);
  }

  const topRegions = [...byRegion.entries()]
    .map(([region, regionRows]) => {
      const stats = summarize(regionRows);
      return stats.totalContributors < SUPPRESS_THRESHOLD
        ? { region, suppressed: true as const }
        : { region, suppressed: false as const, ...stats };
    })
    .sort((a, b) => ('totalContributors' in b ? b.totalContributors : 0) - ('totalContributors' in a ? a.totalContributors : 0))
    .slice(0, 10);

  return { ok: true, generatedAt, overall, topRegions };
}

// 自治体1件を指定した詳細集計（提案書・レポートへの一次データ用）
export async function computeRelationPopulationForRegion(
  supabaseServer: SupabaseClient,
  region: string
): Promise<RelationPopulationRegion> {
  const generatedAt = new Date().toISOString();
  const { data, error } = await supabaseServer
    .from('traces')
    .select('nickname, session_code, want_revisit, region')
    .eq('is_deleted', false)
    .eq('region', region)
    .not('nickname', 'is', null)
    .limit(20000);

  if (error) return { ok: false, generatedAt, region, suppressed: false, error: error.message };

  const rows = (data ?? []) as TraceRow[];
  const stats = summarize(rows);
  if (stats.totalContributors < SUPPRESS_THRESHOLD) {
    return { ok: true, generatedAt, region, suppressed: true };
  }
  return { ok: true, generatedAt, region, suppressed: false, stats };
}
