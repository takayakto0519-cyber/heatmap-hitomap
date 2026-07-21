'use client';

import { colors, radii } from '@/lib/theme';
import { formatTimeLabel } from '@/lib/scheduleFormat';
import type { AvailabilitySlot } from './types';

export default function TimeSlotList({
  slots, selected, onSelect,
}: {
  slots: AvailabilitySlot[];
  selected: AvailabilitySlot | null;
  onSelect: (slot: AvailabilitySlot) => void;
}) {
  if (slots.length === 0) {
    return <p style={{ color: colors.textFaint, fontSize: 13, margin: 0 }}>この日は空いている枠がありません。</p>;
  }
  return (
    <div className="hm-schedule-pills" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      {slots.map((slot) => {
        const isSelected = selected?.start === slot.start;
        return (
          <button key={slot.start} type="button" onClick={() => onSelect(slot)} style={{
            minWidth: 64, minHeight: 40, padding: '10px 14px', borderRadius: radii.sm, cursor: 'pointer',
            fontSize: 13, fontWeight: 700, fontFamily: 'inherit',
            border: isSelected ? `1.5px solid ${colors.primary}` : `1.5px solid ${colors.borderSoft}`,
            background: isSelected ? colors.primary : colors.surfaceMuted,
            color: isSelected ? '#fff' : colors.textSecondary,
          }}>{formatTimeLabel(slot.start)}</button>
        );
      })}
    </div>
  );
}
