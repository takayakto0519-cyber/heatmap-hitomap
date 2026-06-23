// POST /api/migrate — Supabase スキーマの自動マイグレーション
// ensure_schema() 関数を RPC で呼び出してカラムを自動追加する
import { NextResponse } from 'next/server';

const SUPABASE_READY = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function POST() {
  if (!SUPABASE_READY) {
    return NextResponse.json({ ok: false, error: 'Supabase未設定' }, { status: 503 });
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

// GET でも呼び出し可能にする（初回ロード時の自動実行用）
export async function GET() {
  return POST();
}
