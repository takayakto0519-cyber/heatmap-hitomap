import { NextRequest, NextResponse } from 'next/server';
import { checkAdmin } from '@/lib/adminAuth';

const SUPABASE_READY = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL);

// GET /api/admin/quests — クエスト一覧（合言葉必須）
export async function GET(req: NextRequest) {
  if (!SUPABASE_READY) {
    return NextResponse.json({ ok: false, error: 'Supabase未設定' }, { status: 503 });
  }
  if (!checkAdmin(req)) {
    return NextResponse.json({ ok: false, error: '合言葉が違います' }, { status: 401 });
  }
  const { supabaseServer } = await import('@/lib/supabase/server');
  const { data, error } = await supabaseServer.from('quests').select('*').order('created_at', { ascending: false });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, quests: data ?? [] });
}

interface CreateQuestBody {
  emoji: string;
  title: string;
  hint: string;
  quest_type?: 'search' | 'emotion';
  target_emotion_key?: string | null;
  is_active?: boolean;
}

// POST /api/admin/quests — クエストを新規作成（合言葉必須）
export async function POST(req: NextRequest) {
  if (!SUPABASE_READY) {
    return NextResponse.json({ ok: false, error: 'Supabase未設定' }, { status: 503 });
  }
  if (!checkAdmin(req)) {
    return NextResponse.json({ ok: false, error: '合言葉が違います' }, { status: 401 });
  }
  const body = await req.json().catch(() => ({})) as CreateQuestBody;
  if (!body.emoji?.trim() || !body.title?.trim() || !body.hint?.trim()) {
    return NextResponse.json({ ok: false, error: '絵文字・タイトル・ヒントは必須です' }, { status: 400 });
  }

  const { supabaseServer } = await import('@/lib/supabase/server');

  // 新規作成時に「今すぐ表示」を選んだ場合、既存のアクティブなクエストを先に解除する
  if (body.is_active) {
    await supabaseServer.from('quests').update({ is_active: false }).eq('is_active', true);
  }

  const { data, error } = await supabaseServer
    .from('quests')
    .insert({
      emoji: body.emoji.trim(),
      title: body.title.trim(),
      hint: body.hint.trim(),
      quest_type: body.quest_type === 'emotion' ? 'emotion' : 'search',
      target_emotion_key: body.quest_type === 'emotion' ? (body.target_emotion_key ?? null) : null,
      is_active: body.is_active ?? false,
    })
    .select().single();
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, quest: data }, { status: 201 });
}
