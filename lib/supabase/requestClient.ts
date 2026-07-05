// リクエストスコープの Supabase クライアント（Cookieからログインユーザーを判定する用）
// API routes / Server Components から呼ぶ。service-role固定の server.ts とは別物。
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export function createRequestClient() {
  const cookieStore = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options) {
          try {
            cookieStore.set(name, value, options);
          } catch {
            // Server Component から呼ばれた場合は書き込み不可（middlewareでリフレッシュされるため無視でよい）
          }
        },
        remove(name: string, options) {
          try {
            cookieStore.set(name, '', { ...options, maxAge: 0 });
          } catch {
            // 同上
          }
        },
      },
    }
  );
}

/** ログイン中のユーザーIDを取得（未ログインなら null） */
export async function getCurrentUserId(): Promise<string | null> {
  const supabase = createRequestClient();
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}
