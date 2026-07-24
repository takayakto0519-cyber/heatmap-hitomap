import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

// 運営ダッシュボード（/admin, /api/admin）の二重の鍵。
// 1枚目＝ここ（ブラウザ標準のBasic認証。アプリのコード・バンドルが読み込まれる前に弾く）。
// 2枚目＝lib/adminAuth.ts の checkAdmin（x-admin-passwordヘッダ、既存のアプリ内パスワード）。
// ADMIN_GATE_USER/ADMIN_GATE_PASSWORD が未設定の環境（ローカル開発等）では、
// 従来どおり2枚目だけで動く（設定を強制しない）。
// 2026-07-24：URLの非公開・パスワード1本だけでは弱いという指摘を受けて追加。
function checkBasicAuth(request: NextRequest): boolean {
  const user = process.env.ADMIN_GATE_USER;
  const pass = process.env.ADMIN_GATE_PASSWORD;
  if (!user || !pass) return true;

  const header = request.headers.get('authorization');
  if (!header?.startsWith('Basic ')) return false;
  try {
    const [u, p] = atob(header.slice(6)).split(':');
    return u === user && p === pass;
  } catch {
    return false;
  }
}

const UNAUTHORIZED = new NextResponse('Authentication required', {
  status: 401,
  headers: { 'WWW-Authenticate': 'Basic realm="Hitomap Admin"' },
});

// Supabase Auth のセッションCookieをリクエストごとにリフレッシュする標準パターン
export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;
  if ((path.startsWith('/admin') || path.startsWith('/api/admin')) && !checkBasicAuth(request)) {
    return UNAUTHORIZED;
  }

  let response = NextResponse.next({ request: { headers: request.headers } });

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    return response;
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        // 認証トークンは複数のCookieに分割されてset/removeが何度も呼ばれる。
        // ここでresponseを毎回作り直すと、直前に書き込んだCookieが消えて最後の1つしか
        // 返らなくなり、トークン更新のタイミングでログアウトしたように見えるバグになっていた。
        // responseは冒頭で1つ作ったものを使い回し、Cookieだけ都度追加する。
        set(name: string, value: string, options) {
          request.cookies.set({ name, value, ...options });
          response.cookies.set({ name, value, ...options });
        },
        remove(name: string, options) {
          request.cookies.set({ name, value: '', ...options });
          response.cookies.set({ name, value: '', ...options });
        },
      },
    }
  );

  await supabase.auth.getUser();
  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
