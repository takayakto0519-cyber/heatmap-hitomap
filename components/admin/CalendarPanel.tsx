'use client';

// 📅 カレンダー表示の共通パーツ — /api/admin/calendar（agents/calendar_watch.pyが
// 同期する直近2週間分のGoogleカレンダー予定）を叩いて表示する。
// CalendarTab（単独タブ・2週間ぶん表示）とSecretaryTab（秘書タブ内埋め込み・今日のみ）
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

interface CalendarDay {
  date: string;
  events: CalendarEvent[];
}

interface CalendarData {
  ok: boolean;
  connected: boolean;
  days: CalendarDay[];
  today: CalendarEvent[];
  tomorrow: CalendarEvent[];
  asOf?: string | null;
  error?: string | null;
  local?: boolean;
  syncedAt?: string | null;
}

const EMPTY: CalendarData = { ok: false, connected: false, days: [], today: [], tomorrow: [] };

function formatTime(iso: string | null, allDay: boolean): string {
  if (!iso) return '';
  if (allDay) return '終日';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
}

function formatDateLabel(dateStr: string, todayStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  const weekday = ['日', '月', '火', '水', '木', '金', '土'][d.getDay()];
  const label = `${d.getMonth() + 1}/${d.getDate()}(${weekday})`;
  if (dateStr === todayStr) return `${label} ・ 本日`;
  return label;
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
  /** falseの場合は「今日」のみ表示（秘書タブでの軽量表示向け）。trueなら直近2週間ぶんを表示する。 */
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
        📅 カレンダー未連携です。会長のPCで番人29（calendar_watch）を設定すると、ここにGoogleカレンダーの予定が表示されます。
        <div style={{ fontSize: 11, color: '#a68a3f', marginTop: 4 }}>設定手順: agents/secrets/README.md</div>
        {data.error && <div style={{ fontSize: 11, color: '#c0392b', marginTop: 6 }}>{data.error}</div>}
      </div>
    );
  }

  const todayStr = data.days[0]?.date ?? '';

  // 秘書タブ内の軽量表示（今日ぶんだけ）
  if (!showTomorrow) {
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
        {data.asOf && (
          <div style={{ fontSize: 10, color: '#bbb', marginTop: 12 }}>最終更新: {new Date(data.asOf).toLocaleString('ja-JP')}</div>
        )}
      </div>
    );
  }

  // カレンダータブ：直近2週間ぶんを日付ごとに表示
  return (
    <div>
      <div style={{ fontSize: compact ? 13 : 14, fontWeight: 800, color: '#444', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
        直近2週間の予定
        <span style={{ fontSize: 10, fontWeight: 700, color: '#27AE60', background: '#EAF7EE', padding: '2px 8px', borderRadius: 20 }}>● 連携中</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {data.days.map(day => (
          <div key={day.date}>
            <div style={{
              fontSize: 12, fontWeight: 800, marginBottom: 6,
              color: day.date === todayStr ? '#38ADA9' : '#888',
            }}>{formatDateLabel(day.date, todayStr)}</div>
            {day.events.length === 0 ? (
              <div style={{ fontSize: 11, color: '#bbb', padding: '2px 12px' }}>予定なし</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {day.events.map((ev, i) => <EventRow key={i} ev={ev} />)}
              </div>
            )}
          </div>
        ))}
      </div>
      {data.asOf && (
        <div style={{ fontSize: 10, color: '#bbb', marginTop: 12 }}>最終更新: {new Date(data.asOf).toLocaleString('ja-JP')}</div>
      )}
    </div>
  );
}
