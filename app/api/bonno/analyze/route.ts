// POST /api/bonno/analyze — 集まった煩悩をAIで一括解析する（パスワード必須）
//   ・各投稿に切実さスコア（1〜5）とキーワード（名詞2〜3個）を付けてDBに保存
//   ・全体講評（頻出テーマ3つ＋一言）は保存せず返すのみ（AIは下書き、人が確認する姿勢）
//   ?force=1 で分析済みも再分析する
import { NextRequest, NextResponse } from 'next/server';
import { checkAdmin } from '@/lib/adminAuth';
import type { BonnoSubmission } from '@/lib/types';

const SUPABASE_READY = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL);
const CLAUDE_MODEL = 'claude-haiku-4-5-20251001'; // 最大50件のバッチ採点のため速度・コスト優先
const BATCH_LIMIT = 50;

const SYSTEM_PROMPT = `あなたは「煩悩オークション」というイベントの解析係です。
参加者が投稿した煩悩（欲・執着・後悔などの短文）のリストを受け取り、各投稿を採点します。

各投稿について：
- intensity: 切実さを1〜5の整数で。基準：1=軽い笑い・ネタ、2=日常の小さな欲、3=本音がにじむ、4=切実な執着や悩み、5=深い懺悔・魂の告白
- keywords: 本文から拾った名詞を2〜3個（原文の言葉をそのまま使う。一般的すぎる語「こと」「もの」等は避ける）

出力は必ず次のJSONのみ。前置き・説明・コードブロック記法は一切付けない：
{"items":[{"id":"...","intensity":3,"keywords":["...","..."]}],"review":"頻出テーマ3つと全体への一言（2〜3文、体温のある言葉で）"}`;

export async function POST(req: NextRequest) {
  if (!SUPABASE_READY) return NextResponse.json({ ok: false, error: 'Supabase未設定' }, { status: 503 });
  if (!checkAdmin(req)) return NextResponse.json({ ok: false, error: 'パスワードが違います' }, { status: 401 });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({
      ok: false,
      error: 'ANTHROPIC_API_KEYが未設定です。.env.localに設定してください（https://console.anthropic.com/settings/keys）',
    }, { status: 503 });
  }

  const body = await req.json().catch(() => ({})) as { event_slug?: string };
  const eventSlug = body.event_slug?.trim();
  if (!eventSlug) return NextResponse.json({ ok: false, error: 'event_slug は必須です' }, { status: 400 });
  const force = req.nextUrl.searchParams.get('force') === '1';

  const { supabaseServer } = await import('@/lib/supabase/server');
  let query = supabaseServer
    .from('bonno_submissions')
    .select('id, text')
    .eq('event_slug', eventSlug)
    .eq('status', 'visible')
    .order('created_at', { ascending: true })
    .limit(BATCH_LIMIT);
  if (!force) query = query.is('analyzed_at', null);

  const { data: targets, error: fetchError } = await query;
  if (fetchError) return NextResponse.json({ ok: false, error: fetchError.message }, { status: 500 });
  if (!targets || targets.length === 0) {
    return NextResponse.json({ ok: true, analyzed: 0, review: null, message: '未分析の煩悩はありません' });
  }

  try {
    const { default: Anthropic } = await import('@anthropic-ai/sdk');
    const client = new Anthropic({ apiKey });
    const message = await client.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 4000,
      system: SYSTEM_PROMPT,
      messages: [{
        role: 'user',
        content: `煩悩リスト（JSON）:\n${JSON.stringify(targets.map((t) => ({ id: t.id, text: (t.text as string).slice(0, 200) })))}`,
      }],
    });
    const textBlock = message.content.find((b) => b.type === 'text');
    const raw = textBlock && textBlock.type === 'text' ? textBlock.text.trim() : '';
    // モデルがコードブロックで包んでも耐えるよう、最初の { から最後の } までを取り出す
    const jsonText = raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1);
    const parsed = JSON.parse(jsonText) as {
      items?: Array<{ id: string; intensity: number; keywords: string[] }>;
      review?: string;
    };
    const items = parsed.items ?? [];
    if (items.length === 0) return NextResponse.json({ ok: false, error: 'AIの応答から採点結果を読み取れませんでした' }, { status: 500 });

    const validIds = new Set(targets.map((t) => t.id as string));
    const now = new Date().toISOString();
    let analyzed = 0;
    for (const item of items) {
      if (!validIds.has(item.id)) continue;
      const intensity = Math.min(5, Math.max(1, Math.round(Number(item.intensity) || 3)));
      const keywords = (item.keywords ?? []).filter((k) => typeof k === 'string' && k.trim()).slice(0, 3);
      const { error: updateError } = await supabaseServer
        .from('bonno_submissions')
        .update({ intensity_score: intensity, ai_keywords: keywords, analyzed_at: now })
        .eq('id', item.id);
      if (!updateError) analyzed += 1;
    }

    return NextResponse.json({
      ok: true,
      analyzed,
      remaining: targets.length >= BATCH_LIMIT, // まだ未分析が残っている可能性（もう一度実行で続きを処理）
      review: parsed.review?.trim() || null,
      model: message.model,
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : 'AI呼び出しに失敗しました' },
      { status: 500 }
    );
  }
}

// GETでも件数だけ確認できるようにする（コンソールの「分析状況」表示用）
export async function GET(req: NextRequest) {
  if (!SUPABASE_READY) return NextResponse.json({ ok: false, error: 'Supabase未設定' }, { status: 503 });
  const eventSlug = req.nextUrl.searchParams.get('event_slug');
  if (!eventSlug) return NextResponse.json({ ok: false, error: 'event_slug は必須です' }, { status: 400 });

  const { supabaseServer } = await import('@/lib/supabase/server');
  const { count: total } = await supabaseServer
    .from('bonno_submissions').select('id', { count: 'exact', head: true })
    .eq('event_slug', eventSlug).eq('status', 'visible');
  const { count: done } = await supabaseServer
    .from('bonno_submissions').select('id', { count: 'exact', head: true })
    .eq('event_slug', eventSlug).eq('status', 'visible').not('analyzed_at', 'is', null);
  return NextResponse.json({ ok: true, total: total ?? 0, analyzed: done ?? 0 });
}
