// GET /api/admin/command-center — 統合司令室AI（command_center）の「今すぐ判断が要ること」を返す。
// agents/command_center.py が work/command_center.json に書く結果を、
// ローカル（会長の開発機）ではファイルから直接、本番（Vercel等）では agent_status_snapshot の
// command_center 行の result から読む。agent-status/route.ts と同じ local→snapshot フォールバック。
import { NextResponse } from 'next/server';
import { NextRequest } from 'next/server';
import { checkAdmin } from '@/lib/adminAuth';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

interface AttentionItem { agent_id: string; floor: string; name: string; headline: string }
interface CommandCenterResult {
  total_agents_tracked?: number;
  attention_count?: number;
  attention_items?: AttentionItem[];
  floors?: unknown[];
  generated_at?: string;
}

function readJson(filePath: string): CommandCenterResult | null {
  try { return JSON.parse(fs.readFileSync(filePath, 'utf-8')); } catch { return null; }
}

export async function GET(req: NextRequest) {
  if (!checkAdmin(req)) return NextResponse.json({ ok: false, error: 'パスワードが違います' }, { status: 401 });

  // ローカル：work/command_center.json を直接読む
  const localPath = path.join(process.cwd(), 'agents', 'work', 'command_center.json');
  const local = readJson(localPath);
  if (local) {
    return NextResponse.json({ ok: true, source: 'local', result: local });
  }

  // 本番：スナップショットの command_center 行を読む
  if (process.env.NEXT_PUBLIC_SUPABASE_URL) {
    try {
      const { supabaseServer } = await import('@/lib/supabase/server');
      const { data, error } = await supabaseServer
        .from('agent_status_snapshot')
        .select('result, synced_at')
        .eq('agent_id', 'command_center')
        .maybeSingle();
      if (!error && data?.result) {
        return NextResponse.json({ ok: true, source: 'synced', syncedAt: data.synced_at, result: data.result });
      }
    } catch {
      // 未設定・未同期でもエラーにしない
    }
  }

  return NextResponse.json({ ok: true, source: 'none', result: null });
}
