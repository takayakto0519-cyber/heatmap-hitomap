'use client';

// 🕵️ agents/fact_check_watch.py が機械的に検出した「要確認」の指摘を表示する。
// fact_check_flagsテーブル（DB同期版。本番はローカルのwork/fact_check_watch.jsonを
// 読めないため、fact_check_watch.py自身がこのテーブルに書き込む設計）を読み取り専用で表示するだけ。
// fact_check_statusは一切ここでは変更しない（人間が「事実確認済みにする」を押すまでverifiedにしない）。
export interface FactCheckFlag { id: string; profile_id: string; kind: string; claim: string; reason: string | null; detected_at: string }

export default function FactCheckWatchBadge({ flags }: { flags: FactCheckFlag[] }) {
  if (flags.length === 0) return null;
  return (
    <div style={{ margin: '6px 0', padding: '8px 10px', borderRadius: 8, background: '#FFF4F2', border: '1px solid #FBD9D2' }}>
      <p style={{ margin: '0 0 4px', fontSize: 11.5, fontWeight: 800, color: '#E55039' }}>
        🕵️ AI一次チェックで要確認（{flags.length}件）
      </p>
      {flags.map(f => (
        <p key={f.id} style={{ margin: '2px 0', fontSize: 11, color: '#B7332A', lineHeight: 1.6 }}>
          ・「{f.claim}」{f.reason && ` — ${f.reason}`}
        </p>
      ))}
      <p style={{ margin: '4px 0 0', fontSize: 10.5, color: '#999' }}>
        source_linksのURLを開いて内容を確認してから「事実確認済みにする」を押してください。
      </p>
    </div>
  );
}
