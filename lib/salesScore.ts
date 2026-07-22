// ============================================================================
// 営業スコアの「基準」を1箇所に集約するモジュール。
//
// これまで営業価値のスコアは6つの別々の計算に分裂し（温度感・縁スコア・自治体スコア・
// フォロー日数・提案余地・fit_score）、基準はコードの中にしか無かった。
// このファイルは、①各スコアの「意味」と「配点表」を1つのデータ(SALES_SCORE_CRITERIA)に
// まとめ（画面の「スコアの見方」パネルと docs/営業スコアの基準_*.md が同じものを参照する）、
// ②自治体スコアの換算をSalesTabから移して共有する。
//
// 計算そのものは既存の純関数を正とする（二重実装を避ける）：
//   - 縁スコア  : lib/enScore.ts   computeEn()
//   - 温度感    : lib/leadTemperature.ts scoreLead()
//   - フォロー  : lib/followUp.ts  computeFollowUp()
// ============================================================================
import { HOT_WORDS } from '@/lib/leadTemperature';

// ---- 自治体プロファイルのスコア換算（SalesTabから移設・共有） ----
// 縁の台帳(0-200)と同じ物差しに載せるための簡易換算。縁スコアが「積み上げて稼いだ深さ」なのに対し、
// これは「手動で付けた提案余地タグ＋関わりの進み具合」から出す“見立て”。意味が違うので画面では別ラベルにする。
export const OPPORTUNITY_SCORE: Record<string, number> = { 高: 140, 中: 80, 低: 30 };
export const ENGAGEMENT_BONUS: Record<string, number> = { contracted: 40, proposed: 20, lead: 0, observing: -10 };

// 公募中ボーナス：手動評価「高」(140)を超えて最上位帯に浮上させる。締切が近いほどさらに加点。
export const RFP_ACTIVE_BONUS = 70;
export const RFP_DEADLINE_SOON_BONUS = 10;
export const RFP_DEADLINE_SOON_DAYS = 14;

/** その自治体に「募集中」の公募（funding_opportunities, status=watching/preparing）が紐づいているか判定してボーナスを返す */
export function rfpBonus(opps: { status: string; deadline: string | null }[]): number {
  const active = opps.filter((o) => ['watching', 'preparing'].includes(o.status));
  if (active.length === 0) return 0;
  let bonus = RFP_ACTIVE_BONUS;
  const soon = active.some((o) => {
    if (!o.deadline) return false;
    const days = (new Date(o.deadline).getTime() - Date.now()) / 86400000;
    return days >= 0 && days <= RFP_DEADLINE_SOON_DAYS;
  });
  if (soon) bonus += RFP_DEADLINE_SOON_BONUS;
  return bonus;
}

export function municipalityScore(
  p: { opportunity_level: string; engagement_stage: string },
  linkedOpps: { status: string; deadline: string | null }[] = [],
): number {
  const base = OPPORTUNITY_SCORE[p.opportunity_level] ?? 30;
  const bonus = ENGAGEMENT_BONUS[p.engagement_stage] ?? 0;
  return Math.max(0, Math.min(200, base + bonus + rfpBonus(linkedOpps)));
}

// ---- 基準の一覧（画面の凡例とドキュメントの単一ソース） ----
export interface CriteriaRow { when: string; points: string; }
export interface CriteriaBlock {
  key: string;
  icon: string;
  title: string;
  meaning: string;   // このスコアが「何を測っているか」
  rows: CriteriaRow[];
  note?: string;
}

export const SALES_SCORE_CRITERIA: CriteriaBlock[] = [
  {
    key: 'en',
    icon: '🧭',
    title: '縁スコア（0〜200）＝ 積み上げて“稼いだ”関係の深さ',
    meaning: '縁の方程式そのもの。相手を「落とす」のではなく、足りない要素を埋めるほど上がる。リードの主指標。',
    rows: [
      { when: '出会い ＝ 事実 × 共感', points: 'どちらかが0なら出会いは0（掛け算）' },
      { when: '事実（0-10）', points: '台帳の事実記録・証拠パックの熱いキーワード・連絡先の有無・メモの厚み' },
      { when: '共感（0-10）', points: '「相手の困りごと×自社の強み」を1行書くごとに+4' },
      { when: '縁 ＝ 出会い ＋ 行動 × 恩返し', points: '一緒に行動し、先に渡すほど伸びる' },
      { when: '行動（0-10）', points: '一緒に動いた記録ごとに+3（商談中+2・契約中+3）' },
      { when: '恩返し（0-10）', points: '先に渡した／お礼・紹介をもらった記録ごとに+4' },
    ],
    note: '表示は「いまの縁の温度」＝ 縁 × 鮮度（下記）。',
  },
  {
    key: 'freshness',
    icon: '🌡',
    title: '鮮度（×0.4〜1.0）＝ 何もしないと縁は冷める',
    meaning: '最後に手を動かした日からの経過で減衰する。放置への警告。',
    rows: [
      { when: '7日以内', points: '×1.0 🔥 あたたかい' },
      { when: '21日以内', points: '×0.85 🌤 保たれている' },
      { when: '45日以内', points: '×0.65 🌙 冷めかけ' },
      { when: '46日以上', points: '×0.4 ❄ 冷えている' },
    ],
    note: '契約中は関係が続いているため、経過日数を半分に見て冷めにくくする。',
  },
  {
    key: 'temperature',
    icon: '🔥',
    title: '温度感（🔥熱い/🌤ふつう/❄冷たい）＝ “手がかり”の強さ',
    meaning: '縁スコアが「積み上げた深さ」なのに対し、こちらは証拠パック（メモ）の中身から見た当たりやすさ。番人 lead_temperature と同じ基準。',
    rows: [
      ...Object.entries(HOT_WORDS).map(([w, p]) => ({ when: `メモに「${w}」`, points: `+${p}` })),
      { when: '連絡先（メール/電話）あり', points: '+15' },
      { when: '進行中（接触済み/商談中）', points: '+20' },
      { when: '判定', points: '45以上=🔥熱い／20以上=🌤ふつう／未満=❄冷たい' },
    ],
  },
  {
    key: 'municipality',
    icon: '🏛',
    title: '自治体スコア（0〜200）＝ 手動評価ベースの“見立て”',
    meaning: '縁スコアのように稼いだ数字ではなく、提案余地タグ（手入力）と関わりの段階から機械換算した目安。縁スコアと同じ数値でも意味が違う点に注意。',
    rows: [
      { when: '提案余地 高', points: '140' },
      { when: '提案余地 中', points: '80' },
      { when: '提案余地 低', points: '30' },
      { when: '関わり：契約中', points: '+40' },
      { when: '関わり：提案済み', points: '+20' },
      { when: '関わり：様子見', points: '-10' },
      { when: '🔥 公募中（募集中のRFPが紐付き）', points: `+${RFP_ACTIVE_BONUS}` },
      { when: '　うち締切14日以内', points: `さらに+${RFP_DEADLINE_SOON_BONUS}` },
    ],
    note: '0〜200にクランプ。ランキングでは「手動評価」バッジを付けて縁スコアと区別する。',
  },
  {
    key: 'followup',
    icon: '⏰',
    title: '送信後フォロー（送信/要フォロー/返信あり）＝ 送った後の鮮度',
    meaning: 'コールドメールは返信を待つ性質上、縁の鮮度より短いバンドで「そろそろ連絡を」を出す。',
    rows: [
      { when: '返信あり', points: '✓ フォロー不要' },
      { when: '送信〜4日', points: '送信N日目（まだ待つ）' },
      { when: '5〜9日', points: 'そろそろフォロー' },
      { when: '10日以上', points: '⏰ 要フォロー' },
    ],
    note: '手動フォロー（電話・対面）を記録すると、その日から数え直す。',
  },
  {
    key: 'fit',
    icon: '🎯',
    title: 'ヒトマップ度 fit_score（0〜100）＝ 助成金・コンテストとの相性',
    meaning: '助成金/コンテストが「痕跡×地域愛着」というヒトマップの中身にどれだけ合うか。締切順とは別の「相性順」の並べ替えに使う。',
    rows: [
      { when: '70以上', points: '相性◎（緑）' },
      { when: '40〜69', points: '相性○（橙）' },
      { when: '40未満', points: '相性△（灰）' },
    ],
    note: 'エージェント（deep-research等）か手入力で設定する。',
  },
];
