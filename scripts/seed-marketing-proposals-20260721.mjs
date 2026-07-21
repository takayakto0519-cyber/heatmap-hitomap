// ディープリサーチ（deep-researchワークフロー）で調べたマーケティング事例・トレンドをもとに、
// ヒトマップ向けに具体化した施策案をstrategy_proposalsテーブル（category='marketing'）に登録するスクリプト。
// 各施策は検証済みfinding（confidence: high/medium、アダプティブ査読で裏付け済み）を根拠にしている。
// 使い方: node scripts/seed-marketing-proposals-20260721.mjs
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

function loadEnvLocal() {
  const text = readFileSync(new URL('../.env.local', import.meta.url), 'utf-8');
  for (const line of text.split('\n')) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
  }
}
loadEnvLocal();

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const CATEGORY = 'marketing';
const SOURCE_SKILL = 'deep-research';

const ITEMS = [
  {
    title: '痕跡データ版「ヒダスケ！」参加型キャンペーン',
    body: '飛騨市の関係人口創出プログラム「ヒダスケ！」は1.6万人超が参加する成功事例。痕跡データの収集イベントをポイント制・参加型キャンペーン化し、自治体向け提案時に「実際にこれだけの人が動いた」という定量的な実証事例として使えるようにする。まずは佐野市など実証済みエリアで小規模に試す。\n出典: https://www.publicweek.jp/ja-jp/blog/article_101.html （飛騨市ファンクラブ1.6万人超）',
  },
  {
    title: '採用PR動画×定量成果の提案テンプレ化',
    body: '長浜市の採用PR動画事例では受験者数が75人→132人（約1.8倍）に増加した実績がある。学校・自治体向けの提案書・営業資料に「動画施策→定量成果」の型としてこの事例を引用し、recruit-video-outlineスキルで作る動画構成案とセットで「効果が見える提案」として標準化する。\n出典: https://online-soudan.jeki.co.jp/information/blog/jreads/connected-mind/',
  },
  {
    title: 'YOBOZE！型 地域副業マッチング連携メニュー',
    body: '佐久市の「YOBOZE！」は副業人材と地域をマッチングする施策。痕跡データ収集タスクを副業ワーカー向けに開放し、関係人口創出とデータ収集を同時に進める新メニューとして自治体提案に組み込む案。既存の営業・自治体タブでのB2G提案の幅を広げられる。\n出典: https://online-soudan.jeki.co.jp/information/blog/jreads/connected-mind/',
  },
  {
    title: '関係人口市場規模を提案書の定番冒頭指標に',
    body: '全国18歳以上の約2割弱（約1827万人）が関係人口に該当し、自治体の約7割が創出・拡大に取り組み中という国交省の公式統計がある。自治体向け提案書・LP（gov-proposal-customスキルの出力）の冒頭に定型で引用し、B2G営業の説得材料として標準化する。\n出典: https://online-soudan.jeki.co.jp/information/blog/jreads/connected-mind/',
  },
  {
    title: '探究学習プラットフォームとの提携先候補調査',
    body: '博報堂×朝日新聞の「探究インターン」（複数高校オンライン同時参加型）やTimeTact（利用学生60万人超の教育CSRサービス）など、学校探究学習領域には既に大規模プラットフォームが存在する。単独で学校を1校ずつ開拓するより、これらのプラットフォームとの提携・掲載を検討したほうが営業効率が良い可能性がある。次の一手として提携可能性の個別調査が必要。\n出典: https://www.hakuhodo.co.jp/news/info/112357/ / https://www.studyvalley.jp/sponsors/',
  },
  {
    title: '「痕跡物語」人物スポットライト型オウンドメディア',
    body: '地域全体への親近感醸成に、単一人物ではなく多様な人物を取り上げる物語形式が有効という事例（鞆物語）がある（確信度：中）。実績ブログ（achievement-blogスキル）で紹介する参加者の声を、単なる箇条書きの感想ではなく「◯◯さんの痕跡物語」のような人物中心の物語形式にリライトする案。\n出典: https://markenote.jp/article/1487',
  },
  {
    title: 'AEO/GEO対応：AI検索に拾われるLP・提案書構造',
    body: '2026年時点でB2Bマーケティングは検索非依存チャネルへの転換とAEO（Answer Engine Optimization）/GEO（Generative Engine Optimization）が新ルールとして定着しつつある。ヒトマップのLP・提案書・実績ブログをFAQ形式・構造化データで整備し、ChatGPTやAI Overview経由での発見可能性を高める。低コストで着手できる割に効果が見込める施策。\n出典: https://tovira.jp/contents/b2b-marketing-trend-2026',
  },
  {
    title: '商談前タッチポイント強化（無料診断・事例記事の拡充）',
    body: 'Forrester調査によれば、B2B購買者の41%が営業接触前に特定ベンダーを念頭に置き、92%がショートリストを保有している。つまり商談が始まった時点で既に大部分の意思決定が固まっている。free-diagnosis-content・case-study-pageスキルで作る無料診断コンテンツ・事例記事を強化し、営業接触前の情報発信量を増やすことが受注率に直結する可能性が高い。\n出典: https://tovira.jp/contents/b2b-marketing-trend-2026 （Forrester 2024 Buyers\' Journey Survey）',
  },
];

async function main() {
  for (const item of ITEMS) {
    const { error } = await supabase.from('strategy_proposals').insert({
      category: CATEGORY, source_skill: SOURCE_SKILL, title: item.title, body: item.body, status: 'unread',
    });
    if (error) console.error(`✗ ${item.title}: ${error.message}`);
    else console.log(`✓ ${item.title}`);
  }
}

main();
