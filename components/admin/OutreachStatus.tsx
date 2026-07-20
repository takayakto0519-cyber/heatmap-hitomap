'use client';

// 送信後ライフサイクルを1つの見た目に統一する共通部品。
// リード・自治体・営業メールで共用し、lib/followUp.ts の computeFollowUp() で
// 「下書き → 送信済み(N日目) → 要フォロー → 返信あり」を一貫して表示・操作する。
// 送信時刻(email_sent_at)が無い相手は「未送信」。外部送信はここからは行わない（記録のみ）。
import { computeFollowUp } from '@/lib/followUp';

export interface OutreachState {
  drafted?: boolean;
  email_sent_at: string | null;
  email_reply?: string | null;
  followed_up_at?: string | null;
}

const pill = (color: string): React.CSSProperties => ({
  fontSize: 11, fontWeight: 700, padding: '2px 9px', borderRadius: 12,
  background: color + '18', color, whiteSpace: 'nowrap',
});
const btn = (color: string, filled = false): React.CSSProperties => ({
  fontSize: 11, fontWeight: 700, cursor: 'pointer', padding: '3px 10px', borderRadius: 12,
  border: `1px solid ${color}`, background: filled ? color : '#fff', color: filled ? '#fff' : color, whiteSpace: 'nowrap',
});

export default function OutreachStatus({
  state, onMarkDrafted, onMarkSent, onMarkFollowedUp, onMarkReplied, onUnsend,
}: {
  state: OutreachState;
  onMarkDrafted?: () => void;
  onMarkSent?: () => void;        // email_sent_at = now
  onMarkFollowedUp?: () => void;  // followed_up_at = now
  onMarkReplied?: () => void;     // 返信ありに（reply欄が空でもフラグ的に）
  onUnsend?: () => void;          // 送信を取り消す（誤操作の戻し）
}) {
  const fu = computeFollowUp({
    email_sent_at: state.email_sent_at,
    email_reply: state.email_reply ?? null,
    followed_up_at: state.followed_up_at ?? null,
  });

  // 未送信
  if (!state.email_sent_at) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        {onMarkDrafted && (
          <button onClick={onMarkDrafted} style={btn('#4A90E2', Boolean(state.drafted))}>
            {state.drafted ? '✓ 下書き済み' : '下書き未'}
          </button>
        )}
        {onMarkSent && <button onClick={onMarkSent} style={btn('#38ADA9')}>送った</button>}
      </div>
    );
  }

  // 送信後（fu は必ず非null）
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
      <span style={pill(fu!.color)}>{fu!.label}</span>
      {fu!.status !== 'replied' && (
        <>
          {onMarkFollowedUp && (fu!.status === 'due_soon' || fu!.status === 'overdue') && (
            <button onClick={onMarkFollowedUp} style={btn('#E5A139')}>フォローした</button>
          )}
          {onMarkReplied && <button onClick={onMarkReplied} style={btn('#27AE60')}>返信きた</button>}
        </>
      )}
      {onUnsend && <button onClick={onUnsend} style={{ ...btn('#bbb'), border: 'none' }}>戻す</button>}
    </div>
  );
}
