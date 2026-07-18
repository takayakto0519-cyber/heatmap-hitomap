// ============================================================
// 地図タイルの共通定義。国土地理院タイル（地理院タイル）を使う。
// 「行政・自治体向けにはOSMより国土地理院の方が信頼できる」という
// フィードバックを受け、全ての地図表示（TraceMap/RouteMap/LocationPickerMap）を統一する。
// 参照：https://maps.gsi.go.jp/development/ichiran.html
// ============================================================

// 淡色地図（pale）。多色の標準地図(std)より無彩色で情報量が控えめなため、
// 感情ピン・ヒートが主役として映える（白基調ミニマルと最も整合。20260718）。
// ズーム0〜18に対応。まちの痕跡地図として十分な精細度。地理院タイルのため行政信頼性も維持。
export const GSI_TILE_URL = 'https://cyberjapandata.gsi.go.jp/xyz/pale/{z}/{x}/{y}.png';
export const GSI_ATTRIBUTION =
  '<a href="https://maps.gsi.go.jp/development/ichiran.html" target="_blank" rel="noopener noreferrer">地理院タイル</a>';
export const GSI_MAX_ZOOM = 18;

// 淡色タイルをさらに上品な無彩色寄りに整える微フィルタは、タイル境界の継ぎ目を避けるため
// タイル画像単位ではなく .leaflet-tile-pane 全体にCSSで適用する（app/layout.tsx の共通styleに定義）。
