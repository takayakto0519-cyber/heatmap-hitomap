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
  const { data: row, error: fetchError } = await supabaseServer
    .from('client_leads')
    .select('id, org_name, email, contact_email_confidence, email_draft, email_sent_at')
    .eq('id', params.id).maybeSingle();
  if (fetchError) return NextResponse.json({ ok: false, error: fetchError.message }, { status: 500 });
  if (!row) return NextResponse.json({ ok: false, error: '対象が見つかりません' }, { status: 404 });

  if (row.email_sent_at) return NextResponse.json({ ok: false, error: '既に送信済みです' }, { status: 400 });
  if (!row.email) return NextResponse.json({ ok: false, error: '宛先メールアドレスが未設定です' }, { status: 400 });
  if (row.contact_email_confidence === 'low' || !row.contact_email_confidence) {
    return NextResponse.json({ ok: false, error: '宛先の確度が低いため送信できません。手動で確認してから宛先を確定してください' }, { status: 400 });
  }
  if (!row.email_draft?.trim()) return NextResponse.json({ ok: false, error: '下書きが空です' }, { status: 400 });

  const { subject, body } = parseEmailDraft(row.email_draft);
  if (!body.trim()) return NextResponse.json({ ok: false, error: '本文が空です' }, { status: 400 });

  try {
    await sendEmail({ to: row.email, subject: subject ?? `${row.org_name}様へのご提案（ヒトマップ）`, body });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }

  const { error: patchError } = await supabaseServer
    .from('client_leads').update({ email_sent_at: new Date().toISOString() }).eq('id', params.id);
  if (patchError) return NextResponse.json({ ok: false, error: `送信は成功しましたが記録に失敗しました: ${patchError.message}` }, { status: 500 });

  return NextResponse.json({ ok: true });
}
