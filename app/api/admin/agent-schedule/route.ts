// GET/PATCH /api/admin/agent-schedule — 番人（agents/*.py）の実行時刻の一覧・変更。
//
// lib/agents/roster.ts の schedule 文字列がデフォルト値。agent_schedule_overrides に行があれば
// そちらを「有効な時刻」として返す。実際にWindowsタスクスケジューラへ反映するのは
// agents/schedule_sync.py（毎朝05:00起動）で、ここでPATCHしても即座には効かない
// ——次の同期後（翌朝）から有効になる。UI側で必ずその旨を案内すること。
import { NextRequest, NextResponse } from 'next/server';
import { checkAdmin } from '@/lib/adminAuth';
import { isMissingTable, missingTablePayload } from '@/lib/adminApi';
import { SCRIPTS } from '@/lib/agents/roster';

const SUPABASE_READY = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL);
const MIGRATION_FILE = 'supabase/migrations/20260818_add_agent_schedule_overrides.sql';
const KNOWN_AGENT_IDS = new Set(SCRIPTS.map(s => s.id));
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/; // "HH:MM"（24時間表記）

// "毎日 08:25" / "毎週月 09:45" / "毎日 06:30" 等から時刻部分だけを取り出す。
// "every 8h" のような時刻を持たない表現（news_digest等の繰り返し間隔表示）は変更対象外として除外。
function defaultTimeOf(schedule?: string): string | null {
  const m = schedule?.match(/([01]?\d|2[0-3]):([0-5]\d)/);
  if (!m) return null;
  return `${m[1].padStart(2, '0')}:${m[2]}`;
}

export async function GET(req: NextRequest) {
  if (!SUPABASE_READY) return NextResponse.json({ ok: false, error: 'Supabase未設定' }, { status: 503 });
  if (!checkAdmin(req)) return NextResponse.json({ ok: false, error: 'パスワードが違います' }, { status: 401 });

  const { supabaseServer } = await import('@/lib/supabase/server');
  const { data, error } = await supabaseServer.from('agent_schedule_overrides').select('*');

  let overrides: Record<string, string> = {};
  let needsMigration = false;
  if (error) {
    if (isMissingTable(error.message, 'agent_schedule_overrides')) needsMigration = true;
    else return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  } else {
    overrides = Object.fromEntries((data ?? []).map(r => [r.agent_id, r.time]));
  }

  const agents = SCRIPTS.map(s => {
    const defaultTime = defaultTimeOf(s.schedule);
    const overrideTime = overrides[s.id] ?? null;
    return {
      id: s.id, name: s.name, emoji: s.emoji, floor: s.floor,
      scheduleLabel: s.schedule ?? '', defaultTime,
      overrideTime, effectiveTime: overrideTime ?? defaultTime,
      editable: defaultTime !== null,
    };
  }).filter(a => a.effectiveTime !== null)
    .sort((a, b) => (a.effectiveTime! < b.effectiveTime! ? -1 : 1));

  return NextResponse.json(needsMigration ? { ...missingTablePayload('agents', MIGRATION_FILE), agents } : { ok: true, agents });
}

export async function PATCH(req: NextRequest) {
  if (!SUPABASE_READY) return NextResponse.json({ ok: false, error: 'Supabase未設定' }, { status: 503 });
  if (!checkAdmin(req)) return NextResponse.json({ ok: false, error: 'パスワードが違います' }, { status: 401 });

  const body = await req.json().catch(() => ({})) as { agent_id?: string; time?: string | null };
  if (!body.agent_id || !KNOWN_AGENT_IDS.has(body.agent_id)) {
    return NextResponse.json({ ok: false, error: '不明なagent_idです' }, { status: 400 });
  }

  const { supabaseServer } = await import('@/lib/supabase/server');

  // time: null または空文字 → 上書きを削除してデフォルトの時刻に戻す。
  if (!body.time) {
    const { error } = await supabaseServer.from('agent_schedule_overrides').delete().eq('agent_id', body.agent_id);
    if (error) {
      if (isMissingTable(error.message, 'agent_schedule_overrides')) {
        return NextResponse.json({ ok: false, error: `スケジュール変更のテーブルが未作成です。${MIGRATION_FILE} をSQL Editorで実行してください` }, { status: 503 });
      }
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true, reset: true });
  }

  if (!TIME_RE.test(body.time)) {
    return NextResponse.json({ ok: false, error: '時刻は HH:MM 形式で指定してください' }, { status: 400 });
  }

  const { error } = await supabaseServer
    .from('agent_schedule_overrides')
    .upsert({ agent_id: body.agent_id, time: body.time, updated_at: new Date().toISOString() });
  if (error) {
    if (isMissingTable(error.message, 'agent_schedule_overrides')) {
      return NextResponse.json({ ok: false, error: `スケジュール変更のテーブルが未作成です。${MIGRATION_FILE} をSQL Editorで実行してください` }, { status: 503 });
    }
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
