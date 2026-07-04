// ============================================================
// /api/traces : 痕跡データの受け口
//   POST  ... 投稿を1件保存（Googleフォーム中継 / アプリ投稿 共通）
//   GET   ... 一覧取得（マップ・カード・レポート用）
// ============================================================
import { NextRequest, NextResponse } from 'next/server';
import type {
  CreateTraceRequest,
  CreateTraceResponse,
  ListTracesResponse,
  Trace,
} from '@/lib/types';
import { SAMPLE_TRACES } from '@/lib/sampleTraces';

// Supabaseが設定済みかどうか。未設定ならローカル確認用のサンプルにフォールバック。
const SUPABASE_READY = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function getServerClient() {
  const { supabaseServer } = await import('@/lib/supabase/server');
  return supabaseServer;
}

export async function POST(req: NextRequest): Promise<NextResponse<CreateTraceResponse>> {
  try {
    const body = (await req.json()) as CreateTraceRequest;

    // 最低限のバリデーション（入力負荷を下げるため必須は title と座標のみ）
    if (!body.title || typeof body.latitude !== 'number' || typeof body.longitude !== 'number') {
      return NextResponse.json(
        { ok: false, error: 'title・latitude・longitude は必須です' },
        { status: 400 }
      );
    }

    if (!SUPABASE_READY) {
      return NextResponse.json(
        { ok: false, error: 'Supabase未設定（ローカル確認モード）。.env.localにキーを設定してください' },
        { status: 503 }
      );
    }

    const supabaseServer = await getServerClient();
    const { data, error } = await supabaseServer
      .from('traces')
      .insert({
        photo_url: body.photo_url ?? null,
        latitude: body.latitude,
        longitude: body.longitude,
        title: body.title,
        why: body.why ?? null,
        interpretation: body.interpretation ?? null,
        self_reflection: body.self_reflection ?? null,
        want_revisit: body.want_revisit ?? false,
        want_to_share: body.want_to_share ?? false,
        emotion_key: body.emotion_key ?? null,
        intensity: body.intensity ?? 3,
        category: body.category ?? null,
        trace_type: body.trace_type ?? null,
        is_past_memory: body.is_past_memory ?? false,
        memory_date: body.memory_date ?? null,
        custom_tags: body.custom_tags ?? null,
        archive_type: body.archive_type ?? null,
        yomi: body.yomi ?? null,
        alt_names: body.alt_names ?? null,
        era_label: body.era_label ?? null,
        source_ref: body.source_ref ?? null,
        voice_relation: body.voice_relation ?? null,
        audio_url: body.audio_url ?? null,
        session_code: body.session_code ?? null,
        nickname: body.nickname ?? null,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, trace: data as Trace }, { status: 201 });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : 'unknown error' },
      { status: 400 }
    );
  }
}

export async function GET(req: NextRequest): Promise<NextResponse<ListTracesResponse>> {
  const sessionCode = req.nextUrl.searchParams.get('session_code');
  const limit = Number(req.nextUrl.searchParams.get('limit') ?? 200);

  // Supabase未設定時はサンプルを返す（ブラウザでの動作確認用）
  if (!SUPABASE_READY) {
    const traces = sessionCode
      ? SAMPLE_TRACES.filter((t) => t.session_code === sessionCode)
      : SAMPLE_TRACES;
    return NextResponse.json({ ok: true, traces: traces.slice(0, limit) });
  }

  const supabaseServer = await getServerClient();
  let query = supabaseServer
    .from('traces')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (sessionCode) query = query.eq('session_code', sessionCode);

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ ok: false, traces: [], error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, traces: (data ?? []) as Trace[] });
}
