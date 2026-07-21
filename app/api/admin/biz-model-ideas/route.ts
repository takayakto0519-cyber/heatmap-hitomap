// GET/POST /api/admin/biz-model-ideas — ビジネスモデル案の一覧（パスワード必須）
import { NextRequest, NextResponse } from 'next/server';
import { checkAdmin } from '@/lib/adminAuth';
import { isMissingTable, missingTablePayload } from '@/lib/adminApi';

const SUPABASE_READY = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL);
const MIGRATION_FILE = 'supabase/migrations/20260719_add_biz_model_ideas.sql';

export async function GET(req: NextRequest) {
  if (!SUPABASE_READY) return NextResponse.json({ ok: false, error: 'Supabase未設定' }, { status: 503 });
  if (!checkAdmin(req)) return NextResponse.json({ ok: false, error: 'パスワードが違います' }, { status: 401 });

  const contest = req.nextUrl.searchParams.get('contest');
  const { supabaseServer } = await import('@/lib/supabase/server');
  let query = supabaseServer.from('biz_model_ideas').select('*');
  query = contest ? query.eq('contest', contest).order('idea_no', { ascending: true }) : query.order('created_at', { ascending: false });
  const { data, error } = await query;

  if (error) {
    // テーブル未作成（SQL未適用）のときは画面を壊さず、どのSQLを流せばよいかを伝える
    if (isMissingTable(error.message, 'biz_model_ideas')) return NextResponse.json(missingTablePayload('ideas', MIGRATION_FILE));
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, ideas: data ?? [] });
}

export async function POST(req: NextRequest) {
  if (!SUPABASE_READY) return NextResponse.json({ ok: false, error: 'Supabase未設定' }, { status: 503 });
  if (!checkAdmin(req)) return NextResponse.json({ ok: false, error: 'パスワードが違います' }, { status: 401 });

  const body = await req.json().catch(() => ({})) as {
    title?: string; memo?: string; status?: string; contest?: string; idea_no?: number; report_md?: string;
  };
  if (!body.title?.trim()) return NextResponse.json({ ok: false, error: 'タイトルは必須です' }, { status: 400 });

  const { supabaseServer } = await import('@/lib/supabase/server');
  const { data, error } = await supabaseServer
    .from('biz_model_ideas')
    .insert({
      title: body.title.trim(), memo: body.memo, status: body.status,
      contest: body.contest, idea_no: body.idea_no, report_md: body.report_md,
    })
    .select().single();

  if (error) {
    if (isMissingTable(error.message, 'biz_model_ideas')) {
      return NextResponse.json({ ok: false, error: `ビジネスモデル案のテーブルが未作成です。${MIGRATION_FILE} をSQL Editorで実行してください` }, { status: 503 });
    }
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, idea: data });
}
