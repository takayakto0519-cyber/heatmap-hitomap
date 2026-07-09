'use client';

import { useEffect, useRef, useState } from 'react';

interface Props {
  url: string;
  color?: string;
}

// 録音の波形を静的に描画する（Web Audio APIでデコードしてピークを取り出すだけ。追加のライブラリ不要）
export default function AudioWaveform({ url, color = '#8E44AD' }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const AudioContextCtor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        const ctx = new AudioContextCtor();
        const res = await fetch(url);
        const arrayBuffer = await res.arrayBuffer();
        const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
        if (cancelled) return;

        const raw = audioBuffer.getChannelData(0);
        const canvas = canvasRef.current;
        if (!canvas) return;
        const width = canvas.width;
        const height = canvas.height;
        const barCount = 60;
        const samplesPerBar = Math.floor(raw.length / barCount);
        const peaks: number[] = [];
        for (let i = 0; i < barCount; i++) {
          let max = 0;
          for (let j = 0; j < samplesPerBar; j++) {
            const v = Math.abs(raw[i * samplesPerBar + j] ?? 0);
            if (v > max) max = v;
          }
          peaks.push(max);
        }
        const canvasCtx = canvas.getContext('2d');
        if (!canvasCtx) return;
        canvasCtx.clearRect(0, 0, width, height);
        const barWidth = width / barCount;
        peaks.forEach((p, i) => {
          const barHeight = Math.max(2, p * height);
          canvasCtx.fillStyle = color;
          canvasCtx.fillRect(i * barWidth, (height - barHeight) / 2, barWidth * 0.6, barHeight);
        });
        ctx.close();
      } catch {
        if (!cancelled) setError(true);
      }
    })();
    return () => { cancelled = true; };
  }, [url, color]);

  if (error) return null;
  return <canvas ref={canvasRef} width={300} height={40} style={{ width: '100%', height: 40, display: 'block' }} />;
}
