'use client';

// AIが作った成果物1件を、会長が「見て決めるだけ」で処理できる形に表示する共通部品。
// 営業・マーケ・新規事業のどの成果物でも操作は同じ3つ：承認／差し戻し／却下。
//
// 差し戻しがこの仕組みの要。改善点を書いて差し戻すと status='revise' になり、
// 翌朝の番人がその行を最優先でキューに載せ、オートパイロットが feedback を読んで作り直す。
// 「一から作り直す」にチェックを入れると前案を捨てて再生成する（外すと部分修正）。
import { useState } from 'react';
import { KIND_LABEL, REFLECT_TO, isKind } from '@/lib/deliverables';

export interface Deliverable {
  id: string;
  entity_type: string;
  entity_id: string | null;
  kind: string;
  status: string;
  title: string;
  body: string;
  ai_note: string | null;
  sources: string | null;
  feedback: string | null;
  rebuild: boolean;
  revision: number;
  supersedes_id: string | null;
  created_at: string;
}

const TEAL = '#38ADA9';
const btn = (color: string, filled = false): React.CSSProperties => ({
  fontSize: 11.5, fontWeight: 700, cursor: 'pointer', padding: '5px 12px', borderRadius: 12,
  border: `1px solid ${color}`, background: filled ? color : '#fff', color: filled ? '#fff' : color, whiteSpace: 'nowrap',
});

export default function DeliverableCard({
  deliverable: d, subjectName, onApprove, onRevise, onArchive,
}: {
  deliverable: Deliverable;
  /** 誰に向けた成果物か（自治体名など）。一覧に複数対象が混ざるときに表示する。 */
  subjectName?: string;
  onApprove: () => void | Promise<void>;
  onRevise: (feedback: string, rebuild: boolean) => void | Promise<void>;
  onArchive: () => void | Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [reviseOpen, setReviseOpen] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [rebuild, setRebuild] = useState(true);
  const [busy, setBusy] = useState(false);

  const kindLabel = isKind(d.kind) ? KIND_LABEL[d.kind] : d.kind;
  const reflect = isKind(d.kind) ? REFLECT_TO[d.kind] : undefined;

  async function run(fn: () => void | Promise<void>) {
    setBusy(true);
    try { await fn(); } finally { setBusy(false); }
  }

  return (
    <div style={{ border: `1.5px solid ${d.status === 'revise' ? '#E5A139' : TEAL}`, borderRadius: 10, padding: 12, background: '#fff' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <div>
          <span style={{
            fontSize: 10.5, fontWeight: 700, padding: '2px 8px', borderRadius: 10, marginRight: 6,
            background: d.status === 'revise' ? '#E5A13918' : `${TEAL}18`,
            color: d.status === 'revise' ? '#E5A139' : TEAL,
          }}>
            {d.status === 'revise' ? '作り直し待ち' : '🤖 AI提案'}{d.revision > 1 && ` 第${d.revision}案`}
          </span>
          <b style={{ fontSize: 13 }}>{subjectName ? `${subjectName}｜` : ''}{kindLabel}</b>
        </div>
        <span style={{ fontSize: 10.5, color: '#aaa' }}>{new Date(d.created_at).toLocaleString('ja-JP')}</span>
      </div>

      {/* 会長が最初に読む1〜2行。ここだけ読んで判断できることを目指す。 */}
      {d.ai_note && <p style={{ margin: '8px 0 0', fontSize: 12.5, color: '#444', lineHeight: 1.7 }}>{d.ai_note}</p>}

      {d.status === 'revise' && d.feedback && (
        <p style={{ margin: '8px 0 0', fontSize: 12, color: '#B7791F', background: '#FFF8E8', padding: 8, borderRadius: 8, whiteSpace: 'pre-wrap' }}>
          差し戻し済み（{d.rebuild ? '一から作り直し' : '部分修正'}）：{d.feedback}
        </p>
      )}

      <button onClick={() => setOpen(o => !o)} style={{ marginTop: 8, fontSize: 11.5, color: TEAL, background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontWeight: 700 }}>
        {open ? '▲ 本文を閉じる' : '▼ 本文を読む'}
      </button>
      {open && (
        <>
          <pre style={{ margin: '6px 0 0', fontSize: 12.5, lineHeight: 1.8, whiteSpace: 'pre-wrap', fontFamily: 'inherit', color: '#333', background: '#FAFAFA', padding: 10, borderRadius: 8, maxHeight: 340, overflowY: 'auto' }}>{d.body}</pre>
          {d.sources && (
            <p style={{ margin: '6px 0 0', fontSize: 11, color: '#888', whiteSpace: 'pre-wrap' }}>出典：{d.sources}</p>
          )}
        </>
      )}

      {d.status !== 'revise' && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10, alignItems: 'center' }}>
          <button disabled={busy} onClick={() => run(onApprove)} style={btn('#27AE60', true)}>承認する</button>
          <button disabled={busy} onClick={() => setReviseOpen(o => !o)} style={btn('#E5A139')}>差し戻す</button>
          <button disabled={busy} onClick={() => run(onArchive)} style={{ ...btn('#bbb'), border: 'none' }}>却下</button>
          {reflect && (
            <span style={{ fontSize: 10.5, color: '#aaa' }}>承認すると {reflect.table}.{reflect.column} に反映されます</span>
          )}
        </div>
      )}

      {reviseOpen && d.status !== 'revise' && (
        <div style={{ marginTop: 10, padding: 10, background: '#FFFBF2', borderRadius: 8 }}>
          <textarea
            rows={3} value={feedback} onChange={e => setFeedback(e.target.value)}
            placeholder="どこをどう直してほしいか（例：数字の根拠が弱い。飛騨市の総合計画の関係人口の記述に触れて書き直して）"
            style={{ width: '100%', boxSizing: 'border-box', padding: '8px 10px', borderRadius: 8, border: '1.5px solid #ddd', fontSize: 12.5, fontFamily: 'inherit', resize: 'vertical' }}
          />
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, margin: '8px 0', fontSize: 12, color: '#666', cursor: 'pointer' }}>
            <input type="checkbox" checked={rebuild} onChange={e => setRebuild(e.target.checked)} />
            この案は捨てて一から作り直す（外すと今の案を活かして部分修正）
          </label>
          <button
            disabled={busy || !feedback.trim()}
            onClick={() => run(async () => { await onRevise(feedback.trim(), rebuild); setReviseOpen(false); setFeedback(''); })}
            style={btn('#E5A139', true)}
          >差し戻して作り直させる</button>
        </div>
      )}
    </div>
  );
}
