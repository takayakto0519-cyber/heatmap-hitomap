// PATCH/DELETE /api/admin/business-cases/[id]
import { NextRequest, NextResponse } from 'next/server';
import { checkAdmin } from '@/lib/adminAuth';

const SUPABASE_READY = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL);
const ALLOWED_FIELDS = [
  'org_name', 'client_type', 'stage', 'evidence', 'proposal_link', 'next_action', 'lead_ref',
  'amount', 'probability', 'expected_close_date', 'won_at', 'lost_reason',
  'invoice_sent_at', 'payment_due', 'paid_at', 'last_contact_at',
];
// これらのステージへ遷移した瞬間、対応する日付列を自動でセットする（入力の手間を減らす導線）。
// 既に値が入っている場合や、呼び出し側が明示的に指定した場合はそちらを優先する。
const WON_STAGES = ['受注', '制作', '納品', '請求', 'フォロー'];

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  if (!SUPABASE_READY) return NextResponse.json({ ok: false, error: 'Supabase未設定' }, { status: 503 });
  if (!checkAdmin(req)) return NextResponse.json({ ok: false, error: 'パスワードが違います' }, { status: 401 });

  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString(), last_contact_at: new Date().toISOString() };
  for (const key of ALLOWED_FIELDS) if (key in body) patch[key] = body[key];

  const { supabaseServer } = await import('@/lib/supabase/server');

  if (typeof body.stage === 'string' && !('won_at' in body)) {
    if (WON_STAGES.includes(body.stage)) {
      const { data: current } = await supabaseServer.from('business_cases').select('won_at').eq('id', params.id).maybeSingle();
      if (!current?.won_at) patch.won_at = new Date().toISOString().slice(0, 10);
    }
  }
  if (body.stage === '請求' && !('invoice_sent_at' in body)) {
    const { data: current } = await supabaseServer.from('business_cases').select('invoice_sent_at').eq('id', params.id).maybeSingle();
    if (!current?.invoice_sent_at) patch.invoice_sent_at = new Date().toISOString().slice(0, 10);
  }

  const { data, error } = await supabaseServer
    .from('business_cases').update(patch).eq('id', params.id).select().single();
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, case: data });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  if (!SUPABASE_READY) return NextResponse.json({ ok: false, error: 'Supabase未設定' }, { status: 503 });
  if (!checkAdmin(req)) return NextResponse.json({ ok: false, error: 'パスワードが違います' }, { status: 401 });

  const { supabaseServer } = await import('@/lib/supabase/server');
  const { error } = await supabaseServer.from('business_cases').delete().eq('id', params.id);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
