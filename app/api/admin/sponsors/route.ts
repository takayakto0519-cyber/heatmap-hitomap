// GET /api/admin/sponsors — スポンサー枠の全件一覧（非公開分も含む。パスワード必須）
import { NextRequest, NextResponse } from 'next/server';
import { checkAdmin } from '@/lib/adminAuth';
import type { Sponsor } from '@/lib/types';

const SUPABASE_READY = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL);

export async function GET(req: NextRequest) {
  if (!SUPABASE_READY) {
    return NextResponse.json({ ok: false, sponsors: [], error: 'Supabase未設定' }, { status: 503 });
  }
  if (!checkAdmin(req)) {
    return NextResponse.json({ ok: false, sponsors: [], error: 'パスワードが違います' }, { status: 401 });
  }
  const { supabaseServer } = await import('@/lib/supabase/server');
  const { data, error } = await supabaseServer
    .from('sponsors').select('*').order('created_at', { ascending: false });
  if (error) return NextResponse.json({ ok: false, sponsors: [], error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, sponsors: (data ?? []) as Sponsor[] });
}
