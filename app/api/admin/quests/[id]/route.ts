import { NextRequest, NextResponse } from 'next/server';

const SUPABASE_READY = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL);

function checkAdmin(req: NextRequest): boolean {
  const provided = req.headers.get('x-admin-password');
  const expected = process.env.ADMIN_PASSWORD;
  return Boolean(expected) && provided === expected;
}

interface UpdateQuestBody {
  emoji?: string;
  title?: string;
  hint?: string;
  quest_type?: 'search' | 'emotion';
  target_emotion_key?: string | null;
  is_active?: boolean;
}

// PATCH /api/admin/quests/[id] — 編集・アクティブ切り替え（合言葉必須）
export async function PATCH(req: NextRequest, context: { params: { id: string } }) {
  if (!SUPABASE_READY) {
    return NextResponse.json({ ok: false, error: 'Supabase未設定' }, { status: 503 });
  }
  if (!checkAdmin(req)) {
    return NextResponse.json({ ok: false, error: '合言葉が違います' }, { status: 401 });
  }
  const { id } = context.params;
  const body = await req.json().catch(() => ({})) as UpdateQuestBody;

  const { supabaseServer } = await import('@/lib/supabase/server');

  // このクエストをアクティブにする場合、他の全クエストのis_activeを先に解除する（同時に1件だけ有効）
  if (body.is_active === true) {
    await supabaseServer.from('quests').update({ is_active: false }).neq('id', id).eq('is_active', true);
  }

  const updates: Record<string, unknown> = {};
  if ('emoji' in body) updates.emoji = body.emoji;
  if ('title' in body) updates.title = body.title;
  if ('hint' in body) updates.hint = body.hint;
  if ('quest_type' in body) updates.quest_type = body.quest_type;
  if ('target_emotion_key' in body) updates.target_emotion_key = body.target_emotion_key ?? null;
  if ('is_active' in body) updates.is_active = body.is_active;

  const { data, error } = await supabaseServer.from('quests').update(updates).eq('id', id).select().single();
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, quest: data });
}

// DELETE /api/admin/quests/[id]（合言葉必須）
export async function DELETE(req: NextRequest, context: { params: { id: string } }) {
  if (!SUPABASE_READY) {
    return NextResponse.json({ ok: false, error: 'Supabase未設定' }, { status: 503 });
  }
  if (!checkAdmin(req)) {
    return NextResponse.json({ ok: false, error: '合言葉が違います' }, { status: 401 });
  }
  const { id } = context.params;
  const { supabaseServer } = await import('@/lib/supabase/server');
  const { error } = await supabaseServer.from('quests').delete().eq('id', id);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
