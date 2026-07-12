'use client';
import { EMOTIONS } from '@/lib/emotions';

interface Props {
  value: string[];
  onChange: (keys: string[]) => void;
}

// 複数選択可：同じ場所で複数の感情が同時に動くこともあるため、タップごとにON/OFFをトグルする
export default function EmotionPicker({ value, onChange }: Props) {
  function toggle(key: string) {
    onChange(value.includes(key) ? value.filter((k) => k !== key) : [...value, key]);
  }

  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      {EMOTIONS.map((e) => {
        const selected = value.includes(e.key);
        return (
          <button
            key={e.key}
            type="button"
            onClick={() => toggle(e.key)}
            aria-pressed={selected}
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
