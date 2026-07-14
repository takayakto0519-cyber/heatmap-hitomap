'use client';

import { useRef, useState } from 'react';
import type { Trace } from '@/lib/types';
import { colors, radii } from '@/lib/theme';
import EmotionPicker from './form/EmotionPicker';
import FaceEmotionSuggest from './form/FaceEmotionSuggest';

interface Props {
  trace: Trace;
  onClose: () => void;
  onUpdate: (updated: Trace) => void;
}

const NOTE_PLACEHOLDERS = ['修理された木の柱', '細い路地', '昔の郵便受け', 'すり減った石段', '手書きの貼り紙'];

// クイック記録の直後に出す、最小限の追記シート。
// 選ぶ・撮るの1タップごとに即保存する（「保存する」ボタンを挟まない＝迷わせない）。
export default function QuickAddSheet({ trace, onClose, onUpdate }: Props) {
  const [emotions, setEmotions] = useState<string[]>(
    trace.emotion_keys ?? (trace.emotion_key ? [trace.emotion_key] : [])
  );
  const [photoUrl, setPhotoUrl] = useState(trace.photo_url);
  const [uploading, setUploading] = useState(false);
  const [photoError, setPhotoError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const [note, setNote] = useState('');
  const notePlaceholder = useRef(NOTE_PLACEHOLDERS[Math.floor(Math.random() * NOTE_PLACEHOLDERS.length) % NOTE_PLACEHOLDERS.length]).current;

  async function patch(fields: Record<string, unknown>) {
    try {
      const res = await fetch(`/api/traces/${trace.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fields),
      });
      const data = await res.json();
      if (data.ok) onUpdate(data.trace);
    } catch {
      // 追記の保存に失敗しても記録自体（位置）は残っているので、致命的な失敗としては扱わない
    }
  }

  async function selectEmotions(keys: string[]) {
    setEmotions(keys);
    await patch({ emotion_key: keys[0] ?? null, emotion_keys: keys.length > 0 ? keys : null, intensity: trace.intensity ?? 3 });
  }

  async function saveNote() {
    const trimmed = note.trim();
    if (!trimmed) return;
    await patch({ title: trimmed });
  }

  async function handlePhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoError('');
    setUploading(true);
    try {
      const { uploadTracePhoto } = await import('@/lib/supabase/upload');
      const url = await uploadTracePhoto(file);
      setPhotoUrl(url);
      await patch({ photo_url: url, photo_urls: [url] });
    } catch (err) {
      setPhotoError(err instanceof Error ? err.message : '写真のアップロードに失敗しました');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1000 }} />
      <div style={{
        position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 1001,
        background: '#fff', borderRadius: '20px 20px 0 0',
        padding: '18px 16px calc(18px + env(safe-area-inset-bottom))',
        boxShadow: '0 -4px 30px rgba(0,0,0,0.18)',
      }}>
        <p style={{ margin: '0 0 2px', fontWeight: 800, fontSize: 16 }}>⚡ 記録しました</p>
        <p style={{ margin: '0 0 16px', fontSize: 12, color: '#999' }}>
          今なら1タップで感情や写真を足せます。あとからでも大丈夫です。
        </p>

        <p style={{ margin: '0 0 8px', fontSize: 12, color: '#aaa', fontWeight: 700 }}>どんな感情？（複数選べます）</p>
        <EmotionPicker value={emotions} onChange={selectEmotions} />
        <FaceEmotionSuggest
          selectedKeys={emotions}
          onAdd={(key) => selectEmotions(emotions.includes(key) ? emotions : [...emotions, key])}
        />

        <div style={{ marginTop: 16 }}>
          {photoUrl && (
            <img src={photoUrl} alt="" style={{ width: '100%', maxHeight: 160, objectFit: 'cover', borderRadius: 10, marginBottom: 8, display: 'block' }} />
          )}
          <input ref={fileRef} type="file" accept="image/*" onChange={handlePhoto} style={{ display: 'none' }} />
          <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading} style={{
            width: '100%', padding: '11px 0', borderRadius: 10, border: '1.5px solid #ddd',
            background: '#fafafa', color: '#555', fontWeight: 700, fontSize: 14,
            cursor: uploading ? 'wait' : 'pointer',
          }}>{uploading ? 'アップロード中…' : photoUrl ? '📷 写真を撮り直す・選び直す' : '📷 写真を撮る・選ぶ'}</button>
          {photoError && <p style={{ margin: '6px 0 0', fontSize: 12, color: '#E55039' }}>{photoError}</p>}
        </div>

        <div style={{ marginTop: 16 }}>
          <p style={{ margin: '0 0 8px', fontSize: 12, color: '#aaa', fontWeight: 700 }}>何に心が動いた？（任意）</p>
          <input
            type="text" value={note} onChange={e => setNote(e.target.value)} onBlur={saveNote}
            placeholder={notePlaceholder}
            style={{
              width: '100%', boxSizing: 'border-box', padding: '11px 12px', fontSize: 14,
              border: `1.5px solid ${colors.border}`, borderRadius: radii.md, fontFamily: 'inherit', outline: 'none', background: colors.surfaceMuted,
            }}
          />
          <p style={{ margin: '4px 0 0', fontSize: 11, color: colors.textFaint }}>理由はあとから編集できます</p>
        </div>

        <button type="button" onClick={() => { saveNote(); onClose(); }} style={{
          width: '100%', marginTop: 14, padding: '12px 0', borderRadius: 10, border: 'none',
          background: '#FF6B9D', color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer',
        }}>とじる</button>
      </div>
    </>
  );
}
