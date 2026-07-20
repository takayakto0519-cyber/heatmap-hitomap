// GET /api/admin/stats/by-region — 自治体（region）別の好悪内訳（パスワード必須）
// ホームの「自治体向けサマリー」が全国集計しか出せず紛らわしいという指摘を受けて追加。
// region列を持つ公開投稿だけをregionごとにグルーピングして返す。
import { NextRequest, NextResponse } from 'next/server';
import { checkAdmin } from '@/lib/adminAuth';
import { summarizeValence } from '@/lib/emotions';

const SUPABASE_READY = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL);

export async function GET(req: NextRequest) {
  if (!SUPABASE_READY) return NextResponse.json({ ok: false, error: 'Supabase未設定' }, { status: 503 });
  if (!checkAdmin(req)) return NextResponse.json({ ok: false, error: 'パスワードが違います' }, { status: 401 });

  const { supabaseServer } = await import('@/lib/supabase/server');
  const { data, error } = await supabaseServer
    .from('traces')
    .select('region, emotion_key')
    .eq('is_deleted', false)
    .eq('visibility', 'public')
    .not('region', 'is', null);

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  const byRegion = new Map<string, (string | null)[]>();
  for (const row of (data ?? []) as { region: string | null; emotion_key: string | null }[]) {
    if (!row.region) continue;
    const list = byRegion.get(row.region) ?? [];
    list.push(row.emotion_key);
    byRegion.set(row.region, list);
  }

  const regions = Array.from(byRegion.entries())
    .map(([region, emotionKeys]) => ({ region, valence: summarizeValence(emotionKeys) }))
    .filter(r => r.valence.total > 0)
    .sort((a, b) => b.valence.total - a.valence.total);

  return NextResponse.json({ ok: true, regions });
}
