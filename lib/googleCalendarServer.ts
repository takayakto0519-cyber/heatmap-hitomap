// サーバー側（Next.js APIルート専用）のGoogle Calendar連携。
//
// agents/calendar_watch.py・agents/gmail_watch.py はローカルPC上でだけ動く読み取り専用の
// Python番人だが、これは公開日程調整サイト（Part B）用に新規で用意する、読み取り＋書き込み
// 両方できるサーバー側の実装。環境変数（GOOGLE_CALENDAR_CLIENT_ID/SECRET/REFRESH_TOKEN、
// scripts/setup-google-calendar-oauth.mjs で発行）を使い、Vercelの本番でも動く。
//
// 新規npm依存は増やさない方針のため、googleapis SDKは使わず素のfetchでCalendar REST APIを呼ぶ。
// このファイルはAPIルート（サーバー側）からのみimportすること。クライアントコンポーネントから
// importするとGOOGLE_CALENDAR_REFRESH_TOKEN等が露出しうるため、'use client'なファイルからは使わない。

const CALENDAR_ID = 'hitomap.info@gmail.com';
const TIME_ZONE = 'Asia/Tokyo';
const JST_OFFSET = '+09:00';

// 予約を受け付ける営業時間（JST・平日のみ）。必要に応じて調整する。
const BUSINESS_START_HOUR = 9;
const BUSINESS_END_HOUR = 23;

export interface AvailabilitySlot {
  start: string; // ISO8601
  end: string;   // ISO8601
}
export interface AvailabilityDay {
  date: string; // YYYY-MM-DD
  slots: AvailabilitySlot[];
}

interface CachedToken { accessToken: string; expiresAt: number }
let tokenCache: CachedToken | null = null;

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} が設定されていません（scripts/setup-google-calendar-oauth.mjs の手順を参照）`);
  return v;
}

async function getAccessToken(): Promise<string> {
  if (tokenCache && tokenCache.expiresAt > Date.now() + 30_000) {
    return tokenCache.accessToken;
  }
  const clientId = requireEnv('GOOGLE_CALENDAR_CLIENT_ID');
  const clientSecret = requireEnv('GOOGLE_CALENDAR_CLIENT_SECRET');
  const refreshToken = requireEnv('GOOGLE_CALENDAR_REFRESH_TOKEN');

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });
  const data = await res.json();
  if (!res.ok || !data.access_token) {
    throw new Error(`Googleカレンダーのトークン更新に失敗しました: ${data.error_description ?? data.error ?? res.status}`);
  }
  tokenCache = { accessToken: data.access_token, expiresAt: Date.now() + (data.expires_in ?? 3600) * 1000 };
  return tokenCache.accessToken;
}

// JSTの「YYYY-MM-DD HH:mm」からISO8601（+09:00固定）を組み立てる。
// サーバーの実行タイムゾーン（Vercelは基本UTC、ローカルはJST）に依存させないための素朴な文字列組み立て。
function jstIso(y: number, m: number, d: number, hh: number, mm: number): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${y}-${pad(m)}-${pad(d)}T${pad(hh)}:${pad(mm)}:00${JST_OFFSET}`;
}

interface JstDateParts { y: number; m: number; d: number; weekday: number } // weekday: 0=日〜6=土（JST基準）

function jstPartsFromDate(date: Date): JstDateParts {
  const jst = new Date(date.getTime() + 9 * 3600_000);
  return { y: jst.getUTCFullYear(), m: jst.getUTCMonth() + 1, d: jst.getUTCDate(), weekday: jst.getUTCDay() };
}

function addDays(parts: JstDateParts, days: number): JstDateParts {
  const asUtcNoon = Date.UTC(parts.y, parts.m - 1, parts.d, 12, 0, 0);
  const shifted = new Date(asUtcNoon + days * 86400_000);
  return { y: shifted.getUTCFullYear(), m: shifted.getUTCMonth() + 1, d: shifted.getUTCDate(), weekday: shifted.getUTCDay() };
}

interface BusyInterval { start: number; end: number } // epoch ms

async function fetchBusyIntervals(accessToken: string, timeMinIso: string, timeMaxIso: string): Promise<BusyInterval[]> {
  const res = await fetch('https://www.googleapis.com/calendar/v3/freeBusy', {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      timeMin: timeMinIso,
      timeMax: timeMaxIso,
      timeZone: TIME_ZONE,
      items: [{ id: CALENDAR_ID }],
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`freeBusy取得に失敗しました: ${data.error?.message ?? res.status}`);
  const busy = data.calendars?.[CALENDAR_ID]?.busy ?? [];
  return busy.map((b: { start: string; end: string }) => ({
    start: new Date(b.start).getTime(),
    end: new Date(b.end).getTime(),
  }));
}

/**
 * 指定した時間帯が今のGoogleカレンダーで本当に空いているかを確認する（真のfreeBusy APIを使用）。
 * 日程調整サイトの確定処理で、会長が「確定」を押す直前にもう一度これを呼び、
 * 別のリクエストが先に確定されて枠が埋まっていないかをチェックする（二重予約防止）。
 */
export async function isSlotFree(startTime: string, endTime: string): Promise<boolean> {
  const accessToken = await getAccessToken();
  const busy = await fetchBusyIntervals(accessToken, startTime, endTime);
  const startMs = new Date(startTime).getTime();
  const endMs = new Date(endTime).getTime();
  return !busy.some(b => startMs < b.end && endMs > b.start);
}

/**
 * 指定した日付範囲（JST・両端含む）の空き枠を計算する（真のfreeBusy APIを使用）。
 * 土日も含め毎日、営業時間内（既定9:00-23:00 JST）を、durationMinutes刻みでスロット化し、
 * 既存の予定（busy区間）と重ならないものだけを返す。
 *
 * 月間カレンダーグリッド表示のため、空き無し日・過去日も含めて範囲内の
 * 全カレンダー日ぶん `{date, slots}` を返す（該当日はslots: []）。呼び出し側
 * （app/api/schedule/availability/route.ts）が表示中の月の範囲を渡す。
 */
export async function getAvailability(fromDate: string, toDate: string, durationMinutes: number): Promise<AvailabilityDay[]> {
  const accessToken = await getAccessToken();
  const now = new Date();
  const [fy, fm, fd] = fromDate.split('-').map(Number);
  const [ty, tm, td] = toDate.split('-').map(Number);
  const windowStart = jstIso(fy, fm, fd, 0, 0);
  const windowEnd = jstIso(ty, tm, td, 23, 59);

  const busy = await fetchBusyIntervals(accessToken, windowStart, windowEnd);

  const result: AvailabilityDay[] = [];
  let cursor = addDays({ y: fy, m: fm, d: fd, weekday: 0 }, 0); // weekdayを正しく計算させるためaddDays(+0日)を通す
  let safety = 0;
  const maxIterations = 400; // 月表示の想定範囲（前後端込みで最大42日程度）を大きく上回る安全弁
  while (safety < maxIterations) {
    safety++;
    const slots: AvailabilitySlot[] = [];
    for (let hh = BUSINESS_START_HOUR; hh * 60 + durationMinutes <= BUSINESS_END_HOUR * 60; ) {
      const startIso = jstIso(cursor.y, cursor.m, cursor.d, Math.floor(hh), Math.round((hh % 1) * 60));
      const startMs = new Date(startIso).getTime();
      const endMs = startMs + durationMinutes * 60_000;
      const isPast = startMs < now.getTime() + 60 * 60_000; // 1時間より直前の枠は予約できないようにする
      const overlapsBusy = busy.some((b) => startMs < b.end && endMs > b.start);
      if (!isPast && !overlapsBusy) {
        slots.push({ start: new Date(startMs).toISOString(), end: new Date(endMs).toISOString() });
      }
      hh += durationMinutes / 60;
    }
    result.push({ date: `${cursor.y}-${String(cursor.m).padStart(2, '0')}-${String(cursor.d).padStart(2, '0')}`, slots });
    if (cursor.y === ty && cursor.m === tm && cursor.d === td) break;
    cursor = addDays(cursor, 1);
  }
  return result;
}

// lib/scheduleConstants.ts に切り出し済み（クライアント側の確認画面からも参照するため）。
// 既存の呼び出し元（app/api/admin/booking-requests/[id]/route.ts）が引き続き
// このファイルから import できるよう re-export しておく。
export { SCHEDULING_MEET_URL } from '@/lib/scheduleConstants';

export interface CreateEventInput {
  summary: string;
  description?: string;
  startTime: string; // ISO8601
  endTime: string;   // ISO8601
  attendeeEmail?: string;
  // 担当者名。指定すると summary の先頭に "[担当者] " を付ける（CalendarPanel.tsx が表示時に
  // この角括弧プレフィックスを担当者バッジとして解釈する。運営ダッシュボード発の予定と、
  // 会長がGoogleカレンダー側で直接同じ書式でタイトルを付けた予定の両方に効く）。
  assignee?: string;
  // 会議室URL（Google Meet等）。指定するとGoogleカレンダーの「場所」欄と説明欄の両方に入り、
  // 参加者への招待メールにもそのまま乗る。
  location?: string;
}

/**
 * 会長が「確定」を押した時だけ呼ばれる、実際のGoogleカレンダーへの書き込み。
 * 申込者をattendeeに入れると、Google側の招待メール機能で本人にも自動で届く。
 */
export async function createCalendarEvent(input: CreateEventInput): Promise<{ id: string; htmlLink: string }> {
  const accessToken = await getAccessToken();
  const summary = input.assignee ? `[${input.assignee}] ${input.summary}` : input.summary;
  const description = input.location
    ? [input.description, `会議室URL: ${input.location}`].filter(Boolean).join('\n\n')
    : input.description;
  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(CALENDAR_ID)}/events?sendUpdates=all`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        summary,
        description,
        location: input.location,
        start: { dateTime: input.startTime, timeZone: TIME_ZONE },
        end: { dateTime: input.endTime, timeZone: TIME_ZONE },
        attendees: input.attendeeEmail ? [{ email: input.attendeeEmail }] : undefined,
      }),
    }
  );
  const data = await res.json();
  if (!res.ok) throw new Error(`カレンダーへの予定作成に失敗しました: ${data.error?.message ?? res.status}`);
  return { id: data.id, htmlLink: data.htmlLink };
}

/**
 * 既存の予定のタイトルを書き換える（主に「誰の予定か」の担当者バッジを後から付け直す用途）。
 * cleanTitle は担当者プレフィックスを含まない素のタイトル。assignee を渡すと
 * "[担当者] " を付け直し、undefinedならプレフィックスなしのタイトルにする。
 */
export async function updateCalendarEventAssignee(
  eventId: string, cleanTitle: string, assignee: string | null,
): Promise<void> {
  const accessToken = await getAccessToken();
  const summary = assignee ? `[${assignee}] ${cleanTitle}` : cleanTitle;
  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(CALENDAR_ID)}/events/${encodeURIComponent(eventId)}`,
    {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ summary }),
    }
  );
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(`予定の担当者更新に失敗しました: ${data.error?.message ?? res.status}`);
  }
}

/**
 * 確定済みの予定をキャンセルする（日程調整サイトの確定後キャンセル用）。
 * sendUpdates=allで、招待していた参加者にもGoogle側からキャンセル通知メールが届く。
 */
export async function deleteCalendarEvent(eventId: string): Promise<void> {
  const accessToken = await getAccessToken();
  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(CALENDAR_ID)}/events/${encodeURIComponent(eventId)}?sendUpdates=all`,
    { method: 'DELETE', headers: { Authorization: `Bearer ${accessToken}` } }
  );
  // 204 No Content が成功。410 Gone（既に削除済み）は冪等に成功扱いにする。
  if (!res.ok && res.status !== 410) {
    const data = await res.json().catch(() => ({}));
    throw new Error(`カレンダー予定の削除に失敗しました: ${data.error?.message ?? res.status}`);
  }
}

export interface CalendarEventItem {
  id: string | null;
  title: string;
  start: string | null;
  end: string | null;
  all_day: boolean;
  location: string;
  html_link: string;
}
export interface CalendarDayGroup {
  date: string; // YYYY-MM-DD
  events: CalendarEventItem[];
}

const CALENDAR_READ_RANGE_DAYS = 14;

/**
 * 直近days日ぶんの予定を実際のGoogleカレンダーからライブで取得し、日付ごとにグルーピングする。
 * agents/calendar_watch.py（ローカルPC専用・読み取り専用スコープ）と同じ出力形にして、
 * app/api/admin/calendar/route.ts のローカルファイル/Supabaseフォールバックと差し替え可能にする。
 * こちらは書き込みスコープの環境変数を使うため、本番（Vercel）でもリアルタイムに読める。
 */
export async function listUpcomingEventsGrouped(days: number = CALENDAR_READ_RANGE_DAYS): Promise<CalendarDayGroup[]> {
  const accessToken = await getAccessToken();
  const todayParts = jstPartsFromDate(new Date());
  const timeMin = jstIso(todayParts.y, todayParts.m, todayParts.d, 0, 0);
  const endParts = addDays(todayParts, days);
  const timeMax = jstIso(endParts.y, endParts.m, endParts.d, 23, 59);

  const url = new URL(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(CALENDAR_ID)}/events`);
  url.searchParams.set('timeMin', timeMin);
  url.searchParams.set('timeMax', timeMax);
  url.searchParams.set('singleEvents', 'true');
  url.searchParams.set('orderBy', 'startTime');
  url.searchParams.set('maxResults', '250');

  // cache:'no-store' が必須。Next.jsのデータキャッシュはGETのfetchを既定でキャッシュするため、
  // これが無いと dynamic='force-dynamic' を付けていても古い予定一覧が返り続ける
  // （supabaseServerFreshで直した統合司令室の件と同根の問題）。
  const res = await fetch(url.toString(), { headers: { Authorization: `Bearer ${accessToken}` }, cache: 'no-store' });
  const data = await res.json();
  if (!res.ok) throw new Error(`カレンダー予定の取得に失敗しました: ${data.error?.message ?? res.status}`);

  const events: (CalendarEventItem & { dateKey: string })[] = (data.items ?? []).map((e: {
    id?: string; summary?: string; location?: string; htmlLink?: string;
    start?: { dateTime?: string; date?: string }; end?: { dateTime?: string; date?: string };
  }) => {
    const start = e.start?.dateTime ?? e.start?.date ?? null;
    return {
      id: e.id ?? null,
      title: e.summary ?? '(無題の予定)',
      start,
      end: e.end?.dateTime ?? e.end?.date ?? null,
      all_day: Boolean(e.start?.date),
      location: e.location ?? '',
      html_link: e.htmlLink ?? '',
      dateKey: (start ?? '').slice(0, 10),
    };
  });

  const dayGroups: CalendarDayGroup[] = [];
  let cursor = todayParts;
  for (let i = 0; i < days; i++) {
    const dateStr = `${cursor.y}-${String(cursor.m).padStart(2, '0')}-${String(cursor.d).padStart(2, '0')}`;
    dayGroups.push({
      date: dateStr,
      events: events.filter(ev => ev.dateKey === dateStr).map(({ dateKey: _dateKey, ...ev }) => ev),
    });
    cursor = addDays(cursor, 1);
  }
  return dayGroups;
}
