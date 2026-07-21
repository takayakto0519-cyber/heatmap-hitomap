// GET/POST /api/admin/meeting-minutes — 議事録（日記形式）の一覧（パスワード必須）
import { NextRequest, NextResponse } from 'next/server';
import { checkAdmin } from '@/lib/adminAuth';
import { isMissingTable, missingTablePayload } from '@/lib/adminApi';

const SUPABASE_READY = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL);
const MIGRATION_FILE = 'supabase/migrations/20260719_add_meeting_minutes.sql';

export async function GET(req: NextRequest) {
  if (!SUPABASE_READY) return NextResponse.json({ ok: false, error: 'Supabase未設定' }, { status: 503 });
  if (!checkAdmin(req)) return NextResponse.json({ ok: false, error: 'パスワードが違います' }, { status: 401 });

  const { supabaseServer } = await import('@/lib/supabase/server');
  const { data, error } = await supabaseServer
    .from('meeting_minutes').select('*').order('entry_date', { ascending: false }).order('created_at', { ascending: false });

  if (error) {
    // テーブル未作成（SQL未適用）のときは画面を壊さず、どのSQLを流せばよいかを伝える
    if (isMissingTable(error.message, 'meeting_minutes')) return NextResponse.json(missingTablePayload('minutes', MIGRATION_FILE));
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, minutes: data ?? [] });
}

export async function POST(req: NextRequest) {
  if (!SUPABASE_READY) return NextResponse.json({ ok: false, error: 'Supabase未設定' }, { status: 503 });
  if (!checkAdmin(req)) return NextResponse.json({ ok: false, error: 'パスワードが違います' }, { status: 401 });

  const body = await req.json().catch(() => ({})) as { entry_date?: string; title?: string; participants?: string; body?: string };
  if (!body.entry_date) return NextResponse.json({ ok: false, error: '日付は必須です' }, { status: 400 });

  const { supabaseServer } = await import('@/lib/supabase/server');
  const { data, error } = await supabaseServer
    .from('meeting_minutes')
    .insert({
      entry_date: body.entry_date,
      title: body.title?.trim() || null,
      participants: body.participants?.trim() || null,
      body: body.body ?? '',
    })
    .select().single();

  if (error) {
    if (isMissingTable(error.message, 'meeting_minutes')) {
      return NextResponse.json({ ok: false, error: `議事録のテーブルが未作成です。${MIGRATION_FILE} をSQL Editorで実行してください` }, { status: 503 });
    }
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, entry: data });
}
