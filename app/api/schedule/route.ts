// POST /api/schedule — 公開・ログイン不要。日程調整の「仮リクエスト」を受け付ける。
// traces/reports と同じ型：匿名POST→レート制限→保存→Discord通知→会長が別途確認。
// ここではGoogleカレンダーには一切書き込まない（会長が管理画面で「確定」を押した時だけ書き込む）。
//
// 訪問者は候補を3つ以上出す（急な予定変更があっても会長が確定前に他の候補へ切り替えられるように）。
// 送信時点ではまだどれか1つに決まっていないため、requested_start/requested_endはNULLのまま
// candidate_slotsに全候補を保存する（確定はPATCH /api/admin/booking-requests/[id]で行う）。
import { NextRequest, NextResponse } from 'next/server';
import { notifyDiscord } from '@/lib/discord';
import { isRateLimited } from '@/lib/rateLimit';

const ALLOWED_DURATIONS = [15, 30, 45, 60];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_CANDIDATES = 3;

export async function POST(req: NextRequest) {
  // 連投防止（正当な予約依頼が1時間に5件を超えることはまず無い）
  if (isRateLimited(req, 'schedule', 60 * 60_000, 5)) {
    return NextResponse.json({ ok: false, error: 'リクエストが続きすぎています。しばらくしてから再度お試しください' }, { status: 429 });
  }

  const body = await req.json().catch(() => ({})) as {
    name?: string; email?: string; company?: string; purpose?: string;
    duration_minutes?: number; candidates?: { start?: string }[];
  };

  const name = body.name?.trim();
  const email = body.email?.trim();
  const duration = ALLOWED_DURATIONS.includes(Number(body.duration_minutes)) ? Number(body.duration_minutes) : 30;

  if (!name) return NextResponse.json({ ok: false, error: 'お名前は必須です' }, { status: 400 });
  if (!email || !EMAIL_RE.test(email)) return NextResponse.json({ ok: false, error: 'メールアドレスの形式が正しくありません' }, { status: 400 });

  const rawCandidates = Array.isArray(body.candidates) ? body.candidates : [];
  if (rawCandidates.length < MIN_CANDIDATES) {
    return NextResponse.json({ ok: false, error: `候補は${MIN_CANDIDATES}件以上選択してください` }, { status: 400 });
  }

  const seenStarts = new Set<string>();
  const candidateSlots: { start: string; end: string }[] = [];
  for (const c of rawCandidates) {
    if (!c.start) return NextResponse.json({ ok: false, error: '候補の日時が正しくありません' }, { status: 400 });
    const startDate = new Date(c.start);
    if (Number.isNaN(startDate.getTime())) {
      return NextResponse.json({ ok: false, error: '候補の日時の形式が正しくありません' }, { status: 400 });
    }
    if (startDate.getTime() < Date.now() - 60_000) {
      return NextResponse.json({ ok: false, error: '過去の日時は候補に選べません' }, { status: 400 });
    }
    const startIso = startDate.toISOString();
    if (seenStarts.has(startIso)) continue; // 重複候補は1件にまとめる
    seenStarts.add(startIso);
    const endDate = new Date(startDate.getTime() + duration * 60_000);
    candidateSlots.push({ start: startIso, end: endDate.toISOString() });
  }
  if (candidateSlots.length < MIN_CANDIDATES) {
    return NextResponse.json({ ok: false, error: `候補は重複を除いて${MIN_CANDIDATES}件以上必要です` }, { status: 400 });
  }
  candidateSlots.sort((a, b) => a.start.localeCompare(b.start));

  const { supabaseServer } = await import('@/lib/supabase/server');
  const { data, error } = await supabaseServer
    .from('booking_requests')
    .insert({
      name,
      email,
      company: body.company?.trim() || null,
      purpose: body.purpose?.trim() || null,
      duration_minutes: duration,
      candidate_slots: candidateSlots,
    })
    .select().single();

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  const whenList = candidateSlots
    .map((s) => new Date(s.start).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo', month: 'numeric', day: 'numeric', weekday: 'short', hour: '2-digit', minute: '2-digit' }))
    .join(' / ');
  notifyDiscord(
    `📅 日程調整の依頼が届きました（候補${candidateSlots.length}件）\n` +
    `${name}様（${email}）${body.company ? ` ・ ${body.company}` : ''}\n` +
    `候補日時：${whenList}（${duration}分）${body.purpose ? `\n用件：${body.purpose}` : ''}\n` +
    `運営ダッシュボードで候補から1つ選んで確定/却下してください`
  );

  // メール通知（失敗しても送信リクエスト自体は既に保存済みなので、応答は失敗させない）
  try {
    const { sendEmail, OWN_ADDRESS } = await import('@/lib/gmailServer');

    // ① 送信者本人へ：受付確認（この時点ではまだ確定していない旨を明記）
    await sendEmail({
      to: email,
      subject: '【ヒトマップ】日程調整のリクエストを受け付けました',
      body: [
        `${name} 様`,
        '',
        '日程調整のリクエストを受け付けました。ありがとうございます。',
        '',
        `候補日時（${candidateSlots.length}件）：`,
        whenList,
        '',
        'この中から担当者が1つを選び、確定いたします。確定まで今しばらくお待ちください。',
        '確定後、Google Meet（オンライン会議）の招待メールを改めてお送りします。',
        '',
        'ヒトマップ',
      ].join('\n'),
    });

    // ② 運営（hitomap.info@gmail.com）へ：新規リクエスト到着の通知
    await sendEmail({
      to: OWN_ADDRESS,
      subject: `【ヒトマップ】日程調整の新規リクエスト（${name}様）`,
      body: [
        `${name} 様（${email}）${body.company ? ` ・ ${body.company}` : ''} から日程調整のリクエストが届きました。`,
        '',
        `候補日時（${candidateSlots.length}件・${duration}分）：`,
        whenList,
        body.purpose ? `\n用件：${body.purpose}` : '',
        '',
        '運営ダッシュボードの「日程調整」パネルで候補から1つ選んで確定/却下してください。',
        'https://hitomap.com/admin/dashboard?tab=secretary',
      ].filter(Boolean).join('\n'),
    });
  } catch {
    // メール送信失敗はリクエスト受付自体を失敗させない（Discord通知は既に送信済み）
  }

  return NextResponse.json({ ok: true, request: data });
}
