'use client';

interface Props {
  value: number;
  onChange: (v: number) => void;
}

const LABELS = ['', 'すこし', 'まあまあ', 'かなり', 'とても', '最高に'];

export default function IntensityPicker({ value, onChange }: Props) {
  return (
    <div>
      <div style={{ display: 'flex', gap: 10, marginBottom: 6 }}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            style={{
              width: 44,
              height: 44,
              borderRadius: '50%',
              border: 'none',
              background: n <= value ? '#FF6B9D' : '#eee',
              cursor: 'pointer',
              fontSize: 20,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'background 0.15s',
              WebkitTapHighlightColor: 'transparent',
            }}
          >
            {n <= value ? '●' : '○'}
          </button>
        ))}
      </div>
      <p style={{ margin: 0, fontSize: 13, color: '#888' }}>{LABELS[value]}</p>
    </div>
  );
}
