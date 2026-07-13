// ============================================================
// /api/sponsors : スポンサー枠（region ページのバナー／寄り道モードのPR地点）
// 表示のみ。決済・課金処理はアプリ外（手動の協賛契約）で行う。
// ============================================================
import { NextRequest, NextResponse } from 'next/server';
import { checkAdmin } from '@/lib/adminAuth';
import type { Sponsor } from '@/lib/types';

const SUPABASE_READY = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL);

// GET /api/sponsors?placement=region&region=大阪府浪速区 または ?placement=detour
export async function GET(req: NextRequest) {
  if (!SUPABASE_READY) {
    return NextResponse.json({ ok: true, sponsors: [] });
  }
  const placement = req.nextUrl.searchParams.get('placement');
  const region = req.nextUrl.searchParams.get('region');

  const { supabaseServer } = await import('@/lib/supabase/server');
  let query = supabaseServer.from('sponsors').select('*').eq('is_active', true);
  if (placement) query = query.eq('placement', placement);
  if (region) query = query.eq('region', region);

  const { data, error } = await query;
  if (error) return NextResponse.json({ ok: false, sponsors: [], error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, sponsors: (data ?? []) as Sponsor[] });
}

// POST /api/sponsors — スポンサー枠の手動登録（パスワード必須。決済処理は行わない）
export async function POST(req: NextRequest) {
  if (!SUPABASE_READY) {
    return NextResponse.json({ ok: false, error: 'Supabase未設定' }, { status: 503 });
  }
  if (!checkAdmin(req)) {
    return NextResponse.json({ ok: false, error: 'パスワードが違います' }, { status: 401 });
  }
  const body = await req.json().catch(() => ({})) as Partial<Sponsor>;
  if (!body.placement || !body.name) {
    return NextResponse.json({ ok: false, error: 'placementとnameは必須です' }, { status: 400 });
  }
  const { supabaseServer } = await import('@/lib/supabase/server');
  const { data, error } = await supabaseServer.from('sponsors').insert({
    placement: body.placement,
    region: body.region ?? null,
    name: body.name,
    message: body.message ?? null,
    url: body.url ?? null,
    latitude: body.latitude ?? null,
    longitude: body.longitude ?? null,
  }).select().single();
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, sponsor: data });
}
