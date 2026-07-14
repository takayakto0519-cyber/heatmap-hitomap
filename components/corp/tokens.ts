// コーポレートサイト（/, /company/** 配下）専用のトークン。
// lib/appTokens.ts（アプリ本体 /start, /map, /login 等）と同じ体系・同じ値を使い、
// ブランドとしての一貫性を保つ。
//
// 生成り＋朱（暖色クリーム＋テラコッタ）はAI生成デザインで頻出する組み合わせのため、
// 石color（風化した石畳）＋苔color（痕跡に生える苔）に置き換えている。

export const corpColor = {
  ground: '#E6E1D3',      // 石畳（背景）
  groundDeep: '#D8D1BC',  // 石畳・濃淡用
  ink: '#23231F',         // 墨（本文・見出し）
  inkSoft: '#55524A',     // 墨の淡色（サブテキスト）
  moss: '#566246',        // 苔色（強調・CTA・唯一のアクセント）
  mossDeep: '#3B4530',
  line: '#CFC6AE',        // 罫線
  white: '#FBFAF6',
} as const;

export const corpFont = {
  body: '"Yu Gothic Medium", "Yu Gothic", YuGothic, "Hiragino Kaku Gothic ProN", "Noto Sans JP", sans-serif',
  mincho: '"Yu Mincho", YuMincho, "Hiragino Mincho ProN", "Noto Serif JP", serif',
} as const;

export const corpSpace = {
  maxWidth: 960,
} as const;
