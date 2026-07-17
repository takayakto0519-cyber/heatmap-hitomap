// ============================================================
// /api/events/[slug]/my-shift : 本人限定「イベント前後のわたしの感情」
//
// - 認証必須。返すのはリクエスト本人の記録のみ（他人のデータは一切含めない）。
//   本人限定なので k-匿名（5人しきい値）は適用しない——集団の匿名集計
//   （/api/admin/attachment）とはプライバシー階層が異なる。
// - 参加者判定：本人の記録に イベントの session_code が1件以上あるか、
//   イベント期間中の記録があるか。どちらもなければ participated: false。
// - 前後判定は lib/emotionShift.ts の時刻比較（集団集計と同一式）。
// ============================================================
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUserId } from '@/lib/supabase/requestClient';
import { splitByEventPhase } from '@/lib/emotionShift';
import type { MyEventShiftResponse, MyShiftTrace } from '@/lib/types';

export async function GET(
  _req: NextRequest,
  { params }: { params: { slug: string } }
): Promise<NextResponse<MyEventShiftResponse>> {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ ok: false, participated: false, error: 'ログインが必要です' }, { status: 401 });
    }

    const { supabaseServer } = await import('@/lib/supabase/server');

    const { data: route, error: routeError } = await supabaseServer
      .from('routes')
      .select('title, session_code, event_session_code, event_starts_at, event_ends_at')
      .eq('event_slug', params.slug)
      .eq('is_deleted', false)
      .maybeSingle();

    if (routeError) {
      return NextResponse.json({ ok: false, participated: false, error: routeError.message }, { status: 500 });
    }
    if (!route) {
      return NextResponse.json({ ok: false, participated: false, error: 'イベントが見つかりません' }, { status: 404 });
    }
    if (!route.event_starts_at || !route.event_ends_at) {
      return NextResponse.json(
        { ok: false, participated: false, error: 'イベントの開始・終了日時が未設定のため、前後比較ができません' },
        { status: 400 }
      );
    }

    // 本人の全記録（感情タグを持つ痕跡のみ。地名・言い伝え等のアーカイブは感情の変遷に含めない）
    const { data: traceRows, error: tracesError } = await supabaseServer
      .from('traces')
      .select('id, title, created_at, emotion_key, emotion_keys, intensity, session_code, archive_type')
      .eq('user_id', userId)
      .eq('is_deleted', false)
      .order('created_at', { ascending: true });

    if (tracesError) {
      return NextResponse.json({ ok: false, participated: false, error: tracesError.message }, { status: 500 });
    }

    const myTraces = ((traceRows ?? []) as (MyShiftTrace & { session_code: string | null; archive_type: string | null })[])
      .filter((t) => !t.archive_type);

    const start = route.event_starts_at as string;
    const end = route.event_ends_at as string;
    const sessionCodes = [route.event_session_code, route.session_code].filter(Boolean) as string[];

    // 参加者判定：イベントのsession_codeを持つ記録、またはイベント期間中の記録があるか
    const participated = myTraces.some(
      (t) =>
        (t.session_code !== null && sessionCodes.includes(t.session_code)) ||
        (t.created_at >= start && t.created_at <= end)
    );
    if (!participated) {
      return NextResponse.json({ ok: true, participated: false });
    }

    const split = splitByEventPhase(myTraces, start, end);
    const strip = (t: MyShiftTrace & { session_code: string | null; archive_type: string | null }): MyShiftTrace => ({
      id: t.id, title: t.title, created_at: t.created_at,
      emotion_key: t.emotion_key, emotion_keys: t.emotion_keys, intensity: t.intensity,
    });

    return NextResponse.json({
      ok: true,
      participated: true,
      eventTitle: (route.title as string) ?? undefined,
      phases: {
        before: split.before.map(strip),
        during: split.during.map(strip),
        after: split.after.map(strip),
      },
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, participated: false, error: e instanceof Error ? e.message : 'unknown error' },
      { status: 500 }
    );
  }
}
