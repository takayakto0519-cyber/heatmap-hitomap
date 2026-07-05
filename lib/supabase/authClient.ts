// ブラウザ用 Supabase クライアント（Cookieベースのログインセッション管理）
import { createBrowserClient } from '@supabase/ssr';

export function createAuthBrowserClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
