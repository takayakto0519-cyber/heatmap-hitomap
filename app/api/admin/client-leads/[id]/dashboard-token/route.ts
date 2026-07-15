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
  const body = await req.json().catch(() => ({})) as { region?: string; label?: string };
  if (!body.region) {
    return NextResponse.json<IssueDashboardTokenResponse>({ ok: false, error: 'region は必須です' }, { status: 400 });
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

  if (!access) {
    const { data, error } = await supabaseServer
      .from('dashboard_access')
      .insert({
        client_lead_id: id,
        token: randomUUID(),
        region: body.region,
        label: body.label ?? null,
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
