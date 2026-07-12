// e-Stat API（政府統計の総合窓口）連携ヘルパー。
// RESAS APIは2025年3月に提供終了したため、無料で使える代替として e-Stat を採用する。
// 利用にはe-Stat（https://www.e-stat.go.jp/mypage/user/preLogin）で無料アカウント登録し、
// マイページ →「API機能（アプリケーションID発行）」から取得したIDを
// 環境変数 ESTAT_APP_ID に設定する必要がある（アカウント作成自体はユーザー本人の操作が必要）。
const ESTAT_BASE = 'https://api.e-stat.go.jp/rest/3.0/app/json';

export function isEstatConfigured(): boolean {
  return Boolean(process.env.ESTAT_APP_ID);
}

interface EstatStatsDataParams {
  statsDataId: string; // 対象の統計表ID（観光庁の宿泊旅行統計調査など、e-Statの統計表検索から調べて指定する）
  cdArea?: string;      // 地域コード（都道府県・市区町村コード）で絞り込む場合
}

// 統計表から数値データを取得する（getStatsData）。
// 具体的にどの統計表（statsDataId）を使うかは、比較したい指標（観光客数・宿泊者数等）に応じて
// e-Statの統計表検索( https://www.e-stat.go.jp/stat-search )で調べて呼び出し側が指定する。
export async function fetchEstatStatsData(params: EstatStatsDataParams) {
  const appId = process.env.ESTAT_APP_ID;
  if (!appId) {
    throw new Error('ESTAT_APP_ID が未設定です。e-StatでアプリケーションIDを取得して設定してください');
  }
  const url = new URL(`${ESTAT_BASE}/getStatsData`);
  url.searchParams.set('appId', appId);
  url.searchParams.set('statsDataId', params.statsDataId);
  if (params.cdArea) url.searchParams.set('cdArea', params.cdArea);

  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`e-Stat APIエラー: ${res.status}`);
  return res.json();
}
