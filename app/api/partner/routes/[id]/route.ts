import { NextRequest, NextResponse } from 'next/server';
import type { Route, RouteDetailResponse, Trace } from '@/lib/types';

const SUPABASE_READY = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL);

function checkApiKey(req: NextRequest): boolean {
  const provided = req.headers.get('x-api-key');
  const expected = process.env.PARTNER_API_KEY;
  return Boolean(expected) && provided === expected;
}

// GET /api/partner/routes/[id] — 提携先向けのルート詳細（APIキー認証必須）
export async function GET(
  req: NextRequest,
  context: { params: { id: string } }
): Promise<NextResponse<RouteDetailResponse>> {
  if (!checkApiKey(req)) {
    return NextResponse.json({ ok: false, error: 'APIキーが無効です' }, { status: 401 });
  }
  if (!SUPABASE_READY) {
    return NextResponse.json({ ok: false, error: 'Supabase未設定' }, { status: 503 });
  }
  const { id } = context.params;
  const { supabaseServer } = await import('@/lib/supabase/server');

  const { data: route, error: routeError } = await supabaseServer
    .from('routes').select('*').eq('id', id).eq('is_deleted', false).single();
  if (routeError || !route) {
    return NextResponse.json({ ok: false, error: 'ルートが見つかりません' }, { status: 404 });
  }

  const { data: traceRows, error: tracesError } = await supabaseServer
    .from('traces').select('*').in('id', route.trace_ids);
  if (tracesError) {
    return NextResponse.json({ ok: false, error: tracesError.message }, { status: 500 });
  }

  const byId = new Map((traceRows as Trace[]).map((t) => [t.id, t]));
  const traces = (route.trace_ids as string[]).map((tid) => byId.get(tid)).filter((t): t is Trace => Boolean(t));

  return NextResponse.json({ ok: true, route: route as Route, traces });
}
