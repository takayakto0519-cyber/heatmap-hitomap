// POST /api/schedule — 公開・ログイン不要。日程調整の「仮リクエスト」を受け付ける。
// traces/reports と同じ型：匿名POST→レート制限→保存→Discord通知→会長が別途確認。
// ここではGoogleカレンダーには一切書き込まない（会長が管理画面で「確定」を押した時だけ書き込む）。
import { NextRequest, NextResponse } from 'next/server';
import { notifyDiscord } from '@/lib/discord';
import { isRateLimited } from '@/lib/rateLimit';

const ALLOWED_DURATIONS = [15, 30, 45, 60];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: NextRequest) {
  // 連投防止（正当な予約依頼が1時間に5件を超えることはまず無い）
  if (isRateLimited(req, 'schedule', 60 * 60_000, 5)) {
    return NextResponse.json({ ok: false, error: 'リクエストが続きすぎています。しばらくしてから再度お試しください' }, { status: 429 });
  }

  const body = await req.json().catch(() => ({})) as {
    name?: string; email?: string; company?: string; purpose?: string;
    duration_minutes?: number; start?: string;
  };

  const name = body.name?.trim();
  const email = body.email?.trim();
  const start = body.start;
  const duration = ALLOWED_DURATIONS.includes(Number(body.duration_minutes)) ? Number(body.duration_minutes) : 30;

  if (!name) return NextResponse.json({ ok: false, error: 'お名前は必須です' }, { status: 400 });
  if (!email || !EMAIL_RE.test(email)) return NextResponse.json({ ok: false, error: 'メールアドレスの形式が正しくありません' }, { status: 400 });
  if (!start) return NextResponse.json({ ok: false, error: '希望日時が選択されていません' }, { status: 400 });

  const startDate = new Date(start);
  if (Number.isNaN(startDate.getTime())) {
    return NextResponse.json({ ok: false, error: '希望日時の形式が正しくありません' }, { status: 400 });
  }
  if (startDate.getTime() < Date.now() - 60_000) {
    return NextResponse.json({ ok: false, error: '過去の日時は選択できません' }, { status: 400 });
  }
  const endDate = new Date(startDate.getTime() + duration * 60_000);

  const { supabaseServer } = await import('@/lib/supabase/server');
  const { data, error } = await supabaseServer
    .from('booking_requests')
    .insert({
      name,
      email,
      company: body.company?.trim() || null,
      purpose: body.purpose?.trim() || null,
      duration_minutes: duration,
      requested_start: startDate.toISOString(),
      requested_end: endDate.toISOString(),
    })
    .select().single();

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  const when = startDate.toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo', month: 'numeric', day: 'numeric', weekday: 'short', hour: '2-digit', minute: '2-digit' });
  notifyDiscord(
    `📅 日程調整の依頼が届きました\n` +
    `${name}様（${email}）${body.company ? ` ・ ${body.company}` : ''}\n` +
    `希望日時：${when}〜（${duration}分）${body.purpose ? `\n用件：${body.purpose}` : ''}\n` +
    `運営ダッシュボードで確定/却下してください`
  );

  return NextResponse.json({ ok: true, request: data });
}
