// GET /api/admin/agent-status — ローカルAIエージェント（agents/*.py、Windowsタスクスケジューラ登録）の
// 稼働状況を運営ダッシュボードに統合するための読み取り専用API。
// agent-dashboard/server.py（ヒトマップビルUI）が読んでいるのと同じ agents/work/*.json をNode fsで直接読む。
// ※ agents/ ディレクトリはこのPC（会長の開発機）だけに存在するローカルファイルのため、
//   hitomap.com（本番・Vercel等）からアクセスした場合はローカルファイルが無く local:false を返す。
//   会長がこのPC上で `npm run dev` してアクセスしたときだけ実データが見える設計。
//
// フロア定義・番人一覧・空きオフィス一覧は lib/agents/roster.ts が一次情報源（単一の真実の源）。
// 以前はここ・agents/sync_status_to_supabase.py・agent-dashboard/server.py の3箇所に
// 同じ配列を三重管理していたが、roster.ts に集約した。新しい番人はroster.tsに追記する。
import { NextResponse } from 'next/server';
import { NextRequest } from 'next/server';
import { checkAdmin } from '@/lib/adminAuth';
import { FLOORS, SCRIPTS as LOCAL_AGENTS, VACANT } from '@/lib/agents/roster';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

// 稼働状況タブが期待する空きオフィスの形（{floor,num,name}）に変換。
// roster上は原則すべて実装済み（未着工0）だが、将来また空きが出た場合に備えて残す。
const VACANT_AGENTS = VACANT.map(v => ({ floor: v.floor, num: v.num ?? 0, name: v.name }));

function xpToLevel(total: number) {
  return { level: 1 + Math.floor(total / 5), xp: total, into: total % 5, need: 5 };
}

function readJson(filePath: string): Record<string, unknown> | null {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  if (!checkAdmin(req)) return NextResponse.json({ ok: false, error: 'パスワードが違います' }, { status: 401 });

  const workDir = path.join(process.cwd(), 'agents', 'work');
  if (!fs.existsSync(workDir)) {
    // hitomap.com（本番）等、ローカルファイルが無い環境から見た場合は、
    // agents/sync_status_to_supabase.py が定期的に書き込んでいるSupabaseの
    // スナップショットを代わりに読む（＝会長がローカルPCを最後に同期した時点の状況）。
    if (process.env.NEXT_PUBLIC_SUPABASE_URL) {
      try {
        // データキャッシュに載ると古い稼働状況が返り続けるため、必ず最新を読むクライアントを使う
        const { supabaseServerFresh } = await import('@/lib/supabase/server');
        const { data, error } = await supabaseServerFresh.from('agent_status_snapshot').select('*');
        if (!error && data && data.length > 0) {
          const agents = data.map(row => ({
            id: row.agent_id, name: row.name, emoji: row.emoji, floor: row.floor, schedule: row.schedule,
            status: 'synced' as const,
            result: row.result,
            generatedAt: row.generated_at,
            syncedAt: row.synced_at,
            level: row.level, xp: row.xp,
          }));
          return NextResponse.json({ ok: true, local: false, synced: true, floors: FLOORS, agents, vacant: VACANT_AGENTS });
        }
      } catch {
        // Supabase未設定・テーブル未作成でもエラーにはせず、下のlocal:falseにフォールバックする
      }
    }
    return NextResponse.json({ ok: true, local: false, synced: false, floors: FLOORS, vacant: VACANT_AGENTS });
  }

  const xp = readJson(path.join(workDir, 'xp.json')) ?? {};

  const agents = LOCAL_AGENTS.map(meta => {
    const flagPath = path.join(workDir, `${meta.id}.flag`);
    const resultPath = path.join(workDir, `${meta.id}.json`);
    const working = fs.existsSync(flagPath);
    const result = readJson(resultPath);
    const xpRec = (xp as Record<string, { total?: number }>)[meta.id] ?? {};
    const level = xpToLevel(Number(xpRec.total ?? 0));
    return {
      id: meta.id, name: meta.name, emoji: meta.emoji, floor: meta.floor, schedule: meta.schedule,
      status: working ? 'working' : 'resting',
      result,
      generatedAt: (result?.generated_at as string | undefined) ?? null,
      level: level.level, xp: level.xp,
    };
  });

  return NextResponse.json({ ok: true, local: true, floors: FLOORS, agents, vacant: VACANT_AGENTS });
}
