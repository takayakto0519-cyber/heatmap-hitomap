// GET /api/traces/[id]/versions — 版管理（変更履歴）。「痕跡は上書きしない」思想の実装。公開・読み取り専用
import { NextRequest, NextResponse } from 'next/server';

const SUPABASE_READY = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL);

export async function GET(req: NextRequest, context: { params: { id: string } }) {
  if (!SUPABASE_READY) return NextResponse.json({ ok: true, versions: [] });
  const { id } = context.params;
  const { supabaseServer } = await import('@/lib/supabase/server');
  const { data, error } = await supabaseServer
    .from('trace_versions')
    .select('id, snapshot, edited_at')
    .eq('trace_id', id)
    .order('edited_at', { ascending: false });

  if (error) return NextResponse.json({ ok: true, versions: [] });

  const versions = (data ?? []).map((v) => ({
    id: v.id,
    edited_at: v.edited_at,
    title: v.snapshot?.title ?? null,
    why: v.snapshot?.why ?? null,
    interpretation: v.snapshot?.interpretation ?? null,
    self_reflection: v.snapshot?.self_reflection ?? null,
  }));

  return NextResponse.json({ ok: true, versions });
}
