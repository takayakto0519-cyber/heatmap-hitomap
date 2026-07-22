// email_draft列（municipality_profiles / client_leads / sales_email_targets 共通の規約）から
// 件名と本文を取り出す。規約：1行目が「件名：〇〇」ならそれを件名として使い、
// 残りを本文にする。無ければ件名なし（呼び出し側でデフォルト件名を補う）。
// ⚠で始まる注記行（宛先メール未設定の警告など）は、実際に送るメールには含めない。

export interface ParsedEmailDraft {
  subject: string | null;
  body: string;
}

export function parseEmailDraft(raw: string): ParsedEmailDraft {
  const lines = raw.split('\n');
  let subject: string | null = null;
  const bodyLines: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (subject === null && /^件名[：:]/.test(trimmed)) {
      subject = trimmed.replace(/^件名[：:]\s*/, '');
      continue;
    }
    if (trimmed.startsWith('⚠')) continue; // 「宛先メール未設定」等の内部向け注記は除外
    bodyLines.push(line);
  }

  // 先頭・末尾の空行を整える
  while (bodyLines.length > 0 && bodyLines[0].trim() === '') bodyLines.shift();
  while (bodyLines.length > 0 && bodyLines[bodyLines.length - 1].trim() === '') bodyLines.pop();

  return { subject, body: bodyLines.join('\n') };
}
