// GET/POST /api/admin/business-line-pnl — 事業別損益(P&L)の管理（パスワード必須）
// 顧問・キット販売・SaaS・採用商材など事業ラインごとの月次売上・原価を記録する。
// 同じ事業ライン×月の組で保存すると上書き（upsert）されるため、月を跨いだ再入力がしやすい。
import { NextRequest, NextResponse } from 'next/server';
import { checkAdmin } from '@/lib/adminAuth';
import { isMissingTable, missingTablePayload } from '@/lib/adminApi';

const SUPABASE_READY = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL);
const MIGRATION_FILE = 'supabase/migrations/20260719_add_pnl_and_revenue_code.sql';

export async function GET(req: NextRequest) {
  if (!SUPABASE_READY) return NextResponse.json({ ok: false, error: 'Supabase未設定' }, { status: 503 });
  if (!checkAdmin(req)) return NextResponse.json({ ok: false, error: 'パスワードが違います' }, { status: 401 });

  const { supabaseServer } = await import('@/lib/supabase/server');
  const { data, error } = await supabaseServer
    .from('business_line_pnl').select('*').order('month', { ascending: false });

  if (error) {
    // テーブル未作成（SQL未適用）のときは画面を壊さず、どのSQLを流せばよいかを伝える
    if (isMissingTable(error.message, 'business_line_pnl')) return NextResponse.json(missingTablePayload('entries', MIGRATION_FILE));
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, entries: data ?? [] });
}

export async function POST(req: NextRequest) {
  if (!SUPABASE_READY) return NextResponse.json({ ok: false, error: 'Supabase未設定' }, { status: 503 });
  if (!checkAdmin(req)) return NextResponse.json({ ok: false, error: 'パスワードが違います' }, { status: 401 });

  const body = await req.json().catch(() => ({})) as {
    line_key?: string; month?: string; revenue?: number; cost?: number; memo?: string | null;
  };
  if (!body.line_key?.trim()) return NextResponse.json({ ok: false, error: '事業ラインは必須です' }, { status: 400 });
  if (!body.month) return NextResponse.json({ ok: false, error: '対象月は必須です' }, { status: 400 });

  const { supabaseServer } = await import('@/lib/supabase/server');
  const { data, error } = await supabaseServer
    .from('business_line_pnl')
    .upsert({
      line_key: body.line_key.trim(),
      month: body.month,
      revenue: Number.isFinite(body.revenue) ? Number(body.revenue) : 0,
      cost: Number.isFinite(body.cost) ? Number(body.cost) : 0,
      memo: body.memo?.trim() || null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'line_key,month' })
    .select().single();

  if (error) {
    if (isMissingTable(error.message, 'business_line_pnl')) {
      return NextResponse.json({ ok: false, error: `事業別損益のテーブルが未作成です。${MIGRATION_FILE} をSQL Editorで実行してください` }, { status: 503 });
    }
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, entry: data });
}
