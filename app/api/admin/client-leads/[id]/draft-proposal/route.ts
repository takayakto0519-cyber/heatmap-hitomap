// POST /api/admin/client-leads/[id]/draft-proposal — 証拠パックをもとに提案書ドラフトをAIで生成する（パスワード必須）
// ここでもDBやファイルには保存しない。ドラフトを返すのみ。会長がダウンロード・確認・編集してから使う
// （外部送信が必要なものは06_実行待機_Approvalに保管してから、という原則を守るため、保存は会長自身の操作に委ねる）。
import { NextRequest, NextResponse } from 'next/server';
import { checkAdmin } from '@/lib/adminAuth';
import { getRegionalEvidence, formatEvidenceForPrompt } from '@/lib/leadEvidence';

const SUPABASE_READY = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL);
// 提案書は会長がそのまま送る可能性のある成果物のため、証拠パック生成(Haiku)より品質を優先してSonnetを使う
const CLAUDE_MODEL = 'claude-sonnet-5';

const SYSTEM_PROMPT = `あなたはヒトマップ（地域の痕跡・感情を記録するサービス）の提案書ドラフトを書く担当です。
以下の構成（01_経営幹部_Executive/行政向け営業資料_構成案_20260710.md の骨子）に沿って、Markdown形式の提案書ドラフトを書いてください。

## 構成
1. 表紙（団体名・日付）
2. 課題提起（その団体が今どんな課題を抱えていそうか。証拠パック・参考情報から読み取れる範囲で。読み取れなければ一般的な課題提起にとどめる）
3. ヒトマップとは何か（一言で：「まちの痕跡を集めて、感情のヒートマップにするアプリ」。記録する→地図で発見する→感情でつながる、の3ステップ）
4. 実績・データ（証拠パックの数字をそのまま使う。誇張しない）
5. 相手にとっての価値（学校なら：総合学習・町探検の教材としての価値。法人・自治体なら：観光客の回遊データ・地域アーカイブ・関係人口創出への活用）
6. 提供できるもの（データダッシュボード、地域限定ヒートマップページ、イベント機能）
7. 導入までの流れ（実証実験→本格導入の2段階。いきなり大きな契約を求めない）
8. 連絡先・次のステップ

## 厳守事項
- 誇張しない。証拠パック・参考情報に書かれている事実だけを使う。書かれていないことを推測で断定しない
- カタカナのビジネス用語（エンゲージメント・ソリューション・スケール・バリュー等）を使わない
- 短く、断言する文体。抽象と具体を交互に置く
- 料金は具体的な金額を書かない（「要相談」「実証実験からのご提案」程度に留める。金額は会長が別途判断する）
- これは"ドラフト"であることを忘れず、見出しに【ドラフト】と入れる
- 挨拶文・前置きは不要。Markdown本文だけを出力する`;

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
  const body = await req.json().catch(() => ({})) as { extra_notes?: string };

  const { supabaseServer } = await import('@/lib/supabase/server');
  const { data: lead, error: leadError } = await supabaseServer
    .from('client_leads').select('org_name, client_type, contact_name, memo').eq('id', id).single();
  if (leadError || !lead) return NextResponse.json({ ok: false, error: '案件が見つかりません' }, { status: 404 });

  if (!lead.memo?.trim()) {
    return NextResponse.json({
      ok: false,
      error: '証拠パック（メモ）が空です。先に「AIで証拠パックを強化」で証拠を作ってから提案書を生成してください。',
    }, { status: 400 });
  }

  const evidence = await getRegionalEvidence(supabaseServer, lead.org_name);

  try {
    const { default: Anthropic } = await import('@anthropic-ai/sdk');
    const client = new Anthropic({ apiKey });
    const message = await client.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 2000,
      system: SYSTEM_PROMPT,
      messages: [{
        role: 'user',
        content: [
          `団体名: ${lead.org_name}（種別: ${lead.client_type === 'school' ? '学校' : '法人・自治体'}）`,
          lead.contact_name ? `担当者名（分かっていれば）: ${lead.contact_name}` : null,
          formatEvidenceForPrompt(evidence),
          `証拠パック（これまでに集めた情報）: ${lead.memo}`,
          body.extra_notes?.trim() ? `追加の指示・補足: ${body.extra_notes.trim()}` : null,
        ].filter(Boolean).join('\n\n'),
      }],
    });
    // Sonnetはthinkingブロックを先に返すことがあるため、text型のブロックを探す
    const textBlock = message.content.find((b) => b.type === 'text');
    const draft = textBlock && textBlock.type === 'text' ? textBlock.text.trim() : '';
    if (!draft) return NextResponse.json({ ok: false, error: 'AIからの応答が空でした' }, { status: 500 });

    return NextResponse.json({ ok: true, draft, model: message.model });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : 'AI呼び出しに失敗しました' }, { status: 500 });
  }
}
