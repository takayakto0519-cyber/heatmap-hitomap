// 感情カテゴリ定義
// color はマップピン・ヒートマップ円の色
// weight はヒートマップの基準強度係数（intensityと掛け合わせる）
export const EMOTIONS = [
  { key: 'tokimeki',    label: 'ときめき',  emoji: '✨', color: '#FF6B9D', weight: 1.0 },
  { key: 'natsukashii', label: 'なつかしさ', emoji: '🍂', color: '#F6B93B', weight: 0.8 },
  { key: 'setsunai',    label: '切なさ',    emoji: '💧', color: '#6A89CC', weight: 0.7 },
  { key: 'odoroki',     label: '驚き',      emoji: '⚡', color: '#38ADA9', weight: 0.9 },
  { key: 'kandou',      label: '感動',      emoji: '💫', color: '#8E44AD', weight: 0.9 },
  { key: 'atatakasa',   label: 'あたたかさ', emoji: '🌸', color: '#E55039', weight: 0.9 },
  { key: 'anshin',      label: '安心',      emoji: '🍃', color: '#78C88C', weight: 0.6 },
  { key: 'tanoshisa',   label: '楽しさ',    emoji: '🎈', color: '#F9CA24', weight: 1.0 },
  { key: 'hokorashisa', label: '誇らしさ',  emoji: '🏅', color: '#4A69BD', weight: 0.8 },
  { key: 'fushigi',     label: '不思議',    emoji: '🌀', color: '#A29BFE', weight: 0.7 },
] as const;

export type EmotionKey = typeof EMOTIONS[number]['key'];

export function getEmotion(key: string | null | undefined) {
  return EMOTIONS.find((e) => e.key === key) ?? null;
}

export function getEmotionColor(key: string | null | undefined): string {
  return getEmotion(key)?.color ?? '#888888';
}
