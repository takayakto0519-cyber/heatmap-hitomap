// サーバー側（Next.js APIルート専用）のGmail連携。
//
// agents/gmail_watch.py はローカルPC上のWindowsタスクスケジューラでだけ動く読み取り専用の
// Python番人だが、これは会長のPCが閉じていても動くよう、Vercel Cron（app/api/cron/gmail-watch）
// から呼ばれるサーバー側の実装として新規に用意する。ロジックはgmail_watch.pyを踏襲する。
//
// lib/googleCalendarServer.tsと同じ方針：新規npm依存は増やさず、googleapis SDKは使わずに
// 素のfetchでGmail REST APIを呼ぶ。環境変数（GOOGLE_GMAIL_CLIENT_ID/SECRET/REFRESH_TOKEN、
// scripts/setup-google-gmail-oauth.mjs で発行）を使う。読み取り専用スコープ(gmail.readonly)。
//
// このファイルはAPIルート（サーバー側）からのみimportすること。

export const OWN_ADDRESS = 'hitomap.info@gmail.com';

interface CachedToken { accessToken: string; expiresAt: number }
let tokenCache: CachedToken | null = null;

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} が設定されていません（scripts/setup-google-gmail-oauth.mjs の手順を参照）`);
  return v;
}

async function getAccessToken(): Promise<string> {
  if (tokenCache && tokenCache.expiresAt > Date.now() + 30_000) {
    return tokenCache.accessToken;
  }
  const clientId = requireEnv('GOOGLE_GMAIL_CLIENT_ID');
  const clientSecret = requireEnv('GOOGLE_GMAIL_CLIENT_SECRET');
  const refreshToken = requireEnv('GOOGLE_GMAIL_REFRESH_TOKEN');

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
    throw new Error(`Gmailのトークン更新に失敗しました: ${data.error_description ?? data.error ?? res.status}`);
  }
  tokenCache = { accessToken: data.access_token, expiresAt: Date.now() + (data.expires_in ?? 3600) * 1000 };
  return tokenCache.accessToken;
}

interface GmailHeader { name: string; value: string }
interface GmailPayload {
  mimeType?: string;
  body?: { data?: string };
  parts?: GmailPayload[];
  headers?: GmailHeader[];
}
interface GmailMessage {
  id: string;
  snippet?: string;
  payload?: GmailPayload;
}
interface GmailThread {
  id: string;
  messages?: GmailMessage[];
}

function header(headers: GmailHeader[] | undefined, name: string): string {
  return headers?.find(h => h.name?.toLowerCase() === name.toLowerCase())?.value ?? '';
}

// メールアドレスの表示名部分を除いた実アドレスだけを取り出す（"名前 <addr@x.com>" → "addr@x.com"）
function parseAddr(headerValue: string): { name: string; email: string } {
  const match = headerValue.match(/^(.*)<(.+)>$/);
  if (match) {
    return { name: match[1].trim().replace(/^"|"$/g, ''), email: match[2].trim().toLowerCase() };
  }
  return { name: headerValue.trim(), email: headerValue.trim().toLowerCase() };
}

function base64UrlDecode(data: string): string {
  try {
    const normalized = data.replace(/-/g, '+').replace(/_/g, '/');
    return Buffer.from(normalized, 'base64').toString('utf-8');
  } catch {
    return '';
  }
}

// Gmail APIのpayloadから、テキスト本文を可能な範囲で抜き出す（簡易実装。gmail_watch.py:_plain_textと同じ）
function extractPlainText(payload: GmailPayload | undefined): string {
  if (!payload) return '';
  if (payload.mimeType === 'text/plain' && payload.body?.data) {
    return base64UrlDecode(payload.body.data);
  }
  for (const part of payload.parts ?? []) {
    const text = extractPlainText(part);
    if (text) return text;
  }
  return '';
}

async function gmailFetch(path: string, params: Record<string, string>): Promise<Record<string, unknown>> {
  const accessToken = await getAccessToken();
  const url = new URL(`https://gmail.googleapis.com/gmail/v1/users/me/${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  // Next.jsはRoute Handler内のfetchを既定でキャッシュすることがあるため、
  // 実行のたびに必ずGmailを再確認するようcache:'no-store'を明示する
  // （このcacheバグでcronの2回目以降が前回と同じ結果を返し続けていたことが判明したため）
  const res = await fetch(url.toString(), { headers: { Authorization: `Bearer ${accessToken}` }, cache: 'no-store' });
  const data = await res.json();
  if (!res.ok) throw new Error(`Gmail API呼び出しに失敗しました(${path}): ${data.error?.message ?? res.status}`);
  return data;
}

function base64UrlEncode(input: string): string {
  return Buffer.from(input, 'utf-8').toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// MIMEヘッダーの日本語Subjectをエンコードする（RFC 2047, Base64/UTF-8）
function encodeSubject(subject: string): string {
  return `=?UTF-8?B?${Buffer.from(subject, 'utf-8').toString('base64')}?=`;
}

export interface SendEmailInput {
  to: string;
  subject: string;
  body: string; // プレーンテキスト
}

/**
 * gmail.sendスコープでのメール送信（日程調整サイトの却下・キャンセル通知専用）。
 * 予定の作成・削除・返信の閲覧とは別の権限。送信専用の用途にだけ使うこと。
 */
export async function sendEmail(input: SendEmailInput): Promise<void> {
  const accessToken = await getAccessToken();
  const raw = [
    `To: ${input.to}`,
    `From: ${OWN_ADDRESS}`,
    `Subject: ${encodeSubject(input.subject)}`,
    'Content-Type: text/plain; charset=UTF-8',
    '',
    input.body,
  ].join('\r\n');

  const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ raw: base64UrlEncode(raw) }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`メール送信に失敗しました: ${data.error?.message ?? res.status}`);
}

export interface ContactThreadStatus {
  sent: boolean;
  sentContent: string | null;
  reply: string | null;
}

/** 宛先とのやり取りを検索し、送信済みか・実際に送った本文・相手からの返信本文があるかを返す（gmail_watch.py:_check_thread_for_contact 相当） */
export async function checkThreadForContact(contactEmail: string): Promise<ContactThreadStatus> {
  const query = `to:${contactEmail} OR from:${contactEmail}`;
  const listRes = await gmailFetch('threads', { q: query, maxResults: '5' });
  const threadIds = ((listRes.threads as { id: string }[] | undefined) ?? []).map(t => t.id);
  if (threadIds.length === 0) return { sent: false, sentContent: null, reply: null };

  let sent = false;
  let sentContent: string | null = null;
  let sentDate: string | null = null;
  let reply: string | null = null;
  let replyDate: string | null = null;

  for (const tid of threadIds) {
    const thread = await gmailFetch(`threads/${tid}`, { format: 'full' }) as unknown as GmailThread;
    for (const msg of thread.messages ?? []) {
      const headers = msg.payload?.headers;
      const sender = parseAddr(header(headers, 'From')).email;
      const date = header(headers, 'Date');
      if (sender === OWN_ADDRESS.toLowerCase()) {
        sent = true;
        const text = extractPlainText(msg.payload) || msg.snippet || '';
        if (text && (!sentDate || date > sentDate)) { sentContent = text.trim(); sentDate = date; }
      } else if (sender === contactEmail.toLowerCase()) {
        const text = extractPlainText(msg.payload) || msg.snippet || '';
        if (text && (!replyDate || date > replyDate)) { reply = text.trim(); replyDate = date; }
      }
    }
  }
  return { sent, sentContent, reply };
}

export interface SchedulingHit {
  messageId: string;
  fromEmail: string;
  fromName: string;
  subject: string;
  preview: string;
}

const SCHEDULING_KEYWORDS = [
  '日程調整', '都合の良い', '都合のよい', 'ご都合', '空いてる', '空いている',
  '空き状況', '面談', '打ち合わせ', '打合せ', 'スケジュール調整', 'お伺いできれば',
  'お時間いただけ', 'アポイント', 'アポを', '候補日',
];

function containsSchedulingKeyword(text: string): boolean {
  return SCHEDULING_KEYWORDS.some(kw => text.includes(kw));
}

export interface InboxHit extends SchedulingHit {
  isScheduling: boolean; // 日程調整キーワードを含むか（含まなくても自動返信等は拾う）
}

/**
 * 受信箱全体（直近windowDays日・自分が送ったものは除く）から届いたメールを全て拾う。
 * 以前は日程調整キーワードに一致したものだけを対象にしていたが、キーワードを含まない
 * 自動返信（不在通知・受付確認メール等）が拾えていなかったため、キーワードの有無に関わらず
 * 全件を返すようにした（isSchedulingで日程調整っぽいかどうかだけ区別する）。
 * 呼び出し元でclient_leads/sales_email_targets/municipality_profiles登録済みの相手かを判定する。
 */
export async function scanInboxMessages(windowDays: number): Promise<InboxHit[]> {
  const query = `newer_than:${windowDays}d -in:sent -in:chats`;
  const listRes = await gmailFetch('messages', { q: query, maxResults: '50' });
  const messageIds = ((listRes.messages as { id: string }[] | undefined) ?? []).map(m => m.id);

  const hits: InboxHit[] = [];
  for (const mid of messageIds) {
    const msg = await gmailFetch(`messages/${mid}`, { format: 'full' }) as unknown as GmailMessage;
    const headers = msg.payload?.headers;
    const fromHeader = header(headers, 'From');
    const { name: fromName, email: fromEmail } = parseAddr(fromHeader);
    if (!fromEmail || fromEmail === OWN_ADDRESS.toLowerCase()) continue;
    const subject = header(headers, 'Subject');
    const body = extractPlainText(msg.payload) || msg.snippet || '';
    const haystack = `${subject}\n${body}`;
    hits.push({
      messageId: mid,
      fromEmail,
      fromName: fromName || fromEmail,
      subject,
      preview: body.trim().slice(0, 150).replace(/\n/g, ' '),
      isScheduling: containsSchedulingKeyword(haystack),
    });
  }
  return hits;
}
