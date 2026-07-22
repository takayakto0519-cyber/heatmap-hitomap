// PATCH/DELETE /api/admin/municipality-profiles/[id]
import { NextRequest, NextResponse } from 'next/server';
import { checkAdmin } from '@/lib/adminAuth';

const SUPABASE_READY = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL);
const ALLOWED_FIELDS = [
  'region_name', 'engagement_stage', 'evidence_summary', 'relation_population_initiative',
  'fit_assessment', 'opportunity_level', 'opportunity_notes', 'source_links',
  'contact_email', 'email_draft', 'email_sent_at', 'email_sent_content', 'email_reply', 'is_priority_pick',
  'followed_up_at', 'on_hold', 'smout_sent_at', 'smout_reply', 'municipality_code', 'reply_handled_at',
  'website_url', 'contact_email_confidence', 'contact_email_source_url',
  'fact_check_status', 'fact_check_note', 'fact_checked_at',
];

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  if (!SUPABASE_READY) return NextResponse.json({ ok: false, error: 'Supabase未設定' }, { status: 503 });
  if (!checkAdmin(req)) return NextResponse.json({ ok: false, error: 'パスワードが違います' }, { status: 401 });

  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  for (const key of ALLOWED_FIELDS) if (key in body) patch[key] = body[key];

  const { supabaseServer } = await import('@/lib/supabase/server');
  const { data, error } = await supabaseServer
    .from('municipality_profiles').update(patch).eq('id', params.id).select().single();
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, profile: data });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  if (!SUPABASE_READY) return NextResponse.json({ ok: false, error: 'Supabase未設定' }, { status: 503 });
  if (!checkAdmin(req)) return NextResponse.json({ ok: false, error: 'パスワードが違います' }, { status: 401 });

  const { supabaseServer } = await import('@/lib/supabase/server');
  const { error } = await supabaseServer.from('municipality_profiles').delete().eq('id', params.id);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
