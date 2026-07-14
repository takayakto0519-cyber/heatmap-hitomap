'use client';

import { useState } from 'react';

interface Props {
  traceId: string;
  onClose: () => void;
}

const REASONS = [
  { key: 'inappropriate', label: '不適切な内容' },
  { key: 'spam', label: 'スパム・宣伝' },
  { key: 'personal_info', label: '個人情報が写っている' },
  { key: 'private_property', label: '個人の自宅・敷地が特定できる' },
  { key: 'copyright', label: '著作権・肖像権の侵害' },
  { key: 'other', label: 'その他' },
] as const;

export default function ReportModal({ traceId, onClose }: Props) {
  const [reason, setReason] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  async function submit() {
    if (!reason) return;
    setSending(true);
    setError('');
    try {
      const res = await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trace_id: traceId, reason, note: note.trim() || undefined }),
      });
      const data = await res.json();
      if (data.ok) {
        setDone(true);
      } else {
        setError(data.error ?? '送信に失敗しました');
      }
    } catch {
      setError('送信に失敗しました');
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1100 }} />
      <div style={{
        position: 'fixed', left: '50%', top: '50%', transform: 'translate(-50%, -50%)',
        width: 'calc(100% - 40px)', maxWidth: 340, background: '#fff', borderRadius: 16,
        padding: 20, zIndex: 1101, boxShadow: '0 8px 30px rgba(0,0,0,0.25)',
      }}>
        {done ? (
          <>
            <p style={{ margin: '0 0 16px', fontSize: 14, lineHeight: 1.7 }}>
              報告しました。運営が確認します。
            </p>
            <button onClick={onClose} style={{
              width: '100%', padding: '11px 0', borderRadius: 10, border: 'none',
              background: '#38ADA9', color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer',
            }}>閉じる</button>
          </>
        ) : (
          <>
            <h3 style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 800 }}>⚠ 通報する</h3>
            <p style={{ margin: '0 0 14px', fontSize: 12, color: '#999' }}>
              この投稿を運営に報告します。報告内容は投稿者には通知されません。
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
              {REASONS.map((r) => (
                <button key={r.key} type="button" onClick={() => setReason(r.key)} style={{
                  textAlign: 'left', padding: '10px 12px', borderRadius: 10,
                  border: `1.5px solid ${reason === r.key ? '#E55039' : '#eee'}`,
                  background: reason === r.key ? '#FFF0EE' : '#fff',
                  color: reason === r.key ? '#E55039' : '#444',
                  fontWeight: reason === r.key ? 700 : 400, fontSize: 13, cursor: 'pointer',
                }}>{r.label}</button>
              ))}
            </div>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="補足があれば入力してください（任意）"
              rows={3}
              style={{
                width: '100%', boxSizing: 'border-box', padding: '9px 12px', fontSize: 13,
                border: '1.5px solid #eee', borderRadius: 8, resize: 'vertical', outline: 'none',
                marginBottom: 12, fontFamily: 'inherit',
              }}
            />
            {error && <p style={{ margin: '0 0 10px', fontSize: 12, color: '#E55039' }}>{error}</p>}
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={onClose} style={{
                flex: 1, padding: '10px 14px', borderRadius: 10, border: '1.5px solid #ddd',
                background: '#fff', cursor: 'pointer', fontSize: 13,
              }}>キャンセル</button>
              <button onClick={submit} disabled={!reason || sending} style={{
                flex: 2, padding: '10px 14px', borderRadius: 10, border: 'none',
                background: (!reason || sending) ? '#ddd' : '#E55039',
                color: '#fff', cursor: (!reason || sending) ? 'default' : 'pointer', fontSize: 13, fontWeight: 700,
              }}>{sending ? '送信中…' : '報告する'}</button>
            </div>
          </>
        )}
      </div>
    </>
  );
}
