// ============================================================
// /api/bonno : 煩悩オークション（event_mode='bonno'）の投稿受け口
//   POST ... 煩悩を1件投稿（匿名・QR経由のスマホ想定）
//   GET  ... 一覧取得（投影ウォール・分析ダッシュボード・運営コンソール共用）
// bonno_submissions はRLSポリシーなし（service role経由のみ）のため、
// 読み書きは必ずこのRoute Handlerを通る。
// ============================================================
import { NextRequest, NextResponse } from 'next/server';
import type { BonnoSubmission } from '@/lib/types';
import { checkAdmin } from '@/lib/adminAuth';

const SUPABASE_READY = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const MAX_TEXT_LENGTH = 100;
const MAX_NICKNAME_LENGTH = 20;

// 連投荒らし対策：IPごとの投稿回数を時間窓で制限（lib/adminAuth.ts と同じインメモリ方式。
// サーバーレスで複数インスタンスに分散されると完全には効かないが、1日イベント用途には十分）
const RATE_WINDOW_MS = 60 * 1000;
const RATE_MAX_POSTS = 10;
const postCounts = new Map<string, { count: number; windowStart: number }>();

function clientIp(req: NextRequest): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    ?? req.headers.get('x-real-ip')
    ?? 'unknown';
}

function isRateLimited(req: NextRequest): boolean {
  const ip = clientIp(req);
  const now = Date.now();
  const entry = postCounts.get(ip);
  if (!entry || now - entry.windowStart >= RATE_WINDOW_MS) {
    postCounts.set(ip, { count: 1, windowStart: now });
    return false;
  }
  entry.count += 1;
  return entry.count > RATE_MAX_POSTS;
}

async function getServerClient() {
  const { supabaseServer } = await import('@/lib/supabase/server');
  return supabaseServer;
}

// 複数日にまたがる開催を想定し、投稿を期間で絞り込めるようにする（投資ボードの「今日/一週間/総合」切り替え用）。
// 「今日」はJST（日本のイベント運用前提）の暦日で区切る。
function jstStartOfTodayUTC(): string {
  const JST_OFFSET_MS = 9 * 60 * 60 * 1000;
  const jstWallClock = new Date(Date.now() + JST_OFFSET_MS);
  jstWallClock.setUTCHours(0, 0, 0, 0);
  return new Date(jstWallClock.getTime() - JST_OFFSET_MS).toISOString();
}

function periodCutoff(period: string | null): string | null {
  if (period === 'today') return jstStartOfTodayUTC();
  if (period === 'week') return new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  return null; // 'all' または未指定は絞り込みなし
}

export async function POST(req: NextRequest) {
  try {
    if (!SUPABASE_READY) {
      return NextResponse.json(
        { ok: false, error: 'Supabase未設定（ローカル確認モード）。.env.localにキーを設定してください' },
        { status: 503 }
      );
    }

    const body = await req.json().catch(() => ({})) as {
      event_slug?: string; text?: string; nickname?: string;
    };
    const eventSlug = body.event_slug?.trim();
    const text = body.text?.trim();
    if (!eventSlug || !text) {
      return NextResponse.json({ ok: false, error: 'event_slug・text は必須です' }, { status: 400 });
    }
    if (text.length > MAX_TEXT_LENGTH) {
      return NextResponse.json(
        { ok: false, error: `煩悩は${MAX_TEXT_LENGTH}字以内で書いてください` },
        { status: 400 }
      );
    }
    if (isRateLimited(req)) {
      return NextResponse.json(
        { ok: false, error: '投稿が続きすぎています。少し待ってからもう一度どうぞ' },
        { status: 429 }
      );
    }

    const supabaseServer = await getServerClient();

    // 実在する煩悩イベントにだけ投稿を受け付ける
    const { data: route } = await supabaseServer
      .from('routes')
      .select('id, event_mode, is_deleted')
      .eq('event_slug', eventSlug)
      .maybeSingle();
    if (!route || route.is_deleted || route.event_mode !== 'bonno') {
      return NextResponse.json({ ok: false, error: 'このイベントは見つかりません' }, { status: 404 });
    }

    const { data, error } = await supabaseServer
      .from('bonno_submissions')
      .insert({
        event_slug: eventSlug,
        text,
        nickname: body.nickname?.trim().slice(0, MAX_NICKNAME_LENGTH) || null,
        status: 'visible',
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true, submission: data as BonnoSubmission }, { status: 201 });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : 'unknown error' },
      { status: 400 }
    );
  }
}

export async function GET(req: NextRequest) {
  const eventSlug = req.nextUrl.searchParams.get('event_slug');
  if (!eventSlug) {
    return NextResponse.json({ ok: false, error: 'event_slug は必須です' }, { status: 400 });
  }
  if (!SUPABASE_READY) {
    return NextResponse.json({ ok: true, items: [], spotlight_id: null });
  }

  const supabaseServer = await getServerClient();
  // ウォール・分析ページの匿名ポーリングを checkAdmin の失敗回数に数えさせない
  // （数えると会場IPが15分ロックされ、正しいパスワードの運営コンソールまで締め出される）
  const isAdmin = req.headers.get('x-admin-password') ? checkAdmin(req) : false;

  const period = req.nextUrl.searchParams.get('period'); // 'today' | 'week' | 'all' | null（未指定は絞り込みなし＝従来通り）
  const cutoff = periodCutoff(period);

  let query = supabaseServer
    .from('bonno_submissions')
    .select('*')
    .eq('event_slug', eventSlug)
    .order('created_at', { ascending: true })
    .limit(500);
  if (!isAdmin) query = query.eq('status', 'visible');
  if (cutoff) query = query.gte('created_at', cutoff);

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  const rows = (data ?? []) as BonnoSubmission[];

  // BONNO投資合計を集計してsubmission_idごとに付与する（投資ボード・ウォールの演出で使う）
  const { data: investmentRows } = await supabaseServer
    .from('bonno_investments')
    .select('submission_id, amount')
    .eq('event_slug', eventSlug);
  const totalBonnoMap = new Map<string, number>();
  for (const row of investmentRows ?? []) {
    const submissionId = row.submission_id as string;
    totalBonnoMap.set(submissionId, (totalBonnoMap.get(submissionId) ?? 0) + (row.amount as number));
  }
  const rowsWithTotal = rows.map((r) => ({ ...r, total_bonno: totalBonnoMap.get(r.id) ?? 0 }));

  // スポットライト＝featured_at が最も新しい visible の1件（解除は featured_at=NULL に戻すだけ）
  const spotlight = rowsWithTotal
    .filter((r) => r.status === 'visible' && r.featured_at)
    .sort((a, b) => (a.featured_at! < b.featured_at! ? 1 : -1))[0] ?? null;

  // 公開応答では運営用の内部情報（status等）を落とす
  const items = isAdmin
    ? rowsWithTotal
    : rowsWithTotal.map((r) => ({
        id: r.id,
        text: r.text,
        nickname: r.nickname,
        total_bonno: r.total_bonno,
        created_at: r.created_at,
      }));

  return NextResponse.json({ ok: true, items, spotlight_id: spotlight?.id ?? null });
}
