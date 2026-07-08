// /api/bookmarks : ブックマーク（お気に入り）
//   GET  ?trace_id=xxx ... 1件の保存状態を確認
//   GET  (trace_id なし) ... 自分の保存済み投稿一覧
//   POST { trace_id } ... 保存する
//   DELETE { trace_id } ... 保存を解除する
import { NextRequest, NextResponse } from 'next/server';
import { createRequestClient, getCurrentUserId } from '@/lib/supabase/requestClient';
import type { Trace } from '@/lib/types';

export async function GET(req: NextRequest) {
  const myId = await getCurrentUserId();
  if (!myId) return NextResponse.json({ ok: false, error: 'ログインが必要です' }, { status: 401 });

  const supabase = createRequestClient();
  const traceId = req.nextUrl.searchParams.get('trace_id');

  if (traceId) {
    const { data } = await supabase
      .from('bookmarks').select('id').eq('user_id', myId).eq('trace_id', traceId).maybeSingle();
    return NextResponse.json({ ok: true, bookmarked: Boolean(data) });
  }

  const { data: rows, error } = await supabase
    .from('bookmarks').select('trace_id, created_at').eq('user_id', myId)
    .order('created_at', { ascending: false });
  if (error) return NextResponse.json({ ok: false, traces: [], error: error.message }, { status: 500 });

  const traceIds = (rows ?? []).map((r) => r.trace_id);
  if (traceIds.length === 0) return NextResponse.json({ ok: true, traces: [] });

  const { data: traces, error: traceError } = await supabase
    .from('traces').select('*').in('id', traceIds).eq('is_deleted', false);
  if (traceError) return NextResponse.json({ ok: false, traces: [], error: traceError.message }, { status: 500 });

  // 保存した順（新しい順）に並べ替え
  const order = (rows ?? []).map((r) => r.trace_id);
  const sorted = (traces as Trace[] ?? []).sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));

  return NextResponse.json({ ok: true, traces: sorted });
}

export async function POST(req: NextRequest) {
  const myId = await getCurrentUserId();
  if (!myId) return NextResponse.json({ ok: false, error: 'ログインが必要です' }, { status: 401 });

  const body = await req.json().catch(() => ({})) as { trace_id?: string };
  if (!body.trace_id) return NextResponse.json({ ok: false, error: 'trace_id は必須です' }, { status: 400 });

  const supabase = createRequestClient();
  const { error } = await supabase
    .from('bookmarks').insert({ user_id: myId, trace_id: body.trace_id });
  if (error && error.code !== '23505') return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const myId = await getCurrentUserId();
  if (!myId) return NextResponse.json({ ok: false, error: 'ログインが必要です' }, { status: 401 });

  const body = await req.json().catch(() => ({})) as { trace_id?: string };
  if (!body.trace_id) return NextResponse.json({ ok: false, error: 'trace_id は必須です' }, { status: 400 });

  const supabase = createRequestClient();
  const { error } = await supabase
    .from('bookmarks').delete().eq('user_id', myId).eq('trace_id', body.trace_id);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
