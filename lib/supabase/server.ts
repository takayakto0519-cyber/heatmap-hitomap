// サーバー(APIルート)用 Supabase クライアント
// MVPでは匿名キーで十分（RLSで insert/select のみ許可）。
// 将来 Googleフォーム中継などで権限を絞る場合は service_role を環境変数で差し替える。
import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabaseServer = createClient(url, key, {
  auth: { persistSession: false },
});
