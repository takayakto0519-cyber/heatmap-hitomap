// 営業デモ用の合成データ（scripts/seed-demo-sales-data.mjs）を識別するための共通ヘルパー。
// 普段の運営ダッシュボードでは会長の実際の営業データにノイズとして混ざらないよう既定で除外し、
// 商談デモの前後だけ意図的に表示できるようにする（各APIの ?includeDemo=true で切り替え）。
export const DEMO_SESSION_CODE = 'demo-sales-20260720';
export const DEMO_TITLE_PREFIX = '【デモ】';

export function isDemoLead(lead: { memo?: string | null; org_name?: string | null }): boolean {
  return lead.memo === DEMO_SESSION_CODE || Boolean(lead.org_name?.startsWith(DEMO_TITLE_PREFIX));
}

export function isDemoTrace(trace: { session_code?: string | null; title?: string | null }): boolean {
  return trace.session_code === DEMO_SESSION_CODE || Boolean(trace.title?.startsWith(DEMO_TITLE_PREFIX));
}
