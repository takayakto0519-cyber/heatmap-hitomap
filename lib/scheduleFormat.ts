// /schedule（日程調整ページ）と、その各コンポーネント（MonthCalendar・TimeSlotList・
// ConfirmationScreen）で共有する日付・時刻のフォーマット関数。
// サーバー側 lib/googleCalendarServer.ts と同じくJST基準で統一する。

export const WEEKDAY_LABELS = ['日', '月', '火', '水', '木', '金', '土'];
export const WEEKDAY_LABELS_SHORT = ['日', '月', '火', '水', '木', '金', '土']; // モバイル用（現状は同じだが将来1文字固定を変える余地を残す）

export function formatDateLabel(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00+09:00`);
  return `${d.getMonth() + 1}/${d.getDate()}(${WEEKDAY_LABELS[d.getDay()]})`;
}

export function formatTimeLabel(iso: string): string {
  return new Date(iso).toLocaleTimeString('ja-JP', { timeZone: 'Asia/Tokyo', hour: '2-digit', minute: '2-digit' });
}

export function formatMonthLabel(monthKey: string): string {
  const [y, m] = monthKey.split('-').map(Number);
  return `${y}年${m}月`;
}

// JSTの「今日」をYYYY-MM-DD文字列で返す（ブラウザのローカルTZに依存しない）
export function todayJstDateStr(): string {
  return new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' }); // sv-SEロケールはYYYY-MM-DD形式を返す
}

// YYYY-MM-DD の日付文字列から曜日（0=日〜6=土）を返す
export function weekdayOfDateStr(dateStr: string): number {
  return new Date(`${dateStr}T12:00:00+09:00`).getDay();
}

// YYYY-MM を1ヶ月ずらす
export function shiftMonthKey(monthKey: string, diff: number): string {
  const [y, m] = monthKey.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + diff, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

export function currentMonthKey(): string {
  const [y, m] = todayJstDateStr().split('-');
  return `${y}-${m}`;
}
