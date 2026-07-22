// PATCH/DELETE /api/admin/client-leads/[id] — 学校・法人リードの更新・削除（パスワード必須）
import { NextRequest, NextResponse } from 'next/server';
import { checkAdmin } from '@/lib/adminAuth';

const SUPABASE_READY = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL);

const ALLOWED_FIELDS = ['client_type', 'org_name', 'contact_name', 'email', 'phone', 'status', 'memo', 'email_sent_at', 'email_reply', 'followed_up_at', 'reply_handled_at', 'website_url', 'contact_email_confidence', 'contact_email_source_url', 'email_draft', 'fact_check_status', 'fact_check_note', 'fact_checked_at', 'assigned_to', 'hook', 'drafted', 'sent'];

export async function PATCH(req: NextRequest, context: { params: { id: string } }) {
  if (!SUPABASE_READY) return NextResponse.json({ ok: false, error: 'Supabase未設定' }, { status: 503 });
  if (!checkAdmin(req)) return NextResponse.json({ ok: false, error: 'パスワードが違います' }, { status: 401 });

  const { id } = context.params;
  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  for (const key of ALLOWED_FIELDS) {
    if (key in body) updates[key] = body[key];
  }

  const { supabaseServer } = await import('@/lib/supabase/server');
  let { data, error } = await supabaseServer
    .from('client_leads').update(updates).eq('id', id).select().single();
  // マイグレーション未適用のカラムを指定した場合でも壊れないように、
  // エラーメッセージから実際に存在しないカラム名を読み取ってその項目だけ外し再試行する。
  for (let i = 0; error && i < ALLOWED_FIELDS.length; i++) {
    const missing = error.message.match(/['"]([a-zA-Z_]+)['"] column/)?.[1]
      ?? error.message.match(/column ["']([a-zA-Z_]+)["']/)?.[1];
    if (!missing || !(missing in updates)) break;
    delete updates[missing];
    ({ data, error } = await supabaseServer
      .from('client_leads').update(updates).eq('id', id).select().single());
  }

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, lead: data });
}

export async function DELETE(req: NextRequest, context: { params: { id: string } }) {
  if (!SUPABASE_READY) return NextResponse.json({ ok: false, error: 'Supabase未設定' }, { status: 503 });
  if (!checkAdmin(req)) return NextResponse.json({ ok: false, error: 'パスワードが違います' }, { status: 401 });

  const { id } = context.params;
  const { supabaseServer } = await import('@/lib/supabase/server');
  const { error } = await supabaseServer.from('client_leads').delete().eq('id', id);

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
