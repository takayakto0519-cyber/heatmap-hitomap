// ============================================================
// /api/bonno/invest : BONNO投資（参加者が共感した煩悩に持ち点を配分する）
//   POST ... 投資を1件記録（voter_tokenごとの予算超過は拒否）
//   GET  ... voter_tokenの予算状態（残り予算・配分内訳）を取得
// bonno_investments はRLSポリシーなし（service role経由のみ）のため、
// 読み書きは必ずこのRoute Handlerを通る。
// ============================================================
import { NextRequest, NextResponse } from 'next/server';

const SUPABASE_READY = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// 1参加者あたりの持ち点。1タップの配分単位は10 BONNO固定（参加者側UIと対応）。
export const BONNO_BUDGET = 100;

async function getServerClient() {
  const { supabaseServer } = await import('@/lib/supabase/server');
  return supabaseServer;
}

async function spentBy(voterToken: string, eventSlug: string): Promise<number> {
  const supabaseServer = await getServerClient();
  const { data } = await supabaseServer
    .from('bonno_investments')
    .select('amount')
    .eq('event_slug', eventSlug)
    .eq('voter_token', voterToken);
  return (data ?? []).reduce((sum, row) => sum + (row.amount as number), 0);
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
      event_slug?: string; submission_id?: string; voter_token?: string; amount?: number;
    };
    const eventSlug = body.event_slug?.trim();
    const submissionId = body.submission_id?.trim();
    const voterToken = body.voter_token?.trim();
    const amount = Number(body.amount);
    if (!eventSlug || !submissionId || !voterToken || !Number.isInteger(amount) || amount <= 0) {
      return NextResponse.json(
        { ok: false, error: 'event_slug・submission_id・voter_token・amount（正の整数）は必須です' },
        { status: 400 }
      );
    }

    const supabaseServer = await getServerClient();

    // 対象イベントの visible な投稿にのみ投資できる
    const { data: submission } = await supabaseServer
      .from('bonno_submissions')
      .select('id, event_slug, status')
      .eq('id', submissionId)
      .maybeSingle();
    if (!submission || submission.event_slug !== eventSlug || submission.status !== 'visible') {
      return NextResponse.json({ ok: false, error: 'この煩悩は見つかりません' }, { status: 404 });
    }

    const spent = await spentBy(voterToken, eventSlug);
    if (spent + amount > BONNO_BUDGET) {
      return NextResponse.json(
        { ok: false, error: `残り予算が足りません（残り${Math.max(BONNO_BUDGET - spent, 0)} BONNO）` },
        { status: 400 }
      );
    }

    const { error: insertError } = await supabaseServer
      .from('bonno_investments')
      .insert({ event_slug: eventSlug, submission_id: submissionId, voter_token: voterToken, amount });
    if (insertError) {
      return NextResponse.json({ ok: false, error: insertError.message }, { status: 500 });
    }

    const { data: totalRows } = await supabaseServer
      .from('bonno_investments')
      .select('amount')
      .eq('submission_id', submissionId);
    const submissionTotal = (totalRows ?? []).reduce((sum, row) => sum + (row.amount as number), 0);
    const newSpent = spent + amount;

    return NextResponse.json({
      ok: true,
      spent: newSpent,
      remaining: BONNO_BUDGET - newSpent,
      submission_total: submissionTotal,
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : 'unknown error' },
      { status: 400 }
    );
  }
}

export async function GET(req: NextRequest) {
  const eventSlug = req.nextUrl.searchParams.get('event_slug');
  const voterToken = req.nextUrl.searchParams.get('voter_token');
  if (!eventSlug || !voterToken) {
    return NextResponse.json({ ok: false, error: 'event_slug・voter_token は必須です' }, { status: 400 });
  }
  if (!SUPABASE_READY) {
    return NextResponse.json({ ok: true, budget: BONNO_BUDGET, spent: 0, remaining: BONNO_BUDGET, allocations: [] });
  }

  const supabaseServer = await getServerClient();
  const { data, error } = await supabaseServer
    .from('bonno_investments')
    .select('submission_id, amount')
    .eq('event_slug', eventSlug)
    .eq('voter_token', voterToken);
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  const allocationMap = new Map<string, number>();
  for (const row of data ?? []) {
    const submissionId = row.submission_id as string;
    allocationMap.set(submissionId, (allocationMap.get(submissionId) ?? 0) + (row.amount as number));
  }
  const allocations = [...allocationMap.entries()].map(([submission_id, amount]) => ({ submission_id, amount }));
  const spent = allocations.reduce((sum, a) => sum + a.amount, 0);

  return NextResponse.json({
    ok: true,
    budget: BONNO_BUDGET,
    spent,
    remaining: BONNO_BUDGET - spent,
    allocations,
  });
}
