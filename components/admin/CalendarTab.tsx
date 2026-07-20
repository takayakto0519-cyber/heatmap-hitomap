'use client';

// 📅 カレンダー — 連携しているGoogleカレンダー（会長のPC上の番人29が同期）の
// 今日・明日の予定を確認するための単独タブ。表示ロジックはCalendarPanelに集約し、
// 秘書タブ（SecretaryTab）とも共有する。
import CalendarPanel from './CalendarPanel';

const cardStyle: React.CSSProperties = { background: '#fff', borderRadius: 12, padding: 16, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' };

export default function CalendarTab({ authHeaders }: { authHeaders: () => HeadersInit }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={cardStyle}>
        <CalendarPanel authHeaders={authHeaders} showTomorrow />
      </div>
    </div>
  );
}
