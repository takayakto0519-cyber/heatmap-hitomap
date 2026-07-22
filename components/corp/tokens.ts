// コーポレートサイト（/, /company/** 配下）専用のトークン。
// lib/appTokens.ts（アプリ本体 /start, /map, /login 等）と同じ体系・同じ値を使い、
// ブランドとしての一貫性を保つ。
//
// 生成り＋朱（暖色クリーム＋テラコッタ）はAI生成デザインで頻出する組み合わせのため、
// 石color（風化した石畳）＋苔color（痕跡に生える苔）に置き換えている。
//
// 【20260718 白基調ミニマル化】
// 参考: 現代デザイン（白基調・無彩色・信頼感）。支配面を白へ移し、石畳(ground)は
// 「セクションの差し色（帯）」に格下げ。行政・法人向けに青(trust)/灰(gray)の信頼トーンを追加。
// フォントは next/font のCSS変数（--font-serif / --font-gothic）を先頭に置き、游書体はフォールバック。

export const corpColor = {
  // 面（白基調ミニマルの支配面）
  surface: '#FFFFFF',     // 主背景（白）
  surfaceSoft: '#FAF9F6', // 交互セクションのわずかな差し
  white: '#FBFAF6',       // カード等の生成り白（既存互換）

  // 石畳（いまは全面背景ではなく差し色の帯として使う）
  ground: '#E6E1D3',      // 石畳（アクセント帯）
  groundDeep: '#D8D1BC',  // 石畳・濃淡用

  // 墨
  ink: '#23231F',         // 墨（本文・見出し）
  inkSoft: '#55524A',     // 墨の淡色（サブテキスト）

  // 苔（唯一のブランドアクセント＝CTA・強調）
  moss: '#566246',        // 苔色
  mossDeep: '#3B4530',

  // 信頼トーン（行政・法人セクション用）
  trust: '#2E5A88',       // 青
  trustDeep: '#204A62',   // 濃青
  trustSoft: '#EAF1F7',   // 淡青（背景帯）
  gray: '#6B7280',        // 無彩色テキスト
  graySoft: '#F3F4F6',    // 淡灰（背景帯）

  // 罫線
  line: '#CFC6AE',        // 石畳系の罫線（既存互換）
  lineSoft: '#E9E6DD',    // 白面に映える淡い罫線
} as const;

// 角丸
// 2026-07-22: SAGOJO（competitor）分析を踏まえ、苔・石の配色は変えずに角丸だけを拡張。
// 静けさ（白基調・明朝見出し等）はそのまま、硬さだけを抜く方針。
export const corpRadius = {
  sm: 10,
  md: 16,
  lg: 24,
  pill: 999,
} as const;

// 影（白基調で"浮き"を上品に出す）
export const corpShadow = {
  card: '0 1px 2px rgba(35,35,31,.04), 0 8px 24px -18px rgba(35,35,31,.22)',
  lift: '0 14px 34px -16px rgba(35,35,31,.30)',
  header: '0 6px 20px -14px rgba(35,35,31,.28)',
} as const;

// スペーシング（8pxグリッド）
export const corpSpace = {
  maxWidth: 960,   // 既存互換（読み物幅の既定）
  text: 720,       // 読み物幅
  wide: 1120,      // セクション幅
  section: 96,     // セクション縦余白
  unit: 8,
} as const;

export const corpFont = {
  // next/font のCSS変数を先頭に。未読込環境では游書体→システムにフォールバック。
  body:
    'var(--font-gothic), "Yu Gothic Medium", "Yu Gothic", YuGothic, "Hiragino Kaku Gothic ProN", "Noto Sans JP", sans-serif',
  mincho:
    'var(--font-serif), "Yu Mincho", YuMincho, "Hiragino Mincho ProN", "Noto Serif JP", serif',
} as const;
