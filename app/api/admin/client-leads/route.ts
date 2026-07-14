// GET/POST /api/admin/client-leads — 学校・法人向け問い合わせ/契約の管理（パスワード必須）
import { NextRequest, NextResponse } from 'next/server';
import { checkAdmin } from '@/lib/adminAuth';

const SUPABASE_READY = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL);

export async function GET(req: NextRequest) {
  if (!SUPABASE_READY) return NextResponse.json({ ok: false, error: 'Supabase未設定' }, { status: 503 });
  if (!checkAdmin(req)) return NextResponse.json({ ok: false, error: 'パスワードが違います' }, { status: 401 });

  const { supabaseServer } = await import('@/lib/supabase/server');
  const { data, error } = await supabaseServer
    .from('client_leads').select('*').order('created_at', { ascending: false });

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, leads: data ?? [] });
}

export async function POST(req: NextRequest) {
  if (!SUPABASE_READY) return NextResponse.json({ ok: false, error: 'Supabase未設定' }, { status: 503 });
  if (!checkAdmin(req)) return NextResponse.json({ ok: false, error: 'パスワードが違います' }, { status: 401 });

  const body = await req.json().catch(() => ({})) as {
    client_type?: string; org_name?: string; contact_name?: string | null;
    email?: string | null; phone?: string | null; memo?: string | null;
  };
  if (!body.org_name?.trim()) return NextResponse.json({ ok: false, error: '団体名は必須です' }, { status: 400 });

  const { supabaseServer } = await import('@/lib/supabase/server');
  const { data, error } = await supabaseServer
    .from('client_leads')
    .insert({
      client_type: body.client_type === 'school' ? 'school' : 'business',
      org_name: body.org_name.trim(),
      contact_name: body.contact_name?.trim() || null,
      email: body.email?.trim() || null,
      phone: body.phone?.trim() || null,
      memo: body.memo?.trim() || null,
    })
    .select().single();

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, lead: data });
}
