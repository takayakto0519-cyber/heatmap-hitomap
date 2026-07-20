// GET/POST /api/admin/funding-opportunities — コンテスト・補助金・資金調達イベントの締切台帳
// GETは締切が近い順（NULLは末尾）。テーブル未作成の場合はneedsMigration:trueを返し、
// ダッシュボード側が案内を出せるようにする（画面を壊さない）。
import { NextRequest, NextResponse } from 'next/server';
import { checkAdmin } from '@/lib/adminAuth';

const SUPABASE_READY = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL);
const OPP_TYPES = new Set(['municipal_support', 'subsidy', 'contest', 'funding_event']);

function isMissingTable(message: string): boolean {
  return message.includes('funding_opportunities') && (message.includes('does not exist') || message.includes('schema cache'));
}

export async function GET(req: NextRequest) {
  if (!SUPABASE_READY) return NextResponse.json({ ok: false, error: 'Supabase未設定' }, { status: 503 });
  if (!checkAdmin(req)) return NextResponse.json({ ok: false, error: 'パスワードが違います' }, { status: 401 });

  const { supabaseServer } = await import('@/lib/supabase/server');
  const { data, error } = await supabaseServer
    .from('funding_opportunities')
    .select('*')
    .order('deadline', { ascending: true, nullsFirst: false });

  if (error) {
    if (isMissingTable(error.message)) return NextResponse.json({ ok: true, opportunities: [], needsMigration: true });
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, opportunities: data ?? [] });
}

export async function POST(req: NextRequest) {
  if (!SUPABASE_READY) return NextResponse.json({ ok: false, error: 'Supabase未設定' }, { status: 503 });
  if (!checkAdmin(req)) return NextResponse.json({ ok: false, error: 'パスワードが違います' }, { status: 401 });

  const body = await req.json().catch(() => ({})) as {
    title?: string; organizer?: string | null; opp_type?: string; region?: string | null;
    deadline?: string | null; deadline_note?: string | null; announcement_date?: string | null;
    prize_amount?: string | null; url?: string | null; status?: string; memo?: string | null; source?: string | null;
    fit_score?: number | null; fit_notes?: string | null;
  };
  if (!body.title?.trim()) return NextResponse.json({ ok: false, error: 'タイトルは必須です' }, { status: 400 });
  if (body.opp_type && !OPP_TYPES.has(body.opp_type)) return NextResponse.json({ ok: false, error: '種別が不正です' }, { status: 400 });

  const { supabaseServer } = await import('@/lib/supabase/server');
  const { data, error } = await supabaseServer
    .from('funding_opportunities')
    .insert({
      title: body.title.trim(),
      organizer: body.organizer?.trim() || null,
      opp_type: body.opp_type ?? 'contest',
      region: body.region?.trim() || null,
      deadline: body.deadline || null,
      deadline_note: body.deadline_note?.trim() || null,
      announcement_date: body.announcement_date || null,
      prize_amount: body.prize_amount?.trim() || null,
      url: body.url?.trim() || null,
      status: body.status ?? 'watching',
      memo: body.memo?.trim() || null,
      source: body.source?.trim() || null,
      fit_score: body.fit_score ?? null,
      fit_notes: body.fit_notes?.trim() || null,
    })
    .select().single();

  if (error) {
    if (isMissingTable(error.message)) {
      return NextResponse.json({ ok: false, error: '締切台帳のテーブルが未作成です。supabase/migrations/20260720_add_funding_opportunities.sql をSQL Editorで実行してください' }, { status: 503 });
    }
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, opportunity: data });
}
