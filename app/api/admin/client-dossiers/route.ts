// GET/POST /api/admin/client-dossiers — 顧問先カルテの管理（パスワード必須）
import { NextRequest, NextResponse } from 'next/server';
import { checkAdmin } from '@/lib/adminAuth';

const SUPABASE_READY = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL);

export async function GET(req: NextRequest) {
  if (!SUPABASE_READY) return NextResponse.json({ ok: false, error: 'Supabase未設定' }, { status: 503 });
  if (!checkAdmin(req)) return NextResponse.json({ ok: false, error: 'パスワードが違います' }, { status: 401 });

  const { supabaseServer } = await import('@/lib/supabase/server');
  const { data, error } = await supabaseServer
    .from('client_dossiers').select('*').order('created_at', { ascending: false });

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, dossiers: data ?? [] });
}

export async function POST(req: NextRequest) {
  if (!SUPABASE_READY) return NextResponse.json({ ok: false, error: 'Supabase未設定' }, { status: 503 });
  if (!checkAdmin(req)) return NextResponse.json({ ok: false, error: 'パスワードが違います' }, { status: 401 });

  const body = await req.json().catch(() => ({})) as {
    org_name?: string; plan?: string | null; monthly_fee?: number | null;
    start_date?: string | null; contact_name?: string | null; notes?: string | null; next_meeting?: string | null;
  };
  if (!body.org_name?.trim()) return NextResponse.json({ ok: false, error: '組織名は必須です' }, { status: 400 });

  const { supabaseServer } = await import('@/lib/supabase/server');
  const { data, error } = await supabaseServer
    .from('client_dossiers')
    .insert({
      org_name: body.org_name.trim(),
      plan: body.plan?.trim() || null,
      monthly_fee: body.monthly_fee ?? null,
      start_date: body.start_date || null,
      contact_name: body.contact_name?.trim() || null,
      notes: body.notes?.trim() || null,
      next_meeting: body.next_meeting || null,
    })
    .select().single();

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, dossier: data });
}
