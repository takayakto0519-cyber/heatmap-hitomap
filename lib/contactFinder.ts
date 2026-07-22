// 宛先メール発見クローラー（サーバー専用）。
//
// 営業メールの宛先を「Web検索で見つけた気がする」状態から、確度つきで裏取りする。
// LLMは一切使わない（会長の方針：サーバー側で追加のAI API課金を発生させない。
// 文面のドラフト作成は引き続きClaude Codeとのチャットで行う）。
// 新規npm依存も増やさない（lib/gmailServer.ts・lib/googleCalendarServer.tsと同じ方針）。
// このファイルはAPIルート（サーバー側）専用。'use client'なファイルからimportしない。

const USER_AGENT = 'HitomapContactFinder/1.0 (+https://hitomap.com)';
const FETCH_TIMEOUT_MS = 8000;
const MAX_CANDIDATE_PAGES = 3;

const CONTACT_LINK_PATTERN = /(お問い合わせ|お問合せ|問い合わせ|連絡先|contact|inquiry)/i;
const EMAIL_PATTERN = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
// メールアドレスとして拾いたくないドメイン（画像ファイル名やCDN由来の誤検出を避ける）
const EMAIL_EXCLUDE_DOMAIN = /\.(png|jpg|jpeg|gif|svg|webp|css|js)$/i;

export type ContactConfidence = 'high' | 'medium' | 'low';

export interface ContactFindResult {
  email: string | null;
  confidence: ContactConfidence | null;
  sourceUrl: string | null;
  note: string;
}

async function fetchText(url: string): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    const res = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT },
      signal: controller.signal,
      redirect: 'follow',
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    const contentType = res.headers.get('content-type') ?? '';
    if (!contentType.includes('text/html') && !contentType.includes('text/plain')) return null;
    return await res.text();
  } catch {
    return null;
  }
}

// robots.txtのUser-agent: *ブロックにあるDisallowパスの単純パーサー。
// Allow/正規表現ワイルドカードまでは対応しない（過剰なDisallowで即あきらめる保守的な実装で十分）。
function parseDisallowedPaths(robotsTxt: string): string[] {
  const lines = robotsTxt.split(/\r?\n/);
  const disallowed: string[] = [];
  let inWildcardGroup = false;
  for (const rawLine of lines) {
    const line = rawLine.split('#')[0].trim();
    if (!line) continue;
    const [rawKey, ...rest] = line.split(':');
    const key = rawKey.trim().toLowerCase();
    const value = rest.join(':').trim();
    if (key === 'user-agent') {
      inWildcardGroup = value === '*';
    } else if (key === 'disallow' && inWildcardGroup && value) {
      disallowed.push(value);
    }
  }
  return disallowed;
}

function isPathAllowed(path: string, disallowedPaths: string[]): boolean {
  return !disallowedPaths.some((d) => path.startsWith(d));
}

function extractLinks(html: string, baseUrl: string): { href: string; text: string }[] {
  const links: { href: string; text: string }[] = [];
  const re = /<a\s+[^>]*href=["']([^"']+)["'][^>]*>(.*?)<\/a>/gis;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const rawHref = m[1];
    const text = m[2].replace(/<[^>]+>/g, '').trim();
    try {
      const resolved = new URL(rawHref, baseUrl).toString();
      links.push({ href: resolved, text });
    } catch {
      // 相対URLの解決に失敗したリンクは無視
    }
  }
  return links;
}

interface ExtractedEmails { mailto: string[]; plain: string[] }

function extractEmails(html: string): ExtractedEmails {
  const mailtoRe = /href=["']mailto:([^"'?]+)/gi;
  const mailtoEmails: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = mailtoRe.exec(html))) mailtoEmails.push(m[1].trim());

  const bodyText = html.replace(/<[^>]+>/g, ' ');
  const plainEmails = (bodyText.match(EMAIL_PATTERN) ?? []).filter((e) => !EMAIL_EXCLUDE_DOMAIN.test(e));

  return { mailto: mailtoEmails, plain: plainEmails };
}

/**
 * 公式サイトのURLから、問い合わせ用メールアドレスを探す。
 * robots.txtで禁止されたパスは取得しない。見つからなければconfidence=null（=手動確認へ倒す）。
 */
export async function findContactEmail(websiteUrl: string): Promise<ContactFindResult> {
  let origin: string;
  try {
    origin = new URL(websiteUrl).origin;
  } catch {
    return { email: null, confidence: null, sourceUrl: null, note: 'website_urlの形式が不正です' };
  }

  const robotsTxt = await fetchText(`${origin}/robots.txt`);
  const disallowed = robotsTxt ? parseDisallowedPaths(robotsTxt) : [];

  const homePath = new URL(websiteUrl).pathname || '/';
  if (!isPathAllowed(homePath, disallowed)) {
    return { email: null, confidence: null, sourceUrl: null, note: 'robots.txtによりトップページの取得が禁止されています' };
  }

  const homeHtml = await fetchText(websiteUrl);
  if (!homeHtml) {
    return { email: null, confidence: null, sourceUrl: null, note: 'トップページの取得に失敗しました' };
  }

  // ①トップページ自体にmailtoがあれば最有力（highの中でも最優先で採用）
  const homeEmails = extractEmails(homeHtml);
  if (homeEmails.mailto.length > 0) {
    return { email: homeEmails.mailto[0], confidence: 'high', sourceUrl: websiteUrl, note: 'トップページのmailtoリンクから取得' };
  }

  // ②問い合わせページ候補を抽出し、許可されたページだけ辿る
  const links = extractLinks(homeHtml, websiteUrl);
  const candidates = links
    .filter((l) => CONTACT_LINK_PATTERN.test(l.text) || CONTACT_LINK_PATTERN.test(l.href))
    .filter((l) => new URL(l.href).origin === origin)
    .filter((l) => isPathAllowed(new URL(l.href).pathname, disallowed))
    .slice(0, MAX_CANDIDATE_PAGES);

  let formPageUrl: string | null = null;
  for (const candidate of candidates) {
    const pageHtml = await fetchText(candidate.href);
    if (!pageHtml) continue;
    const { mailto, plain } = extractEmails(pageHtml);
    if (mailto.length > 0) {
      return { email: mailto[0], confidence: 'high', sourceUrl: candidate.href, note: '問い合わせページのmailtoリンクから取得' };
    }
    if (plain.length > 0) {
      return { email: plain[0], confidence: 'medium', sourceUrl: candidate.href, note: '問い合わせページ本文中のメールアドレスから取得（要目視確認）' };
    }
    if (!formPageUrl) formPageUrl = candidate.href; // メールは無いがフォームらしきページ
  }

  // ③トップページ本文中の素のメールアドレス（確度は低め）
  if (homeEmails.plain.length > 0) {
    return { email: homeEmails.plain[0], confidence: 'medium', sourceUrl: websiteUrl, note: 'トップページ本文中のメールアドレスから取得（要目視確認）' };
  }

  if (formPageUrl) {
    return { email: null, confidence: 'low', sourceUrl: formPageUrl, note: 'メールアドレスは見つからず、問い合わせフォームのみ確認できました' };
  }

  return { email: null, confidence: null, sourceUrl: null, note: '問い合わせ先を確認できませんでした' };
}
