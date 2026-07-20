'use client';

// 📅 カレンダー表示の共通パーツ — /api/admin/calendar（agents/calendar_watch.pyが
// 書き出すagents/work/calendar_watch.jsonを読む読み取り専用API）を叩いて
// 今日・明日の予定を表示する。CalendarTab（単独タブ）とSecretaryTab（秘書タブ内埋め込み）
// の両方から使う共通コンポーネント。
import { useCallback, useEffect, useState } from 'react';

interface CalendarEvent {
  title: string;
  start: string | null;
  end: string | null;
  all_day: boolean;
  location: string;
  html_link: string;
}

interface CalendarData {
  ok: boolean;
  connected: boolean;
  today: CalendarEvent[];
  tomorrow: CalendarEvent[];
  asOf?: string | null;
  error?: string | null;
}

const EMPTY: CalendarData = { ok: false, connected: false, today: [], tomorrow: [] };

function formatTime(iso: string | null, allDay: boolean): string {
  if (!iso) return '';
  if (allDay) return '終日';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
}

function EventRow({ ev }: { ev: CalendarEvent }) {
  const time = ev.all_day ? '終日' : `${formatTime(ev.start, ev.all_day)}${ev.end ? ` – ${formatTime(ev.end, ev.all_day)}` : ''}`;
  const content = (
    <div style={{
      display: 'flex', gap: 12, alignItems: 'flex-start', padding: '10px 12px',
      borderRadius: 10, background: '#F4F6F5',
    }}>
      <div style={{ fontSize: 12, fontWeight: 800, color: '#38ADA9', minWidth: 84, whiteSpace: 'nowrap' }}>{time}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#222' }}>{ev.title || '(無題の予定)'}</div>
        {ev.location && <div style={{ fontSize: 11, color: '#999', marginTop: 2 }}>📍 {ev.location}</div>}
      </div>
    </div>
  );
  if (!ev.html_link) return content;
  return (
    <a href={ev.html_link} target="_blank" rel="noreferrer" style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}>
      {content}
    </a>
  );
}

export default function CalendarPanel({
  authHeaders,
  compact = false,
  showTomorrow = true,
}: {
  authHeaders: () => HeadersInit;
  compact?: boolean;
  showTomorrow?: boolean;
}) {
  const [data, setData] = useState<CalendarData>(EMPTY);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/calendar', { headers: authHeaders() });
      const json = await res.json();
      setData(json.ok ? json : EMPTY);
    } catch {
      setData(EMPTY);
    } finally {
      setLoading(false);
    }
  }, [authHeaders]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <div style={{ fontSize: 12, color: '#999', padding: compact ? 0 : 16 }}>読み込み中…</div>;

  if (!data.connected) {
    return (
      <div style={{
        padding: compact ? 12 : 16, borderRadius: 12, background: '#FFF8E8',
        fontSize: 12, color: '#8a6d1f', lineHeight: 1.6,
      }}>
        📅 カレンダー未連携です。会長のPCで番人29（calendar_watch）を設定すると、ここにGoogleカレンダーの今日・明日の予定が表示されます。
        <div style={{ fontSize: 11, color: '#a68a3f', marginTop: 4 }}>設定手順: agents/secrets/README.md</div>
        {data.error && <div style={{ fontSize: 11, color: '#c0392b', marginTop: 6 }}>{data.error}</div>}
      </div>
    );
  }

  return (
    <div>
      <div style={{ fontSize: compact ? 13 : 14, fontWeight: 800, color: '#444', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
        今日の予定
        <span style={{ fontSize: 10, fontWeight: 700, color: '#27AE60', background: '#EAF7EE', padding: '2px 8px', borderRadius: 20 }}>● 連携中</span>
      </div>
      {data.today.length === 0 ? (
        <div style={{ fontSize: 12, color: '#999', padding: '10px 12px' }}>本日の予定はありません。</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {data.today.map((ev, i) => <EventRow key={i} ev={ev} />)}
        </div>
      )}

      {showTomorrow && (
        <>
          <div style={{ fontSize: compact ? 12 : 13, fontWeight: 800, color: '#777', margin: '16px 0 8px' }}>明日の予定</div>
          {data.tomorrow.length === 0 ? (
            <div style={{ fontSize: 12, color: '#999', padding: '10px 12px' }}>明日の予定はありません。</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {data.tomorrow.map((ev, i) => <EventRow key={i} ev={ev} />)}
            </div>
          )}
        </>
      )}

      {data.asOf && (
        <div style={{ fontSize: 10, color: '#bbb', marginTop: 12 }}>最終更新: {new Date(data.asOf).toLocaleString('ja-JP')}</div>
      )}
    </div>
  );
}
