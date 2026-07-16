// POST /api/migrate — Supabase スキーマの自動マイグレーション（運営パスワード必須）
// ensure_schema() 関数を RPC で呼び出してカラムを自動追加する。
// かつては地図の初回ロードから無認証GETで自動実行していたが、スキーマ変更を
// 誰でも起動できる状態は危険なため、運営ダッシュボードからの明示実行に限定した。
import { NextRequest, NextResponse } from 'next/server';
import { checkAdmin } from '@/lib/adminAuth';

const SUPABASE_READY = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function POST(req: NextRequest) {
  if (!SUPABASE_READY) {
    return NextResponse.json({ ok: false, error: 'Supabase未設定' }, { status: 503 });
  }
  if (!checkAdmin(req)) {
    return NextResponse.json({ ok: false, error: 'パスワードが違います' }, { status: 401 });
  }
  try {
    const { supabaseServer } = await import('@/lib/supabase/server');
    const { error } = await supabaseServer.rpc('ensure_schema');
    if (error) {
      // 関数が未作成の場合のエラーを分かりやすく返す
      if (error.message.includes('ensure_schema')) {
        return NextResponse.json({
          ok: false,
          error: 'ensure_schema 関数が未作成です。Supabase SQL Editor で setup SQL を実行してください。',
          needsSetup: true,
        }, { status: 503 });
      }
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true, message: 'スキーマ最新化完了' });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
