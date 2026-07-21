// GET/POST /api/admin/action-items — 作業状況（次のアクション）の横断管理（パスワード必須）
import { NextRequest, NextResponse } from 'next/server';
import { checkAdmin } from '@/lib/adminAuth';
import { isMissingTable, missingTablePayload } from '@/lib/adminApi';

const SUPABASE_READY = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL);
const MIGRATION_FILE = 'supabase/migrations/20260720_add_action_items.sql';

export async function GET(req: NextRequest) {
  if (!SUPABASE_READY) return NextResponse.json({ ok: false, error: 'Supabase未設定' }, { status: 503 });
  if (!checkAdmin(req)) return NextResponse.json({ ok: false, error: 'パスワードが違います' }, { status: 401 });

  const { supabaseServer } = await import('@/lib/supabase/server');
  const { data, error } = await supabaseServer
    .from('action_items').select('*').order('updated_at', { ascending: false });

  if (error) {
    // テーブル未作成（SQL未適用）のときは画面を壊さず、どのSQLを流せばよいかを伝える
    if (isMissingTable(error.message, 'action_items')) return NextResponse.json(missingTablePayload('items', MIGRATION_FILE));
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, items: data ?? [] });
}

export async function POST(req: NextRequest) {
  if (!SUPABASE_READY) return NextResponse.json({ ok: false, error: 'Supabase未設定' }, { status: 503 });
  if (!checkAdmin(req)) return NextResponse.json({ ok: false, error: 'パスワードが違います' }, { status: 401 });

  const body = await req.json().catch(() => ({})) as {
    title?: string; category?: string; status?: string; owner?: string;
    file_ref?: string | null; notes?: string | null; due_date?: string | null;
  };
  if (!body.title?.trim()) return NextResponse.json({ ok: false, error: 'タイトルは必須です' }, { status: 400 });

  const { supabaseServer } = await import('@/lib/supabase/server');
  const { data, error } = await supabaseServer
    .from('action_items')
    .insert({
      title: body.title.trim(),
      category: body.category?.trim() || 'その他',
      status: body.status?.trim() || 'todo',
      owner: body.owner?.trim() || 'AI',
      file_ref: body.file_ref?.trim() || null,
      notes: body.notes?.trim() || null,
      due_date: body.due_date || null,
    })
    .select().single();

  if (error) {
    if (isMissingTable(error.message, 'action_items')) {
      return NextResponse.json({ ok: false, error: `作業状況(To-Do)のテーブルが未作成です。${MIGRATION_FILE} をSQL Editorで実行してください` }, { status: 503 });
    }
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, item: data });
}
