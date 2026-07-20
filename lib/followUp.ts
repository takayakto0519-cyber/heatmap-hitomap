// フォローアップ追跡 — 送信した営業メールに返信が無いまま何日経ったかを判定する純粋関数。
// lib/enScore.ts の freshness バンドと同じ考え方だが、返信を待つコールドメールという性質上、
// 7/21/45日よりタイトな 4/9/10+ 日のバンドにする。
export type FollowUpStatus = 'ok' | 'due_soon' | 'overdue' | 'replied';

export interface FollowUpInfo {
  status: FollowUpStatus;
  daysSince: number;
  label: string;
  color: string;
}

interface FollowUpInput {
  email_sent_at: string | null;
  email_reply?: string | null;
  followed_up_at?: string | null;
}

function daysBetween(iso: string, now: number): number {
  return Math.floor((now - new Date(iso).getTime()) / 86400000);
}

// 未送信なら追跡対象外（null）。返信済みならフォロー不要。
// 手動フォロー（電話・対面など）を記録した場合は followed_up_at を起点に日数を数え直す。
export function computeFollowUp(p: FollowUpInput, now: number = Date.now()): FollowUpInfo | null {
  if (!p.email_sent_at) return null;
  if (p.email_reply && p.email_reply.trim()) {
    return { status: 'replied', daysSince: daysBetween(p.email_sent_at, now), label: '✓ 返信あり', color: '#27AE60' };
  }
  const anchor = p.followed_up_at && p.followed_up_at > p.email_sent_at ? p.followed_up_at : p.email_sent_at;
  const days = daysBetween(anchor, now);
  if (days <= 4) return { status: 'ok', daysSince: days, label: `送信${days}日目`, color: '#4A69BD' };
  if (days <= 9) return { status: 'due_soon', daysSince: days, label: `そろそろフォロー（${days}日経過）`, color: '#E5A139' };
  return { status: 'overdue', daysSince: days, label: `⏰要フォロー（${days}日経過）`, color: '#E74C3C' };
}
