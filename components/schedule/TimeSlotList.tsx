'use client';

// トグル式の複数選択（候補日時を3つ以上出してもらう方式のため、単一選択ではない）。
// クリックするたびに選択中の候補一覧（selectedSlots、複数の日にまたがりうる）への
// 追加/削除をトグルする。
import { colors, radii } from '@/lib/theme';
import { formatTimeLabel } from '@/lib/scheduleFormat';
import type { AvailabilitySlot } from './types';

export default function TimeSlotList({
  slots, selectedSlots, onToggle,
}: {
  slots: AvailabilitySlot[];
  selectedSlots: AvailabilitySlot[];
  onToggle: (slot: AvailabilitySlot) => void;
}) {
  if (slots.length === 0) {
    return <p style={{ color: colors.textFaint, fontSize: 13, margin: 0 }}>この日は空いている枠がありません。</p>;
  }
  return (
    <div className="hm-schedule-pills" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      {slots.map((slot) => {
        const isSelected = selectedSlots.some((s) => s.start === slot.start);
        return (
          <button key={slot.start} type="button" onClick={() => onToggle(slot)} style={{
            minWidth: 64, minHeight: 40, padding: '10px 14px', borderRadius: radii.sm, cursor: 'pointer',
            fontSize: 13, fontWeight: 700, fontFamily: 'inherit',
            border: isSelected ? `1.5px solid ${colors.primary}` : `1.5px solid ${colors.borderSoft}`,
            background: isSelected ? colors.primary : colors.surfaceMuted,
            color: isSelected ? '#fff' : colors.textSecondary,
          }}>{isSelected ? '✓ ' : ''}{formatTimeLabel(slot.start)}</button>
        );
      })}
    </div>
  );
}
