export const CATEGORIES = [
  { key: 'building',  label: '建物・構造', emoji: '🏠' },
  { key: 'nature',    label: '植物・自然', emoji: '🌿' },
  { key: 'tool',      label: '道具・生活用品', emoji: '🔧' },
  { key: 'sense',     label: '音・においなど', emoji: '👂' },
  { key: 'people',    label: '人の気配', emoji: '👤' },
  { key: 'other',     label: 'その他', emoji: '✦' },
] as const;

export type CategoryKey = typeof CATEGORIES[number]['key'];

export function getCategory(key: string | null | undefined) {
  return CATEGORIES.find(c => c.key === key) ?? null;
}
