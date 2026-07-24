// 運営ダッシュボード内部の運用設定（app_settings）の型・既定値・読み込みヘルパー。
// site_settings（トップページ文言・公開サイトに直結しrevalidateSitePages()を伴う）とは
// 意図的に分離する。営業ノルマのような「サイトの顔」ではない内部運用値をここに置く。

export interface SalesTargets {
  dailySendTarget: number; // 1日に送るべきメール件数の目標
}

export const DEFAULT_SALES_TARGETS: SalesTargets = {
  dailySendTarget: 10,
};

export function mergeSalesTargets(rows: { key: string; value: unknown }[]): SalesTargets {
  const byKey = new Map(rows.map(r => [r.key, r.value]));
  const stored = byKey.get('sales_targets') as Partial<SalesTargets> | undefined;
  const merged = { ...DEFAULT_SALES_TARGETS, ...stored };
  if (!Number.isFinite(merged.dailySendTarget) || merged.dailySendTarget <= 0) {
    merged.dailySendTarget = DEFAULT_SALES_TARGETS.dailySendTarget;
  }
  return merged;
}

export async function fetchSalesTargets(): Promise<SalesTargets> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return DEFAULT_SALES_TARGETS;
  }
  try {
    const { supabaseServer } = await import('@/lib/supabase/server');
    const { data } = await supabaseServer.from('app_settings').select('key, value').eq('key', 'sales_targets');
    return mergeSalesTargets(data ?? []);
  } catch {
    return DEFAULT_SALES_TARGETS;
  }
}
