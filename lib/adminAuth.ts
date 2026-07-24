// 管理画面のパスワード認証。単一パスワード方式であることは変えないが、
// ブルートフォース対策として IP ごとの失敗回数を時間窓で制限する。
// 注意：メモリ上のカウンタなので、サーバーレス環境で複数インスタンスに分散されると
// 制限が完全には効かない場合がある（それでも無制限よりは大幅に安全）。
import type { NextRequest } from 'next/server';

const WINDOW_MS = 15 * 60 * 1000; // 15分
const MAX_ATTEMPTS = 20; // この回数を超えて失敗したIPは、正しいパスワードでも一時的に拒否する

const failedAttempts = new Map<string, { count: number; windowStart: number }>();

// x-forwarded-forの「先頭」は、リバースプロキシに届く前にクライアント自身が
// 送ってきた値をそのまま信頼してしまう（"偽IP, 本物のIP" のように偽装できる）。
// Vercel等のプロキシは実際のクライアントIPをチェーンの末尾に追記する挙動のため、
// 末尾側を優先する方が偽装されにくい。x-real-ipはプロキシが単一値で上書きする
// ことが多いのでそちらを最優先にする。
// 2026-07-24：IPを偽装してブルートフォースのレート制限を回避できる可能性の指摘を受けて修正。
// 完全な対策ではない（ヘッダに依存する限りアプリコードだけでは限界がある）ことに留意。
function clientIp(req: NextRequest): string {
  const realIp = req.headers.get('x-real-ip');
  if (realIp) return realIp.trim();

  const chain = req.headers.get('x-forwarded-for');
  if (chain) {
    const parts = chain.split(',').map(s => s.trim()).filter(Boolean);
    if (parts.length > 0) return parts[parts.length - 1];
  }

  return 'unknown';
}

export function checkAdmin(req: NextRequest): boolean {
  const ip = clientIp(req);
  const now = Date.now();
  const entry = failedAttempts.get(ip);

  if (entry && now - entry.windowStart < WINDOW_MS && entry.count >= MAX_ATTEMPTS) {
    return false;
  }

  const provided = req.headers.get('x-admin-password');
  const expected = process.env.ADMIN_PASSWORD;
  const ok = Boolean(expected) && provided === expected;

  if (!ok) {
    if (!entry || now - entry.windowStart >= WINDOW_MS) {
      failedAttempts.set(ip, { count: 1, windowStart: now });
    } else {
      entry.count += 1;
    }
  } else if (entry) {
    failedAttempts.delete(ip);
  }

  return ok;
}
