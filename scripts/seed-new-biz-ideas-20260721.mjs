// 会長の依頼「新規事業案はあなたが思いついたものでもいいからあげておいて」に応じて、
// Claude Codeが考案した新規事業案8件をbiz_model_ideasテーブルに登録するワンショットスクリプト。
// 使い方: node scripts/seed-new-biz-ideas-20260721.mjs
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

const IDEAS = [
  {
    title: '地域愛着スコアAPI（卒論研究のSaaS化）',
    memo: '会長の卒論（人間観光と地域愛着、2028年1月提出予定）で構築する愛着計測ロジック（lib/attachment.ts）を、外部の不動産・移住定住支援会社向けにAPI化して外販する。「この地域は住民の愛着度が高い＝住みやすい」を数値で示せるのは他社にない強み。学術的裏付け（卒論・査読）があることが差別化になる。まずは佐野市実証データで試作版を作り、移住定住支援を行う自治体系法人にβ提供する。',
    status: 'idea',
  },
  {
    title: '痕跡データの匿名統計販売（BtoBデータ事業）',
    memo: '蓄積した痕跡データ（投稿・感情タグ・位置情報）を個人特定不可能な形に匿名集計し、都市計画コンサル・不動産デベロッパー・自治体総合計画の策定支援会社に「エリア別の人の動き・感情の傾向データ」として販売する。既存の顧問業・自治体提案の副産物をそのままデータ商品化できるため追加取材コストがほぼゼロ。個人情報保護の設計（pii-auditスキルの活用）が前提条件。',
    status: 'idea',
  },
  {
    title: 'AI社長キット（社内AIエージェント運用の外販）',
    memo: 'ヒトマップ社内で運用している「AI社長（roster.ts・番人・スキル体制）」の仕組み自体を、他の中小企業向けに導入パッケージとして外販する。既存の「導入キット」商材（kit-assemblerスキル）の延長線上だが、単発のAI利用ルールではなく「組織全体をAIエージェント群で回す設計図」を売る点が新しい。自社が実践者であることが最大の説得材料になる。',
    status: 'idea',
  },
  {
    title: '越境インターン（都市部企業×地方学生のリモート密着取材）',
    memo: '既存の採用インターン商材（学生が企業に密着取材するプランA/B）を逆転させ、都市部企業が地方学生をリモートで受け入れる「越境インターン」パッケージ化。地方学生は都市部企業の実務に触れられ、企業側は地方在住のZ世代の視点を採用広報に活かせる。既存の intern-matching / intern-phase-tracker スキルの4フェーズ進行テンプレをそのまま転用できる。',
    status: 'idea',
  },
  {
    title: '痕跡データ×OTA連携の周遊ツアー商品化',
    memo: '地域の痕跡データベースから「感情濃度の高いルート」を抽出し、じゃらん等のOTA（オンライン旅行代理店）や地域の旅行代理店と提携して周遊ツアー商品として販売する。既存の公開イベント（route/relay）機能をそのまま観光商品の設計図として転用でき、自治体向け提案（gov-proposal-custom、digital-tourism-ambassador）とも接続できる。',
    status: 'idea',
  },
  {
    title: '学校向け探究学習コンソーシアム（年間契約サブスク化）',
    memo: '現在は単発の学校向け探究学習教材・研修を、複数校をまとめた年間契約のコンソーシアムモデルに転換する。1校ごとの営業コストを下げつつ、学校間で成果を比較できる「地域探究ランキング」的な仕掛けを作ると学校側の継続意欲が上がる。既存のtraining-builder・training-signup・seminar-progress-trackerスキルの延長で実装可能。',
    status: 'idea',
  },
  {
    title: 'インバウンド向け痕跡データ多言語周遊体験',
    memo: '痕跡データを多言語対応させ、訪日外国人観光客向けの周遊体験プロダクトとして展開する。日本語圏の10倍規模とされる英語圏市場（global-market-researchスキルの調査対象）を見据え、まずは佐野市など実証済みエリアの痕跡データを英語・中国語で翻訳した観光ルートとして試験展開する。furusato-nozeiスキルとの連携でふるさと納税の返礼品導線も作れる。',
    status: 'idea',
  },
  {
    title: '自治体向け「デジタル観光大使AI」の月額サブスク化',
    memo: '既存の digital-tourism-ambassador スキルで作る自治体向け観光ナビ提案を、単発の提案書納品ではなく月額利用料のSaaSプロダクトとして再構成する。自治体は初期費用を抑えて導入でき、ヒトマップ側は複数自治体への横展開（gov-proposal-customスキルによる量産）でストック収益化できる。佐野市実証データを最初のショーケースとして使う。',
    status: 'idea',
  },
];

async function main() {
  for (const idea of IDEAS) {
    const { error } = await supabase.from('biz_model_ideas').insert(idea);
    if (error) {
      console.error(`✗ ${idea.title}: ${error.message}`);
    } else {
      console.log(`✓ ${idea.title}`);
    }
  }
}

main();
