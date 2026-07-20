// GET /api/cron/gmail-watch — Vercel Cronから8時間おき(毎日01:10/09:10/17:10 JST)に呼ばれる。
// agents/gmail_watch.py（会長のPC上のWindowsタスクスケジューラでしか動かない）と同じロジックを、
// PCが閉じていても動くようVercel Cron + lib/gmailServer.tsに移植したもの。
//
// やること（gmail_watch.pyと同じ）：
//  ① municipality_profiles（contact_emailが入っている行）ごとに、
//     送信済みか・実際に送った本文・相手からの返信本文を確認し、email_sent_at/email_sent_content/email_reply を更新。
//     新しく返信が付いた自治体があればDiscordに通知（自動返信かどうかは判定しない＝どんな返信でも反映・通知する）。
//  ② 受信箱全体（直近2日・学校/法人宛も含む）から日程調整を求めていそうなメールを検知し、
//     client_leads / sales_email_targets / municipality_profiles のいずれかに登録済みならscheduling_request_detected_atを更新。
//     二重通知を防ぐため、通知済みメッセージIDをsite_settingsに保存する。
//
// 読み取り専用スコープ(gmail.readonly)。メールの送信・削除・変更は一切しない。
import { NextRequest, NextResponse } from 'next/server';
import { checkThreadForContact, scanInboxForSchedulingRequests, OWN_ADDRESS } from '@/lib/gmailServer';
import { listUpcomingEventsGrouped } from '@/lib/googleCalendarServer';
import { notifyDiscord, notifyDiscordError } from '@/lib/discord';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const SUPABASE_READY = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL);
const SCAN_WINDOW_DAYS = 2;
const SEEN_SCHEDULING_IDS_KEY = 'gmail_watch_scheduling_seen';
const SEEN_SCHEDULING_IDS_MAX = 500;

interface MunicipalityProfileRow {
  id: string;
  region_name: string;
  contact_email: string | null;
  email_sent_at: string | null;
  email_sent_content: string | null;
  email_reply: string | null;
}

const CONTACT_TABLES: { table: string; emailCol: string; nameCol: string }[] = [
  { table: 'client_leads', emailCol: 'email', nameCol: 'org_name' },
  { table: 'sales_email_targets', emailCol: 'email', nameCol: 'company' },
  { table: 'municipality_profiles', emailCol: 'contact_email', nameCol: 'region_name' },
];

function sendDiscordMessage(content: string) {
  // gmail_watch.pyの投稿名(username)は素のwebhook POSTでしか設定できないため、
  // lib/discord.tsのnotifyDiscordはそのまま使い、送信元が分かるよう先頭に絵文字ラベルを付ける
  notifyDiscord(content);
}

async function computeOpenDays(maxDays = 5): Promise<string[]> {
  try {
    const groups = await listUpcomingEventsGrouped(14);
    const weekdayLabels = ['日', '月', '火', '水', '木', '金', '土'];
    const openDays: string[] = [];
    for (const day of groups) {
      const d = new Date(`${day.date}T00:00:00+09:00`);
      const weekday = d.getDay();
      if (weekday === 0 || weekday === 6) continue; // 土日は除外
      if (day.events.length <= 2) {
        openDays.push(`${d.getMonth() + 1}/${d.getDate()}(${weekdayLabels[weekday]})`);
      }
      if (openDays.length >= maxDays) break;
    }
    return openDays;
  } catch {
    return []; // カレンダー未連携でも本処理は止めない
  }
}

export async function GET(req: NextRequest) {
  if (!SUPABASE_READY) return NextResponse.json({ ok: false, error: 'Supabase未設定' }, { status: 503 });

  // Vercel Cronからの呼び出しか、CRON_SECRETによる手動確認かのみ許可する
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = req.headers.get('authorization');
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ ok: false, error: '認証に失敗しました' }, { status: 401 });
    }
  }

  const { supabaseServer } = await import('@/lib/supabase/server');

  // ① 自治体プロファイルの返信チェック
  const { data: profilesData, error: profilesError } = await supabaseServer
    .from('municipality_profiles')
    .select('id, region_name, contact_email, email_sent_at, email_sent_content, email_reply')
    .not('contact_email', 'is', null);

  if (profilesError) {
    notifyDiscordError('gmail-watch', profilesError);
    return NextResponse.json({ ok: false, error: profilesError.message }, { status: 500 });
  }

  const profiles = (profilesData ?? []) as MunicipalityProfileRow[];
  let checked = 0;
  let updated = 0;
  const errors: { region_name: string; error: string }[] = [];
  const newReplies: { region_name: string; reply: string }[] = [];

  for (const p of profiles) {
    const contact = (p.contact_email ?? '').trim();
    if (!contact) continue;
    checked++;
    let status;
    try {
      status = await checkThreadForContact(contact);
    } catch (e) {
      errors.push({ region_name: p.region_name, error: e instanceof Error ? e.message : String(e) });
      continue;
    }

    const patch: Record<string, unknown> = {};
    if (status.sent && !p.email_sent_at) patch.email_sent_at = new Date().toISOString();
    if (status.sentContent && status.sentContent !== (p.email_sent_content ?? '')) patch.email_sent_content = status.sentContent;
    // どんな返信でも（自動返信かどうかを判定せず）反映・通知する
    if (status.reply && status.reply !== (p.email_reply ?? '')) {
      patch.email_reply = status.reply;
      newReplies.push({ region_name: p.region_name, reply: status.reply });
    }

    if (Object.keys(patch).length > 0) {
      const { error: patchError } = await supabaseServer.from('municipality_profiles').update(patch).eq('id', p.id);
      if (patchError) errors.push({ region_name: p.region_name, error: patchError.message });
      else updated++;
    }
  }

  if (newReplies.length > 0) {
    const lines = [`**📬 自治体から新しい返信が届きました（${newReplies.length}件）**`];
    for (const r of newReplies) {
      const preview = r.reply.slice(0, 120).replace(/\n/g, ' ');
      lines.push(`・${r.region_name}：${preview}${r.reply.length > 120 ? '…' : ''}`);
    }
    lines.push('運営ダッシュボードの「関係人口」タブで全文を確認してください。');
    sendDiscordMessage(lines.join('\n'));
  }

  // ② 受信箱全体からの日程調整検知
  let schedulingHits: Awaited<ReturnType<typeof scanInboxForSchedulingRequests>> = [];
  let schedulingError: string | null = null;
  try {
    schedulingHits = await scanInboxForSchedulingRequests(SCAN_WINDOW_DAYS);
  } catch (e) {
    schedulingError = e instanceof Error ? e.message : String(e);
  }

  let newSchedulingCount = 0;
  if (schedulingHits.length > 0) {
    const { data: seenRow } = await supabaseServer
      .from('site_settings').select('value').eq('key', SEEN_SCHEDULING_IDS_KEY).maybeSingle();
    const seenIds = new Set<string>(Array.isArray(seenRow?.value) ? seenRow.value as string[] : []);
    const newHits = schedulingHits.filter(h => !seenIds.has(h.messageId));

    if (newHits.length > 0) {
      const matchedHits: (typeof newHits[number] & { matchedName?: string })[] = [];
      for (const hit of newHits) {
        let matchedName: string | undefined;
        for (const { table, emailCol, nameCol } of CONTACT_TABLES) {
          const { data: rows } = await supabaseServer
            .from(table).select(`id, ${nameCol}`).ilike(emailCol, hit.fromEmail).limit(1);
          const row = rows?.[0] as Record<string, unknown> | undefined;
          if (row) {
            matchedName = (row[nameCol] as string) ?? hit.fromEmail;
            await supabaseServer.from(table).update({ scheduling_request_detected_at: new Date().toISOString() }).eq('id', row.id);
            break;
          }
        }
        matchedHits.push({ ...hit, matchedName });
      }

      const openDays = await computeOpenDays();
      const daysLine = openDays.length > 0 ? openDays.join('・') : '（カレンダー未連携のため空き日を計算できません）';
      const lines = [`**📅 日程調整を求める返信が届いています（${matchedHits.length}件）**`];
      for (const h of matchedHits) {
        const who = h.fromName !== h.fromEmail ? `${h.fromName}（${h.fromEmail}）` : h.fromEmail;
        const matched = h.matchedName ? ` ・${h.matchedName}として登録済み` : '';
        lines.push(`・${who}${matched} — 「${h.subject || h.preview}」`);
      }
      lines.push(`空いてそうな日: ${daysLine}`);
      lines.push('※簡易判定です。実際に返信する前にカレンダーで最終確認してください。');
      sendDiscordMessage(lines.join('\n'));

      newSchedulingCount = newHits.length;
      const trimmed = [...seenIds, ...newHits.map(h => h.messageId)].slice(-SEEN_SCHEDULING_IDS_MAX);
      await supabaseServer.from('site_settings').upsert(
        { key: SEEN_SCHEDULING_IDS_KEY, value: trimmed, updated_at: new Date().toISOString() },
        { onConflict: 'key' }
      );
    }
  }

  return NextResponse.json({
    ok: true,
    ownAddress: OWN_ADDRESS,
    checked,
    updated,
    newReplies: newReplies.length,
    errors,
    schedulingChecked: schedulingHits.length,
    schedulingNew: newSchedulingCount,
    schedulingError,
  });
}
