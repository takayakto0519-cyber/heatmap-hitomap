'use client';

// 通報：寄せられた通報の対応。page.tsx monolith分割で切り出し。
import { useCallback, useEffect, useState } from 'react';
import { Card } from '@/components/admin/adminShared';

export interface Report {
  id: string;
  trace_id: string;
  reason: string;
  note: string | null;
  status: string;
  created_at: string;
  trace: { id: string; title: string; photo_url: string | null; is_deleted: boolean } | null;
}

export const REASON_LABELS: Record<string, string> = {
  inappropriate: '不適切な内容',
  spam: 'スパム・宣伝',
  personal_info: '個人情報が写っている',
  private_property: '個人の自宅・敷地が特定できる',
  copyright: '著作権・肖像権の侵害',
  other: 'その他',
};

export const URGENT_REPORT_REASONS = new Set(['private_property']);
export default function ReportsTab({ authHeaders }: { authHeaders: () => HeadersInit }) {
  const [status, setStatus] = useState<'pending' | 'all'>('pending');
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    fetch(`/api/admin/reports?status=${status}`, { headers: authHeaders() })
      .then(r => r.json())
      .then(d => {
        if (d.ok) {
          // 個人宅・敷地の特定通報を先頭に出す（それ以外は元の並び＝新着順を維持）
          const sorted = [...(d.reports as Report[])].sort((a, b) =>
            Number(URGENT_REPORT_REASONS.has(b.reason)) - Number(URGENT_REPORT_REASONS.has(a.reason))
          );
          setReports(sorted);
        } else setError(d.error ?? '取得に失敗しました');
      })
      .catch(() => setError('通信エラー'))
      .finally(() => setLoading(false));
  }, [authHeaders, status]);

  useEffect(() => { load(); }, [load]);

  async function act(id: string, action: 'dismiss' | 'action') {
    const res = await fetch(`/api/admin/reports/${id}`, {
      method: 'PATCH', headers: authHeaders(), body: JSON.stringify({ action }),
    });
    const data = await res.json();
    if (data.ok) load(); else setError(data.error ?? '処理に失敗しました');
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
        {([['pending', '未処理'], ['all', 'すべて']] as [typeof status, string][]).map(([id, label]) => (
          <button key={id} onClick={() => setStatus(id)} style={{
            padding: '7px 14px', borderRadius: 16, border: 'none', cursor: 'pointer',
            background: status === id ? '#E55039' : '#fff',
            color: status === id ? '#fff' : '#666', fontWeight: 700, fontSize: 12,
            boxShadow: status === id ? 'none' : '0 1px 3px rgba(0,0,0,0.08)',
          }}>{label}</button>
        ))}
      </div>

      {error && <p style={{ color: '#E74C3C', fontSize: 13 }}>{error}</p>}
      {loading ? <p style={{ color: '#999' }}>読み込み中…</p> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {reports.length === 0 && <p style={{ color: '#aaa' }}>該当する通報はありません。</p>}
          {reports.map(r => {
            const urgent = URGENT_REPORT_REASONS.has(r.reason);
            return (
            <Card key={r.id} style={urgent ? { background: '#FFF5F3', boxShadow: '0 1px 4px rgba(229,80,57,0.2)', border: '1.5px solid #FFB4A8' } : undefined}>
              <div style={{ display: 'flex', gap: 10 }}>
                {r.trace?.photo_url && (
                  <img src={r.trace.photo_url} alt="" style={{ width: 56, height: 56, objectFit: 'cover', borderRadius: 8, flexShrink: 0 }} />
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: '0 0 4px', fontWeight: 700, fontSize: 13 }}>
                    {r.trace?.title ?? '（投稿が見つかりません）'}
                    {r.trace?.is_deleted && <span style={{ color: '#aaa', fontWeight: 400 }}> ・ 削除済み</span>}
                  </p>
                  <p style={{ margin: '0 0 4px', fontSize: 12, color: '#E55039', fontWeight: 700 }}>
                    {urgent && '🚨 至急・'}{REASON_LABELS[r.reason] ?? r.reason}
                  </p>
                  {r.note && <p style={{ margin: '0 0 4px', fontSize: 12, color: '#555' }}>{r.note}</p>}
                  <p style={{ margin: 0, fontSize: 11, color: '#aaa' }}>
                    {new Date(r.created_at).toLocaleString('ja-JP')} ・ ステータス：{r.status}
                  </p>
                </div>
              </div>
              {r.status === 'pending' && (
                <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                  <button onClick={() => act(r.id, 'dismiss')} style={{
                    flex: 1, padding: '8px 0', borderRadius: 8, border: '1px solid #ddd',
                    background: '#fff', color: '#888', fontWeight: 700, cursor: 'pointer',
                  }}>却下</button>
                  <button onClick={() => act(r.id, 'action')} style={{
                    flex: 1, padding: '8px 0', borderRadius: 8, border: 'none',
                    background: '#E55039', color: '#fff', fontWeight: 700, cursor: 'pointer',
                  }}>投稿を削除</button>
                </div>
              )}
            </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

