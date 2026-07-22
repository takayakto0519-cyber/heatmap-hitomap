// ============================================================
// 軽量デザイントークン（Phase 1）
// 既存コンポーネントの色はインラインstyleに直書きされており、
// 一括置換はスコープ外。新規に書くコードからこのファイルを参照し、
// 今後の変更のたびに段階的に移行するための土台。
// ============================================================

// 2026-07-15: 旧ピンク/紫/青緑の配色はコーポレートサイト刷新後の「石＋苔」の世界観と食い違うため、
// アプリ側もlib/appTokens.tsと同じ系統（苔=主要、黄土=特別な導線、青緑=副次）へ全面移行した。
export const colors = {
  primary: '#566246',      // 苔：主要CTA・アクティブ状態
  primaryDark: '#3B4530',
  accent: '#2F8C88',       // 青緑：確定操作・副次アクセント
  purple: '#8A6B3F',       // 黄土：クエスト・特別な導線（旧・紫の役割）
  purpleBg: '#F3EDDE',
  gold: '#9C6B23',         // クイック記録・強調
  danger: '#B23A2E',
  textPrimary: '#23231F',
  textSecondary: '#55524A',
  textMuted: '#726C5E',
  textFaint: '#A79E8A',
  border: '#D7CFB8',
  borderSoft: '#E9E3D2',
  surface: '#fff',
  surfaceMuted: '#F4F1E8',
  trackBg: '#E9E3D2',
} as const;

// 2026-07-22: SAGOJO分析を踏まえ、corpRadius（components/corp/tokens.ts）と同じ方針で拡張。
// 配色は変えず、角丸だけをSAGOJO寄りの柔らかさに近づける。
export const radii = {
  sm: 10,
  md: 14,
  lg: 20,
  pill: 20,
} as const;

export const shadows = {
  card: '0 1px 4px rgba(0,0,0,0.06)',
  floating: '0 3px 14px rgba(0,0,0,0.3)',
  sheet: '0 -4px 30px rgba(0,0,0,0.18)',
  segment: '0 1px 3px rgba(0,0,0,0.15)',
} as const;
