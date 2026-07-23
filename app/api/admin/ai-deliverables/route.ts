// GET/POST /api/admin/ai-deliverables — AIが作った成果物の作業場。
// AIは実体テーブルへ直接書かず、ここに status='proposed' で積む。会長が承認したときだけ
// [id]/route.ts の PATCH が実体テーブルへ反映する。差し戻し・作り直しの履歴もここに残る。
import { NextRequest, NextResponse } from 'next/server';
import { checkAdmin } from '@/lib/adminAuth';
import { isMissingTable, missingTablePayload } from '@/lib/adminApi';
import { KINDS, isKind } from '@/lib/deliverables';

const SUPABASE_READY = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL);
const MIGRATION_FILE = 'supabase/migrations/20260816_add_ai_deliverables.sql';

export async function GET(req: NextRequest) {
  if (!SUPABASE_READY) return NextResponse.json({ ok: false, error: 'Supabase未設定' }, { status: 503 });
  if (!checkAdmin(req)) return NextResponse.json({ ok: false, error: 'パスワードが違います' }, { status: 401 });

  const sp = req.nextUrl.searchParams;
  const { supabaseServer } = await import('@/lib/supabase/server');
  let query = supabaseServer.from('ai_deliverables').select('*').order('created_at', { ascending: false });
  for (const key of ['entity_type', 'entity_id', 'kind', 'status'] as const) {
    const v = sp.get(key);
    if (v) query = query.eq(key, v);
  }
  // 既定では却下済みを隠す（会長が見るのは提案中・差し戻し中・承認済みだけ）
  if (!sp.get('status') && sp.get('include_archived') !== '1') query = query.neq('status', 'archived');

  const { data, error } = await query;
  if (error) {
    if (isMissingTable(error.message, 'ai_deliverables')) return NextResponse.json(missingTablePayload('deliverables', MIGRATION_FILE));
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, deliverables: data ?? [] });
}

export async function POST(req: NextRequest) {
  if (!SUPABASE_READY) return NextResponse.json({ ok: false, error: 'Supabase未設定' }, { status: 503 });
  if (!checkAdmin(req)) return NextResponse.json({ ok: false, error: 'パスワードが違います' }, { status: 401 });

  const body = await req.json().catch(() => ({})) as {
    entity_type?: string; entity_id?: string | null; kind?: string;
    title?: string; body?: string; ai_note?: string | null; sources?: string | null;
    supersedes_id?: string | null;
  };
  if (!body.entity_type?.trim()) return NextResponse.json({ ok: false, error: 'entity_typeは必須です' }, { status: 400 });
  if (!isKind(body.kind)) return NextResponse.json({ ok: false, error: `kindが不正です（${KINDS.join('|')}）` }, { status: 400 });
  if (!body.title?.trim()) return NextResponse.json({ ok: false, error: 'タイトルは必須です' }, { status: 400 });

  const { supabaseServer } = await import('@/lib/supabase/server');

  // 作り直しの場合は前リビジョンを引き継ぐ。前の行は archived にして一覧を汚さない
  // （履歴は supersedes_id を辿れば読めるので消さない）。
  let revision = 1;
  if (body.supersedes_id) {
    const { data: prev } = await supabaseServer
      .from('ai_deliverables').select('revision').eq('id', body.supersedes_id).single();
    revision = (prev?.revision ?? 1) + 1;
    await supabaseServer.from('ai_deliverables')
      .update({ status: 'archived', updated_at: new Date().toISOString() }).eq('id', body.supersedes_id);
  }

  const { data, error } = await supabaseServer
    .from('ai_deliverables')
    .insert({
      entity_type: body.entity_type.trim(),
      entity_id: body.entity_id || null,
      kind: body.kind,
      status: 'proposed',
      title: body.title.trim(),
      body: body.body ?? '',
      ai_note: body.ai_note?.trim() || null,
      sources: body.sources?.trim() || null,
      revision,
      supersedes_id: body.supersedes_id || null,
    })
    .select().single();

  if (error) {
    if (isMissingTable(error.message, 'ai_deliverables')) {
      return NextResponse.json({ ok: false, error: `AI成果物のテーブルが未作成です。${MIGRATION_FILE} をSQL Editorで実行してください` }, { status: 503 });
    }
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, deliverable: data });
}
