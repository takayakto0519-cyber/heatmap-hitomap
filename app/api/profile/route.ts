import { NextRequest, NextResponse } from 'next/server';
import { createRequestClient } from '@/lib/supabase/requestClient';

// GET /api/profile — 自分のプロフィール取得（未ログインなら user:null）
export async function GET() {
  const supabase = createRequestClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    return NextResponse.json({ ok: true, user: null, profile: null });
  }
  const { data: profile } = await supabase
    .from('profiles').select('*').eq('id', userData.user.id).maybeSingle();
  return NextResponse.json({ ok: true, user: { id: userData.user.id, email: userData.user.email }, profile });
}

// POST /api/profile — 初回のusername登録（重複不可）
export async function POST(req: NextRequest) {
  const supabase = createRequestClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    return NextResponse.json({ ok: false, error: 'ログインが必要です' }, { status: 401 });
  }
  const body = await req.json().catch(() => ({})) as { username?: string; display_name?: string; bio?: string };
  if (!body.username || !body.username.trim()) {
    return NextResponse.json({ ok: false, error: 'ユーザー名は必須です' }, { status: 400 });
  }
  const { data, error } = await supabase
    .from('profiles')
    .insert({ id: userData.user.id, username: body.username.trim(), display_name: body.display_name ?? null, bio: body.bio ?? null })
    .select().single();
  if (error) {
    const msg = error.code === '23505' ? 'そのユーザー名は既に使われています' : error.message;
    return NextResponse.json({ ok: false, error: msg }, { status: 400 });
  }
  return NextResponse.json({ ok: true, profile: data });
}

// PATCH /api/profile — display_name・bio の更新
export async function PATCH(req: NextRequest) {
  const supabase = createRequestClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    return NextResponse.json({ ok: false, error: 'ログインが必要です' }, { status: 401 });
  }
  const body = await req.json().catch(() => ({})) as { display_name?: string; bio?: string; avatar_url?: string };
  const updates: Record<string, unknown> = {};
  if ('display_name' in body) updates.display_name = body.display_name ?? null;
  if ('bio' in body) updates.bio = body.bio ?? null;
  if ('avatar_url' in body) updates.avatar_url = body.avatar_url ?? null;
  const { data, error } = await supabase
    .from('profiles').update(updates).eq('id', userData.user.id).select().single();
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, profile: data });
}
