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

// 常に最新を読むクライアント。
// supabase-js は内部で fetch を使うため、Next.js のデータキャッシュに載ってしまい、
// ルートに dynamic='force-dynamic' を付けていても古いレスポンスが返り続けることがある
// （実際に本番で、統合司令室の要注意項目が20時間以上前の内容のまま表示される事象が起きた）。
// 運営ダッシュボードのように「今の状態」を見る画面では必ずこちらを使う。
export const supabaseServerFresh = createClient(url, key, {
  auth: { persistSession: false },
  global: {
    fetch: (input, init) => fetch(input, { ...init, cache: 'no-store' }),
  },
});
