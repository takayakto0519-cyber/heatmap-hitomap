// PATCH /api/admin/sales-entries/bulk-assign — 複数の営業先（学校・法人／自治体）を
// まとめて1人の担当者に割り当てる（パスワード必須）。
// body: { items: { kind: 'lead' | 'municipality'; id: string }[]; assignedTo: string | null }
// client_leadsとmunicipality_profilesはテーブルが別なのでkindでid仕分けし、
// テーブルごとに1回ずつ.update({assigned_to}).in('id', ids)を呼ぶ（N回PATCHを避ける）。
// assigned_to専用のエンドポイントとし、他フィールドは一切触らない。
import { NextRequest, NextResponse } from 'next/server';
import { checkAdmin } from '@/lib/adminAuth';

const SUPABASE_READY = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL);

interface BulkAssignItem { kind: 'lead' | 'municipality'; id: string }

export async function PATCH(req: NextRequest) {
  if (!SUPABASE_READY) return NextResponse.json({ ok: false, error: 'Supabase未設定' }, { status: 503 });
  if (!checkAdmin(req)) return NextResponse.json({ ok: false, error: 'パスワードが違います' }, { status: 401 });

  const body = await req.json().catch(() => ({})) as { items?: BulkAssignItem[]; assignedTo?: string | null };
  const items = Array.isArray(body.items) ? body.items : [];
  if (items.length === 0) return NextResponse.json({ ok: false, error: '対象が選択されていません' }, { status: 400 });

  const leadIds = items.filter(i => i.kind === 'lead').map(i => i.id);
  const municipalityIds = items.filter(i => i.kind === 'municipality').map(i => i.id);
  const assignedTo = body.assignedTo?.trim() || null;
  const updated_at = new Date().toISOString();

  const { supabaseServer } = await import('@/lib/supabase/server');

  let leadError: string | null = null;
  let municipalityError: string | null = null;

  if (leadIds.length > 0) {
    const { error } = await supabaseServer.from('client_leads').update({ assigned_to: assignedTo, updated_at }).in('id', leadIds);
    if (error) leadError = error.message;
  }
  if (municipalityIds.length > 0) {
    const { error } = await supabaseServer.from('municipality_profiles').update({ assigned_to: assignedTo, updated_at }).in('id', municipalityIds);
    if (error) municipalityError = error.message;
  }

  if (leadError && municipalityError) {
    return NextResponse.json({ ok: false, error: `client_leads: ${leadError} / municipality_profiles: ${municipalityError}` }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    leadCount: leadIds.length, municipalityCount: municipalityIds.length,
    leadError, municipalityError,
  });
}
