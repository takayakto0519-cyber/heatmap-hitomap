'use client';

// 🗒 秘書 — 会長の負荷最小化のための一枚ビュー。
// 今日の予定（Googleカレンダー、CalendarPanel共有）＋ To-Do（action_items）を束ねる。
// To-Doの追加・詳細編集はAIOpsTab（作業状況セクション）で行う。ここは「今日やること」の
// 見晴らしと、会長作業待ちのものだけワンタップで完了にする軽い操作のみ。
import { useCallback, useEffect, useState } from 'react';
import CalendarPanel from './CalendarPanel';

interface ActionItem {
  id: string; title: string; category: string; status: string; owner: string;
  file_ref: string | null; notes: string | null; due_date: string | null; updated_at: string;
}

const STATUS_META: Record<string, { label: string; color: string }> = {
  todo: { label: '未着手', color: '#999' },
  manual_required: { label: '会長作業待ち', color: '#E67E22' },
  blocked: { label: '保留', color: '#999' },
  done: { label: 'AI完了', color: '#27AE60' },
};

const cardStyle: React.CSSProperties = { background: '#fff', borderRadius: 12, padding: 16, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' };
const sectionTitleStyle: React.CSSProperties = { fontSize: 14, fontWeight: 800, color: '#444', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 };

function isOverdue(due: string | null): boolean {
  if (!due) return false;
  return new Date(due + 'T23:59:59').getTime() < Date.now();
}

export default function SecretaryTab({ authHeaders }: { authHeaders: () => HeadersInit }) {
  const [items, setItems] = useState<ActionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  // ナビ整理で独立タブ「カレンダー」を廃止し、ここに内包（サイドバー整理2026-07-20）。
  // 普段はコンパクト表示、必要な時だけフル（今日・明日の全件）に切り替える。
  const [showFullCalendar, setShowFullCalendar] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/admin/action-items', { headers: authHeaders() });
      const data = await res.json();
      if (data.ok) setItems(data.items ?? []);
      else setError(data.error ?? '取得に失敗しました');
    } catch {
      setError('通信エラー');
    } finally {
      setLoading(false);
    }
  }, [authHeaders]);

  useEffect(() => { load(); }, [load]);

  async function markDone(id: string) {
    setItems(prev => prev.map(it => it.id === id ? { ...it, status: 'done' } : it));
    await fetch(`/api/admin/action-items/${id}`, {
      method: 'PATCH',
      headers: { ...authHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'done' }),
    });
    load();
  }

  function sortByPriority(list: ActionItem[]): ActionItem[] {
    return [...list].sort((a, b) => {
      const aOverdue = isOverdue(a.due_date), bOverdue = isOverdue(b.due_date);
      if (aOverdue !== bOverdue) return aOverdue ? -1 : 1;
      if (a.due_date && b.due_date) return a.due_date < b.due_date ? -1 : 1;
      if (a.due_date) return -1;
      if (b.due_date) return 1;
      return a.status === 'manual_required' ? -1 : 1;
    });
  }

  const pending = sortByPriority(items.filter(it => it.status !== 'done'));

  // 担当（owner）ごとに振り分け。「会長」を先頭、「AI」を末尾、その他はあいうえお順。
  function ownerRank(owner: string): number {
    if (owner === '会長') return 0;
    if (owner === 'AI') return 2;
    return 1;
  }
  const owners = Array.from(new Set(pending.map(it => it.owner || '未割当')))
    .sort((a, b) => ownerRank(a) - ownerRank(b) || a.localeCompare(b, 'ja'));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={cardStyle}>
        <CalendarPanel authHeaders={authHeaders} compact={!showFullCalendar} showTomorrow={showFullCalendar} />
        <button onClick={() => setShowFullCalendar(v => !v)} style={{
          marginTop: 8, padding: '4px 10px', borderRadius: 14, border: '1px solid #38ADA9', background: '#fff',
          color: '#38ADA9', fontSize: 11, fontWeight: 700, cursor: 'pointer',
        }}>{showFullCalendar ? '▴ コンパクト表示に戻す' : '▾ フルカレンダー（今日・明日）を見る'}</button>
      </div>

      <div style={cardStyle}>
        <div style={sectionTitleStyle}>
          今日やること（To-Do）
          {pending.length > 0 && (
            <span style={{ fontSize: 10, fontWeight: 700, color: '#E67E22', background: '#FFF3DC', padding: '2px 8px', borderRadius: 20 }}>{pending.length}件</span>
          )}
        </div>
        {loading && <div style={{ fontSize: 12, color: '#999' }}>読み込み中…</div>}
        {error && <div style={{ fontSize: 12, color: '#c0392b' }}>{error}</div>}
        {!loading && !error && pending.length === 0 && (
          <div style={{ fontSize: 12, color: '#999', padding: '10px 12px' }}>未完了のTo-Doはありません。</div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {owners.map(owner => {
            const ownerItems = pending.filter(it => (it.owner || '未割当') === owner);
            return (
              <div key={owner}>
                <div style={{
                  fontSize: 12, fontWeight: 800, color: '#666', marginBottom: 6,
                  display: 'flex', alignItems: 'center', gap: 6,
                }}>
                  <span style={{
                    width: 22, height: 22, borderRadius: '50%', background: '#38ADA9', color: '#fff',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 800,
                  }}>{owner.slice(0, 1)}</span>
                  {owner}
                  <span style={{ fontSize: 10, fontWeight: 700, color: '#999' }}>{ownerItems.length}件</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {ownerItems.map(it => {
                    const meta = STATUS_META[it.status] ?? STATUS_META.todo;
                    const overdue = isOverdue(it.due_date);
                    return (
                      <div key={it.id} style={{
                        display: 'flex', gap: 12, alignItems: 'center', padding: '10px 12px',
                        borderRadius: 10, background: overdue ? '#FDEDEC' : '#F4F6F5',
                      }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: '#222' }}>{it.title}</div>
                          <div style={{ fontSize: 11, color: '#999', marginTop: 2, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                            <span>{it.category}</span>
                            <span style={{ color: meta.color, fontWeight: 700 }}>{meta.label}</span>
                            {it.due_date && <span style={{ color: overdue ? '#c0392b' : '#999', fontWeight: overdue ? 700 : 400 }}>期限: {it.due_date}{overdue ? '（超過）' : ''}</span>}
                          </div>
                        </div>
                        <button
                          onClick={() => markDone(it.id)}
                          style={{ padding: '6px 12px', borderRadius: 8, border: 'none', background: '#38ADA9', color: '#fff', fontWeight: 700, fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap' }}
                        >完了</button>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
        <div style={{ fontSize: 11, color: '#bbb', marginTop: 12 }}>To-Doの追加・詳細編集は「AIエージェント運営」タブから行えます。</div>
      </div>
    </div>
  );
}
