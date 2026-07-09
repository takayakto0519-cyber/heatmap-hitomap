// GET /api/quests/active — 現在のお題を返す（運営が手動でis_active=trueにしたものを最優先。
// 未設定なら週番号ローテーションの静的お題にフォールバックする）
import { NextResponse } from 'next/server';
import { getCurrentQuest } from '@/lib/quests';

// 運営が切り替えたアクティブなお題を毎回反映するため、静的最適化を無効化する
export const dynamic = 'force-dynamic';

const SUPABASE_READY = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL);

export async function GET() {
  if (SUPABASE_READY) {
    try {
      const { supabaseServer } = await import('@/lib/supabase/server');
      const { data } = await supabaseServer
        .from('quests').select('*').eq('is_active', true)
        .order('created_at', { ascending: false }).limit(1).maybeSingle();
      if (data) {
        return NextResponse.json({ ok: true, quest: data, source: 'admin' });
      }
    } catch {
      // クエストテーブル未作成などの場合はフォールバックへ
    }
  }
  const fallback = getCurrentQuest();
  return NextResponse.json({
    ok: true,
    quest: {
      id: null, emoji: fallback.emoji, title: fallback.title, hint: fallback.hint,
      quest_type: 'search', target_emotion_key: null,
    },
    source: 'rotation',
  });
}
