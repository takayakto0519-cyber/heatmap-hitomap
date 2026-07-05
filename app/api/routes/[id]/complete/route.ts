import { NextRequest, NextResponse } from 'next/server';
import type { RouteCompletionsResponse } from '@/lib/types';
import { getCurrentUserId } from '@/lib/supabase/requestClient';

const SUPABASE_READY = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL);

async function getServerClient() {
  const { supabaseServer } = await import('@/lib/supabase/server');
  return supabaseServer;
}

// POST /api/routes/[id]/complete — 踏破の記録（無料。決済は伴わない）
export async function POST(req: NextRequest, context: { params: { id: string } }) {
  if (!SUPABASE_READY) {
    return NextResponse.json({ ok: false, error: 'Supabase未設定' }, { status: 503 });
  }
  const { id } = context.params;
  const body = await req.json().catch(() => ({})) as { nickname?: string };
  const userId = await getCurrentUserId();
  const supabase = await getServerClient();

  const { error } = await supabase.from('route_completions').insert({
    route_id: id,
    user_id: userId,
    nickname: body.nickname ?? null,
  });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

// GET /api/routes/[id]/complete — 踏破人数の取得
export async function GET(
  req: NextRequest,
  context: { params: { id: string } }
): Promise<NextResponse<RouteCompletionsResponse>> {
  if (!SUPABASE_READY) {
    return NextResponse.json({ ok: true, count: 0 });
  }
  const { id } = context.params;
  const supabase = await getServerClient();
  const { count, error } = await supabase
    .from('route_completions')
    .select('id', { count: 'exact', head: true })
    .eq('route_id', id);
  if (error) return NextResponse.json({ ok: false, count: 0, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, count: count ?? 0 });
}
