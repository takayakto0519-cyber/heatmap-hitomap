// GET /api/admin/attachment — 愛着計測（パスワード必須）
//   ?region=<地域名> ... 縁の螺旋ファネル（地・理・心の段階別人数と到達率）
//   ?event=<slug>    ... イベント前後の感情変化と再訪率
// 自治体向け「関係人口・愛着レポート」の一次データ。応答は件数・割合のみで、
// 個人を特定できる値は一切含めない（詳細は lib/attachment.ts の設計原則を参照）。
import { NextRequest, NextResponse } from 'next/server';
import { checkAdmin } from '@/lib/adminAuth';
import { computeAttachmentFunnel, computeEventEmotionShift } from '@/lib/attachment';

const SUPABASE_READY = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL);

export async function GET(req: NextRequest) {
  if (!SUPABASE_READY) {
    return NextResponse.json({ ok: false, error: 'Supabase未設定' }, { status: 503 });
  }
  if (!checkAdmin(req)) {
    return NextResponse.json({ ok: false, error: 'パスワードが違います' }, { status: 401 });
  }

  const region = req.nextUrl.searchParams.get('region');
  const event = req.nextUrl.searchParams.get('event');

  const { supabaseServer } = await import('@/lib/supabase/server');

  if (region) {
    const result = await computeAttachmentFunnel(supabaseServer, region);
    return NextResponse.json(result, { status: result.ok ? 200 : 500 });
  }
  if (event) {
    const result = await computeEventEmotionShift(supabaseServer, event);
    // 「イベントが見つかりません」等は呼び出し側の指定ミスなので404で返す
    return NextResponse.json(result, { status: result.ok ? 200 : 404 });
  }

  return NextResponse.json(
    { ok: false, error: 'region または event のどちらかを指定してください' },
    { status: 400 }
  );
}
