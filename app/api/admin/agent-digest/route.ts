// GET /api/admin/agent-digest?ids=competitor_market_research,global_market_watch
//
// 番人（agents/*.py）が集めてきた調査結果の「中身」を、指定したものだけ返す読み取り専用API。
//
// 既存の /api/admin/agent-status は約30体分を結果込みで返すため、
// competitor_market_research だけで13KBというサイズになる（しかも稼働状況タブは1行に潰して捨てている）。
// 提案タブが欲しいのは2〜3体のフル結果だけなので、ids指定で絞って返すこちらを用意した。
// 構造は command-center/route.ts と同じ local→snapshot フォールバック。
//
// データの流れ（Python側の変更は不要）:
//   agents/*.py → agents/work/<id>.json → sync_status_to_supabase.py が result 丸ごと同期
//   → agent_status_snapshot.result → 本番はここを読む
import { NextResponse } from 'next/server';
import { NextRequest } from 'next/server';
import { checkAdmin } from '@/lib/adminAuth';
import { SCRIPTS } from '@/lib/agents/roster';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

interface DigestAgent {
  id: string;
  name: string;
  emoji: string;
  schedule: string;
  generatedAt: string | null;
  result: Record<string, unknown> | null;
}

function readJson(filePath: string): Record<string, unknown> | null {
  try { return JSON.parse(fs.readFileSync(filePath, 'utf-8')); } catch { return null; }
}

export async function GET(req: NextRequest) {
  if (!checkAdmin(req)) return NextResponse.json({ ok: false, error: 'パスワードが違います' }, { status: 401 });

  // roster.ts が番人名簿の一次情報源。ここに無いidは黙って無視する（存在しないidを渡されてもエラーにしない）
  const requested = (req.nextUrl.searchParams.get('ids') ?? '').split(',').map(s => s.trim()).filter(Boolean);
  const metas = requested
    .map(id => SCRIPTS.find(s => s.id === id))
    .filter((m): m is NonNullable<typeof m> => Boolean(m));
  if (metas.length === 0) return NextResponse.json({ ok: true, source: 'none', agents: [] });

  // 会長の開発機には agents/work があるため local 分岐が必ず勝ち、本番専用パス（snapshot）を
  // 手元で一度も踏めない。?source=snapshot を付けるとローカルでも本番と同じ経路を確認できる。
  const forceSnapshot = req.nextUrl.searchParams.get('source') === 'snapshot';

  if (!forceSnapshot) {
    const workDir = path.join(process.cwd(), 'agents', 'work');
    if (fs.existsSync(workDir)) {
      const agents: DigestAgent[] = metas.map(m => {
        const result = readJson(path.join(workDir, `${m.id}.json`));
        return {
          id: m.id, name: m.name, emoji: m.emoji, schedule: m.schedule ?? '',
          generatedAt: (result?.generated_at as string) ?? null,
          result,
        };
      });
      return NextResponse.json({ ok: true, source: 'local', syncedAt: null, agents });
    }
  }

  // 本番（Vercel等）：会長のPCが最後に同期した時点のスナップショットを読む
  if (process.env.NEXT_PUBLIC_SUPABASE_URL) {
    try {
      // データキャッシュに載ると古い調査結果が返り続けるため、必ず最新を読むクライアントを使う
      const { supabaseServerFresh } = await import('@/lib/supabase/server');
      const { data, error } = await supabaseServerFresh
        .from('agent_status_snapshot')
        .select('agent_id, result, generated_at, synced_at')
        .in('agent_id', metas.map(m => m.id));
      if (!error && data) {
        const byId = new Map(data.map(row => [row.agent_id, row]));
        const agents: DigestAgent[] = metas.map(m => {
          const row = byId.get(m.id);
          return {
            id: m.id, name: m.name, emoji: m.emoji, schedule: m.schedule ?? '',
            generatedAt: row?.generated_at ?? null,
            result: (row?.result as Record<string, unknown>) ?? null,
          };
        });
        // 同期時刻は行ごとに持っているが、画面では「最後にPCが送った時点」を1つ出せば足りるので最新を採る
        const syncedAt = data.map(r => r.synced_at).filter(Boolean).sort().at(-1) ?? null;
        return NextResponse.json({ ok: true, source: 'synced', syncedAt, agents });
      }
    } catch {
      // 未設定・テーブル未作成でもエラーにはせず、下の none にフォールバックする
    }
  }

  return NextResponse.json({ ok: true, source: 'none', syncedAt: null, agents: [] });
}
