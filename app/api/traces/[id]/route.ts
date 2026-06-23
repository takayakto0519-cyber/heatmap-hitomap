import { NextRequest, NextResponse } from 'next/server';
import type { Trace } from '@/lib/types';

const SUPABASE_READY = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL);

async function getServerClient() {
  const { supabaseServer } = await import('@/lib/supabase/server');
  return supabaseServer;
}

// PATCH /api/traces/[id] — タイトル・テキスト・トグルの更新
export async function PATCH(
  req: NextRequest,
  context: { params: { id: string } }
) {
  if (!SUPABASE_READY) {
    return NextResponse.json({ ok: false, error: 'Supabase未設定' }, { status: 503 });
  }
  try {
    const { id } = context.params;
    const body = await req.json();
    const allowed = ['title', 'why', 'interpretation', 'self_reflection', 'want_revisit', 'want_to_share'];
    const updates: Record<string, unknown> = {};
    for (const key of allowed) {
      if (key in body) updates[key] = body[key] ?? null;
    }
    const supabase = await getServerClient();
    const { data, error } = await supabase
      .from('traces').update(updates).eq('id', id).select().single();
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, trace: data as Trace });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 400 });
  }
}

// DELETE /api/traces/[id] — 削除＋写真のStorageクリーンアップ
export async function DELETE(
  _req: NextRequest,
  context: { params: { id: string } }
) {
  if (!SUPABASE_READY) {
    return NextResponse.json({ ok: false, error: 'Supabase未設定' }, { status: 503 });
  }
  try {
    const { id } = context.params;
    const supabase = await getServerClient();
    const { data: trace } = await supabase
      .from('traces').select('photo_url').eq('id', id).single();
    const { error } = await supabase.from('traces').delete().eq('id', id);
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    if (trace?.photo_url) {
      const match = trace.photo_url.match(/trace-photos\/(.+)/);
      if (match) await supabase.storage.from('trace-photos').remove([match[1]]);
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 400 });
  }
}
