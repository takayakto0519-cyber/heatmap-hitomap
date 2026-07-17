// ============================================================
// 地図タイルの共通定義。国土地理院タイル（地理院タイル）を使う。
// 「行政・自治体向けにはOSMより国土地理院の方が信頼できる」という
// フィードバックを受け、全ての地図表示（TraceMap/RouteMap/LocationPickerMap）を統一する。
// 参照：https://maps.gsi.go.jp/development/ichiran.html
// ============================================================

// 標準地図（std）。ズーム0〜18に対応。まちの痕跡地図として十分な精細度。
export const GSI_TILE_URL = 'https://cyberjapandata.gsi.go.jp/xyz/std/{z}/{x}/{y}.png';
export const GSI_ATTRIBUTION =
  '<a href="https://maps.gsi.go.jp/development/ichiran.html" target="_blank" rel="noopener noreferrer">地理院タイル</a>';
export const GSI_MAX_ZOOM = 18;
