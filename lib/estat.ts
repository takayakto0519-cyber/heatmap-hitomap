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

// 感情ヒートマップと組み合わせる「自治体単位の人口統計」用の統計表ID（国勢調査・昼夜間人口比率、市区町村単位）。
// e-Stat統計表検索( https://www.e-stat.go.jp/stat-search )で会長が事前に1つ確定させ、
// 環境変数 ESTAT_CENSUS_STATS_DATA_ID に設定する（自治体ごとに変わるものではなく、
// cdAreaで自治体を絞り込む共通の統計表IDのはず）。
export function requireCensusStatsDataId(): string {
  const id = process.env.ESTAT_CENSUS_STATS_DATA_ID;
  if (!id) {
    throw new Error('ESTAT_CENSUS_STATS_DATA_ID が未設定です。e-Stat統計表検索で昼夜間人口比率（市区町村単位）の統計表IDを調べて設定してください');
  }
  return id;
}

// e-Statの getStatsData レスポンスから、最初に見つかった数値を「昼夜間人口比率」として取り出す簡易パーサー。
// e-Statのレスポンス構造は統計表ごとに細部が異なるため、実際のstatsDataIdが決まって
// レスポンス例を確認した際にはこの関数の調整が必要になる可能性がある。
export function extractDayNightRatio(estatResponse: unknown): { value: number; time?: string } | null {
  try {
    const dataInf = (estatResponse as Record<string, any>)?.GET_STATS_DATA?.STATISTICAL_DATA?.DATA_INF;
    const values = dataInf?.VALUE;
    const list = Array.isArray(values) ? values : values ? [values] : [];
    if (list.length === 0) return null;
    const first = list[0] as Record<string, unknown>;
    const raw = first['$'] ?? first['@value'];
    const value = typeof raw === 'string' ? parseFloat(raw) : typeof raw === 'number' ? raw : NaN;
    if (!Number.isFinite(value)) return null;
    const time = typeof first['@time'] === 'string' ? (first['@time'] as string) : undefined;
    return { value, time };
  } catch {
    return null;
  }
}
