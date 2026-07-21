// GET/POST /api/admin/en-records — 縁の台帳（痕跡・余白・共動・推譲の記録）
// GETは全件（?lead_id=で絞り込み可）。テーブル未作成の場合は needsMigration:true を返して
// ダッシュボード側が「SQL適用待ち」の案内を出せるようにする（画面を壊さない）。
import { NextRequest, NextResponse } from 'next/server';
import { checkAdmin } from '@/lib/adminAuth';
import { isMissingTable, missingTablePayload } from '@/lib/adminApi';

const SUPABASE_READY = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL);
const KINDS = new Set(['trace', 'yohaku', 'action', 'suijo']);
const MIGRATION_FILE = 'supabase/migrations/20260719_add_en_records.sql';

export async function GET(req: NextRequest) {
  if (!SUPABASE_READY) return NextResponse.json({ ok: false, error: 'Supabase未設定' }, { status: 503 });
  if (!checkAdmin(req)) return NextResponse.json({ ok: false, error: 'パスワードが違います' }, { status: 401 });

  const leadId = req.nextUrl.searchParams.get('lead_id');
  const { supabaseServer } = await import('@/lib/supabase/server');
  let query = supabaseServer.from('en_records').select('*').order('happened_at', { ascending: false }).order('created_at', { ascending: false });
  if (leadId) query = query.eq('lead_id', leadId);
  const { data, error } = await query;

  if (error) {
    if (isMissingTable(error.message, 'en_records')) return NextResponse.json(missingTablePayload('records', MIGRATION_FILE));
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, records: data ?? [] });
}

export async function POST(req: NextRequest) {
  if (!SUPABASE_READY) return NextResponse.json({ ok: false, error: 'Supabase未設定' }, { status: 503 });
  if (!checkAdmin(req)) return NextResponse.json({ ok: false, error: 'パスワードが違います' }, { status: 401 });

  const body = await req.json().catch(() => ({})) as {
    lead_id?: string; kind?: string; note?: string; happened_at?: string;
  };
  if (!body.lead_id) return NextResponse.json({ ok: false, error: 'lead_idは必須です' }, { status: 400 });
  if (!body.kind || !KINDS.has(body.kind)) return NextResponse.json({ ok: false, error: 'kindはtrace/yohaku/action/suijoのいずれかです' }, { status: 400 });
  if (!body.note?.trim()) return NextResponse.json({ ok: false, error: '記録の内容を書いてください' }, { status: 400 });

  const { supabaseServer } = await import('@/lib/supabase/server');
  const { data, error } = await supabaseServer
    .from('en_records')
    .insert({
      lead_id: body.lead_id,
      kind: body.kind,
      note: body.note.trim(),
      ...(body.happened_at ? { happened_at: body.happened_at } : {}),
    })
    .select().single();

  if (error) {
    if (isMissingTable(error.message, 'en_records')) {
      return NextResponse.json({ ok: false, error: `縁の台帳のテーブルが未作成です。${MIGRATION_FILE} をSQL Editorで実行してください` }, { status: 503 });
    }
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, record: data });
}
