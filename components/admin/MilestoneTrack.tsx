'use client';

// 営業先が11段のどこにいるかを1行のドット列で示す部品。
// 判定は lib/tracks/govOutreach.ts の deriveMilestone() に委ね、ここは見た目だけを持つ。
// 送信後のライフサイクル表示は components/admin/OutreachStatus.tsx が既に担っているので、
// この部品はそこと重ねず「どこまで進んだか」だけを表す。
import { GOV_OUTREACH_TRACK, type MilestoneState } from '@/lib/tracks/govOutreach';

const TEAL = '#38ADA9';

export default function MilestoneTrack({ state, compact = false }: { state: MilestoneState; compact?: boolean }) {
  if (state.onHold) {
    return <span style={{ fontSize: 11, color: '#aaa', fontWeight: 700 }}>⏸ 保留中</span>;
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
        {GOV_OUTREACH_TRACK.map((m, i) => {
          const done = i < state.reached;
          const isCurrent = i === state.reached;
          return (
            <span
              key={m.id}
              title={`${m.id} ${m.label}${done ? '（達成）' : isCurrent ? '（いまここ）' : ''}`}
              style={{
                width: isCurrent ? 9 : 7,
                height: isCurrent ? 9 : 7,
                borderRadius: '50%',
                background: done ? TEAL : isCurrent ? '#fff' : '#e2e2e2',
                border: isCurrent ? `2px solid ${TEAL}` : 'none',
                display: 'inline-block',
              }}
            />
          );
        })}
      </div>
      {!compact && state.current && (
        <span style={{ fontSize: 11, color: '#777' }}>
          {state.current.id} {state.current.label}
        </span>
      )}
      {!compact && (
        <span style={{
          fontSize: 11, fontWeight: 700,
          color: state.owner === 'ai' ? TEAL : state.owner === 'chairman' ? '#B7791F' : '#aaa',
        }}>
          {state.owner === 'ai' ? '🤖 ' : state.owner === 'chairman' ? '👤 ' : ''}{state.nextAction}
        </span>
      )}
    </div>
  );
}
