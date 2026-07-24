// 運営ダッシュボード（/admin/dashboard 以下）共通トークン。
// corpColor/appColor と同じ苔色（#566246）を基調にして、本体サイトと同じブランドの上に
// 「作業画面としての速さ・見やすさ」を保つ。28タブ全てを書き換えるのではなく、
// 常時表示されるシェル（サイドバー・ヘッダー）とホームタブから適用し、
// 見た目の一貫性をそこから広げていく。
export const adminColor = {
  bg: '#F4F6F5',
  surface: '#FFFFFF',
  surfaceSoft: '#FAFAF9',
  sidebarFrom: '#1B2420',   // サイドバーの上端（苔色寄りの深緑）
  sidebarTo: '#14181A',     // サイドバーの下端（ほぼ墨）
  sidebarActive: 'rgba(255,255,255,0.12)',
  sidebarHover: 'rgba(255,255,255,0.06)',
  ink: '#23231F',
  inkSoft: '#6B7280',
  line: '#E5E8E7',
  lineSoft: '#EDEFEE',
  accent: '#566246',        // corpColor.moss と同値（唯一のブランドアクセント）
  accentSoft: '#EDF1E9',
  danger: '#E55039',
  dangerSoft: '#FFF1EE',
} as const;

export const adminRadius = { sm: 8, md: 12, lg: 16, pill: 999 } as const;

export const adminShadow = {
  card: '0 1px 2px rgba(35,35,31,.05), 0 10px 24px -16px rgba(35,35,31,.16)',
  cardHover: '0 16px 32px -18px rgba(35,35,31,.26)',
} as const;
