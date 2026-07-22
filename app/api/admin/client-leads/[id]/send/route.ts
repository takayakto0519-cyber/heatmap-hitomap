// POST /api/admin/client-leads/[id]/send — 送信キューからの1クリック送信（パスワード必須）
// 会長がダッシュボードで「送信」を押した時だけ呼ばれる。AIが自律的に呼ぶことは無い。
import { NextRequest, NextResponse } from 'next/server';
import { checkAdmin } from '@/lib/adminAuth';
import { sendEmail } from '@/lib/gmailServer';
import { parseEmailDraft } from '@/lib/parseEmailDraft';

const SUPABASE_READY = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL);

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  if (!SUPABASE_READY) return NextResponse.json({ ok: false, error: 'Supabase未設定' }, { status: 503 });
  if (!checkAdmin(req)) return NextResponse.json({ ok: false, error: 'パスワードが違います' }, { status: 401 });

  const { supabaseServer } = await import('@/lib/supabase/server');
  let { data: row, error: fetchError } = await supabaseServer
    .from('client_leads')
    .select('id, org_name, email, contact_email_confidence, email_draft, email_sent_at, fact_check_status')
    .eq('id', params.id).maybeSingle();
  let factCheckColumnMissing = false;
  if (fetchError && /fact_check_status|column/.test(fetchError.message)) {
    factCheckColumnMissing = true;
    ({ data: row, error: fetchError } = await supabaseServer
      .from('client_leads')
      .select('id, org_name, email, contact_email_confidence, email_draft, email_sent_at')
      .eq('id', params.id).maybeSingle());
  }
  if (fetchError) return NextResponse.json({ ok: false, error: fetchError.message }, { status: 500 });
  if (!row) return NextResponse.json({ ok: false, error: '対象が見つかりません' }, { status: 404 });

  if (row.email_sent_at) return NextResponse.json({ ok: false, error: '既に送信済みです' }, { status: 400 });
  if (!row.email) return NextResponse.json({ ok: false, error: '宛先メールアドレスが未設定です' }, { status: 400 });
  if (row.contact_email_confidence === 'low' || !row.contact_email_confidence) {
    return NextResponse.json({ ok: false, error: '宛先の確度が低いため送信できません。手動で確認してから宛先を確定してください' }, { status: 400 });
  }
  if (factCheckColumnMissing) {
    return NextResponse.json({ ok: false, error: '事実確認用のマイグレーション(20260722_add_fact_check_status.sql)が未適用です。Supabase SQL Editorで適用してから送信してください' }, { status: 400 });
  }
  if ((row as { fact_check_status?: string }).fact_check_status !== 'verified') {
    return NextResponse.json({ ok: false, error: '下書きの事実確認が済んでいないため送信できません。出典と突き合わせてfact_check_statusをverifiedにしてください' }, { status: 400 });
  }
  if (!row.email_draft?.trim()) return NextResponse.json({ ok: false, error: '下書きが空です' }, { status: 400 });

  const { subject, body } = parseEmailDraft(row.email_draft);
  if (!body.trim()) return NextResponse.json({ ok: false, error: '本文が空です' }, { status: 400 });

  // 二重送信防止：実際に送信する前に「未送信のときだけ」の条件付き更新で送信権を確保する。
  // 2人がほぼ同時に送信ボタンを押しても、email_sent_atをIS NULL条件で更新できるのは
  // 片方だけなので、後発リクエストはここで弾かれ、Gmail送信自体が行われない。
  const { data: claimed, error: claimError } = await supabaseServer
    .from('client_leads').update({ email_sent_at: new Date().toISOString() })
    .eq('id', params.id).is('email_sent_at', null).select('id');
  if (claimError) return NextResponse.json({ ok: false, error: claimError.message }, { status: 500 });
  if (!claimed || claimed.length === 0) {
    return NextResponse.json({ ok: false, error: '既に送信済みです（他の方が同時に送信した可能性があります）' }, { status: 409 });
  }

  try {
    await sendEmail({ to: row.email, subject: subject ?? `${row.org_name}様へのご提案（ヒトマップ）`, body });
  } catch (e) {
    // 送信自体が失敗した場合は、確保した送信権を元に戻して再送信できるようにする
    await supabaseServer.from('client_leads').update({ email_sent_at: null }).eq('id', params.id);
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
