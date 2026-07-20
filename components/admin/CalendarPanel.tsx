'use client';

// 📅 カレンダー表示の共通パーツ — /api/admin/calendar（優先順でGoogleカレンダーからライブ取得、
// もしくはagents/calendar_watch.pyが同期した直近2週間分）を叩いて表示する。
// 予定の追加はPOST /api/admin/calendar-events（lib/googleCalendarServer.tsの書き込みスコープ）経由。
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
  live?: boolean;
  syncedAt?: string | null;
}

const EMPTY: CalendarData = { ok: false, connected: false, days: [], today: [], tomorrow: [] };

// 予定タイトルの先頭 "[担当者] " を担当者バッジとして解釈する（追加フォームで自動的にこの形式にする。
// 会長がGoogleカレンダー側で直接同じ書式でタイトルを付けた既存の予定にも同じように効く）。
function parseAssignee(rawTitle: string): { assignee: string | null; title: string } {
  const m = rawTitle.match(/^\[([^\]]+)\]\s*(.*)$/);
  if (m) return { assignee: m[1], title: m[2] || rawTitle };
  return { assignee: null, title: rawTitle };
}

const ASSIGNEE_COLORS = ['#38ADA9', '#4A69BD', '#E5A139', '#8E44AD', '#E55039', '#27AE60'];
function assigneeColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return ASSIGNEE_COLORS[hash % ASSIGNEE_COLORS.length];
}

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
  const { assignee, title } = parseAssignee(ev.title || '(無題の予定)');
  const content = (
    <div style={{
      display: 'flex', gap: 12, alignItems: 'flex-start', padding: '10px 12px',
      borderRadius: 10, background: '#F4F6F5',
    }}>
      <div style={{ fontSize: 12, fontWeight: 800, color: '#38ADA9', minWidth: 84, whiteSpace: 'nowrap' }}>{time}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#222', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          {assignee && (
            <span style={{
              fontSize: 10.5, fontWeight: 800, color: '#fff', background: assigneeColor(assignee),
              padding: '2px 8px', borderRadius: 20, whiteSpace: 'nowrap',
            }}>👤 {assignee}</span>
          )}
          {title}
        </div>
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

const inputStyle: React.CSSProperties = {
  padding: '7px 10px', borderRadius: 8, border: '1.5px solid #ddd',
  fontSize: 12.5, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box',
};
const labelStyle: React.CSSProperties = { fontSize: 10.5, fontWeight: 700, color: '#777', margin: '6px 0 3px', display: 'block' };

const emptyForm = { title: '', assignee: '', date: '', startTime: '10:00', endTime: '11:00', memo: '' };

function AddEventForm({
  authHeaders, onCreated, isLive,
}: { authHeaders: () => HeadersInit; onCreated: () => void; isLive: boolean }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  async function submit() {
    if (!form.title.trim()) { setMessage('タイトルを入力してください'); return; }
    if (!form.date) { setMessage('日付を選んでください'); return; }
    setSaving(true);
    setMessage('');
    try {
      const res = await fetch('/api/admin/calendar-events', {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!data.ok) { setMessage(data.error ?? '追加に失敗しました'); setSaving(false); return; }
      setForm(emptyForm);
      setOpen(false);
      setSaving(false);
      onCreated();
    } catch {
      setMessage('通信エラー');
      setSaving(false);
    }
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} style={{
        fontSize: 11.5, fontWeight: 700, background: '#fff', color: '#38ADA9', border: '1px solid #38ADA9',
        borderRadius: 999, padding: '5px 12px', cursor: 'pointer', marginBottom: 10,
      }}>＋ 予定を追加</button>
    );
  }

  return (
    <div style={{ padding: 12, borderRadius: 10, background: '#F4FAF9', border: '1px solid #DDF0EE', marginBottom: 12 }}>
      <label style={labelStyle}>タイトル</label>
      <input style={{ ...inputStyle, width: '100%' }} value={form.title}
        onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="例：牧之原市との打ち合わせ" />
      <label style={labelStyle}>担当</label>
      <input style={{ ...inputStyle, width: '100%' }} value={form.assignee}
        onChange={e => setForm(f => ({ ...f, assignee: e.target.value }))} placeholder="例：会長 / 小田（空欄可）" />
      <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
        <div style={{ flex: 1 }}>
          <label style={labelStyle}>日付</label>
          <input type="date" style={{ ...inputStyle, width: '100%' }} value={form.date}
            onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
        </div>
        <div>
          <label style={labelStyle}>開始</label>
          <input type="time" style={inputStyle} value={form.startTime}
            onChange={e => setForm(f => ({ ...f, startTime: e.target.value }))} />
        </div>
        <div>
          <label style={labelStyle}>終了</label>
          <input type="time" style={inputStyle} value={form.endTime}
            onChange={e => setForm(f => ({ ...f, endTime: e.target.value }))} />
        </div>
      </div>
      <label style={labelStyle}>メモ（任意）</label>
      <textarea style={{ ...inputStyle, width: '100%', resize: 'vertical' }} rows={2} value={form.memo}
        onChange={e => setForm(f => ({ ...f, memo: e.target.value }))} />
      {!isLive && (
        <div style={{ fontSize: 10.5, color: '#B7791F', marginTop: 6 }}>
          ※ この画面はまだGoogleカレンダーへのライブ読み取りが未設定です。追加自体は成功しますが、この一覧への反映は次回の同期まで遅れます。
        </div>
      )}
      {message && <div style={{ fontSize: 11.5, color: '#c0392b', marginTop: 6 }}>{message}</div>}
      <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
        <button onClick={submit} disabled={saving} style={{
          padding: '7px 16px', borderRadius: 8, border: 'none', background: '#38ADA9', color: '#fff',
          fontWeight: 700, fontSize: 12.5, cursor: saving ? 'default' : 'pointer', opacity: saving ? 0.6 : 1,
        }}>{saving ? '追加中…' : '追加する'}</button>
        <button onClick={() => { setOpen(false); setMessage(''); }} style={{
          padding: '7px 16px', borderRadius: 8, border: '1px solid #ccc', background: '#fff', color: '#666',
          fontWeight: 700, fontSize: 12.5, cursor: 'pointer',
        }}>キャンセル</button>
      </div>
    </div>
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
      <div>
        <AddEventForm authHeaders={authHeaders} onCreated={load} isLive={false} />
        <div style={{
          padding: compact ? 12 : 16, borderRadius: 12, background: '#FFF8E8',
          fontSize: 12, color: '#8a6d1f', lineHeight: 1.6,
        }}>
          📅 カレンダー未連携です。会長のPCで番人29（calendar_watch）を設定すると、ここにGoogleカレンダーの予定が表示されます。
          <div style={{ fontSize: 11, color: '#a68a3f', marginTop: 4 }}>設定手順: agents/secrets/README.md</div>
          {data.error && <div style={{ fontSize: 11, color: '#c0392b', marginTop: 6 }}>{data.error}</div>}
        </div>
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
        <AddEventForm authHeaders={authHeaders} onCreated={load} isLive={Boolean(data.live)} />
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
      <AddEventForm authHeaders={authHeaders} onCreated={load} isLive={Boolean(data.live)} />
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
