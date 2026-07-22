// GET /api/cron/todo-calendar-sync — Vercel Cronから毎日1回呼ばれる。
// 秘書タブが提示する「会長対応待ちのTo-Do」「営業リードの未接触・要フォロー先」
// 「案件パイプラインの次アクション」を、Googleカレンダーにも予定として追記する。
//
// なぜ深夜帯1時間なのか：
// /scheduleの空き枠計算（lib/googleCalendarServer.ts）は9:00〜23:00だけを対象にしている。
// ここで作る予定はあくまで「会長への通知・リマインダー」であり実際の面談ではないため、
// 終日予定にすると（Googleカレンダー上は終日でもfreeBusyでは丸1日busy扱いになりうる）
// 面談予約の空き枠計算に干渉してしまう。営業時間の外である23:30〜翌0:30に置くことで、
// 実際の面談予定とは絶対にぶつからないようにしている。時間は会長が後で手動で動かせばよい。
//
// 二重登録防止：AI APIは使わず、site_settingsに同期済みマーカー（例: action_item:{id}）の
// 配列を保存しておき、次回以降は同じ項目を再登録しない（gmail-watchのSEEN_SCHEDULING_IDS_KEYと同じ手法）。
// 項目が完了/解決してもマーカーは消さない（一度作った予定を勝手に消したりしない。片付けは会長が行う）。
import { NextRequest, NextResponse } from 'next/server';
import { notifyDiscord, notifyDiscordError } from '@/lib/discord';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const maxDuration = 60;

const SUPABASE_READY = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL);
const SEEN_KEY = 'todo_calendar_sync_seen';
const SEEN_MAX = 3000;
const REMINDER_DURATION_MIN = 60;
const REMINDER_START_HOUR = 23;
const REMINDER_START_MINUTE = 30;

interface ReminderCandidate {
  marker: string;
  summary: string;
  description: string;
}

// 今日（JST）の23:30〜0:30をISO8601で返す
function reminderWindowTonight(): { startTime: string; endTime: string } {
  const jst = new Date(Date.now() + 9 * 3600_000);
  const y = jst.getUTCFullYear(); const m = jst.getUTCMonth() + 1; const d = jst.getUTCDate();
  const pad = (n: number) => String(n).padStart(2, '0');
  const startTime = `${y}-${pad(m)}-${pad(d)}T${pad(REMINDER_START_HOUR)}:${pad(REMINDER_START_MINUTE)}:00+09:00`;
  const endTime = new Date(new Date(startTime).getTime() + REMINDER_DURATION_MIN * 60_000).toISOString();
  return { startTime, endTime };
}

export async function GET(req: NextRequest) {
  if (!SUPABASE_READY) return NextResponse.json({ ok: false, error: 'Supabase未設定' }, { status: 503 });

  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = req.headers.get('authorization');
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ ok: false, error: '認証に失敗しました' }, { status: 401 });
    }
  }

  const { supabaseServer } = await import('@/lib/supabase/server');
  const candidates: ReminderCandidate[] = [];
  const errors: { source: string; error: string }[] = [];

  // ① 会長対応待ちのTo-Do（action_items、秘書タブ「今日やること」の元データ）
  try {
    const { data, error } = await supabaseServer
      .from('action_items').select('id, title, category, notes, due_date')
      .in('status', ['todo', 'manual_required']);
    if (error) throw new Error(error.message);
    for (const item of (data ?? []) as { id: string; title: string; category: string | null; notes: string | null; due_date: string | null }[]) {
      candidates.push({
        marker: `action_item:${item.id}`,
        summary: `🔔 [To-Do] ${item.title}`,
        description: [
          item.category ? `カテゴリ：${item.category}` : null,
          item.due_date ? `期限：${item.due_date}` : null,
          item.notes || null,
          '運営ダッシュボード「秘書」タブで詳細確認。',
        ].filter(Boolean).join('\n'),
      });
    }
  } catch (e) {
    errors.push({ source: 'action_items', error: e instanceof Error ? e.message : String(e) });
  }

  // ② 営業リード（client_leads）の未接触・要フォロー先
  try {
    const { data, error } = await supabaseServer
      .from('client_leads').select('id, org_name, client_type, status, email_sent_at, email_reply')
      .not('status', 'in', '(contracted,lost)');
    if (error) throw new Error(error.message);
    const { computeFollowUp } = await import('@/lib/followUp');
    for (const lead of (data ?? []) as { id: string; org_name: string; client_type: string; status: string; email_sent_at: string | null; email_reply: string | null }[]) {
      const isUncontacted = lead.status === 'lead';
      const followUp = computeFollowUp({ email_sent_at: lead.email_sent_at, email_reply: lead.email_reply });
      const needsFollowUp = followUp?.status === 'due_soon' || followUp?.status === 'overdue';
      if (!isUncontacted && !needsFollowUp) continue;
      const typeLabel = lead.client_type === 'school' ? '学校' : '法人・自治体';
      candidates.push({
        marker: `lead:${lead.id}`,
        summary: `🔔 [営業] ${lead.org_name}へ${isUncontacted ? '初回接触' : 'フォロー'}`,
        description: [
          `種別：${typeLabel}`,
          isUncontacted ? 'まだ接触していません。' : (followUp?.label ?? ''),
          '運営ダッシュボード「営業」タブで詳細確認。',
        ].filter(Boolean).join('\n'),
      });
    }
  } catch (e) {
    errors.push({ source: 'client_leads', error: e instanceof Error ? e.message : String(e) });
  }

  // ③ 案件パイプライン（business_cases）の次アクション
  try {
    const { data, error } = await supabaseServer
      .from('business_cases').select('id, org_name, stage, next_action')
      .not('next_action', 'is', null).neq('next_action', '').neq('stage', '見送り');
    if (error) throw new Error(error.message);
    for (const c of (data ?? []) as { id: string; org_name: string; stage: string; next_action: string }[]) {
      candidates.push({
        marker: `case:${c.id}`,
        summary: `🔔 [案件] ${c.org_name}：${c.next_action}`,
        description: [
          `ステージ：${c.stage}`,
          '運営ダッシュボード「営業」タブで詳細確認。',
        ].join('\n'),
      });
    }
  } catch (e) {
    errors.push({ source: 'business_cases', error: e instanceof Error ? e.message : String(e) });
  }

  // 既に同期済みのものを除外
  const { data: seenRow } = await supabaseServer
    .from('site_settings').select('value').eq('key', SEEN_KEY).maybeSingle();
  const seenMarkers = new Set<string>(Array.isArray(seenRow?.value) ? seenRow.value as string[] : []);
  const fresh = candidates.filter((c) => !seenMarkers.has(c.marker));

  if (fresh.length === 0) {
    return NextResponse.json({ ok: true, created: 0, skipped: candidates.length, errors });
  }

  const { createCalendarEvent } = await import('@/lib/googleCalendarServer');
  const { startTime, endTime } = reminderWindowTonight();
  let created = 0;
  const createErrors: { marker: string; error: string }[] = [];

  for (const c of fresh) {
    try {
      await createCalendarEvent({
        summary: c.summary,
        description: `${c.description}\n\n[hm-sync:${c.marker}]`,
        startTime, endTime,
      });
      seenMarkers.add(c.marker);
      created++;
    } catch (e) {
      createErrors.push({ marker: c.marker, error: e instanceof Error ? e.message : String(e) });
    }
  }

  const trimmed = [...seenMarkers].slice(-SEEN_MAX);
  await supabaseServer.from('site_settings').upsert(
    { key: SEEN_KEY, value: trimmed, updated_at: new Date().toISOString() },
    { onConflict: 'key' }
  );

  if (created > 0) {
    notifyDiscord(
      `🗓️ To-Do・営業リストから${created}件をGoogleカレンダーに追記しました（本日23:30〜の仮枠）\n` +
      '実際にやる時間へは手動で動かしてください。'
    );
  }
  for (const e of errors) notifyDiscordError('todo-calendar-sync', new Error(`${e.source}: ${e.error}`));
  for (const e of createErrors) notifyDiscordError('todo-calendar-sync:create', new Error(`${e.marker}: ${e.error}`));

  return NextResponse.json({ ok: true, created, skipped: candidates.length - fresh.length, createErrors, errors });
}
