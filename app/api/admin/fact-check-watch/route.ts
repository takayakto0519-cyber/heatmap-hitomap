// GET /api/admin/fact-check-watch — agents/fact_check_watch.py が書き込んだ「要確認」指摘の読み取り専用API。
// fact_check_flagsは同スクリプトのneeds_reviewをそのままDB化したもので、ここでは一切書き込まない。
// fact_check_statusの自動変更はしない設計（2026-07-22の誤検知インシデントを踏まえた恒久ルール）。
import { NextRequest, NextResponse } from 'next/server';
import { checkAdmin } from '@/lib/adminAuth';
import { isMissingTable, missingTablePayload } from '@/lib/adminApi';

const SUPABASE_READY = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL);
const MIGRATION_FILE = 'supabase/migrations/20260723_add_fact_check_flags.sql';

export async function GET(req: NextRequest) {
  if (!SUPABASE_READY) return NextResponse.json({ ok: false, error: 'Supabase未設定' }, { status: 503 });
  if (!checkAdmin(req)) return NextResponse.json({ ok: false, error: 'パスワードが違います' }, { status: 401 });

  const { supabaseServer } = await import('@/lib/supabase/server');
  const { data, error } = await supabaseServer
    .from('fact_check_flags').select('*').order('detected_at', { ascending: false });

  if (error) {
    if (isMissingTable(error.message, 'fact_check_flags')) return NextResponse.json(missingTablePayload('flags', MIGRATION_FILE));
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, flags: data ?? [] });
}
