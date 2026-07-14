// コーポレートサイト（/, /philosophy, /service, /business, /school, /works, /team, /contact）専用のトークン。
// アプリ本体（/start, /map, /login 等）の見た目には影響しない。

export const corpColor = {
  kinari: '#F4EFE4',      // 生成り（背景）
  kinariDeep: '#EDE5D3',  // 生成り・濃淡用
  sumi: '#211E1B',        // 墨色（本文・見出し）
  sumiSoft: '#4A453E',    // 墨色の淡色（サブテキスト）
  tsuchi: '#8A6B4A',      // 土色（罫線・アクセント）
  tsuchiSoft: '#B79E7D',
  shu: '#B7410E',         // 朱（強調・CTA）
  shuDeep: '#8F3009',
  line: '#D8CDB6',        // 罫線
  white: '#FFFDF8',
} as const;

export const corpFont = {
  body: '"Yu Gothic Medium", "Yu Gothic", YuGothic, "Hiragino Kaku Gothic ProN", "Noto Sans JP", sans-serif',
  mincho: '"Yu Mincho", YuMincho, "Hiragino Mincho ProN", "Noto Serif JP", serif',
} as const;

export const corpSpace = {
  maxWidth: 960,
} as const;
