// 公開書き込みAPI共通のインメモリ・レート制限。
// app/api/bonno/route.ts で使っていた方式を共通化したもの：IPごとに時間窓内の回数を数える。
// サーバーレスで複数インスタンスに分散されると完全には効かないが、
// 単純な連投スクリプト・荒らし対策としては十分（本格的な対策が要る規模になったら外部KVへ）。
import type { NextRequest } from 'next/server';

interface Entry { count: number; windowStart: number }

const buckets = new Map<string, Map<string, Entry>>(); // scope → ip → entry

function clientIp(req: NextRequest): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    ?? req.headers.get('x-real-ip')
    ?? 'unknown';
}

/**
 * scope（API名）ごとに独立した窓でIP別の回数を数え、超過していれば true を返す。
 * 呼び出し例: if (isRateLimited(req, 'traces', 60_000, 10)) return 429;
 */
export function isRateLimited(req: NextRequest, scope: string, windowMs: number, maxPosts: number): boolean {
  let bucket = buckets.get(scope);
  if (!bucket) {
    bucket = new Map();
    buckets.set(scope, bucket);
  }

  // 窓が過ぎた古いIPの掃除（アクセスのたびに軽く間引く。放置するとMapが際限なく育つ）
  if (bucket.size > 1000) {
    const now = Date.now();
    for (const [ip, e] of bucket) {
      if (now - e.windowStart >= windowMs) bucket.delete(ip);
    }
  }

  const ip = clientIp(req);
  const now = Date.now();
  const entry = bucket.get(ip);
  if (!entry || now - entry.windowStart >= windowMs) {
    bucket.set(ip, { count: 1, windowStart: now });
    return false;
  }
  entry.count += 1;
  return entry.count > maxPosts;
}
