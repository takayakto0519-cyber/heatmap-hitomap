// GET /api/admin/trace-pattern — 痕跡データパターン分析（パスワード必須）
// agents/trace_pattern.py（番人62）と同じ考え方をサイト本体からライブに読む。
// 自治体向けレポート商品の一次データ。個人を特定できる値は含めない。
import { NextRequest, NextResponse } from 'next/server';
import { checkAdmin } from '@/lib/adminAuth';
import { computeTracePattern } from '@/lib/tracePattern';

const SUPABASE_READY = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL);

export async function GET(req: NextRequest) {
  if (!SUPABASE_READY) {
    return NextResponse.json({ ok: false, error: 'Supabase未設定' }, { status: 503 });
  }
  if (!checkAdmin(req)) {
    return NextResponse.json({ ok: false, error: 'パスワードが違います' }, { status: 401 });
  }

  const { supabaseServer } = await import('@/lib/supabase/server');
  const result = await computeTracePattern(supabaseServer);
  return NextResponse.json(result, { status: result.ok ? 200 : 500 });
}
