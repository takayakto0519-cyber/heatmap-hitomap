// POST /api/admin/contact-finder — 宛先メールディープリサーチ（パスワード必須）
// website_url を持つ行を対象に、lib/contactFinder.ts で問い合わせ先メールを探し、
// email/contact_email・contact_email_confidence・contact_email_source_url を更新する。
// LLMは使わない。追加のAI API課金は発生しない。
import { NextRequest, NextResponse } from 'next/server';
import { checkAdmin } from '@/lib/adminAuth';
import { findContactEmail } from '@/lib/contactFinder';

const SUPABASE_READY = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL);

type TableName = 'client_leads' | 'sales_email_targets' | 'municipality_profiles';
const EMAIL_COLUMN: Record<TableName, string> = {
  client_leads: 'email',
  sales_email_targets: 'email',
  municipality_profiles: 'contact_email',
};
const VALID_TABLES = Object.keys(EMAIL_COLUMN) as TableName[];

interface RowResult {
  id: string;
  email: string | null;
  confidence: string | null;
  sourceUrl: string | null;
  note: string;
}

export async function POST(req: NextRequest) {
  if (!SUPABASE_READY) return NextResponse.json({ ok: false, error: 'Supabase未設定' }, { status: 503 });
  if (!checkAdmin(req)) return NextResponse.json({ ok: false, error: 'パスワードが違います' }, { status: 401 });

  const body = await req.json().catch(() => ({})) as { table?: string; id?: string; ids?: string[] };
  const table = body.table as TableName | undefined;
  if (!table || !VALID_TABLES.includes(table)) {
    return NextResponse.json({ ok: false, error: 'tableはclient_leads/sales_email_targets/municipality_profilesのいずれかで指定してください' }, { status: 400 });
  }
  const ids = body.ids ?? (body.id ? [body.id] : []);
  if (ids.length === 0) return NextResponse.json({ ok: false, error: 'idまたはidsを指定してください' }, { status: 400 });
  if (ids.length > 20) return NextResponse.json({ ok: false, error: '一度に処理できるのは20件までです' }, { status: 400 });

  const emailCol = EMAIL_COLUMN[table];
  const { supabaseServer } = await import('@/lib/supabase/server');

  const { data: rows, error: fetchError } = await supabaseServer
    .from(table).select(`id, website_url, ${emailCol}`).in('id', ids);
  if (fetchError) return NextResponse.json({ ok: false, error: fetchError.message }, { status: 500 });

  const results: RowResult[] = [];
  for (const row of (rows ?? []) as unknown as Record<string, unknown>[]) {
    const id = row.id as string;
    const websiteUrl = row.website_url as string | null;
    if (!websiteUrl) {
      results.push({ id, email: null, confidence: null, sourceUrl: null, note: 'website_urlが未設定です' });
      continue;
    }
    const found = await findContactEmail(websiteUrl);
    const patch: Record<string, unknown> = {
      contact_email_confidence: found.confidence,
      contact_email_source_url: found.sourceUrl,
    };
    // 既存のメールアドレスを見つかった値で上書きしない（会長が手動で確認済みの値を保護する）。
    // 空欄のときだけ埋める。
    if (found.email && !row[emailCol]) patch[emailCol] = found.email;

    const { error: patchError } = await supabaseServer.from(table).update(patch).eq('id', id);
    results.push({
      id, email: found.email, confidence: found.confidence, sourceUrl: found.sourceUrl,
      note: patchError ? `保存に失敗しました: ${patchError.message}` : found.note,
    });
  }

  return NextResponse.json({ ok: true, results });
}
