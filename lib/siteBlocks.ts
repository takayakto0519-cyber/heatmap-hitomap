// 運営が自由に編集できるサイトコンテンツ（site_blocks）の型とメタ情報。
// テキスト・画像・カード・引用・CTAをブロック単位で追加・並び替え・削除できるようにする。

export type BlockType = 'heading' | 'text' | 'image' | 'cards' | 'quote' | 'cta' | 'mvv';

export interface BlockCardItem {
  title: string;
  body: string;
  image_url?: string;
  href?: string;
  badge?: string;
}

export interface BlockQuoteItem {
  name: string;
  comment: string;
}

export interface SiteBlock {
  id: string;
  page: string;
  sort_order: number;
  block_type: BlockType;
  eyebrow: string | null;
  heading: string | null;
  body: string | null;
  image_url: string | null;
  cta_label: string | null;
  cta_href: string | null;
  items: (BlockCardItem | BlockQuoteItem)[];
  is_visible: boolean;
  created_at: string;
  updated_at: string;
}

export const BLOCK_TYPES: { key: BlockType; label: string; hint: string }[] = [
  { key: 'heading', label: '見出しのみ', hint: '小ラベル＋大きな見出し文言' },
  { key: 'text', label: 'テキスト段落', hint: '見出し＋本文の文章ブロック' },
  { key: 'image', label: '画像', hint: '横幅いっぱいの写真＋任意のキャプション' },
  { key: 'cards', label: 'カード（複数項目）', hint: '機能紹介・実績・メニュー等を並べるカード群' },
  { key: 'quote', label: '声・感想の引用', hint: '参加者・利用者の声を複数並べる' },
  { key: 'cta', label: 'CTA帯', hint: '濃色背景の行動喚起（ボタン付き）' },
  { key: 'mvv', label: 'MVV演出（全幅・順番表示）', hint: '地図アート背景で1項目ずつ全画面表示。カード（title/body）をそのまま流用' },
];

export const SITE_PAGES: { key: string; label: string; path: string }[] = [
  { key: 'home', label: 'トップページ', path: '/' },
  { key: 'business', label: '法人・行政の方へ', path: '/business' },
  { key: 'school', label: '学校の方へ', path: '/school' },
  { key: 'service', label: 'ヒトマップの使い方', path: '/service' },
  { key: 'team', label: '運営', path: '/team' },
  { key: 'contact', label: 'お問い合わせ', path: '/contact' },
];

export function pagePath(key: string): string {
  return SITE_PAGES.find(p => p.key === key)?.path ?? '/';
}

export function blockTypeLabel(type: string): string {
  return BLOCK_TYPES.find(b => b.key === type)?.label ?? type;
}
