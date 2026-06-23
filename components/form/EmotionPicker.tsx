'use client';
import { EMOTIONS } from '@/lib/emotions';

interface Props {
  value: string | null;
  onChange: (key: string) => void;
}

export default function EmotionPicker({ value, onChange }: Props) {
  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      {EMOTIONS.map((e) => {
        const selected = value === e.key;
        return (
          <button
            key={e.key}
            type="button"
            onClick={() => onChange(e.key)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              padding: '10px 14px',
              borderRadius: 24,
              border: `2px solid ${selected ? e.color : '#ddd'}`,
              background: selected ? e.color : '#fff',
              color: selected ? '#fff' : '#333',
              fontSize: 14,
              fontWeight: selected ? 700 : 400,
              cursor: 'pointer',
              transition: 'all 0.15s',
              WebkitTapHighlightColor: 'transparent',
            }}
          >
            <span style={{ fontSize: 18 }}>{e.emoji}</span>
            {e.label}
          </button>
        );
      })}
    </div>
  );
}
