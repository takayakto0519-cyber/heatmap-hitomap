// GET/POST /api/admin/team-members — 運営メンバー名簿（パスワード必須）
// To-Doの担当・カレンダーの予定担当者として使う実名リスト。「会長」のような役職名ではなく
// 実名で管理し、メンバーが増減してもコードを直さず登録・編集できるようにする。
import { NextRequest, NextResponse } from 'next/server';
import { checkAdmin } from '@/lib/adminAuth';
import { isMissingTable, missingTablePayload } from '@/lib/adminApi';

const SUPABASE_READY = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL);
const MIGRATION_FILE = 'supabase/migrations/20260721_add_team_members.sql';
const PROFILE_MIGRATION_FILE = 'supabase/migrations/20260723_add_team_member_profile.sql';

export async function GET(req: NextRequest) {
  if (!SUPABASE_READY) return NextResponse.json({ ok: false, error: 'Supabase未設定' }, { status: 503 });
  if (!checkAdmin(req)) return NextResponse.json({ ok: false, error: 'パスワードが違います' }, { status: 401 });

  const { supabaseServer } = await import('@/lib/supabase/server');
  const { data, error } = await supabaseServer
    .from('team_members').select('*').order('is_lead', { ascending: false }).order('sort_order', { ascending: true });

  if (error) {
    if (isMissingTable(error.message, 'team_members')) return NextResponse.json(missingTablePayload('members', MIGRATION_FILE));
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, members: data ?? [] });
}

export async function POST(req: NextRequest) {
  if (!SUPABASE_READY) return NextResponse.json({ ok: false, error: 'Supabase未設定' }, { status: 503 });
  if (!checkAdmin(req)) return NextResponse.json({ ok: false, error: 'パスワードが違います' }, { status: 401 });

  const body = await req.json().catch(() => ({})) as { name?: string; role?: string; is_lead?: boolean; profile_notes?: string };
  if (!body.name?.trim()) return NextResponse.json({ ok: false, error: '名前は必須です' }, { status: 400 });

  const { supabaseServer } = await import('@/lib/supabase/server');
  const { data, error } = await supabaseServer
    .from('team_members')
    .insert({
      name: body.name.trim(), role: body.role?.trim() || null, is_lead: Boolean(body.is_lead),
      profile_notes: body.profile_notes?.trim() || null,
    })
    .select().single();

  if (error) {
    if (isMissingTable(error.message, 'team_members')) {
      return NextResponse.json({ ok: false, error: `運営メンバーのテーブルまたはカラムが未作成です。${MIGRATION_FILE} と ${PROFILE_MIGRATION_FILE} をSQL Editorで実行してください` }, { status: 503 });
    }
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, member: data });
}
