// GET/POST /api/admin/municipality-profiles — 自治体プロファイルの管理（パスワード必須）
// 関係人口ダッシュボードの一部。営業対象・実証先の自治体ごとに、調べた内容・関係人口創出の
// 取り組みの有無・ヒトマップとの親和性・提案余地をまとめて残す。
import { NextRequest, NextResponse } from 'next/server';
import { checkAdmin } from '@/lib/adminAuth';
import { isMissingTable, missingTablePayload } from '@/lib/adminApi';

const SUPABASE_READY = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL);
const MIGRATION_FILE = 'supabase/migrations/20260719_add_municipality_profiles.sql';

export async function GET(req: NextRequest) {
  if (!SUPABASE_READY) return NextResponse.json({ ok: false, error: 'Supabase未設定' }, { status: 503 });
  if (!checkAdmin(req)) return NextResponse.json({ ok: false, error: 'パスワードが違います' }, { status: 401 });

  const { supabaseServer } = await import('@/lib/supabase/server');
  const { data, error } = await supabaseServer
    .from('municipality_profiles').select('*').order('region_name', { ascending: true });

  if (error) {
    // テーブル未作成（SQL未適用）のときは画面を壊さず、どのSQLを流せばよいかを伝える
    if (isMissingTable(error.message, 'municipality_profiles')) return NextResponse.json(missingTablePayload('profiles', MIGRATION_FILE));
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, profiles: data ?? [] });
}

export async function POST(req: NextRequest) {
  if (!SUPABASE_READY) return NextResponse.json({ ok: false, error: 'Supabase未設定' }, { status: 503 });
  if (!checkAdmin(req)) return NextResponse.json({ ok: false, error: 'パスワードが違います' }, { status: 401 });

  const body = await req.json().catch(() => ({})) as {
    region_name?: string; engagement_stage?: string;
    evidence_summary?: string | null; relation_population_initiative?: string | null;
    fit_assessment?: string | null; opportunity_level?: string; opportunity_notes?: string | null;
    source_links?: string | null; contact_email?: string | null; email_draft?: string | null;
    email_sent_at?: string | null; email_reply?: string | null; is_priority_pick?: boolean;
  };
  if (!body.region_name?.trim()) return NextResponse.json({ ok: false, error: '自治体名は必須です' }, { status: 400 });

  const { supabaseServer } = await import('@/lib/supabase/server');
  const { data, error } = await supabaseServer
    .from('municipality_profiles')
    .upsert({
      region_name: body.region_name.trim(),
      engagement_stage: body.engagement_stage?.trim() || 'lead',
      evidence_summary: body.evidence_summary?.trim() || null,
      relation_population_initiative: body.relation_population_initiative?.trim() || null,
      fit_assessment: body.fit_assessment?.trim() || null,
      opportunity_level: body.opportunity_level?.trim() || '中',
      opportunity_notes: body.opportunity_notes?.trim() || null,
      source_links: body.source_links?.trim() || null,
      contact_email: body.contact_email?.trim() || null,
      email_draft: body.email_draft?.trim() || null,
      email_sent_at: body.email_sent_at || null,
      email_reply: body.email_reply?.trim() || null,
      is_priority_pick: body.is_priority_pick ?? false,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'region_name' })
    .select().single();

  if (error) {
    if (isMissingTable(error.message, 'municipality_profiles')) {
      return NextResponse.json({ ok: false, error: `自治体プロファイルのテーブルが未作成です。${MIGRATION_FILE} をSQL Editorで実行してください` }, { status: 503 });
    }
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, profile: data });
}
