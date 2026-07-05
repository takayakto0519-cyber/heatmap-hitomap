import { NextRequest, NextResponse } from 'next/server';
import type { Route, RouteDetailResponse, Trace } from '@/lib/types';

const SUPABASE_READY = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL);

async function getServerClient() {
  const { supabaseServer } = await import('@/lib/supabase/server');
  return supabaseServer;
}

// GET /api/routes/[id] — ルート＋trace_idsの順番どおりに解決した痕跡一覧
export async function GET(
  req: NextRequest,
  context: { params: { id: string } }
): Promise<NextResponse<RouteDetailResponse>> {
  if (!SUPABASE_READY) {
    return NextResponse.json({ ok: false, error: 'Supabase未設定' }, { status: 503 });
  }
  const { id } = context.params;
  const supabase = await getServerClient();

  const { data: route, error: routeError } = await supabase
    .from('routes').select('*').eq('id', id).eq('is_deleted', false).single();
  if (routeError || !route) {
    return NextResponse.json({ ok: false, error: 'ルートが見つかりません' }, { status: 404 });
  }

  const { data: traceRows, error: tracesError } = await supabase
    .from('traces').select('*').in('id', route.trace_ids);
  if (tracesError) {
    return NextResponse.json({ ok: false, error: tracesError.message }, { status: 500 });
  }

  // trace_ids の順番どおりに並べ直す
  const byId = new Map((traceRows as Trace[]).map((t) => [t.id, t]));
  const traces = (route.trace_ids as string[])
    .map((tid) => byId.get(tid))
    .filter((t): t is Trace => Boolean(t));

  return NextResponse.json({ ok: true, route: route as Route, traces });
}

// PATCH /api/routes/[id] — タイトル・説明・並び順の更新（本人のみ、nickname照合）
export async function PATCH(
  req: NextRequest,
  context: { params: { id: string } }
) {
  if (!SUPABASE_READY) {
    return NextResponse.json({ ok: false, error: 'Supabase未設定' }, { status: 503 });
  }
  const { id } = context.params;
  const body = await req.json().catch(() => ({})) as {
    title?: string; description?: string; trace_ids?: string[]; nickname?: string;
  };
  const supabase = await getServerClient();

  const { data: route } = await supabase.from('routes').select('nickname').eq('id', id).single();
  if (route?.nickname) {
    if (!body.nickname || body.nickname.trim() !== route.nickname.trim()) {
      return NextResponse.json({ ok: false, error: 'ニックネームが一致しません' }, { status: 403 });
    }
  }

  const updates: Record<string, unknown> = {};
  if ('title' in body) updates.title = body.title;
  if ('description' in body) updates.description = body.description ?? null;
  if ('trace_ids' in body) updates.trace_ids = body.trace_ids;

  const { data, error } = await supabase.from('routes').update(updates).eq('id', id).select().single();
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, route: data as Route });
}

// DELETE /api/routes/[id] — ソフトデリート（本人のみ、nickname照合）
export async function DELETE(
  req: NextRequest,
  context: { params: { id: string } }
) {
  if (!SUPABASE_READY) {
    return NextResponse.json({ ok: false, error: 'Supabase未設定' }, { status: 503 });
  }
  const { id } = context.params;
  const body = await req.json().catch(() => ({})) as { nickname?: string };
  const supabase = await getServerClient();

  const { data: route } = await supabase.from('routes').select('nickname').eq('id', id).single();
  if (route?.nickname) {
    if (!body.nickname || body.nickname.trim() !== route.nickname.trim()) {
      return NextResponse.json({ ok: false, error: 'ニックネームが一致しません' }, { status: 403 });
    }
  }

  const { error } = await supabase
    .from('routes')
    .update({ is_deleted: true, deleted_at: new Date().toISOString(), deleted_by: body.nickname ?? 'anonymous' })
    .eq('id', id);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
