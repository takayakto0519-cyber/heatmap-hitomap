// GET /api/cron/gmail-watch — Vercel Cronから8時間おき(毎日01:10/09:10/17:10 JST)に呼ばれる。
// agents/gmail_watch.py（会長のPC上のWindowsタスクスケジューラでしか動かない）と同じロジックを、
// PCが閉じていても動くようVercel Cron + lib/gmailServer.tsに移植したもの。
//
// やること（gmail_watch.pyと同じ）：
//  ① client_leads・sales_email_targets・municipality_profiles（連絡先メールが入っている行）ごとに、
//     送信済みか・実際に送った本文・相手からの返信本文を確認し、email_sent_at/email_reply を更新
//     （email_sent_contentはmunicipality_profilesのみ持つ列）。
//     以前は自治体だけが対象で、学校・法人（client_leads）と便り（sales_email_targets）は
//     会長が手動でしか反映できず、営業タブの返信率KPIやフォローキューが不正確だった。
//     新しく返信が付いた相手があればDiscordに通知（自動返信かどうかは判定しない＝どんな返信でも反映・通知する）。
//  ② 受信箱全体（直近2日・学校/法人宛も含む）に届いた「自分が送った以外」の全メールを検知し
//     （日程調整キーワードを含むかどうかに関わらず＝自動返信・不在通知なども対象）、
//     client_leads / sales_email_targets / municipality_profiles のいずれかに登録済みなら
//     Discordに通知する。日程調整キーワードを含む場合はscheduling_request_detected_atも更新する。
//     二重通知を防ぐため、通知済みメッセージIDをsite_settingsに保存する。
//
// 読み取り専用スコープ(gmail.readonly)。メールの送信・削除・変更は一切しない。
import { NextRequest, NextResponse } from 'next/server';
import { checkThreadForContact, scanInboxMessages, OWN_ADDRESS } from '@/lib/gmailServer';
import { listUpcomingEventsGrouped } from '@/lib/googleCalendarServer';
import { notifyDiscord, notifyDiscordError } from '@/lib/discord';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const maxDuration = 60;

const SUPABASE_READY = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL);
const SCAN_WINDOW_DAYS = 2;
// キー名はscheduling時代の名残だが、値の実体は「受信箱スキャンで既に通知済みのメッセージID」全般に拡張して使う
const SEEN_SCHEDULING_IDS_KEY = 'gmail_watch_scheduling_seen';
const SEEN_SCHEDULING_IDS_MAX = 500;

interface ContactRow {
  id: string;
  name: string;
  email: string | null;
  email_sent_at: string | null;
  email_sent_content: string | null;
  email_reply: string | null;
}

// ①の返信チェック対象。municipality_profilesだけがemail_sent_content列を持つため、hasSentContentで分岐する。
// 2026-07-23：sales_email_targetsはclient_leadsへ統合したため対象から除外（残すと同一組織の返信を
// 両テーブルに別々に書き込んでしまい、片方だけ更新される事故が再発する）。
const REPLY_CHECK_TABLES: { table: string; emailCol: string; nameCol: string; hasSentContent: boolean; label: string }[] = [
  { table: 'client_leads', emailCol: 'email', nameCol: 'org_name', hasSentContent: false, label: '学校・法人・便り' },
  { table: 'municipality_profiles', emailCol: 'contact_email', nameCol: 'region_name', hasSentContent: true, label: '自治体' },
];

// ②の受信箱スキャンで「登録済みの相手か」を突き合わせるテーブル一覧（①と同じテーブル）
const CONTACT_TABLES: { table: string; emailCol: string; nameCol: string }[] =
  REPLY_CHECK_TABLES.map(({ table, emailCol, nameCol }) => ({ table, emailCol, nameCol }));

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

  // ① 学校・法人／便り／自治体、それぞれの返信チェック（3テーブル共通ロジック）
  let checked = 0;
  let updated = 0;
  const errors: { name: string; error: string }[] = [];
  const newReplies: { label: string; name: string; reply: string }[] = [];

  for (const { table, emailCol, nameCol, hasSentContent, label } of REPLY_CHECK_TABLES) {
    const selectCols = ['id', nameCol, emailCol, 'email_sent_at', 'email_reply', ...(hasSentContent ? ['email_sent_content'] : [])].join(', ');
    const { data: rowsData, error: rowsError } = await supabaseServer
      .from(table).select(selectCols).not(emailCol, 'is', null);

    if (rowsError) {
      notifyDiscordError('gmail-watch', rowsError);
      continue; // 1テーブルの失敗で他テーブルの処理を止めない
    }

    const rows = ((rowsData ?? []) as unknown as Record<string, unknown>[]).map((r): ContactRow => ({
      id: r.id as string, name: r[nameCol] as string, email: r[emailCol] as string | null,
      email_sent_at: r.email_sent_at as string | null, email_reply: r.email_reply as string | null,
      email_sent_content: hasSentContent ? (r.email_sent_content as string | null) : null,
    }));

    for (const row of rows) {
      const contact = (row.email ?? '').trim();
      if (!contact) continue;
      checked++;
      let status;
      try {
        status = await checkThreadForContact(contact);
      } catch (e) {
        errors.push({ name: row.name, error: e instanceof Error ? e.message : String(e) });
        continue;
      }

      const patch: Record<string, unknown> = {};
      if (status.sent && !row.email_sent_at) patch.email_sent_at = new Date().toISOString();
      if (hasSentContent && status.sentContent && status.sentContent !== (row.email_sent_content ?? '')) patch.email_sent_content = status.sentContent;
      // どんな返信でも（自動返信かどうかを判定せず）反映・通知する
      if (status.reply && status.reply !== (row.email_reply ?? '')) {
        patch.email_reply = status.reply;
        newReplies.push({ label, name: row.name, reply: status.reply });
      }

      if (Object.keys(patch).length > 0) {
        const { error: patchError } = await supabaseServer.from(table).update(patch).eq('id', row.id);
        if (patchError) errors.push({ name: row.name, error: patchError.message });
        else updated++;
      }
    }
  }

  if (newReplies.length > 0) {
    const lines = [`**📬 新しい返信が届きました（${newReplies.length}件）**`];
    for (const r of newReplies) {
      const preview = r.reply.slice(0, 120).replace(/\n/g, ' ');
      lines.push(`・[${r.label}] ${r.name}：${preview}${r.reply.length > 120 ? '…' : ''}`);
    }
    lines.push('運営ダッシュボードの「営業」タブで全文を確認してください。');
    sendDiscordMessage(lines.join('\n'));
  }

  // ② 受信箱全体のスキャン（日程調整キーワードの有無に関わらず全メールが対象。自動返信もここで拾う）
  let inboxHits: Awaited<ReturnType<typeof scanInboxMessages>> = [];
  let inboxScanError: string | null = null;
  try {
    inboxHits = await scanInboxMessages(SCAN_WINDOW_DAYS);
  } catch (e) {
    inboxScanError = e instanceof Error ? e.message : String(e);
  }

  let newInboxCount = 0;
  let newSchedulingCount = 0;
  if (inboxHits.length > 0) {
    const { data: seenRow } = await supabaseServer
      .from('site_settings').select('value').eq('key', SEEN_SCHEDULING_IDS_KEY).maybeSingle();
    const seenIds = new Set<string>(Array.isArray(seenRow?.value) ? seenRow.value as string[] : []);
    const newHits = inboxHits.filter(h => !seenIds.has(h.messageId));

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
            // scheduling_request_detected_atは元々「日程調整を求められている」ことを示す列のため、
            // 日程調整キーワードを含む場合だけ更新する（それ以外の一般的な返信では更新しない）
            if (hit.isScheduling) {
              await supabaseServer.from(table).update({ scheduling_request_detected_at: new Date().toISOString() }).eq('id', row.id);
            }
            break;
          }
        }
        matchedHits.push({ ...hit, matchedName });
      }

      // 日程調整っぽいメールは未登録の相手（見込み客の初コンタクト等）でも見逃したくないため通知する。
      // 一方、日程調整キーワードを含まない一般メールは、登録済みの相手（自治体・学校法人・営業先）
      // からのものだけに絞る（無関係な通知・広告メールでDiscordが埋まらないようにするため）。
      const schedulingMatched = matchedHits.filter(h => h.isScheduling);
      const otherMatched = matchedHits.filter(h => !h.isScheduling && h.matchedName);

      if (schedulingMatched.length > 0) {
        const openDays = await computeOpenDays();
        const daysLine = openDays.length > 0 ? openDays.join('・') : '（カレンダー未連携のため空き日を計算できません）';
        const lines = [`**📅 日程調整を求める返信が届いています（${schedulingMatched.length}件）**`];
        for (const h of schedulingMatched) {
          const who = h.fromName !== h.fromEmail ? `${h.fromName}（${h.fromEmail}）` : h.fromEmail;
          const matched = h.matchedName ? ` ・${h.matchedName}として登録済み` : '';
          lines.push(`・${who}${matched} — 「${h.subject || h.preview}」`);
        }
        lines.push(`空いてそうな日: ${daysLine}`);
        lines.push('※簡易判定です。実際に返信する前にカレンダーで最終確認してください。');
        sendDiscordMessage(lines.join('\n'));
      }

      if (otherMatched.length > 0) {
        const lines = [`**📬 新着メール（返信・自動返信の可能性を含む、${otherMatched.length}件）**`];
        for (const h of otherMatched) {
          const who = h.fromName !== h.fromEmail ? `${h.fromName}（${h.fromEmail}）` : h.fromEmail;
          const matched = h.matchedName ? ` ・${h.matchedName}として登録済み` : '';
          lines.push(`・${who}${matched} — 「${h.subject || h.preview}」`);
        }
        lines.push('※日程調整キーワードは含まれていません。自動返信・受付確認等の可能性があります。');
        sendDiscordMessage(lines.join('\n'));
      }

      newInboxCount = newHits.length;
      newSchedulingCount = schedulingMatched.length;
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
    inboxChecked: inboxHits.length,
    inboxNew: newInboxCount,
    schedulingNew: newSchedulingCount,
    inboxScanError,
  });
}
