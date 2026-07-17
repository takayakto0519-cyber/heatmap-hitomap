// ============================================================
// イベント前後の時期分割：純関数層。
// サーバーの集団集計（lib/attachment.ts・匿名強制）と、
// 本人限定の個人ビュー（/api/events/[slug]/my-shift）の両方が共有する。
// 判定式は attachment.ts の従来実装と同一：
//   created_at < start ? before : created_at <= end ? during : after
// ============================================================

export type EventPhase = 'before' | 'during' | 'after';

export function phaseOf(createdAt: string, startsAt: string, endsAt: string): EventPhase {
  return createdAt < startsAt ? 'before' : createdAt <= endsAt ? 'during' : 'after';
}

export function splitByEventPhase<T extends { created_at: string }>(
  traces: T[],
  startsAt: string,
  endsAt: string
): { before: T[]; during: T[]; after: T[] } {
  const out: { before: T[]; during: T[]; after: T[] } = { before: [], during: [], after: [] };
  for (const t of traces) out[phaseOf(t.created_at, startsAt, endsAt)].push(t);
  return out;
}
