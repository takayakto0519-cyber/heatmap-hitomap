'use client';

import { colors, radii } from '@/lib/theme';

export const DURATIONS = [
  { value: 15, label: '15分' },
  { value: 30, label: '30分' },
  { value: 45, label: '45分' },
  { value: 60, label: '60分' },
];

export default function DurationTabs({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div style={{ display: 'flex', gap: 8 }}>
      {DURATIONS.map((d) => {
        const active = value === d.value;
        return (
          <button key={d.value} type="button" onClick={() => onChange(d.value)} style={{
            flex: 1, minHeight: 44, padding: '9px 0', borderRadius: radii.md, cursor: 'pointer',
            fontSize: 13, fontWeight: 700, fontFamily: 'inherit',
            border: active ? `1.5px solid ${colors.primary}` : `1.5px solid ${colors.border}`,
            background: active ? colors.primary : colors.surface,
            color: active ? '#fff' : colors.textSecondary,
          }}>{d.label}</button>
        );
      })}
    </div>
  );
}
