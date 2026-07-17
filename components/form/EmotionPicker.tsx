'use client';
import { EMOTIONS } from '@/lib/emotions';

interface Props {
  value: string[];
  onChange: (keys: string[]) => void;
  // 強度も一緒に扱う場合に渡す（1タップ投稿用）。
  // 感情を1つ以上選んだときだけコンパクトな5ドット行が現れ、押さなければ標準の3のまま投稿できる。
  intensity?: number;
  onIntensityChange?: (v: number) => void;
}

const INTENSITY_LABELS = ['', 'すこし', 'まあまあ', 'かなり', 'とても', '最高に'];

// 複数選択可：同じ場所で複数の感情が同時に動くこともあるため、タップごとにON/OFFをトグルする
export default function EmotionPicker({ value, onChange, intensity, onIntensityChange }: Props) {
  function toggle(key: string) {
    onChange(value.includes(key) ? value.filter((k) => k !== key) : [...value, key]);
  }

  const showIntensity = value.length > 0 && intensity !== undefined && onIntensityChange !== undefined;

  return (
    <div>
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

      {showIntensity && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10 }}>
          <span style={{ fontSize: 12, color: '#888' }}>強さ</span>
          <div style={{ display: 'flex', gap: 6 }}>
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => onIntensityChange(n)}
                aria-label={`強度${n}`}
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: '50%',
                  border: 'none',
                  background: n <= intensity ? '#FF6B9D' : '#eee',
                  cursor: 'pointer',
                  fontSize: 13,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'background 0.15s',
                  WebkitTapHighlightColor: 'transparent',
                  color: n <= intensity ? '#fff' : '#bbb',
                }}
              >
                {n <= intensity ? '●' : '○'}
              </button>
            ))}
          </div>
          <span style={{ fontSize: 12, color: '#888' }}>{INTENSITY_LABELS[intensity]}</span>
        </div>
      )}
    </div>
  );
}
