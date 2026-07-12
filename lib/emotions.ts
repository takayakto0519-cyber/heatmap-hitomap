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
