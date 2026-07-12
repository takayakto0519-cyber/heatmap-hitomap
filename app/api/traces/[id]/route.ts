import { NextRequest, NextResponse } from 'next/server';
import type { Trace } from '@/lib/types';
import { getCurrentUserId } from '@/lib/supabase/requestClient';
import { notifyDiscordError } from '@/lib/discord';

const SUPABASE_READY = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL);

async function getServerClient() {
  const { supabaseServer } = await import('@/lib/supabase/server');
  return supabaseServer;
}

// 所有者確認：アカウント投稿は user_id 一致を最優先（ニックネーム未設定でも安全）。
// 匿名投稿（user_id なし）は従来どおりニックネーム照合にフォールバックする。
async function checkOwnership(
  trace: { user_id: string | null; nickname: string | null },
  suppliedNickname: string | undefined
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (trace.user_id) {
    const myId = await getCurrentUserId();
    if (myId !== trace.user_id) {
      return { ok: false, error: 'この投稿を編集・削除する権限がありません' };
    }
    return { ok: true };
  }
  if (trace.nickname) {
    if (!suppliedNickname || suppliedNickname.trim() !== trace.nickname.trim()) {
      return { ok: false, error: 'ニックネームが一致しません' };
    }
  }
  return { ok: true };
}

// GET /api/traces/[id] — 単一トレース取得（恒久リンク・近隣取得用）。可視性ルールは一覧APIと揃える。
export async function GET(
  req: NextRequest,
  context: { params: { id: string } }
) {
  if (!SUPABASE_READY) {
    return NextResponse.json({ ok: false, error: 'Supabase未設定' }, { status: 503 });
  }
  const { id } = context.params;
  const supabase = await getServerClient();
  const { data: trace, error } = await supabase.from('traces').select('*').eq('id', id).single();
  if (error || !trace || trace.is_deleted) {
    return NextResponse.json({ ok: false, error: '見つかりません' }, { status: 404 });
  }

  if (trace.visibility && trace.visibility !== 'public') {
    const myId = await getCurrentUserId();
    const isOwner = myId && myId === trace.user_id;
    let isFollower = false;
    if (!isOwner && myId && trace.visibility === 'followers') {
      const { data: followRow } = await supabase
        .from('follows').select('follower_id')
        .eq('follower_id', myId).eq('followee_id', trace.user_id).maybeSingle();
      isFollower = Boolean(followRow);
    }
    if (!isOwner && !isFollower) {
      return NextResponse.json({ ok: false, error: '見つかりません' }, { status: 404 });
    }
  }

  return NextResponse.json({ ok: true, trace: trace as Trace });
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
        .from('traces').select('nickname, user_id').eq('id', id).single();
      if (!trace) return NextResponse.json({ ok: false, error: '投稿が見つかりません' }, { status: 404 });
      const owned = await checkOwnership(trace, body.nickname);
      if (!owned.ok) return NextResponse.json({ ok: false, error: owned.error }, { status: 403 });

      const { data, error } = await supabase
        .from('traces')
        .update({ is_deleted: false, deleted_at: null, deleted_by: null })
        .eq('id', id).select().single();
      if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true, trace: data as Trace });
    }

    // アカウント投稿の編集は本人のみ（未ログイン・匿名投稿は従来どおり誰でも可）
    const { data: existing } = await supabase
      .from('traces').select('*').eq('id', id).single();
    if (existing?.user_id) {
      const myId = await getCurrentUserId();
      if (myId !== existing.user_id) {
        return NextResponse.json({ ok: false, error: 'この投稿を編集する権限がありません' }, { status: 403 });
      }
    }

    // 版管理：「痕跡は上書きしない」思想の実装。編集前の状態をスナップショットとして残す（失敗しても編集自体は継続）
    if (existing) {
      try {
        await supabase.from('trace_versions').insert({ trace_id: id, snapshot: existing });
      } catch { /* trace_versions未作成の環境でも編集自体は継続させる */ }
    }

    const allowed = [
      'title', 'why', 'interpretation', 'self_reflection', 'want_revisit', 'want_to_share',
      'archive_type', 'yomi', 'alt_names', 'era_label', 'source_ref', 'voice_relation', 'audio_url',
      'audio_transcript', 'visibility', 'emotion_key', 'intensity', 'category', 'photo_url', 'photo_urls',
      'video_url',
    ];
    const updates: Record<string, unknown> = {};
    for (const key of allowed) {
      if (key in body) updates[key] = body[key] ?? null;
    }
    // emotion_keys は未マイグレーション環境（列未追加）でも既存の編集が壊れないよう、指定時のみ送る。
    // 空配列(=全解除)も有効な更新として扱う（旧実装は空配列がfalsyになり無視されるバグがあった）
    if ('emotion_keys' in body) {
      updates.emotion_keys = (body.emotion_keys && body.emotion_keys.length > 0) ? body.emotion_keys : null;
    }
    const { data, error } = await supabase
      .from('traces').update(updates).eq('id', id).select().single();
    if (error) {
      notifyDiscordError('PATCH /api/traces/[id]', error);
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true, trace: data as Trace });
  } catch (e) {
    notifyDiscordError('PATCH /api/traces/[id]', e);
    return NextResponse.json({ ok: false, error: String(e) }, { status: 400 });
  }
}

// DELETE /api/traces/[id] — ソフトデリート（アカウント投稿は本人のセッション、匿名投稿はニックネーム照合。復元可能）
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

    const { data: trace } = await supabase
      .from('traces').select('nickname, user_id').eq('id', id).single();
    if (!trace) return NextResponse.json({ ok: false, error: '投稿が見つかりません' }, { status: 404 });

    const owned = await checkOwnership(trace, body.nickname);
    if (!owned.ok) return NextResponse.json({ ok: false, error: owned.error }, { status: 403 });

    const deletedBy = trace.user_id ? 'author' : (body.nickname ?? 'anonymous');
    const { error } = await supabase
      .from('traces')
      .update({ is_deleted: true, deleted_at: new Date().toISOString(), deleted_by: deletedBy })
      .eq('id', id);
    if (error) {
      notifyDiscordError('DELETE /api/traces/[id]', error);
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    notifyDiscordError('DELETE /api/traces/[id]', e);
    return NextResponse.json({ ok: false, error: String(e) }, { status: 400 });
  }
}

