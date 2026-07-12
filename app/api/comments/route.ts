// /api/comments : 痕跡へのコメント
//   GET  ... trace_id を指定してコメント一覧を取得（投稿者のusername/avatarも解決して返す）
//   POST ... コメントを投稿する（ログイン必須）
import { NextRequest, NextResponse } from 'next/server';
import { createRequestClient, getCurrentUserId } from '@/lib/supabase/requestClient';
import { notifyDiscordError } from '@/lib/discord';
import type { TraceComment } from '@/lib/types';

const MAX_COMMENT_LENGTH = 500;

export async function GET(req: NextRequest) {
  const traceId = req.nextUrl.searchParams.get('trace_id');
  if (!traceId) {
    return NextResponse.json({ ok: false, comments: [], error: 'trace_id は必須です' }, { status: 400 });
  }

  const supabase = createRequestClient();
  const { data, error } = await supabase
    .from('trace_comments')
    .select('id, created_at, trace_id, user_id, body')
    .eq('trace_id', traceId)
    .eq('is_deleted', false)
    .order('created_at', { ascending: true });

  if (error) {
    notifyDiscordError('GET /api/comments', error);
    return NextResponse.json({ ok: false, comments: [], error: error.message }, { status: 500 });
  }

  const rows = data ?? [];
  const userIds = Array.from(new Set(rows.map((r) => r.user_id)));
  const profilesById = new Map<string, { username: string; display_name: string | null; avatar_url: string | null }>();
  if (userIds.length > 0) {
    const { data: profiles } = await supabase
      .from('profiles').select('id, username, display_name, avatar_url').in('id', userIds);
    for (const p of profiles ?? []) profilesById.set(p.id, p);
  }

  const comments: TraceComment[] = rows.map((r) => {
    const profile = profilesById.get(r.user_id);
    return {
      id: r.id,
      created_at: r.created_at,
      trace_id: r.trace_id,
      user_id: r.user_id,
      body: r.body,
      username: profile?.username ?? null,
      display_name: profile?.display_name ?? null,
      avatar_url: profile?.avatar_url ?? null,
    };
  });

  return NextResponse.json({ ok: true, comments });
}

export async function POST(req: NextRequest) {
  const myId = await getCurrentUserId();
  if (!myId) return NextResponse.json({ ok: false, error: 'ログインが必要です' }, { status: 401 });

  const body = await req.json().catch(() => ({})) as { trace_id?: string; body?: string };
  if (!body.trace_id) return NextResponse.json({ ok: false, error: 'trace_id は必須です' }, { status: 400 });
  const text = body.body?.trim();
  if (!text) return NextResponse.json({ ok: false, error: 'コメントを入力してください' }, { status: 400 });
  if (text.length > MAX_COMMENT_LENGTH) {
    return NextResponse.json({ ok: false, error: `コメントは${MAX_COMMENT_LENGTH}文字以内にしてください` }, { status: 400 });
  }

  const supabase = createRequestClient();
  const { data, error } = await supabase
    .from('trace_comments')
    .insert({ trace_id: body.trace_id, user_id: myId, body: text })
    .select('id, created_at, trace_id, user_id, body')
    .single();

  if (error) {
    notifyDiscordError('POST /api/comments', error);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  const { data: profile } = await supabase
    .from('profiles').select('username, display_name, avatar_url').eq('id', myId).maybeSingle();

  const comment: TraceComment = {
    ...data,
    username: profile?.username ?? null,
    display_name: profile?.display_name ?? null,
    avatar_url: profile?.avatar_url ?? null,
  };

  return NextResponse.json({ ok: true, comment }, { status: 201 });
}
