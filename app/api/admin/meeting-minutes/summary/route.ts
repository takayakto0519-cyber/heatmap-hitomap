// GET/PUT /api/admin/meeting-minutes/summary — 議事録の統合まとめ（直近3日＋過去分）
// このまとめはアプリ内でAI APIを自動呼び出しして生成するものではなく、
// 会長がチャットでClaude Codeに指示した時にPUTで書き込む運用（meeting_minutes_summaryは単一行）。
import { NextRequest, NextResponse } from 'next/server';
import { checkAdmin } from '@/lib/adminAuth';

const SUPABASE_READY = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL);

export async function GET(req: NextRequest) {
  if (!SUPABASE_READY) return NextResponse.json({ ok: false, error: 'Supabase未設定' }, { status: 503 });
  if (!checkAdmin(req)) return NextResponse.json({ ok: false, error: 'パスワードが違います' }, { status: 401 });

  const { supabaseServer } = await import('@/lib/supabase/server');
  const { data, error } = await supabaseServer
    .from('meeting_minutes_summary').select('*').eq('id', 'main').maybeSingle();

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, summary: data ?? { id: 'main', summary: '', covers_through: null, updated_at: null } });
}

export async function PUT(req: NextRequest) {
  if (!SUPABASE_READY) return NextResponse.json({ ok: false, error: 'Supabase未設定' }, { status: 503 });
  if (!checkAdmin(req)) return NextResponse.json({ ok: false, error: 'パスワードが違います' }, { status: 401 });

  const body = await req.json().catch(() => ({})) as { summary?: string; covers_through?: string | null };
  if (typeof body.summary !== 'string') return NextResponse.json({ ok: false, error: 'summaryは必須です' }, { status: 400 });

  const { supabaseServer } = await import('@/lib/supabase/server');
  const { data, error } = await supabaseServer
    .from('meeting_minutes_summary')
    .upsert({
      id: 'main',
      summary: body.summary,
      covers_through: body.covers_through ?? null,
      updated_at: new Date().toISOString(),
    })
    .select().single();

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, summary: data });
}
