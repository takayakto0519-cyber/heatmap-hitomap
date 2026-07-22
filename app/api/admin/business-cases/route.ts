// GET/POST /api/admin/business-cases — 案件パイプラインの管理（パスワード必須）
import { NextRequest, NextResponse } from 'next/server';
import { checkAdmin } from '@/lib/adminAuth';

const SUPABASE_READY = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL);

export async function GET(req: NextRequest) {
  if (!SUPABASE_READY) return NextResponse.json({ ok: false, error: 'Supabase未設定' }, { status: 503 });
  if (!checkAdmin(req)) return NextResponse.json({ ok: false, error: 'パスワードが違います' }, { status: 401 });

  const { supabaseServer } = await import('@/lib/supabase/server');
  const { data, error } = await supabaseServer
    .from('business_cases').select('*').order('updated_at', { ascending: false });

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, cases: data ?? [] });
}

export async function POST(req: NextRequest) {
  if (!SUPABASE_READY) return NextResponse.json({ ok: false, error: 'Supabase未設定' }, { status: 503 });
  if (!checkAdmin(req)) return NextResponse.json({ ok: false, error: 'パスワードが違います' }, { status: 401 });

  const body = await req.json().catch(() => ({})) as {
    org_name?: string; client_type?: string; stage?: string;
    evidence?: string | null; proposal_link?: string | null; next_action?: string | null;
    lead_ref?: string | null; amount?: number | null; probability?: number | null;
    expected_close_date?: string | null;
  };
  if (!body.org_name?.trim()) return NextResponse.json({ ok: false, error: '組織名は必須です' }, { status: 400 });

  const { supabaseServer } = await import('@/lib/supabase/server');
  const { data, error } = await supabaseServer
    .from('business_cases')
    .insert({
      org_name: body.org_name.trim(),
      client_type: body.client_type?.trim() || 'business',
      stage: body.stage?.trim() || '発案',
      evidence: body.evidence?.trim() || null,
      proposal_link: body.proposal_link?.trim() || null,
      next_action: body.next_action?.trim() || null,
      lead_ref: body.lead_ref || null,
      amount: body.amount ?? null,
      probability: body.probability ?? 50,
      expected_close_date: body.expected_close_date || null,
    })
    .select().single();

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, case: data });
}
