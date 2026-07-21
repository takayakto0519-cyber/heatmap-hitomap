// 「記録が育てる自分だけのキャラクター」の判定ロジック。
// lib/badges.ts と同じ思想：新しいDBカラム・テーブルは増やさず、
// 既に取得済みの traces（GET /api/traces?user_id=…）だけから純関数で算出する。
import type { Trace } from './types';

export type CharacterBranch = 'hidamari' | 'bouken' | 'monogatari' | 'machibito';
export type CharacterMood = 'awake' | 'sleepy' | 'asleep' | 'justWoke';
export type CharacterStage = 1 | 2 | 3 | 4 | 5;
export type SceneVariant = 'day' | 'evening' | 'night' | 'sleep';

export interface CharacterState {
  level: number;
  totalExp: number;
  expIntoLevel: number;
  expToNext: number;
  progress: number; // 0..1（次のレベルまでのバー用）
  stage: CharacterStage;
  stageLabel: string;
  branch: CharacterBranch | null; // stage>=3 で確定。stage<3はまだ「何者でもない」
  branchLabel: string | null;
  mood: CharacterMood;
  daysSinceLastRecord: number | null;
  emoji: string;
  sceneVariant: SceneVariant;
  regionCount: number;
  prefectureCount: number;
  postCount: number;
}

const STAGE_LABELS: Record<CharacterStage, string> = {
  1: 'たまご',
  2: 'ふたば',
  3: 'こども',
  4: 'おとな',
  5: '達人',
};

const EGG_EMOJI = '🥚';
const SPROUT_EMOJI = '🐣';

const BRANCH_META: Record<CharacterBranch, { label: string; emojis: Record<3 | 4 | 5, string> }> = {
  hidamari: { label: 'ひだまり型', emojis: { 3: '🐰', 4: '🦢', 5: '🦄' } },
  bouken: { label: 'ぼうけん型', emojis: { 3: '🦊', 4: '🐺', 5: '🦁' } },
  monogatari: { label: 'ものがたり型', emojis: { 3: '🦉', 4: '🐲', 5: '🐉' } },
  machibito: { label: 'まちびと型', emojis: { 3: '🐕', 4: '🐆', 5: '🦮' } },
};

const PREFECTURES = [
  '北海道', '青森県', '岩手県', '宮城県', '秋田県', '山形県', '福島県',
  '茨城県', '栃木県', '群馬県', '埼玉県', '千葉県', '東京都', '神奈川県',
  '新潟県', '富山県', '石川県', '福井県', '山梨県', '長野県', '岐阜県',
  '静岡県', '愛知県', '三重県', '滋賀県', '京都府', '大阪府', '兵庫県',
  '奈良県', '和歌山県', '鳥取県', '島根県', '岡山県', '広島県', '山口県',
  '徳島県', '香川県', '愛媛県', '高知県', '福岡県', '佐賀県', '長崎県',
  '熊本県', '大分県', '宮崎県', '鹿児島県', '沖縄県',
] as const;

/** "大阪府浪速区" のような region 文字列から都道府県名だけを取り出す。該当なしは null */
export function extractPrefecture(region: string | null | undefined): string | null {
  if (!region) return null;
  return PREFECTURES.find((p) => region.startsWith(p)) ?? null;
}

/** レベル L → L+1 に必要なEXP。序盤は軽く、後半になるほど緩やかに重くなる */
function expNeededForLevel(level: number): number {
  return 40 + 15 * (level - 1);
}

function levelFromTotalExp(totalExp: number): { level: number; expIntoLevel: number; expToNext: number } {
  let level = 1;
  let remaining = totalExp;
  // 実用上ここまで届くことはまずないが、無限ループ防止の上限
  while (level < 999) {
    const needed = expNeededForLevel(level);
    if (remaining < needed) {
      return { level, expIntoLevel: remaining, expToNext: needed - remaining };
    }
    remaining -= needed;
    level += 1;
  }
  return { level, expIntoLevel: 0, expToNext: expNeededForLevel(level) };
}

function stageFromLevel(level: number): CharacterStage {
  if (level <= 2) return 1;
  if (level <= 5) return 2;
  if (level <= 9) return 3;
  if (level <= 14) return 4;
  return 5;
}

function photoCount(t: Trace): number {
  if (t.photo_urls?.length) return t.photo_urls.length;
  return t.photo_url ? 1 : 0;
}

function traceEmotionKeys(t: Trace): string[] {
  if (t.emotion_keys?.length) return t.emotion_keys;
  return t.emotion_key ? [t.emotion_key] : [];
}

/** 1件の記録のEXP。量ではなく「どれだけ丁寧に記録したか」を評価する */
function expForTrace(t: Trace, isNewRegion: boolean): number {
  let exp = 10;
  exp += Math.min(photoCount(t), 4) * 2; // 最大+8
  if (t.why?.trim()) exp += 3;
  if (t.interpretation?.trim()) exp += 3;
  if (t.self_reflection?.trim()) exp += 3;
  if (traceEmotionKeys(t).length > 0) exp += 2;
  if (isNewRegion) exp += 4;
  if (t.revisit_of) exp += 5; // 「その後」を記録した＝愛着の証
  return exp;
}

function determineBranch(traces: Trace[], regionCount: number): CharacterBranch {
  const emotionCount = (keys: string[]) =>
    traces.reduce((sum, t) => sum + traceEmotionKeys(t).filter((k) => keys.includes(k)).length, 0);

  const hidamariScore = emotionCount(['atatakasa', 'anshin', 'natsukashii']);
  const boukenBase = emotionCount(['odoroki', 'tokimeki', 'tanoshisa']);
  const diversityBonus = traces.length > 0 ? (regionCount / traces.length) * 10 : 0;
  const boukenScore = boukenBase + diversityBonus;

  const reflectionFillRate = traces.length > 0
    ? traces.filter((t) => t.why?.trim() || t.interpretation?.trim() || t.self_reflection?.trim()).length / traces.length
    : 0;
  const kotoCount = traces.filter((t) => t.trace_type === 'こと').length;
  const monogatariScore = emotionCount(['setsunai', 'fushigi', 'kandou']) + reflectionFillRate * 5 + kotoCount;

  const hitoCount = traces.filter((t) => t.trace_type === '人').length;
  const companionCount = traces.filter((t) => t.companion_tag?.trim()).length;
  const machibitoScore = hitoCount + companionCount;

  const scores: [CharacterBranch, number][] = [
    ['hidamari', hidamariScore],
    ['bouken', boukenScore],
    ['monogatari', monogatariScore],
    ['machibito', machibitoScore],
  ];
  // 全員0点（記録が薄い等）の場合も含め、最初に最大値を取ったものを採用（順序=優先度）
  return scores.reduce((best, cur) => (cur[1] > best[1] ? cur : best))[0];
}

function resolveSceneVariant(mood: CharacterMood, now: Date): SceneVariant {
  if (mood === 'asleep') return 'sleep';
  const hour = now.getHours();
  if (hour >= 17 && hour < 19) return 'evening';
  if (hour >= 19 || hour < 5) return 'night';
  return 'day';
}

export function computeCharacter(traces: Trace[], now: Date = new Date()): CharacterState {
  const sorted = [...traces].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );

  const seenRegions = new Set<string>();
  let totalExp = 0;
  for (const t of sorted) {
    const isNewRegion = Boolean(t.region) && !seenRegions.has(t.region as string);
    if (t.region) seenRegions.add(t.region);
    totalExp += expForTrace(t, isNewRegion);
  }

  const regionCount = seenRegions.size;
  const prefectureCount = new Set(
    [...seenRegions].map(extractPrefecture).filter((p): p is string => Boolean(p))
  ).size;

  const { level, expIntoLevel, expToNext } = levelFromTotalExp(totalExp);
  const stage = stageFromLevel(level);
  const branch = stage >= 3 ? determineBranch(sorted, regionCount) : null;

  // 放置の検知（レベルは絶対に下げない。表情が変わるだけ）
  let daysSinceLastRecord: number | null = null;
  let mood: CharacterMood = 'awake';
  if (sorted.length > 0) {
    const last = sorted[sorted.length - 1];
    const lastDate = new Date(last.created_at);
    daysSinceLastRecord = Math.floor((now.getTime() - lastDate.getTime()) / 86_400_000);

    if (daysSinceLastRecord >= 14) mood = 'asleep';
    else if (daysSinceLastRecord >= 7) mood = 'sleepy';

    if (sorted.length >= 2) {
      const prev = sorted[sorted.length - 2];
      const gapDays = (lastDate.getTime() - new Date(prev.created_at).getTime()) / 86_400_000;
      const hoursSinceLast = (now.getTime() - lastDate.getTime()) / 3_600_000;
      if (gapDays >= 14 && hoursSinceLast < 24) mood = 'justWoke';
    }
  }

  const needed = expToNext + expIntoLevel;
  const progress = needed > 0 ? expIntoLevel / needed : 0;

  const emoji = stage === 1 ? EGG_EMOJI : stage === 2 ? SPROUT_EMOJI : BRANCH_META[branch as CharacterBranch].emojis[stage as 3 | 4 | 5];

  return {
    level,
    totalExp,
    expIntoLevel,
    expToNext,
    progress,
    stage,
    stageLabel: STAGE_LABELS[stage],
    branch,
    branchLabel: branch ? BRANCH_META[branch].label : null,
    mood,
    daysSinceLastRecord,
    emoji,
    sceneVariant: resolveSceneVariant(mood, now),
    regionCount,
    prefectureCount,
    postCount: sorted.length,
  };
}
