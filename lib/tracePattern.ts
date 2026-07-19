// ============================================================
// 痕跡データパターン分析：agents/trace_pattern.py（番人62）と同じ集計を
// サイト本体からライブに読む。自治体向けレポート商品の中身（数字）を作る装置。
// 投稿時間帯のピーク・また来たい率・話したい率・書き込みの厚み（3問完答率）・
// 実験回別の件数を返す。個人を特定できる値は含めない。
// ============================================================
import type { SupabaseClient } from '@supabase/supabase-js';

interface TraceRow {
  created_at: string;
  why: string | null;
  interpretation: string | null;
  self_reflection: string | null;
  want_revisit: boolean;
  want_to_share: boolean;
  session_code: string | null;
}

export interface TracePatternResult {
  ok: boolean;
  generatedAt: string;
  total: number;
  wantRevisitRate?: number;
  wantToShareRate?: number;
  deepWriteRate?: number;
  peakHours?: { hour: number; count: number }[];
  topSessions?: { sessionCode: string; count: number }[];
  error?: string;
  note?: string;
}

export async function computeTracePattern(supabaseServer: SupabaseClient): Promise<TracePatternResult> {
  const generatedAt = new Date().toISOString();
  const { data, error } = await supabaseServer
    .from('traces')
    .select('created_at, why, interpretation, self_reflection, want_revisit, want_to_share, session_code')
    .eq('is_deleted', false)
    .limit(5000);

  if (error) return { ok: false, generatedAt, total: 0, error: error.message };

  const rows = (data ?? []) as TraceRow[];
  const total = rows.length;
  if (total === 0) return { ok: true, generatedAt, total: 0, note: 'まだ痕跡がありません' };

  const hourCounts = new Map<number, number>();
  const sessionCounts = new Map<string, number>();
  let revisit = 0, share = 0, deep = 0;

  for (const r of rows) {
    const hour = new Date(r.created_at).getUTCHours();
    if (Number.isFinite(hour)) hourCounts.set(hour, (hourCounts.get(hour) ?? 0) + 1);
    if (r.want_revisit) revisit++;
    if (r.want_to_share) share++;
    if (r.why && r.interpretation && r.self_reflection) deep++;
    if (r.session_code) sessionCounts.set(r.session_code, (sessionCounts.get(r.session_code) ?? 0) + 1);
  }

  const peakHours = [...hourCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([hour, count]) => ({ hour, count }));

  const topSessions = [...sessionCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([sessionCode, count]) => ({ sessionCode, count }));

  return {
    ok: true,
    generatedAt,
    total,
    wantRevisitRate: Math.round((revisit / total) * 1000) / 10,
    wantToShareRate: Math.round((share / total) * 1000) / 10,
    deepWriteRate: Math.round((deep / total) * 1000) / 10,
    peakHours,
    topSessions,
  };
}
