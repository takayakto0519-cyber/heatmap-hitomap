// PATCH /api/bonno/[id] — 運営コンソールからの操作（パスワード必須）
//   action: 'hide'（壁から下げる） | 'show'（戻す） | 'spotlight'（中央特大表示） | 'unspotlight'（解除）
import { NextRequest, NextResponse } from 'next/server';
import { checkAdmin } from '@/lib/adminAuth';

const SUPABASE_READY = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL);

const ACTION_UPDATES: Record<string, Record<string, unknown>> = {
  hide: { status: 'hidden', featured_at: null },
  show: { status: 'visible' },
  spotlight: { featured_at: new Date().toISOString() },
  unspotlight: { featured_at: null },
};

export async function PATCH(req: NextRequest, context: { params: { id: string } }) {
  if (!SUPABASE_READY) return NextResponse.json({ ok: false, error: 'Supabase未設定' }, { status: 503 });
  if (!checkAdmin(req)) return NextResponse.json({ ok: false, error: 'パスワードが違います' }, { status: 401 });

  const { id } = context.params;
  const body = await req.json().catch(() => ({})) as { action?: string };
  const action = body.action ?? '';
  if (!(action in ACTION_UPDATES)) {
    return NextResponse.json(
      { ok: false, error: 'action は hide / show / spotlight / unspotlight のいずれかです' },
      { status: 400 }
    );
  }

  // spotlight は「今この瞬間」を指すため、実行時刻を毎回取り直す
  const updates = action === 'spotlight'
    ? { featured_at: new Date().toISOString() }
    : ACTION_UPDATES[action];

  const { supabaseServer } = await import('@/lib/supabase/server');
  const { data, error } = await supabaseServer
    .from('bonno_submissions')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ ok: false, error: '投稿が見つかりません' }, { status: 404 });
  return NextResponse.json({ ok: true, submission: data });
}
