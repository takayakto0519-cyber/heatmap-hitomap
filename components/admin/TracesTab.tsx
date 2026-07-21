'use client';

// 投稿管理：投稿を検索・削除・復元する。page.tsx monolith分割で切り出し。
import { useCallback, useEffect, useState } from 'react';
import type { Trace } from '@/lib/types';
import { inputStyle, AuthorLine, ContentTags, useAuthorMap } from '@/components/admin/adminShared';

export default function TracesTab({ authHeaders }: { authHeaders: () => HeadersInit }) {
  const [q, setQ] = useState('');
  const [showDeleted, setShowDeleted] = useState(false);
  const [includeDemo, setIncludeDemo] = useState(false);
  const [demoHiddenCount, setDemoHiddenCount] = useState(0);
  const [traces, setTraces] = useState<Trace[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  // データ整合性QA・不正投稿検知（ホームの「今日の要注意」と同じ着眼点）をこの一覧側でも
  // 絞り込めるようにする。品質チェック目的なので通常より広い範囲（500件）を対象にする。
  const [emptyTitleOnly, setEmptyTitleOnly] = useState(false);
  const [duplicateOnly, setDuplicateOnly] = useState(false);
  const authorMap = useAuthorMap(authHeaders);

  const load = useCallback(() => {
    setLoading(true);
    const qaMode = emptyTitleOnly || duplicateOnly;
    const params = new URLSearchParams({ status: 'all', limit: qaMode ? '500' : '100' });
    if (q.trim()) params.set('q', q.trim());
    if (showDeleted) params.set('include_deleted', 'true');
    if (includeDemo) params.set('includeDemo', 'true');
    fetch(`/api/admin/traces?${params}`, { headers: authHeaders() })
      .then(r => r.json())
      .then(d => {
        if (d.ok) { setTraces(d.traces); setDemoHiddenCount(d.demoHiddenCount ?? 0); }
        else setError(d.error ?? '取得に失敗しました');
      })
      .catch(() => setError('通信エラー'))
      .finally(() => setLoading(false));
  }, [authHeaders, q, showDeleted, includeDemo, emptyTitleOnly, duplicateOnly]);

  useEffect(() => { load(); }, [load]);

  async function softDelete(id: string) {
    if (!confirm('この投稿を非公開（削除）にしますか？')) return;
    const res = await fetch(`/api/admin/traces/${id}`, { method: 'DELETE', headers: authHeaders() });
    const data = await res.json();
    if (data.ok) load(); else setError(data.error ?? '処理に失敗しました');
  }

  async function restore(id: string) {
    const res = await fetch(`/api/admin/traces/${id}`, { method: 'PATCH', headers: authHeaders() });
    const data = await res.json();
    if (data.ok) load(); else setError(data.error ?? '処理に失敗しました');
  }

  // タイトル空欄件数・重複タイトル（3件以上）は、agents/trace_qa.py・spam_detect.pyと同じ着眼点で
  // クライアント側に計算する（ホームの「今日の要注意」と同じ考え方の絞り込み）
  const emptyTitleCount = traces.filter(t => !t.title?.trim()).length;
  const titleCounts = new Map<string, number>();
  for (const t of traces) {
    const title = t.title?.trim();
    if (title) titleCounts.set(title, (titleCounts.get(title) ?? 0) + 1);
  }
  const duplicateTitles = new Set([...titleCounts.entries()].filter(([, c]) => c >= 3).map(([t]) => t));
  const visibleTraces = traces.filter(t => {
    if (emptyTitleOnly && t.title?.trim()) return false;
    if (duplicateOnly && !duplicateTitles.has(t.title?.trim() ?? '')) return false;
    return true;
  });

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
        <input value={q} onChange={e => setQ(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') load(); }}
          placeholder="タイトルで検索" style={{ ...inputStyle, flex: 1, minWidth: 160 }} />
        <button onClick={load} style={{ ...inputStyle, background: '#38ADA9', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 700 }}>検索</button>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#666' }}>
          <input type="checkbox" checked={showDeleted} onChange={e => setShowDeleted(e.target.checked)} />
          削除済みも表示
        </label>
      </div>

      <div style={{ display: 'flex', gap: 14, marginBottom: 14, flexWrap: 'wrap' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, color: '#B7791F', cursor: 'pointer' }}>
          <input type="checkbox" checked={emptyTitleOnly} onChange={e => setEmptyTitleOnly(e.target.checked)} />
          ⚠ タイトル空欄のみ（{emptyTitleCount}件）
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, color: '#B7791F', cursor: 'pointer' }}>
          <input type="checkbox" checked={duplicateOnly} onChange={e => setDuplicateOnly(e.target.checked)} />
          ⚠ 重複タイトル（3件以上）のみ（{duplicateTitles.size}種類）
        </label>
      </div>

      {(includeDemo || demoHiddenCount > 0) && (
        <label style={{
          display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 10, padding: '5px 12px',
          borderRadius: 16, fontSize: 11, fontWeight: 700, cursor: 'pointer',
          background: includeDemo ? '#E5A13918' : '#f4f4f4', color: includeDemo ? '#B7791F' : '#999',
        }}>
          <input type="checkbox" checked={includeDemo} onChange={e => setIncludeDemo(e.target.checked)} />
          🎭 商談デモ用データ{includeDemo ? 'を表示中' : `（${demoHiddenCount}件）を隠しています`}
        </label>
      )}

      {error && <p style={{ color: '#E74C3C', fontSize: 13 }}>{error}</p>}
      {loading ? <p style={{ color: '#999' }}>読み込み中…</p> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {visibleTraces.length === 0 && <p style={{ color: '#aaa' }}>該当する投稿はありません。</p>}
          {visibleTraces.map(t => (
            <div key={t.id} style={{
              display: 'flex', alignItems: 'flex-start', gap: 10,
              background: '#fff', borderRadius: 10, padding: '10px 12px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
              opacity: t.is_deleted ? 0.55 : 1,
            }}>
              {t.photo_url && <img src={t.photo_url} alt="" style={{ width: 48, height: 48, objectFit: 'cover', borderRadius: 6, flexShrink: 0 }} />}
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: 0, fontWeight: 700, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: t.title?.trim() ? undefined : '#B23A2E' }}>
                  {t.title?.trim() || '（タイトル空欄）'}
                </p>
                <ContentTags trace={t} />
                {t.why && (
                  <p style={{ margin: '2px 0 4px', fontSize: 12, color: '#666', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.why}</p>
                )}
                <p style={{ margin: 0, fontSize: 11, color: '#aaa' }}>
                  <AuthorLine trace={t} authorMap={authorMap} /> ・ {t.visibility} ・ {new Date(t.created_at).toLocaleDateString('ja-JP')}
                  {t.is_deleted && ' ・ 削除済み'}
                </p>
              </div>
              {t.is_deleted ? (
                <button onClick={() => restore(t.id)} style={{
                  padding: '6px 12px', borderRadius: 8, border: 'none',
                  background: '#EEF4FF', color: '#4A90E2', fontSize: 12, fontWeight: 700, cursor: 'pointer',
                }}>復元</button>
              ) : (
                <button onClick={() => softDelete(t.id)} style={{
                  padding: '6px 12px', borderRadius: 8, border: 'none',
                  background: '#FFF0F0', color: '#E55039', fontSize: 12, fontWeight: 700, cursor: 'pointer',
                }}>削除</button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

