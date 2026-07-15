// POST /api/admin/blocks/seed-home { page? } — 指定ページ（既定 home）の初期セクションをsite_blocksとして投入する
// （既にそのページにブロックがあれば何もしない）
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { checkAdmin } from '@/lib/adminAuth';

const SUPABASE_READY = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL);

type SeedBlock = {
  block_type: string;
  eyebrow?: string;
  heading?: string;
  body?: string;
  cta_label?: string;
  cta_href?: string;
  items?: unknown[];
};

const SEEDS: Record<string, SeedBlock[]> = {
  home: [
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
  ],

  business: [
    {
      block_type: 'text',
      heading: '解読型の採用・組織ブランディング',
      body: '「面白い人に会いに行く」対話型のインターンではなく、その人が使い込んだモノ・現場の痕跡を先に読み解いてから本人と向き合う「解読型」の設計を採ります。表層的な共感ではなく、「この痕跡が自分の中の何かと共鳴した」という、本人にも説明しきれない必然の接続をつくることを目的にしています。',
    },
    {
      block_type: 'cards',
      heading: 'ヒトマップ型採用インターンシップ',
      body: '社員一人ひとりの痕跡を取材・記録し、社員トレーディングカードやショート動画などの成果物に落とし込みながら、学生と社員の関係を一度きりのイベントで終わらせず、その後も続く「縁」として設計します。',
      items: [
        { title: 'Phase 1', body: 'ホスト選定・心理的安全性の醸成' },
        { title: 'Phase 2', body: 'エディター育成ワークショップ' },
        { title: 'Phase 3', body: '密着取材・編集作業' },
        { title: 'Phase 4', body: '成果発表・経営陣へのプレゼン' },
      ],
    },
    {
      block_type: 'text',
      heading: '成果物の例',
      body: '社員トレーディングカード\n共創型ショート動画（30〜60秒・縦型）\n取材を通じて生まれる、社員と学生の持続的な関係',
    },
    {
      block_type: 'text',
      heading: '行政・地域の方へ',
      body: 'まちあるき記録アプリで集まった痕跡・感情データを、地域振興や観光施策の検討材料としてご活用いただける形でのご提供も行っています。まずは個別にご相談ください。',
    },
    {
      block_type: 'cta',
      heading: 'お話を聞かせてください。',
      body: '痕跡から組織の生き様を伝える、解読型の採用・組織ブランディング支援のご相談はこちらから。',
      cta_label: 'お問い合わせ',
      cta_href: '/contact',
    },
  ],

  school: [
    {
      block_type: 'cards',
      eyebrow: 'ご利用の流れ',
      items: [
        { title: 'クラス専用のコードを発行', body: '運営が「実験回コード」をクラスごとに発行します。生徒はこのコードを使って記録すると、クラスの記録だけをまとめて振り返れます。' },
        { title: '町を歩いて痕跡を記録', body: '生徒はスマートフォンやタブレットで、気になったモノ・場所を写真と一言で記録します。文章が苦手な子でも、写真とタップだけで参加できます。' },
        { title: 'クラスの地図として振り返る', body: '記録が集まると、クラスだけの地域理解レポートができあがります。どこにみんなの関心が集まったかが一目で分かり、発表や作文のもとになります。' },
      ],
    },
    {
      block_type: 'text',
      heading: '費用について',
      body: '学校・教育機関でのご利用は、個別にご相談のうえ決めさせていただいています。まずはお気軽にお問い合わせください。',
    },
    {
      block_type: 'cta',
      heading: 'まずはご相談ください。',
      body: 'クラス専用コードの発行後、生徒はアプリの記録画面で「実験回コード」欄に入力するだけで使えます。',
      cta_label: '学校での利用を問い合わせる',
      cta_href: '/contact',
    },
  ],

  service: [
    {
      block_type: 'cta',
      heading: 'さっそく歩いてみませんか。',
      body: 'ログインしなくても、匿名のまま記録を始められます。',
      cta_label: '地図をひらく',
      cta_href: '/start',
    },
  ],

  team: [],
};

export async function POST(req: NextRequest) {
  if (!SUPABASE_READY) return NextResponse.json({ ok: false, error: 'Supabase未設定' }, { status: 503 });
  if (!checkAdmin(req)) return NextResponse.json({ ok: false, error: 'パスワードが違います' }, { status: 401 });

  const body = await req.json().catch(() => ({})) as { page?: string };
  const page = body.page ?? 'home';
  const seed = SEEDS[page];
  if (!seed) return NextResponse.json({ ok: false, error: `ページ "${page}" の初期セクションは用意されていません` }, { status: 400 });
  if (seed.length === 0) return NextResponse.json({ ok: false, error: 'このページには初期セクションがありません。「＋ セクションを追加」から作成してください' }, { status: 400 });

  const { supabaseServer } = await import('@/lib/supabase/server');
  const { count } = await supabaseServer
    .from('site_blocks')
    .select('id', { count: 'exact', head: true })
    .eq('page', page);
  if ((count ?? 0) > 0) {
    return NextResponse.json({ ok: false, error: 'すでにブロックが存在します（重複投入を防止のため中止しました）' }, { status: 400 });
  }

  // 一括insertでは行ごとにキーが揃っていないと欠けた列がNULL扱いになる（DEFAULTが効かない）ため、
  // 全行に同じキー集合を明示的に持たせる
  const rows = seed.map((s, i) => ({
    page, sort_order: i, is_visible: true,
    eyebrow: null, heading: null, body: null, image_url: null, cta_label: null, cta_href: null, items: [],
    ...s,
  }));
  const { error } = await supabaseServer.from('site_blocks').insert(rows);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, inserted: rows.length });
}
