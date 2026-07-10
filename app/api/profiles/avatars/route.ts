// GET /api/profiles/avatars?ids=uuid1,uuid2 — 地図ピン・投稿カードにアイコンを出すための一括取得
import { NextRequest, NextResponse } from 'next/server';

const SUPABASE_READY = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL);

export async function GET(req: NextRequest) {
  if (!SUPABASE_READY) return NextResponse.json({ ok: true, avatars: {} });

  const idsParam = req.nextUrl.searchParams.get('ids');
  if (!idsParam) return NextResponse.json({ ok: true, avatars: {} });
  const ids = [...new Set(idsParam.split(',').map((s) => s.trim()).filter(Boolean))].slice(0, 500);
  if (ids.length === 0) return NextResponse.json({ ok: true, avatars: {} });

  const { supabaseServer } = await import('@/lib/supabase/server');
  const { data, error } = await supabaseServer
    .from('profiles').select('id, avatar_url').in('id', ids);

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  const avatars: Record<string, string> = {};
  for (const row of data ?? []) {
    if (row.avatar_url) avatars[row.id] = row.avatar_url;
  }
  return NextResponse.json({ ok: true, avatars });
}
