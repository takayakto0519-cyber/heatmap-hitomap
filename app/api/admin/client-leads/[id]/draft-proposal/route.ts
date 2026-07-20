// POST /api/admin/client-leads/[id]/draft-proposal — 証拠パックをもとに提案書ドラフトをAIで生成する（パスワード必須）
// ここでもDBやファイルには保存しない。ドラフトを返すのみ。会長がダウンロード・確認・編集してから使う
// （外部送信が必要なものは06_実行待機_Approvalに保管してから、という原則を守るため、保存は会長自身の操作に委ねる）。
import { NextRequest, NextResponse } from 'next/server';
import { checkAdmin } from '@/lib/adminAuth';
import { getRegionalEvidence, formatEvidenceForPrompt } from '@/lib/leadEvidence';

const SUPABASE_READY = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL);
// 提案書は会長がそのまま送る可能性のある成果物のため、証拠パック生成(Haiku)より品質を優先してSonnetを使う
const CLAUDE_MODEL = 'claude-sonnet-5';

const SYSTEM_PROMPT = `あなたはヒトマップの提案書ドラフトを書く担当です。
読み手はヒトマップを全く知らない自治体・法人の担当者です。専門用語は必ず初出で説明し、
読んだだけで「何をしている会社で、何をお願いされているか」が誤解なく伝わる文章にしてください。
以下の構成（01_経営幹部_Executive/行政向け営業資料_構成案_20260710.md の骨子）に沿って、Markdown形式の提案書ドラフトを書いてください。

## 構成
1. 表紙（団体名・日付）
2. 課題提起（その団体が今どんな課題を抱えていそうか。証拠パック・参考情報から読み取れる範囲で。読み取れなければ一般的な課題提起にとどめる）
3. ヒトマップとは何か（読み手は初めて聞く前提で、平易な言葉で説明する。
   例：「地図アプリ『ヒトマップ』を運営しています。利用者がまちで見つけた小さな出来事や場所の記録（"痕跡"と呼んでいます＝写真＋一言メモの投稿）を地図上に集め、そこで生まれた感情を色分けして『感情のヒートマップ』として可視化するサービスです」のように、"痕跡"などヒトマップ独自の言葉を使う場合は必ずその場で意味を一言添える。カタカナのビジネス用語（エンゲージメント・ソリューション・スケール・バリュー等）は使わない）
4. 実績・データ（証拠パックの数字をそのまま使う。誇張しない）
5. 相手にとっての価値（学校なら：総合学習・町探検の教材としての価値。法人・自治体なら：観光客の回遊データ・地域アーカイブ・関係人口創出への活用）
6. 提供できるもの（データダッシュボード、地域限定ヒートマップページ、イベント機能）
7. 導入までの流れ（実証実験→本格導入の2段階。いきなり大きな契約を求めない）
8. 次の一歩（下記「厳守事項」の返信導線を、独立した見出しとして必ず入れる）

## 厳守事項
- 誇張しない。証拠パック・参考情報に書かれている事実だけを使う。書かれていないことを推測で断定しない
- カタカナのビジネス用語（エンゲージメント・ソリューション・スケール・バリュー等）を使わない
- 短く、断言する文体。抽象と具体を交互に置く
- 料金は具体的な金額を書かない（「要相談」「実証実験からのご提案」程度に留める。金額は会長が別途判断する）
- これは"ドラフト"であることを忘れず、見出しに【ドラフト】と入れる
- 挨拶文・前置きは不要。Markdown本文だけを出力する
- 【最重要・返信導線】相手が興味を持ったことを、迷いなく・1アクションで伝えられる一文を最後の見出しに必ず入れる。
  例：「本メールに『興味があります』とご返信いただくだけで、資料一式と実証実験のご案内をお送りします。」
  のように、相手が取るべき行動を一つだけに絞り、電話・フォーム入力・複数の選択肢など曖昧な導線にしない。
  この一文が無いドラフトは、会長が毎回手直しする原因になるため必ず入れること。`;

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
