// アプリ本体（/start, /map, /login等、BottomNav・TraceCardが表示される画面）専用のトークン。
// components/corp/tokens.ts（コーポレートサイト /, /business, /school 等）とは別管理だが、
// ink=sumi・accent=shu は同じ値を採用し、ブランドとしての一貫性を保つ。

export const appColor = {
  canvas: '#F7F6F1',     // 背景（corpのkinariより少し軽く、写真が主役の画面向け）
  surface: '#FFFFFF',
  ink: '#211E1B',        // 墨色（本文・見出し。corpColor.sumiと同値）
  inkSoft: '#4A453E',    // サブテキスト（corpColor.sumiSoftと同値）
  inkFaint: '#8C8579',   // 補足・メタ情報
  inkGhost: '#B8B0A2',   // プレースホルダ・無効状態
  line: '#E3DCCB',       // 罫線・カード境界
  lineSoft: '#EFEAE0',

  accent: '#B7410E',     // 朱（corpColor.shuと同値。CTA・アクティブ状態にのみ使う一点物アクセント）
  accentTint: '#F6E8E0',
  teal: '#2F8C88',       // 副アクセント（地図・セカンダリ操作）
  tealTint: '#E9F3F2',

  danger: '#B23A2E',
  dangerTint: '#F8E9E7',
  success: '#3D7A54',
  successTint: '#E9F3EC',
  warning: '#9C6B23',
  warningTint: '#F5EDDD',
} as const;

export const appFont = {
  body: '"Yu Gothic Medium", "Yu Gothic", YuGothic, "Hiragino Kaku Gothic ProN", "Noto Sans JP", sans-serif',
  mincho: '"Yu Mincho", YuMincho, "Hiragino Mincho ProN", "Noto Serif JP", serif',
} as const;

export const appRadius = {
  sm: 8,
  md: 12,
} as const;

export const appShadow = {
  sm: '0 1px 4px rgba(33,30,27,0.08)',
  md: '0 4px 16px rgba(33,30,27,0.14)',
} as const;
