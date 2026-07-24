// /api/admin/sales-settings — 営業運用設定（app_settings）の読み書き（パスワード必須）
//   GET ... 既定値と合成した現在の設定を返す
//   PUT ... { dailySendTarget } を受け取りupsertする
// site_settings（公開サイトの文言・PUT時にrevalidateSitePages()必須）とは別テーブル。
// ここは運営ダッシュボード内部の値なので、保存してもサイトの再生成は呼ばない。
import { NextRequest, NextResponse } from 'next/server';
import { checkAdmin } from '@/lib/adminAuth';
import { isMissingTable } from '@/lib/adminApi';
import { mergeSalesTargets, DEFAULT_SALES_TARGETS } from '@/lib/appSettings';

const SUPABASE_READY = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL);
const MIGRATION_FILE = 'supabase/migrations/20260723_add_app_settings.sql';

export async function GET(req: NextRequest) {
  if (!SUPABASE_READY) return NextResponse.json({ ok: false, error: 'Supabase未設定' }, { status: 503 });
  if (!checkAdmin(req)) return NextResponse.json({ ok: false, error: 'パスワードが違います' }, { status: 401 });

  const { supabaseServer } = await import('@/lib/supabase/server');
  const { data, error } = await supabaseServer.from('app_settings').select('key, value');
  if (error) {
    if (isMissingTable(error.message, 'app_settings')) {
      return NextResponse.json({ ok: true, settings: DEFAULT_SALES_TARGETS, needsMigration: true, migrationFile: MIGRATION_FILE });
    }
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, settings: mergeSalesTargets(data ?? []), defaults: DEFAULT_SALES_TARGETS });
}

export async function PUT(req: NextRequest) {
  if (!SUPABASE_READY) return NextResponse.json({ ok: false, error: 'Supabase未設定' }, { status: 503 });
  if (!checkAdmin(req)) return NextResponse.json({ ok: false, error: 'パスワードが違います' }, { status: 401 });

  const body = await req.json().catch(() => ({})) as { dailySendTarget?: number };
  if (!Number.isFinite(body.dailySendTarget) || (body.dailySendTarget as number) <= 0) {
    return NextResponse.json({ ok: false, error: 'dailySendTargetは1以上の数値で指定してください' }, { status: 400 });
  }

  const { supabaseServer } = await import('@/lib/supabase/server');
  const { error } = await supabaseServer.from('app_settings').upsert(
    { key: 'sales_targets', value: { dailySendTarget: body.dailySendTarget }, updated_at: new Date().toISOString() },
    { onConflict: 'key' },
  );
  if (error) {
    if (isMissingTable(error.message, 'app_settings')) {
      return NextResponse.json({ ok: false, error: `app_settingsテーブルが未作成です。${MIGRATION_FILE} をSQL Editorで実行してください` }, { status: 503 });
    }
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  const { data } = await supabaseServer.from('app_settings').select('key, value');
  return NextResponse.json({ ok: true, settings: mergeSalesTargets(data ?? []) });
}
