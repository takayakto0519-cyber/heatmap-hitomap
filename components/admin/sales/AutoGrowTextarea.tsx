'use client';

// 展開時に本文の行数へ自動で高さが追従するtextarea。
// 固定rows（例：rows={8}）だと長いメール文案が途中でスクロールになり全文を一目で見られない、
// という営業タブの不満に対応する。rowsは初期表示の最小高さとしてのみ使う。
import { useEffect, useRef } from 'react';

export default function AutoGrowTextarea({
  value, onChange, onBlur, placeholder, rows = 3, style,
}: {
  value: string;
  onChange: (v: string) => void;
  onBlur?: (v: string) => void;
  placeholder?: string;
  rows?: number;
  style?: React.CSSProperties;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);

  return (
    <textarea
      ref={ref}
      value={value}
      onChange={e => onChange(e.target.value)}
      onBlur={e => onBlur?.(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      style={{ ...style, overflow: 'hidden', resize: 'vertical' }}
    />
  );
}
