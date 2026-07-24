// /api/admin/settings — サイト設定の読み書き（運営ダッシュボード用・パスワード必須）
//   GET ... 既定値と合成した現在の設定を返す
//   PUT ... { hero?, announcement? } を受け取り、キーごとにupsertする
import { NextRequest, NextResponse } from 'next/server';
import { checkAdmin } from '@/lib/adminAuth';
import { mergeSiteSettings, DEFAULT_SITE_SETTINGS, type HeroSettings, type AnnouncementSettings } from '@/lib/siteSettings';
import { revalidateSitePages } from '@/lib/revalidateSite';

const SUPABASE_READY = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL);

export async function GET(req: NextRequest) {
  if (!SUPABASE_READY) return NextResponse.json({ ok: false, error: 'Supabase未設定' }, { status: 503 });
  if (!checkAdmin(req)) return NextResponse.json({ ok: false, error: 'パスワードが違います' }, { status: 401 });

  const { supabaseServer } = await import('@/lib/supabase/server');
  const { data, error } = await supabaseServer.from('site_settings').select('key, value');
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, settings: mergeSiteSettings(data ?? []), defaults: DEFAULT_SITE_SETTINGS });
}

export async function PUT(req: NextRequest) {
  if (!SUPABASE_READY) return NextResponse.json({ ok: false, error: 'Supabase未設定' }, { status: 503 });
  if (!checkAdmin(req)) return NextResponse.json({ ok: false, error: 'パスワードが違います' }, { status: 401 });

  const body = await req.json().catch(() => ({})) as {
    hero?: Partial<HeroSettings>;
    announcement?: Partial<AnnouncementSettings>;
    home_photo_grid?: string[];
  };

  const rows: { key: string; value: unknown; updated_at: string }[] = [];
  const now = new Date().toISOString();
  if (body.hero) rows.push({ key: 'hero', value: body.hero, updated_at: now });
  if (body.announcement) rows.push({ key: 'announcement', value: body.announcement, updated_at: now });
  if (body.home_photo_grid) rows.push({ key: 'home_photo_grid', value: body.home_photo_grid, updated_at: now });
  if (rows.length === 0) return NextResponse.json({ ok: false, error: '保存する項目がありません' }, { status: 400 });

  const { supabaseServer } = await import('@/lib/supabase/server');
  const { error } = await supabaseServer.from('site_settings').upsert(rows, { onConflict: 'key' });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  revalidateSitePages(); // 保存した瞬間にサイトへ反映（ISRの60秒待ちをなくす）

  const { data } = await supabaseServer.from('site_settings').select('key, value');
  return NextResponse.json({ ok: true, settings: mergeSiteSettings(data ?? []) });
}
