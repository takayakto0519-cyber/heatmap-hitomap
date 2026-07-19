// 実績ブログ（site_posts）の型とヘルパー。lib/types.ts とは独立させて管理する。

export interface Testimonial {
  name: string;    // 例：「参加学生（大学3年）」「〇〇株式会社 人事ご担当者」
  comment: string;
}

export interface SitePost {
  id: string;
  slug: string;
  title: string;
  category: 'event' | 'case' | 'note';
  post_type: 'achievement' | 'blog';
  related_slug: string | null;
  event_date: string | null;
  event_date_end: string | null;
  body: string;
  cover_url: string | null;
  photo_urls: string[];
  testimonials: Testimonial[];
  is_published: boolean;
  created_at: string;
  updated_at: string;
}

export const POST_CATEGORIES = [
  { key: 'event', label: 'イベント実施' },
  { key: 'case', label: '導入事例' },
  { key: 'note', label: 'お知らせ' },
] as const;

export function categoryLabel(key: string): string {
  return POST_CATEGORIES.find(c => c.key === key)?.label ?? key;
}

// 実績（achievement）＝箇条書き＋写真の簡単な投稿。 ブログ（blog）＝実績の背景を深掘りする読み物。
export const POST_TYPES = [
  { key: 'achievement', label: '実績（簡単な報告）' },
  { key: 'blog', label: 'ブログ（深掘り記事）' },
] as const;

export function postTypeLabel(key: string): string {
  return POST_TYPES.find(t => t.key === key)?.label ?? key;
}

// タイトルから重複しにくいslugを生成する（日本語タイトルはそのままURLに使わない）
export function generateSlug(eventDate?: string | null): string {
  const d = eventDate ? new Date(eventDate) : new Date();
  const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  return `${ymd}-${Math.random().toString(36).slice(2, 7)}`;
}

// 実施日の表示。複数日程（event_date_end が別日）の場合は「〜」でつなぐ。
export function formatEventDateRange(start: string | null, end?: string | null): string {
  if (!start) return '';
  const startLabel = new Date(start).toLocaleDateString('ja-JP');
  if (!end || end === start) return startLabel;
  return `${startLabel}〜${new Date(end).toLocaleDateString('ja-JP')}`;
}
