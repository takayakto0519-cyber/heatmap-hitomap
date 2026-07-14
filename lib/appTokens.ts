// アプリ本体（/start, /map, /login等、BottomNav・TraceCardが表示される画面）専用のトークン。
// components/corp/tokens.ts（コーポレートサイト /, /company/** 等）とは別管理だが、
// ink=ink・accent=moss は同じ値を採用し、ブランドとしての一貫性を保つ。
// 生成り＋朱（暖色クリーム＋テラコッタ）はAI生成デザインで頻出する組み合わせのため、
// 石color（風化した石畳）＋苔color（痕跡に生える苔）に置き換えている。

export const appColor = {
  canvas: '#EFEBDF',     // 石畳の背景（corpのgroundより少し軽く、写真が主役の画面向け）
  surface: '#FFFFFF',
  ink: '#23231F',        // 墨色（本文・見出し。corpColor.inkと同値）
  inkSoft: '#55524A',    // サブテキスト（corpColor.inkSoftと同値）
  inkFaint: '#726C5E',   // 補足・メタ情報（旧値は明度が高すぎて視認性が低かったため濃くした）
  inkGhost: '#A79E8A',   // プレースホルダ・無効状態
  line: '#D7CFB8',       // 罫線・カード境界
  lineSoft: '#E9E3D2',

  accent: '#566246',     // 苔色（corpColor.mossと同値。CTA・アクティブ状態にのみ使う一点物アクセント）
  accentTint: '#E6E9DE',
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
