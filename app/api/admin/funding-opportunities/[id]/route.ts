// PATCH/DELETE /api/admin/funding-opportunities/[id] — 締切台帳の1件更新・削除
import { NextRequest, NextResponse } from 'next/server';
import { checkAdmin } from '@/lib/adminAuth';

const SUPABASE_READY = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL);
const ALLOWED_FIELDS = [
  'title', 'organizer', 'opp_type', 'region', 'deadline', 'deadline_note',
  'announcement_date', 'prize_amount', 'url', 'status', 'memo', 'source',
  'fit_score', 'fit_notes', 'municipality_profile_id',
];

export async function PATCH(req: NextRequest, context: { params: { id: string } }) {
  if (!SUPABASE_READY) return NextResponse.json({ ok: false, error: 'Supabase未設定' }, { status: 503 });
  if (!checkAdmin(req)) return NextResponse.json({ ok: false, error: 'パスワードが違います' }, { status: 401 });

  const { id } = context.params;
  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  for (const key of ALLOWED_FIELDS) {
    if (key in body) updates[key] = body[key];
  }

  const { supabaseServer } = await import('@/lib/supabase/server');
  let { data, error } = await supabaseServer
    .from('funding_opportunities').update(updates).eq('id', id).select().single();
  // マイグレーション未適用のカラムを指定した場合でも壊れないように、
  // エラーメッセージから実際に存在しないカラム名を読み取ってその項目だけ外し再試行する。
  for (let i = 0; error && i < ALLOWED_FIELDS.length; i++) {
    const missing = error.message.match(/['"]([a-zA-Z_]+)['"] column/)?.[1]
      ?? error.message.match(/column ["']([a-zA-Z_]+)["']/)?.[1];
    if (!missing || !(missing in updates)) break;
    delete updates[missing];
    ({ data, error } = await supabaseServer
      .from('funding_opportunities').update(updates).eq('id', id).select().single());
  }

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, opportunity: data });
}

export async function DELETE(req: NextRequest, context: { params: { id: string } }) {
  if (!SUPABASE_READY) return NextResponse.json({ ok: false, error: 'Supabase未設定' }, { status: 503 });
  if (!checkAdmin(req)) return NextResponse.json({ ok: false, error: 'パスワードが違います' }, { status: 401 });

  const { id } = context.params;
  const { supabaseServer } = await import('@/lib/supabase/server');
  const { error } = await supabaseServer.from('funding_opportunities').delete().eq('id', id);

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
