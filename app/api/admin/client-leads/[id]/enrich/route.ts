// POST /api/admin/client-leads/[id]/enrich — 会長が貼り付けた参考情報からAIで証拠パックの下書きを生成する（パスワード必須）
// ここではDBに保存しない。会長が確認・編集してから通常のPATCHで保存する（1件ずつ、人がレビューする姿勢を崩さない）。
import { NextRequest, NextResponse } from 'next/server';
import { checkAdmin } from '@/lib/adminAuth';

const SUPABASE_READY = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL);
const CLAUDE_MODEL = 'claude-haiku-4-5-20251001'; // 1件ずつの手動生成のため速度・コスト優先

const SYSTEM_PROMPT = `あなたはヒトマップ（地域の痕跡・感情を記録するサービス）の営業リード担当です。
与えられた「団体名」「参考情報（ニュース記事・IR情報・自治体の総合戦略資料などの貼り付けテキスト）」「ヒトマップの既存データ」をもとに、
その団体向けの"証拠パック"を1〜2文で書いてください。

厳守事項：
- 誇張しない。参考情報に書かれている事実だけを使う。書かれていないことを推測で足さない。
- カタカナのビジネス用語（エンゲージメント・ソリューション・スケール等）を使わない。
- 断言調・簡潔に。前置きや挨拶文は不要、証拠パックの本文だけを出力する。
- 参考情報から団体の課題やヒトマップとの接点が読み取れない場合は、正直に「参考情報からは接点が明確でない」と書く。`;

export async function POST(req: NextRequest, context: { params: { id: string } }) {
  if (!SUPABASE_READY) return NextResponse.json({ ok: false, error: 'Supabase未設定' }, { status: 503 });
  if (!checkAdmin(req)) return NextResponse.json({ ok: false, error: 'パスワードが違います' }, { status: 401 });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({
      ok: false,
      error: 'ANTHROPIC_API_KEYが未設定です。.env.localに設定してください（https://console.anthropic.com/settings/keys）',
    }, { status: 503 });
  }

  const { id } = context.params;
  const body = await req.json().catch(() => ({})) as { source_text?: string };
  const sourceText = body.source_text?.trim();
  if (!sourceText) return NextResponse.json({ ok: false, error: '参考情報（source_text）は必須です' }, { status: 400 });

  const { supabaseServer } = await import('@/lib/supabase/server');
  const { data: lead, error: leadError } = await supabaseServer
    .from('client_leads').select('org_name, client_type, memo').eq('id', id).single();
  if (leadError || !lead) return NextResponse.json({ ok: false, error: '案件が見つかりません' }, { status: 404 });

  // 地域名を団体名から素朴に拾い、既存の痕跡データ件数を"証"として添える（無ければ0件のまま正直に使う）
  const { count: traceCount } = await supabaseServer
    .from('traces')
    .select('id', { count: 'exact', head: true })
    .eq('is_deleted', false)
    .eq('visibility', 'public')
    .ilike('region', `%${lead.org_name.replace(/[市区町村県]$/u, '')}%`);

  try {
    const { default: Anthropic } = await import('@anthropic-ai/sdk');
    const client = new Anthropic({ apiKey });
    const message = await client.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 400,
      system: SYSTEM_PROMPT,
      messages: [{
        role: 'user',
        content: [
          `団体名: ${lead.org_name}（種別: ${lead.client_type === 'school' ? '学校' : '法人・自治体'}）`,
          `ヒトマップの既存データ: 全国公開済みの痕跡投稿が約${traceCount ?? 0}件（団体名から推定した地域名で検索）`,
          lead.memo ? `既存の証拠パック（あれば更新の参考に）: ${lead.memo}` : null,
          `参考情報（貼り付けテキスト）:\n${sourceText.slice(0, 6000)}`,
        ].filter(Boolean).join('\n\n'),
      }],
    });
    const block = message.content[0];
    const draft = block.type === 'text' ? block.text.trim() : '';
    if (!draft) return NextResponse.json({ ok: false, error: 'AIからの応答が空でした' }, { status: 500 });

    return NextResponse.json({ ok: true, draft, traceCount: traceCount ?? 0 });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : 'AI呼び出しに失敗しました' }, { status: 500 });
  }
}
