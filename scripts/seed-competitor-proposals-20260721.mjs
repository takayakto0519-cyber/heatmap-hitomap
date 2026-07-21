// ディープリサーチ（deep-researchワークフロー）で調べた競合・市場調査の結果を
// strategy_proposalsテーブル（category='competitor_insight'）に登録するワンショットスクリプト。
// 各出典URLは調査エージェントがWebFetchで直接確認した一次/二次情報源。
// 使い方: node scripts/seed-competitor-proposals-20260721.mjs
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

const CATEGORY = 'competitor_insight';
const SOURCE_SKILL = 'competitor-market-research';

const ITEMS = [
  {
    title: 'デジタル庁 地域幸福度(Well-Being)指標',
    body: '主観指標（住民アンケート）と客観指標（オープンデータ）を組み合わせた24カテゴリー構成の全国標準フォーマット。導入自治体は2022年24団体→2025年6月183団体まで拡大。加古川市は令和4年度から先駆導入し、市民アンケート（令和7年度は1,635人回答・回答率36.3%）で9割以上が5点以上と回答、平均点は4年間全国平均を上回る。職員向けOASIS研修も令和7年度15部課が受講。ヒトマップの佐野市実証データとの比較優位性を検討する材料になる。\n出典: https://digital-agency-news.digital.go.jp/articles/2025-02-04 / https://www.city.kakogawa.lg.jp/soshikikarasagasu/kikakubu/kikakubukohoka/kakogawashinoseisakuzaisei/42841.html',
  },
  {
    title: 'TIS「地域幸福度可視化アプリ」',
    body: '住民がスマホで「ホッとする場所」「自慢の場所」等の感情を記録し地図・グラフで可視化するサービス。2024年9月にスマートシティ・インスティテュートとWBPD OASISプログラム実施の覚書を締結し自治体展開を推進。実証実験募集期間は2024年12月〜2026年9月末（予定）のオープンベータ版で、正式な自治体導入実績はまだ明記されていない。ヒトマップの「痕跡データ」コンセプトと最も重なる直接競合であり、佐野市実証との差別化ポイントの言語化が急務。\n出典: https://www.tisi.jp/service_solution/wellbeing-map/ / https://www.tis.co.jp/news/2024/tis_news/20241114_1.html',
  },
  {
    title: '総務省「ふるさと住民登録制度」',
    body: '関係人口を可視化し地域活性化の担い手として位置づける制度で、令和8年度（2026年度）本格開始予定。2026年1〜2月にモデル事業実施自治体を募集し、7道県・21市町村（計28モデル事業）が選定された。専用アプリを活用した実証を経てアプリの機能改善を進める計画。長野県飯綱町・北海道上川町・山梨県甲州市は楽天グループ主導コンソーシアムで2026年4〜7月に先行実証を開始しており、自治体経由でヒトマップが関与できる余地があるか要調査。\n出典: https://www.travelvoice.jp/20260122-159120 / https://prtimes.jp/main/html/rd/p/000000264.000076519.html',
  },
  {
    title: '観光DX SaaS「Nutmeg」',
    body: '現地体験事業者（観光施設・ツアー/アクティビティ）向けにオフライン予約デジタル化・在庫/予約管理・現場業務効率化を一気通貫で支援するオールインワンSaaS。2023年5月シリーズA約4億円（累計約5.5億円）、2025年2月プレシリーズB5億円を調達。導入社数は約600社まで倍増し、顧客層がテーマパーク・リゾートホテル・交通インフラ関連事業者へ拡大中。ヒトマップの自治体・法人向けキット外販がB2G以外へ横展開する際の参考事例になる。\n出典: https://kepple.co.jp/articles/wml7vdwm-t / https://www.travelvoice.jp/20230525-153492',
  },
  {
    title: '観光庁「観光DX推進事業」公募',
    body: '令和8年度「全国の観光地・観光産業における観光DX推進事業」の公募（令和8年4月24日〜5月29日）。地域コンテンツの販路拡大・レベニューマネジメント等に資するデジタルツールの導入支援、およびDX活用に向けた専門人材による伴走支援を提供する。ヒトマップの「導入支援＋伴走支援」型ビジネスモデルと構造的に類似する国の補助スキームであり、自治体・観光事業者への提案時の並走メニュー・補助金活用先として参照価値が高い。\n出典: https://www.mlit.go.jp/kankocho/kobo06_00047.html',
  },
  {
    title: 'zenschool（AI導入コンサル競合）',
    body: '運営：株式会社enmono（代表・三木康司、神奈川県鎌倉市）。中小企業向けに生成AIツール（ChatGPT・Claude・Gemini・NotebookLM等）の実務活用から経営資料作成・社内AIルール策定まで、月次対話ベースの経営伴走コンサルティングを提供。ヒトマップのAI導入顧問業と直接競合しうる月額伴走型モデルの具体的な事例で、料金体系・提供範囲の比較調査が次の一手。\n出典: https://www.zenschool.jp/ai-consulting',
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
