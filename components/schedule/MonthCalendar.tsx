'use client';

// 月間カレンダーグリッド（Calendly風）。
// 表示中の月の全カレンダー日を7列グリッドで並べ、空き枠がある日だけ選択可能にする。
// 土日も含め毎日が対象（サーバー側 lib/googleCalendarServer.ts は曜日を区別しない）。
// 空き枠の有無（slots.length）で「過去日・空き無し日」をまとめて非活性にできる。
import { colors, radii } from '@/lib/theme';
import { formatMonthLabel, todayJstDateStr, weekdayOfDateStr, WEEKDAY_LABELS } from '@/lib/scheduleFormat';
import type { AvailabilityDay } from './types';

export default function MonthCalendar({
  monthKey, days, selectedDate, onSelectDate, onChangeMonth, minMonth, maxMonth, pickedCounts,
}: {
  monthKey: string;
  days: AvailabilityDay[];
  selectedDate: string | null;
  onSelectDate: (date: string) => void;
  onChangeMonth: (diff: 1 | -1) => void;
  minMonth: string;
  maxMonth: string;
  // 日付ごとに、その日から候補として選択中の枠数（複数日にまたがって候補を選べるため、
  // 「今見ている日」＝selectedDateとは別に、どの日に候補があるかを視覚的に示す）
  pickedCounts: Record<string, number>;
}) {
  const today = todayJstDateStr();
  const firstDate = days[0]?.date;
  const leadingBlanks = firstDate ? weekdayOfDateStr(firstDate) : 0;
  const totalCells = leadingBlanks + days.length;
  const trailingBlanks = (7 - (totalCells % 7)) % 7;

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <button type="button" onClick={() => onChangeMonth(-1)} disabled={monthKey <= minMonth} aria-label="前の月" style={{
          width: 32, height: 32, borderRadius: radii.sm, border: `1.5px solid ${colors.border}`,
          background: colors.surface, color: monthKey <= minMonth ? colors.textFaint : colors.textSecondary,
          cursor: monthKey <= minMonth ? 'default' : 'pointer', fontSize: 14, fontWeight: 700,
        }}>‹</button>
        <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: colors.textPrimary }}>{formatMonthLabel(monthKey)}</p>
        <button type="button" onClick={() => onChangeMonth(1)} disabled={monthKey >= maxMonth} aria-label="次の月" style={{
          width: 32, height: 32, borderRadius: radii.sm, border: `1.5px solid ${colors.border}`,
          background: colors.surface, color: monthKey >= maxMonth ? colors.textFaint : colors.textSecondary,
          cursor: monthKey >= maxMonth ? 'default' : 'pointer', fontSize: 14, fontWeight: 700,
        }}>›</button>
      </div>

      <div className="hm-schedule-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, marginBottom: 4 }}>
        {WEEKDAY_LABELS.map((w) => (
          <div key={w} style={{ textAlign: 'center', fontSize: 11, fontWeight: 700, color: colors.textFaint, padding: '2px 0' }}>{w}</div>
        ))}
      </div>

      <div className="hm-schedule-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
        {Array.from({ length: leadingBlanks }).map((_, i) => <div key={`lead-${i}`} />)}
        {days.map((day) => {
          const hasSlots = day.slots.length > 0;
          const isToday = day.date === today;
          const isViewing = day.date === selectedDate;
          const pickedCount = pickedCounts[day.date] ?? 0;
          const dayNum = Number(day.date.slice(8, 10));
          return (
            <button key={day.date} type="button" disabled={!hasSlots} onClick={() => onSelectDate(day.date)} style={{
              position: 'relative', aspectRatio: '1 / 1', minHeight: 40, borderRadius: radii.sm, cursor: hasSlots ? 'pointer' : 'default',
              fontSize: 13, fontWeight: isViewing ? 800 : 600, fontFamily: 'inherit',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2,
              border: isViewing ? `1.5px solid ${colors.primary}` : isToday ? `1.5px solid ${colors.textFaint}` : '1.5px solid transparent',
              background: isViewing ? colors.primary : pickedCount > 0 ? colors.purpleBg : hasSlots ? colors.surface : colors.surfaceMuted,
              color: isViewing ? '#fff' : hasSlots ? colors.textPrimary : colors.textFaint,
            }}>
              <span>{dayNum}</span>
              {hasSlots && pickedCount === 0 && (
                <span style={{ width: 4, height: 4, borderRadius: '50%', background: colors.accent }} />
              )}
              {pickedCount > 0 && (
                <span style={{
                  position: 'absolute', top: 2, right: 2, minWidth: 14, height: 14, borderRadius: 7,
                  background: isViewing ? '#fff' : colors.purple, color: isViewing ? colors.primary : '#fff',
                  fontSize: 9, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 3px',
                }}>{pickedCount}</span>
              )}
            </button>
          );
        })}
        {Array.from({ length: trailingBlanks }).map((_, i) => <div key={`trail-${i}`} />)}
      </div>
    </div>
  );
}
