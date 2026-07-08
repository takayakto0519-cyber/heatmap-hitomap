// ============================================================
// /api/routes : 痕跡ルート（複数の痕跡を順番につなげた「歩いた道」）
//   POST ... ルートを1件作成
//   GET  ... 一覧取得
// ============================================================
import { NextRequest, NextResponse } from 'next/server';
import type { CreateRouteRequest, CreateRouteResponse, ListRoutesResponse, Route } from '@/lib/types';
import { getCurrentUserId } from '@/lib/supabase/requestClient';

const SUPABASE_READY = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function getServerClient() {
  const { supabaseServer } = await import('@/lib/supabase/server');
  return supabaseServer;
}

export async function POST(req: NextRequest): Promise<NextResponse<CreateRouteResponse>> {
  if (!SUPABASE_READY) {
    return NextResponse.json({ ok: false, error: 'Supabase未設定' }, { status: 503 });
  }
  try {
    const body = (await req.json()) as CreateRouteRequest;
    const isRelay = body.event_mode === 'relay';
    // relay型イベントは事前に地点が決まっていないため、trace_ids 2件以上の必須チェックを免除する
    if (!body.title || (!isRelay && (!Array.isArray(body.trace_ids) || body.trace_ids.length < 2))) {
      return NextResponse.json(
        { ok: false, error: 'タイトルと2件以上の痕跡が必要です' },
        { status: 400 }
      );
    }

    const userId = await getCurrentUserId();
    // おすすめルート公開申請はログインユーザーのみ（本人確認・承認連絡のため）
    const wantsRecommendation = Boolean(userId) && body.is_public_recommendation === true;
    const supabaseServer = await getServerClient();
    const { data, error } = await supabaseServer
      .from('routes')
      .insert({
        title: body.title,
        description: body.description ?? null,
        trace_ids: body.trace_ids ?? [],
        nickname: body.nickname ?? null,
        session_code: body.session_code ?? null,
        user_id: userId,
        event_mode: isRelay ? 'relay' : 'route',
        event_session_code: isRelay ? (body.event_session_code ?? null) : null,
        is_public_recommendation: wantsRecommendation,
        review_status: wantsRecommendation ? 'pending' : null,
        highlights: body.highlights?.trim() || null,
      })
      .select()
      .single();

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, route: data as Route }, { status: 201 });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : 'unknown error' },
      { status: 400 }
    );
  }
}

export async function GET(): Promise<NextResponse<ListRoutesResponse>> {
  if (!SUPABASE_READY) {
    return NextResponse.json({ ok: true, routes: [] });
  }
  const supabaseServer = await getServerClient();
  const { data, error } = await supabaseServer
    .from('routes')
    .select('*')
    .eq('is_deleted', false)
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ ok: false, routes: [], error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, routes: (data ?? []) as Route[] });
}
