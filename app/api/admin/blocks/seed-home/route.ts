// POST /api/admin/blocks/seed-home — トップページの初期セクションをsite_blocksとして投入する（既にブロックがあれば何もしない）
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { checkAdmin } from '@/lib/adminAuth';

const SUPABASE_READY = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL);

const SEED = [
  {
    block_type: 'cards',
    eyebrow: 'ヒトマップでできること',
    items: [
      { title: '痕跡を記録する', body: '修理された椅子、色あせた看板。まちで気になったモノを、写真と一言で地図に残す。文章が苦手でも、撮ってタップするだけ。', href: '/start' },
      { title: '感情を一緒に残す', body: 'ときめき、なつかしさ、切なさ——。10種類の感情から選んで、「なぜ心が動いたのか」まで痕跡に刻む。', href: '/start' },
      { title: '感情の地図が育つ', body: '記録が積み重なると、町ごとの感情の濃淡がヒートマップとして浮かび上がる。あなたの記録が、町の見え方を変えていく。', href: '/start' },
    ],
  },
  {
    block_type: 'cards',
    eyebrow: '体験の流れ',
    items: [
      { title: '壱　痕跡を記録する', body: 'まちで見つけたモノ・場所と、そこで動いた感情を残す。' },
      { title: '弐　感情がヒートマップになる', body: '記録が積み重なり、まちごとの感情の地図が育つ。' },
      { title: '参　似た感情の人とつながる', body: '同じものに心を動かされた人をフォローし、メッセージを送れる。' },
      { title: '四　実際に会いに行く', body: '誰かが歩いた足跡を、自分の足で辿れる。' },
    ],
  },
  {
    block_type: 'cards',
    eyebrow: 'MISSION / VISION / VALUE',
    items: [
      { title: 'MISSION', body: '人の生き方を通して、地域を伝える。' },
      { title: 'VISION', body: 'まちに残る痕跡と感情から、人と人をつなぐ。' },
      { title: 'VALUE', body: '人を消費せず、関係を育てる。' },
    ],
  },
  {
    block_type: 'cards',
    eyebrow: '事業の三本柱',
    items: [
      { title: 'ヒトマップ（Webサービス）', body: 'まちの痕跡と感情を記録する、稼働中の主軸サービス。', href: '/service', badge: '稼働中' },
      { title: '法人・行政の方へ', body: '痕跡から組織の生き様を伝える、解読型の採用・組織ブランディング支援。', href: '/business', badge: '稼働中' },
      { title: '学校の方へ', body: 'クラス単位の実験回コードで、地域理解教育に使う。', href: '/school', badge: '稼働中' },
    ],
  },
  {
    block_type: 'cta',
    heading: 'まず、ひとつの町から。',
    body: '痕跡は、町の縮尺でこそ生きた証になる。登録なしで、今日から歩けます。',
    cta_label: '地図をひらく — 無料',
    cta_href: '/start',
  },
];

export async function POST(req: NextRequest) {
  if (!SUPABASE_READY) return NextResponse.json({ ok: false, error: 'Supabase未設定' }, { status: 503 });
  if (!checkAdmin(req)) return NextResponse.json({ ok: false, error: 'パスワードが違います' }, { status: 401 });

  const { supabaseServer } = await import('@/lib/supabase/server');
  const { count } = await supabaseServer
    .from('site_blocks')
    .select('id', { count: 'exact', head: true })
    .eq('page', 'home');
  if ((count ?? 0) > 0) {
    return NextResponse.json({ ok: false, error: 'すでにブロックが存在します（重複投入を防止のため中止しました）' }, { status: 400 });
  }

  const rows = SEED.map((s, i) => ({ page: 'home', sort_order: i, is_visible: true, ...s }));
  const { error } = await supabaseServer.from('site_blocks').insert(rows);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, inserted: rows.length });
}
