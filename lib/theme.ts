// ============================================================
// 軽量デザイントークン（Phase 1）
// 既存コンポーネントの色はインラインstyleに直書きされており、
// 一括置換はスコープ外。新規に書くコードからこのファイルを参照し、
// 今後の変更のたびに段階的に移行するための土台。
// ============================================================

export const colors = {
  primary: '#FF6B9D',      // ときめき・主要CTA
  primaryDark: '#E5527F',
  accent: '#38ADA9',       // 落ち着き・確定操作
  purple: '#8E44AD',       // クエスト・特別な導線
  purpleBg: '#F3EAFB',
  gold: '#F6B93B',         // クイック記録・強調
  danger: '#E55039',
  textPrimary: '#333',
  textSecondary: '#666',
  textMuted: '#999',
  textFaint: '#ccc',
  border: '#e0e0e0',
  borderSoft: '#eee',
  surface: '#fff',
  surfaceMuted: '#fafafa',
  trackBg: '#f2f2f2',
} as const;

export const radii = {
  sm: 8,
  md: 10,
  lg: 14,
  pill: 20,
} as const;

export const shadows = {
  card: '0 1px 4px rgba(0,0,0,0.06)',
  floating: '0 3px 14px rgba(0,0,0,0.3)',
  sheet: '0 -4px 30px rgba(0,0,0,0.18)',
  segment: '0 1px 3px rgba(0,0,0,0.15)',
} as const;
