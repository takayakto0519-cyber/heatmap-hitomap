// ビジネスモデルキャンバス（BMC）の雛形と検出。
// 新しいテーブル・カラムは作らない。既存の biz_model_ideas.report_md は
// lib/markdownLite.ts の splitTopLevelSections()（"# 見出し" 区切りのセクション集合）として
// 既に扱われているため、BMCの9ブロックもその形式のセクションとして差し込むだけで済む
// （IdeaReportEditor の「＋ 新しいセクションを追加」と同じ仕組みに乗る）。
import { splitTopLevelSections } from '@/lib/markdownLite';

// 見出しにこの接頭辞を付けて生成することで、後から「BMCが埋まっているか」を判定できるようにする。
export const BMC_HEADING_PREFIX = '🧩BMC：';

export interface BmcBlock {
  key: string;
  label: string;
  hint: string;
}

// Osterwalderの9ブロック。並び順はキャンバスの読む順（右上→左→下）ではなく、
// 埋めやすい順（誰に・何を→どう届ける→どう稼ぐ→何が要る）にしている。
export const BMC_BLOCKS: BmcBlock[] = [
  { key: 'customer_segments', label: '顧客セグメント', hint: '誰の痛みを引き受けるのか。1文で。' },
  { key: 'value_proposition', label: '価値提案', hint: '相手が金を払ってでも欲しい理由は何か。' },
  { key: 'channels', label: 'チャネル', hint: 'どうやって相手に届ける・知ってもらうか。' },
  { key: 'customer_relationships', label: '顧客との関係', hint: '一度きりか、続くか。続くなら何が縁をつなぐか。' },
  { key: 'revenue_streams', label: '収益の流れ', hint: '何に対して、いくら、どんな頻度で払われるか。' },
  { key: 'key_resources', label: '主要リソース', hint: 'これが無いと成立しないもの（データ・人・信用）は何か。' },
  { key: 'key_activities', label: '主要活動', hint: '毎回やらないと価値が出ない作業は何か。' },
  { key: 'key_partners', label: '主要パートナー', hint: '自分だけでは足りない部分を、誰と組んで埋めるか。' },
  { key: 'cost_structure', label: 'コスト構造', hint: '一番お金・時間を食う部分はどこか。' },
];

function blockToSection(block: BmcBlock): string {
  return `# ${BMC_HEADING_PREFIX}${block.label}\n\n${block.hint}`;
}

/** IdeaReportEditor の「新しいセクションを追加」と同じ join 形式で、9ブロック分をまとめて返す。 */
export function buildBmcTemplateSections(): string[] {
  return BMC_BLOCKS.map(blockToSection);
}

/**
 * report_md に9ブロックのうちいくつ「見出しが存在するか」を数える。
 * ヒントのプレースホルダーのままでも「埋まっている」扱いにする（雛形を入れただけでは未完了とは判定しない——
 * 会長がキャンバスの形を見て考え始めた時点で価値があるため）。会長が見出し自体を消したブロックはカウントしない。
 */
export function bmcBlockCount(reportMd: string | null | undefined): number {
  if (!reportMd) return 0;
  const sections = splitTopLevelSections(reportMd);
  return sections.filter(s => s.heading.startsWith(BMC_HEADING_PREFIX)).length;
}

/** 9ブロックのうち過半数（5つ以上）の見出しが立っていれば「キャンバスあり」とみなす。 */
export function hasBmc(reportMd: string | null | undefined): boolean {
  return bmcBlockCount(reportMd) >= 5;
}
