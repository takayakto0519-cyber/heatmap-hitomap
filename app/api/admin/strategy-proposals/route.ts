// GET/POST /api/admin/strategy-proposals — 経営提案ボード（マーケ案・新規事業案の受信トレイ、パスワード必須）
import { NextRequest, NextResponse } from 'next/server';
import { checkAdmin } from '@/lib/adminAuth';

const SUPABASE_READY = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL);

export async function GET(req: NextRequest) {
  if (!SUPABASE_READY) return NextResponse.json({ ok: false, error: 'Supabase未設定' }, { status: 503 });
  if (!checkAdmin(req)) return NextResponse.json({ ok: false, error: 'パスワードが違います' }, { status: 401 });

  const status = req.nextUrl.searchParams.get('status');
  const { supabaseServer } = await import('@/lib/supabase/server');
  let query = supabaseServer.from('strategy_proposals').select('*').order('created_at', { ascending: false });
  if (status) query = query.eq('status', status);
  const { data, error } = await query;

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, proposals: data ?? [] });
}

export async function POST(req: NextRequest) {
  if (!SUPABASE_READY) return NextResponse.json({ ok: false, error: 'Supabase未設定' }, { status: 503 });
  if (!checkAdmin(req)) return NextResponse.json({ ok: false, error: 'パスワードが違います' }, { status: 401 });

  const body = await req.json().catch(() => ({})) as {
    category?: string; source_skill?: string; title?: string; body?: string; status?: string;
  };
  if (!body.title?.trim()) return NextResponse.json({ ok: false, error: 'タイトルは必須です' }, { status: 400 });

  const { supabaseServer } = await import('@/lib/supabase/server');
  const { data, error } = await supabaseServer
    .from('strategy_proposals')
    .insert({
      category: body.category || 'new_biz',
      source_skill: body.source_skill,
      title: body.title.trim(),
      body: body.body || '',
      status: body.status || 'unread',
    })
    .select().single();

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, proposal: data });
}
