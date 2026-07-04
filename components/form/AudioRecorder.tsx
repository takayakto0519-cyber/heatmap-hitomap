'use client';
// 言い伝え・人の声を録音するための簡易レコーダー（MediaRecorder API）
import { useRef, useState, useEffect } from 'react';

interface Props {
  value: Blob | null;
  onChange: (blob: Blob | null) => void;
}

function formatTime(sec: number) {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function AudioRecorder({ value, onChange }: Props) {
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState('');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    if (!value) { setPreviewUrl(null); return; }
    const url = URL.createObjectURL(value);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [value]);

  useEffect(() => () => {
    if (timerRef.current) clearInterval(timerRef.current);
    streamRef.current?.getTracks().forEach(t => t.stop());
  }, []);

  async function startRecording() {
    setError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : undefined;
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      chunksRef.current = [];
      recorder.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        onChange(blob);
        stream.getTracks().forEach(t => t.stop());
      };
      mediaRecorderRef.current = recorder;
      recorder.start();
      setRecording(true);
      setSeconds(0);
      timerRef.current = setInterval(() => setSeconds(s => s + 1), 1000);
    } catch {
      setError('マイクにアクセスできませんでした。ブラウザの権限設定を確認してください');
    }
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop();
    setRecording(false);
    if (timerRef.current) clearInterval(timerRef.current);
  }

  function clearRecording() {
    onChange(null);
    setSeconds(0);
  }

  return (
    <div>
      {!value && !recording && (
        <button type="button" onClick={startRecording} style={{
          width: '100%', padding: '13px', borderRadius: 10,
          border: '2px solid #E55039', background: '#FFF0EE',
          color: '#E55039', fontSize: 14, fontWeight: 700, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        }}>
          🎙️ 録音を始める
        </button>
      )}

      {recording && (
        <button type="button" onClick={stopRecording} style={{
          width: '100%', padding: '13px', borderRadius: 10,
          border: '2px solid #E55039', background: '#E55039',
          color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          animation: 'pulse 1.5s infinite',
        }}>
          ⏹ 録音を止める（{formatTime(seconds)}）
        </button>
      )}

      {value && !recording && previewUrl && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <audio controls src={previewUrl} style={{ width: '100%' }} />
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" onClick={clearRecording} style={{
              flex: 1, padding: '9px', borderRadius: 8, border: '1.5px solid #ddd',
              background: '#fff', color: '#E55039', fontSize: 12, cursor: 'pointer',
            }}>削除して撮り直す</button>
          </div>
        </div>
      )}

      {error && <p style={{ color: '#E55039', fontSize: 12, margin: '6px 0 0' }}>{error}</p>}
    </div>
  );
}
