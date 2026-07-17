// POST /api/admin/client-leads/[id]/dashboard-token
// 学校・法人リードに、集計ダッシュボードの専用URLを発行する（パスワード必須）。
// 既に有効なトークンがあればそれを使い回し、無ければ新規発行する。
import { randomUUID } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { checkAdmin } from '@/lib/adminAuth';
import type { DashboardAccess, IssueDashboardTokenResponse } from '@/lib/types';

const SUPABASE_READY = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL);

export async function POST(req: NextRequest, context: { params: { id: string } }) {
  if (!SUPABASE_READY) {
    return NextResponse.json<IssueDashboardTokenResponse>({ ok: false, error: 'Supabase未設定' }, { status: 503 });
  }
  if (!checkAdmin(req)) {
    return NextResponse.json<IssueDashboardTokenResponse>({ ok: false, error: 'パスワードが違います' }, { status: 401 });
  }

  const { id } = context.params;
  const body = await req.json().catch(() => ({})) as {
    region?: string; label?: string;
    bbox_min_lat?: number; bbox_max_lat?: number; bbox_min_lng?: number; bbox_max_lng?: number;
  };
  if (!body.region) {
    return NextResponse.json<IssueDashboardTokenResponse>({ ok: false, error: 'region は必須です' }, { status: 400 });
  }

  // bboxは4値すべて揃っている場合のみ有効にする（片方だけの中途半端な範囲指定を防ぐ）
  const bboxFields = [body.bbox_min_lat, body.bbox_max_lat, body.bbox_min_lng, body.bbox_max_lng];
  const hasBbox = bboxFields.every((v) => typeof v === 'number' && Number.isFinite(v));
  if (bboxFields.some((v) => v !== undefined) && !hasBbox) {
    return NextResponse.json<IssueDashboardTokenResponse>(
      { ok: false, error: '地図範囲を指定する場合は北端・南端・東端・西端をすべて入力してください' },
      { status: 400 }
    );
  }
  if (hasBbox && (body.bbox_min_lat! >= body.bbox_max_lat! || body.bbox_min_lng! >= body.bbox_max_lng!)) {
    return NextResponse.json<IssueDashboardTokenResponse>(
      { ok: false, error: '地図範囲の指定が不正です（南端は北端より小さく、西端は東端より小さくしてください）' },
      { status: 400 }
    );
  }

  const { supabaseServer } = await import('@/lib/supabase/server');

  // 同じ地域向けに既に有効なトークンがあれば使い回す（発行しすぎて管理が煩雑になるのを防ぐ）
  const { data: existing } = await supabaseServer
    .from('dashboard_access')
    .select('*')
    .eq('client_lead_id', id)
    .eq('region', body.region)
    .eq('is_active', true)
    .maybeSingle();

  let access = existing as DashboardAccess | null;

  // 既存トークンの範囲指定が今回の指定と食い違う場合は使い回さず、新規発行に進む
  // （範囲を変えたい＝実質的に別のダッシュボードとして扱う）
  if (access && hasBbox !== (access.bbox_min_lat !== null)) access = null;

  if (!access) {
    const { data, error } = await supabaseServer
      .from('dashboard_access')
      .insert({
        client_lead_id: id,
        token: randomUUID(),
        region: body.region,
        label: body.label ?? null,
        bbox_min_lat: hasBbox ? body.bbox_min_lat : null,
        bbox_max_lat: hasBbox ? body.bbox_max_lat : null,
        bbox_min_lng: hasBbox ? body.bbox_min_lng : null,
        bbox_max_lng: hasBbox ? body.bbox_max_lng : null,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json<IssueDashboardTokenResponse>({ ok: false, error: error.message }, { status: 500 });
    }
    access = data as DashboardAccess;
  }

  const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://hitomap.com';
  return NextResponse.json<IssueDashboardTokenResponse>({
    ok: true,
    access,
    url: `${SITE_URL}/dashboard/${access.token}`,
  });
}
