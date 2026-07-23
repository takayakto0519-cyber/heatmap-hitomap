// GET/POST /api/admin/biz-model-events — 事業ラインの伴走ログ（打ち合わせ・決定事項・マイルストーン）
import { NextRequest, NextResponse } from 'next/server';
import { checkAdmin } from '@/lib/adminAuth';
import { isMissingTable, missingTablePayload } from '@/lib/adminApi';

const SUPABASE_READY = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL);
const MIGRATION_FILE = 'supabase/migrations/20260723b_add_biz_model_dashboard.sql';
const EVENT_TYPES = new Set(['meeting', 'decision', 'milestone', 'note']);

export async function GET(req: NextRequest) {
  if (!SUPABASE_READY) return NextResponse.json({ ok: false, error: 'Supabase未設定' }, { status: 503 });
  if (!checkAdmin(req)) return NextResponse.json({ ok: false, error: 'パスワードが違います' }, { status: 401 });

  const bizModelIdeaId = req.nextUrl.searchParams.get('biz_model_idea_id');
  const { supabaseServer } = await import('@/lib/supabase/server');
  let query = supabaseServer.from('biz_model_events').select('*').order('occurred_at', { ascending: false });
  if (bizModelIdeaId) query = query.eq('biz_model_idea_id', bizModelIdeaId);
  const { data, error } = await query;

  if (error) {
    if (isMissingTable(error.message, 'biz_model_events')) return NextResponse.json(missingTablePayload('events', MIGRATION_FILE));
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, events: data ?? [] });
}

export async function POST(req: NextRequest) {
  if (!SUPABASE_READY) return NextResponse.json({ ok: false, error: 'Supabase未設定' }, { status: 503 });
  if (!checkAdmin(req)) return NextResponse.json({ ok: false, error: 'パスワードが違います' }, { status: 401 });

  const body = await req.json().catch(() => ({})) as {
    biz_model_idea_id?: string; event_type?: string; title?: string; body?: string | null; occurred_at?: string | null;
  };
  if (!body.biz_model_idea_id) return NextResponse.json({ ok: false, error: 'biz_model_idea_idは必須です' }, { status: 400 });
  if (!body.title?.trim()) return NextResponse.json({ ok: false, error: 'タイトルは必須です' }, { status: 400 });
  if (body.event_type && !EVENT_TYPES.has(body.event_type)) return NextResponse.json({ ok: false, error: '種別が不正です' }, { status: 400 });

  const { supabaseServer } = await import('@/lib/supabase/server');
  const { data, error } = await supabaseServer
    .from('biz_model_events')
    .insert({
      biz_model_idea_id: body.biz_model_idea_id,
      event_type: body.event_type ?? 'note',
      title: body.title.trim(),
      body: body.body?.trim() || null,
      occurred_at: body.occurred_at || new Date().toISOString(),
    })
    .select().single();

  if (error) {
    if (isMissingTable(error.message, 'biz_model_events')) {
      return NextResponse.json({ ok: false, error: `伴走ログのテーブルが未作成です。${MIGRATION_FILE} をSQL Editorで実行してください` }, { status: 503 });
    }
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, event: data });
}
