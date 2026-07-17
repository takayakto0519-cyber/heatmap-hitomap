// 感情カテゴリ定義
// color はマップピン・ヒートマップ円の色
// weight はヒートマップの基準強度係数（intensityと掛け合わせる）
// valence は自治体向けサマリー用の粗い好悪判定（1=好意的 / -1=否定的 / 0=中立）
export const EMOTIONS = [
  { key: 'tokimeki',    label: 'ときめき',  emoji: '✨', color: '#FF6B9D', weight: 1.0, valence: 1 },
  { key: 'natsukashii', label: 'なつかしさ', emoji: '🍂', color: '#F6B93B', weight: 0.8, valence: 1 },
  { key: 'setsunai',    label: '切なさ',    emoji: '💧', color: '#6A89CC', weight: 0.7, valence: -1 },
  { key: 'odoroki',     label: '驚き',      emoji: '⚡', color: '#38ADA9', weight: 0.9, valence: 0 },
  { key: 'kandou',      label: '感動',      emoji: '💫', color: '#8E44AD', weight: 0.9, valence: 1 },
  { key: 'atatakasa',   label: 'あたたかさ', emoji: '🌸', color: '#E55039', weight: 0.9, valence: 1 },
  { key: 'anshin',      label: '安心',      emoji: '🍃', color: '#78C88C', weight: 0.6, valence: 1 },
  { key: 'tanoshisa',   label: '楽しさ',    emoji: '🎈', color: '#F9CA24', weight: 1.0, valence: 1 },
  { key: 'hokorashisa', label: '誇らしさ',  emoji: '🏅', color: '#4A69BD', weight: 0.8, valence: 1 },
  { key: 'fushigi',     label: '不思議',    emoji: '🌀', color: '#A29BFE', weight: 0.7, valence: 0 },
] as const;

export type EmotionKey = typeof EMOTIONS[number]['key'];

export function getEmotion(key: string | null | undefined) {
  return EMOTIONS.find((e) => e.key === key) ?? null;
}

export function getEmotionColor(key: string | null | undefined): string {
  return getEmotion(key)?.color ?? '#888888';
}

// ──────────────────────────────────────────────
// 感情の濃淡表現：会長の要望「マイナスは赤で薄→濃、プラスは明るい色」を
// valence × intensity → 色・不透明度 に変換する共通層。
// タイムライン・イベント前後ビュー・（将来）地図のグラデーション表示が共有する。
// ──────────────────────────────────────────────

const NEGATIVE_BASE = '#E24B4A'; // AttachmentTab の negative と同じ赤
const NEUTRAL_COLOR = '#B8B8B8';

/** hex色を白と混ぜて薄くする（ratio 0=元色のまま, 1=真っ白） */
export function mixWithWhite(hex: string, ratio: number): string {
  const r = Math.min(Math.max(ratio, 0), 1);
  const n = parseInt(hex.replace('#', ''), 16);
  const mix = (c: number) => Math.round(c + (255 - c) * r);
  const [red, green, blue] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(mix);
  return `#${((red << 16) | (green << 8) | blue).toString(16).padStart(6, '0')}`;
}

/** 複数感情キーの平均 valence（-1〜1）。感情なしは null */
export function meanValence(emotionKeys: (string | null | undefined)[]): number | null {
  const found = emotionKeys.map(getEmotion).filter((e): e is NonNullable<ReturnType<typeof getEmotion>> => e !== null);
  if (found.length === 0) return null;
  return found.reduce((sum, e) => sum + e.valence, 0) / found.length;
}

/**
 * valence × intensity → 塗り色と不透明度。
 * - マイナス感情：赤（NEGATIVE_BASE）に収束させ、強度1=かなり薄い赤 → 強度5=濃い赤
 * - プラス感情：感情固有色（既存パレットは元々明色）を、強度が低いほど白寄せ
 * - 中立・感情なし：灰色
 */
export function getValenceGradientColor(
  emotionKeys: (string | null | undefined)[],
  intensity: number | null | undefined
): { color: string; opacity: number } {
  const valence = meanValence(emotionKeys);
  const level = Math.min(Math.max(intensity ?? 3, 1), 5); // 1〜5
  const t = (level - 1) / 4; // 0〜1

  if (valence === null || valence === 0) {
    return { color: NEUTRAL_COLOR, opacity: 0.35 };
  }
  if (valence < 0) {
    // 薄い赤 → 濃い赤（マイナスの深さが濃度で伝わる）
    return { color: mixWithWhite(NEGATIVE_BASE, 0.65 * (1 - t)), opacity: 0.30 + 0.55 * t };
  }
  // プラスは感情固有の明るい色を活かす
  const base = getEmotionColor(emotionKeys.find((k) => getEmotion(k)?.valence === 1) ?? emotionKeys[0]);
  return { color: mixWithWhite(base, 0.45 * (1 - t)), opacity: 0.45 + 0.45 * t };
}

/** before→after の valence 差分 → 変化を示す矢印・文字の色（AttachmentTab と同色系） */
export function getShiftColor(delta: number): string {
  if (delta > 0.05) return '#639922';  // あたたかくなった
  if (delta < -0.05) return '#E24B4A'; // 想いが沈んだ
  return '#888888';                    // 変わらない
}

// 好意的／否定的／中立の粗い内訳を集計する（自治体向けサマリー表示用）
export function summarizeValence(emotionKeys: (string | null | undefined)[]): {
  positive: number; negative: number; neutral: number; total: number;
} {
  let positive = 0, negative = 0, neutral = 0;
  for (const key of emotionKeys) {
    const e = getEmotion(key);
    if (!e) continue;
    if (e.valence > 0) positive++;
    else if (e.valence < 0) negative++;
    else neutral++;
  }
  return { positive, negative, neutral, total: positive + negative + neutral };
}
