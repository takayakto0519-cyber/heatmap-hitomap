// サイト設定（site_settings）の型・既定値・読み込みヘルパー。
// トップページの大見出し・サブ文・ボタン文言、お知らせ帯など「サイトの顔」の文言を
// 運営ダッシュボード（サイト設定タブ）から編集できるようにする。
// DBに値が無い項目はここに書いた既定文言で表示するため、空でもサイトは壊れない。

export interface HeroSettings {
  eyebrow: string;            // 見出しの上に出る小さな英字ラベル
  headline_lines: string[];   // 大見出し（1行ずつ配列。1〜3行を想定）
  subcopy: string;            // 大見出しの下の説明文
  cta_label: string;          // メインボタンの文言
  cta_href: string;           // メインボタンのリンク先
  sub_link_label: string;     // 「使い方を見る →」の文言
  sub_link_href: string;
  note: string;               // ボタンの下の一言（例：ログインしなくても…）
  biz_link_label: string;     // 法人・自治体向け導線の文言
  biz_link_href: string;
}

export interface AnnouncementSettings {
  enabled: boolean;
  text: string;               // お知らせ帯に出す文言
  href: string;               // タップした時のリンク先（空なら文字だけ）
}

export interface SiteSettings {
  hero: HeroSettings;
  announcement: AnnouncementSettings;
  // トップページ「いま、積み重なっている痕跡」に出す写真の並び（trace.id の配列。先頭ほど大きく出る）。
  // 空配列なら自動選定（直近の投稿から写真つきのものを新しい順に採用）に戻る。
  home_photo_grid: string[];
}

// 既定文言：これまでコード内（components/corp/Hero.tsx）に固定されていた文言と同一にする。
export const DEFAULT_SITE_SETTINGS: SiteSettings = {
  hero: {
    eyebrow: 'HITOMAP — まちの痕跡と感情の地図',
    headline_lines: ['その色あせも、', '誰かが生きた証です。'],
    subcopy:
      'まちで見つけた痕跡を、写真と一言で地図に残せます。' +
      '記録が重なると、町ごとの感情の濃淡が浮かび上がります。' +
      '名所を見るのではなく、人に会いに行く旅がここから始まります。',
    cta_label: '地図をひらく — 無料',
    cta_href: '/start',
    sub_link_label: '使い方を見る →',
    sub_link_href: '/company/service',
    note: 'ログインしなくても、匿名のまま今日から記録できます。',
    biz_link_label: '法人・自治体の方はこちら →',
    biz_link_href: '/company/business',
  },
  announcement: {
    enabled: false,
    text: '',
    href: '',
  },
  home_photo_grid: [],
};

// DBの値（部分的な上書き）と既定値を項目単位で合成する。
// 保存側が一部の項目しか持っていなくても、残りは既定文言で埋まる。
export function mergeSiteSettings(rows: { key: string; value: unknown }[]): SiteSettings {
  const byKey = new Map(rows.map(r => [r.key, r.value]));
  const hero = { ...DEFAULT_SITE_SETTINGS.hero, ...(byKey.get('hero') as Partial<HeroSettings> | undefined) };
  // headline_lines は空配列で保存されると見出しが消えるため、空なら既定に戻す
  if (!Array.isArray(hero.headline_lines) || hero.headline_lines.filter(l => l.trim()).length === 0) {
    hero.headline_lines = DEFAULT_SITE_SETTINGS.hero.headline_lines;
  }
  const announcement = { ...DEFAULT_SITE_SETTINGS.announcement, ...(byKey.get('announcement') as Partial<AnnouncementSettings> | undefined) };
  const rawGrid = byKey.get('home_photo_grid');
  const home_photo_grid = Array.isArray(rawGrid) ? rawGrid.filter((id): id is string => typeof id === 'string') : [];
  return { hero, announcement, home_photo_grid };
}

// サーバー側（ページ描画時）にサイト設定を読む。Supabase未設定・エラー時は既定値。
export async function fetchSiteSettings(): Promise<SiteSettings> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return DEFAULT_SITE_SETTINGS;
  }
  try {
    const { supabaseServer } = await import('@/lib/supabase/server');
    const { data } = await supabaseServer.from('site_settings').select('key, value');
    return mergeSiteSettings(data ?? []);
  } catch {
    return DEFAULT_SITE_SETTINGS;
  }
}
