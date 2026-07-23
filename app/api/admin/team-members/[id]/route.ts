// PATCH/DELETE /api/admin/team-members/[id] — 運営メンバーの更新・削除（パスワード必須）
import { NextRequest, NextResponse } from 'next/server';
import { checkAdmin } from '@/lib/adminAuth';
import { isMissingTable } from '@/lib/adminApi';

const SUPABASE_READY = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL);
const ALLOWED_FIELDS = ['name', 'role', 'is_lead', 'is_active', 'sort_order', 'profile_notes'];
const PROFILE_MIGRATION_FILE = 'supabase/migrations/20260723_add_team_member_profile.sql';

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
  const { data, error } = await supabaseServer
    .from('team_members').update(updates).eq('id', id).select().single();

  if (error) {
    if (isMissingTable(error.message, 'team_members')) {
      return NextResponse.json({ ok: false, error: `profile_notesカラムが未作成の可能性があります。${PROFILE_MIGRATION_FILE} をSQL Editorで実行してください` }, { status: 503 });
    }
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, member: data });
}

export async function DELETE(req: NextRequest, context: { params: { id: string } }) {
  if (!SUPABASE_READY) return NextResponse.json({ ok: false, error: 'Supabase未設定' }, { status: 503 });
  if (!checkAdmin(req)) return NextResponse.json({ ok: false, error: 'パスワードが違います' }, { status: 401 });

  const { id } = context.params;
  const { supabaseServer } = await import('@/lib/supabase/server');
  const { error } = await supabaseServer.from('team_members').delete().eq('id', id);

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
