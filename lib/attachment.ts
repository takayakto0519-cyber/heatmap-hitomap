// ============================================================
// 愛着計測層：縁の螺旋（地1.0→理2.0→心3.0）を数える。
//
// ヒトマップの本義＝「ヒトとの出会いが、どんな感情を経て、その地域への
// 愛着になっていくのか」の見える化。このファイルはその読み方（集計）を担う。
//
// - 地（記録した）  ：その地域に痕跡を1件以上残した
// - 理（つながった）：地の人のうち、他者と反応・コメントを交わした
// - 心（結ばれた）  ：地の人のうち、再訪（2日以上の記録）・「その後」記録・
//                     会いたい申請の成立、のいずれかに至った
//
// 設計原則（lib/regionAggregate.ts と同じ流儀）：
// - service_role クライアントは呼び出し元から注入する
// - 個人を特定できる値（user_id等）は絶対に返さない。件数と割合のみ
// - 地の段階が5人未満の地域は suppressed（少人数から個人の行動が推定できるため）
// - 個人単位の系列データはここに置かない。仮名化を強制する
//   卒論_Thesis/scripts/export_attachment.py だけが扱う
// ============================================================
import type { SupabaseClient } from '@supabase/supabase-js';
import { summarizeValence } from '@/lib/emotions';
import { phaseOf } from '@/lib/emotionShift';
import type { AttachmentFunnel, EventEmotionShift, ValenceSummary } from '@/lib/types';

const SUPPRESS_THRESHOLD = 5; // regionAggregateのk-匿名しきい値と同じ思想

// PostgRESTの .in() はURLクエリに展開されるため、id数が多いとURL長制限に当たる。
// 200件ずつに分割して取得し、結果を結合する。
const IN_CHUNK = 200;

async function selectInChunks<T>(
  ids: string[],
  fetchChunk: (chunk: string[]) => Promise<T[]>
): Promise<T[]> {
  const out: T[] = [];
  for (let i = 0; i < ids.length; i += IN_CHUNK) {
    out.push(...await fetchChunk(ids.slice(i, i + IN_CHUNK)));
  }
  return out;
}

function dateKey(iso: string): string {
  return iso.slice(0, 10); // YYYY-MM-DD（再訪＝日付の異なる記録、の判定に使う）
}

export async function computeAttachmentFunnel(
  supabaseServer: SupabaseClient,
  region: string
): Promise<AttachmentFunnel> {
  const generatedAt = new Date().toISOString();

  // ① 地域の痕跡（削除済みを除く・ユーザー紐付きのみ。匿名投稿は縦断できないため対象外）
  const { data: traceRows, error } = await supabaseServer
    .from('traces')
    .select('id, user_id, created_at, revisit_of')
    .eq('region', region)
    .eq('is_deleted', false)
    .not('user_id', 'is', null);

  if (error) {
    return { ok: false, region, generatedAt, suppressed: false, error: error.message };
  }

  const traces = (traceRows ?? []) as { id: string; user_id: string; created_at: string; revisit_of: string | null }[];
  const traceOwner = new Map<string, string>();          // trace_id → user_id
  const userDates = new Map<string, Set<string>>();      // user_id → 記録した日付の集合
  const usersWithRevisitRecord = new Set<string>();      // 「その後」を記録した人
  for (const t of traces) {
    traceOwner.set(t.id, t.user_id);
    if (!userDates.has(t.user_id)) userDates.set(t.user_id, new Set());
    userDates.get(t.user_id)!.add(dateKey(t.created_at));
    if (t.revisit_of) usersWithRevisitRecord.add(t.user_id);
  }

  const chiUsers = new Set(userDates.keys());
  if (chiUsers.size < SUPPRESS_THRESHOLD) {
    return { ok: true, region, generatedAt, suppressed: true };
  }

  const traceIds = [...traceOwner.keys()];

  // ②③④ 反応・コメント・会いたい申請（trace_id join で地域に帰属させる）
  const [reactions, comments, appointments] = await Promise.all([
    selectInChunks(traceIds, async chunk => {
      const { data } = await supabaseServer
        .from('trace_reactions').select('user_id, trace_id').in('trace_id', chunk);
      return (data ?? []) as { user_id: string; trace_id: string }[];
    }),
    selectInChunks(traceIds, async chunk => {
      const { data } = await supabaseServer
        .from('trace_comments').select('user_id, trace_id').eq('is_deleted', false).in('trace_id', chunk);
      return (data ?? []) as { user_id: string; trace_id: string }[];
    }),
    selectInChunks(traceIds, async chunk => {
      const { data } = await supabaseServer
        .from('appointment_requests')
        .select('requester_id, requestee_id, trace_id, status')
        .eq('status', 'accepted')
        .in('trace_id', chunk);
      return (data ?? []) as { requester_id: string; requestee_id: string; trace_id: string; status: string }[];
    }),
  ]);

  // 理：地の人のうち、他者との反応・コメントの授受があった人
  //（自分の痕跡への自己反応は数えない）
  const riUsers = new Set<string>();
  for (const r of [...reactions, ...comments]) {
    const owner = traceOwner.get(r.trace_id);
    if (!owner || r.user_id === owner) continue;
    if (chiUsers.has(owner)) riUsers.add(owner);       // 受けた側
    if (chiUsers.has(r.user_id)) riUsers.add(r.user_id); // 送った側
  }

  // 心：再訪（2日以上）・「その後」記録・会いたい成立
  const shinUsers = new Set<string>();
  for (const [userId, dates] of userDates) {
    if (dates.size >= 2) shinUsers.add(userId);
  }
  for (const u of usersWithRevisitRecord) shinUsers.add(u);
  for (const a of appointments) {
    if (chiUsers.has(a.requester_id)) shinUsers.add(a.requester_id);
    if (chiUsers.has(a.requestee_id)) shinUsers.add(a.requestee_id);
  }

  const chi = chiUsers.size;
  const ri = riUsers.size;
  const shin = shinUsers.size;

  return {
    ok: true,
    region,
    generatedAt,
    suppressed: false,
    stages: { chi, ri, shin },
    rates: {
      riRate: Math.round((ri / chi) * 100),
      shinRate: Math.round((shin / chi) * 100),
    },
  };
}

// ============================================================
// イベント前後の感情変化：参加者の記録をイベント期間で前・中・後に分け、
// 感情価の内訳と「イベント後の再訪率」を返す。
// 参加者の特定は event_session_code → routes.session_code → routes.user_id の順で合成。
// ============================================================
export async function computeEventEmotionShift(
  supabaseServer: SupabaseClient,
  eventSlug: string
): Promise<EventEmotionShift> {
  const generatedAt = new Date().toISOString();
  const base = { eventSlug, generatedAt, participantCount: 0 };

  const { data: route, error: routeError } = await supabaseServer
    .from('routes')
    .select('id, user_id, session_code, event_session_code, event_starts_at, event_ends_at')
    .eq('event_slug', eventSlug)
    .eq('is_deleted', false)
    .maybeSingle();

  if (routeError) return { ok: false, suppressed: false, ...base, error: routeError.message };
  if (!route) return { ok: false, suppressed: false, ...base, error: 'イベントが見つかりません' };
  if (!route.event_starts_at || !route.event_ends_at) {
    return { ok: false, suppressed: false, ...base, error: 'イベントの開始・終了日時が未設定のため、前後比較ができません' };
  }

  // 参加者のuser_idを集める（匿名参加は縦断比較できないため含めない）
  const sessionCodes = [route.event_session_code, route.session_code].filter(Boolean) as string[];
  const participantIds = new Set<string>();
  if (route.user_id) participantIds.add(route.user_id as string);

  if (sessionCodes.length > 0) {
    const { data: sessionTraces } = await supabaseServer
      .from('traces')
      .select('user_id')
      .in('session_code', sessionCodes)
      .eq('is_deleted', false)
      .not('user_id', 'is', null);
    for (const t of sessionTraces ?? []) participantIds.add((t as { user_id: string }).user_id);
  }

  const participantCount = participantIds.size;
  if (participantCount < SUPPRESS_THRESHOLD) {
    return { ok: true, suppressed: true, ...base, participantCount };
  }

  // 参加者の全記録を取り、イベント期間で3つの時期に分ける
  const ids = [...participantIds];
  const allTraces = await selectInChunks(ids, async chunk => {
    const { data } = await supabaseServer
      .from('traces')
      .select('user_id, region, created_at, emotion_key, emotion_keys')
      .eq('is_deleted', false)
      .in('user_id', chunk);
    return (data ?? []) as { user_id: string; region: string | null; created_at: string; emotion_key: string | null; emotion_keys: string[] | null }[];
  });

  const start = route.event_starts_at as string;
  const end = route.event_ends_at as string;

  const emotionsOf = (t: { emotion_key: string | null; emotion_keys: string[] | null }) =>
    t.emotion_keys && t.emotion_keys.length > 0 ? t.emotion_keys : [t.emotion_key];

  const phaseKeys: { before: (string | null)[]; during: (string | null)[]; after: (string | null)[] } = { before: [], during: [], after: [] };
  const duringRegions = new Map<string, Set<string>>(); // user_id → イベント中に歩いた地域
  const afterRegions = new Map<string, Set<string>>();  // user_id → イベント後に歩いた地域

  for (const t of allTraces) {
    const phase = phaseOf(t.created_at, start, end);
    phaseKeys[phase].push(...emotionsOf(t));
    if (t.region) {
      const map = phase === 'during' ? duringRegions : phase === 'after' ? afterRegions : null;
      if (map) {
        if (!map.has(t.user_id)) map.set(t.user_id, new Set());
        map.get(t.user_id)!.add(t.region);
      }
    }
  }

  // 再訪率：イベント中に歩いた地域のどれかへ、イベント後にも記録を残した参加者の割合
  let revisitors = 0;
  for (const [userId, regions] of duringRegions) {
    const after = afterRegions.get(userId);
    if (after && [...regions].some(r => after.has(r))) revisitors++;
  }
  const duringParticipants = duringRegions.size;

  const phases: { before: ValenceSummary; during: ValenceSummary; after: ValenceSummary } = {
    before: summarizeValence(phaseKeys.before),
    during: summarizeValence(phaseKeys.during),
    after: summarizeValence(phaseKeys.after),
  };

  return {
    ok: true,
    suppressed: false,
    ...base,
    participantCount,
    phases,
    repeatVisitRate: duringParticipants > 0 ? Math.round((revisitors / duringParticipants) * 100) : 0,
  };
}
