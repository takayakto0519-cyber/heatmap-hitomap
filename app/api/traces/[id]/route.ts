import { NextRequest, NextResponse } from 'next/server';
import type { Trace } from '@/lib/types';

const SUPABASE_READY = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL);

async function getServerClient() {
  const { supabaseServer } = await import('@/lib/supabase/server');
  return supabaseServer;
}

// PATCH /api/traces/[id] — タイトル・テキスト・トグルの更新、および復元(action:'restore')
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
    const supabase = await getServerClient();

    if (body.action === 'restore') {
      const { data: trace } = await supabase
        .from('traces').select('nickname').eq('id', id).single();
      if (trace?.nickname) {
        if (!body.nickname || body.nickname.trim() !== trace.nickname.trim()) {
          return NextResponse.json({ ok: false, error: 'ニックネームが一致しません' }, { status: 403 });
        }
      }
      const { data, error } = await supabase
        .from('traces')
        .update({ is_deleted: false, deleted_at: null, deleted_by: null })
        .eq('id', id).select().single();
      if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true, trace: data as Trace });
    }

    const allowed = [
      'title', 'why', 'interpretation', 'self_reflection', 'want_revisit', 'want_to_share',
      'archive_type', 'yomi', 'alt_names', 'era_label', 'source_ref', 'voice_relation', 'audio_url',
      'visibility',
    ];
    const updates: Record<string, unknown> = {};
    for (const key of allowed) {
      if (key in body) updates[key] = body[key] ?? null;
    }
    const { data, error } = await supabase
      .from('traces').update(updates).eq('id', id).select().single();
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, trace: data as Trace });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 400 });
  }
}

// DELETE /api/traces/[id] — ソフトデリート（本人はニックネーム照合、復元可能）
export async function DELETE(
  req: NextRequest,
  context: { params: { id: string } }
) {
  if (!SUPABASE_READY) {
    return NextResponse.json({ ok: false, error: 'Supabase未設定' }, { status: 503 });
  }
  try {
    const { id } = context.params;
    const body = await req.json().catch(() => ({})) as { nickname?: string };
    const supabase = await getServerClient();

    // 削除前にニックネーム照合
    const { data: trace } = await supabase
      .from('traces').select('nickname').eq('id', id).single();

    if (trace?.nickname) {
      // 投稿にニックネームが設定されている場合は一致確認
      if (!body.nickname || body.nickname.trim() !== trace.nickname.trim()) {
        return NextResponse.json(
          { ok: false, error: 'ニックネームが一致しません' },
          { status: 403 }
        );
      }
    }

    const { error } = await supabase
      .from('traces')
      .update({ is_deleted: true, deleted_at: new Date().toISOString(), deleted_by: body.nickname ?? 'anonymous' })
      .eq('id', id);
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 400 });
  }
}

