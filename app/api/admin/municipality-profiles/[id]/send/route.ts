// POST /api/admin/municipality-profiles/[id]/send — 送信キューからの1クリック送信（パスワード必須）
// 会長がダッシュボードで「送信」を押した時だけ呼ばれる。AIが自律的に呼ぶことは無い。
// 確度がlow/未設定、または宛先が空、または送信済みの場合は拒否する（誤送信ガード）。
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
    .from('municipality_profiles')
    .select('id, region_name, contact_email, contact_email_confidence, email_draft, email_sent_at, fact_check_status')
    .eq('id', params.id).maybeSingle();
  // 20260722_add_fact_check_status.sql 未適用の環境でも壊れないように、
  // 列が無いことによるエラー時は fact_check_status 抜きで再取得し、未確認扱いとして送信をブロックする。
  let factCheckColumnMissing = false;
  if (fetchError && /fact_check_status|column/.test(fetchError.message)) {
    factCheckColumnMissing = true;
    ({ data: row, error: fetchError } = await supabaseServer
      .from('municipality_profiles')
      .select('id, region_name, contact_email, contact_email_confidence, email_draft, email_sent_at')
      .eq('id', params.id).maybeSingle());
  }
  if (fetchError) return NextResponse.json({ ok: false, error: fetchError.message }, { status: 500 });
  if (!row) return NextResponse.json({ ok: false, error: '対象が見つかりません' }, { status: 404 });

  if (row.email_sent_at) return NextResponse.json({ ok: false, error: '既に送信済みです' }, { status: 400 });
  if (!row.contact_email) return NextResponse.json({ ok: false, error: '宛先メールアドレスが未設定です' }, { status: 400 });
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

  try {
    await sendEmail({ to: row.contact_email, subject: subject ?? `${row.region_name}様へのご提案（ヒトマップ）`, body });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }

  const { error: patchError } = await supabaseServer
    .from('municipality_profiles').update({ email_sent_at: new Date().toISOString() }).eq('id', params.id);
  if (patchError) return NextResponse.json({ ok: false, error: `送信は成功しましたが記録に失敗しました: ${patchError.message}` }, { status: 500 });

  return NextResponse.json({ ok: true });
}
