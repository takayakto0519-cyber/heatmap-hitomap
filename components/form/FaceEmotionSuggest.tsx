'use client';

import { useEffect, useRef, useState } from 'react';
import { classifyFace, FACE_EMOTION_DWELL_SECONDS, type FaceReading } from '@/lib/faceEmotion';
import { getEmotion } from '@/lib/emotions';

interface Props {
  // すでに選ばれている感情キー（サジェストの重複表示を避けるため）
  selectedKeys: string[];
  // ユーザーがサジェストされたタグをタップして追加したときに呼ばれる
  onAdd: (key: string) => void;
}

// 「なにを感じた？」の下に置く、任意参加のAIサジェスト。
// 表情から推定した感情タグを「候補」として出すだけで、選ぶ・使うかは常に本人が決める。
// カメラは短時間だけ使い、解析後は即座に停止・破棄する（サーバー送信なし）。
export default function FaceEmotionSuggest({ selectedKeys, onAdd }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const landmarkerRef = useRef<import('@mediapipe/tasks-vision').FaceLandmarker | null>(null);
  const rafRef = useRef<number | null>(null);
  const dwellStartRef = useRef<number | null>(null);
  const dwellLabelRef = useRef<string | null>(null);

  const [status, setStatus] = useState<'idle' | 'loading' | 'scanning' | 'done' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [reading, setReading] = useState<FaceReading | null>(null);

  useEffect(() => cleanup, []);

  function cleanup() {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    landmarkerRef.current?.close();
    rafRef.current = null;
    streamRef.current = null;
    landmarkerRef.current = null;
  }

  async function start() {
    setStatus('loading');
    setErrorMsg('');
    setReading(null);
    dwellStartRef.current = null;
    dwellLabelRef.current = null;
    try {
      const { FaceLandmarker, FilesetResolver } = await import('@mediapipe/tasks-vision');

      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      const fileset = await FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm'
      );
      const landmarker = await FaceLandmarker.createFromOptions(fileset, {
        baseOptions: {
          modelAssetPath:
            'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
          delegate: 'GPU',
        },
        outputFaceBlendshapes: true,
        runningMode: 'VIDEO',
        numFaces: 1,
      });
      landmarkerRef.current = landmarker;

      setStatus('scanning');
      loop();
    } catch (err) {
      cleanup();
      setStatus('error');
      setErrorMsg(err instanceof Error ? err.message : 'カメラまたはモデルの初期化に失敗しました');
    }
  }

  function loop() {
    const video = videoRef.current;
    const landmarker = landmarkerRef.current;
    if (!video || !landmarker) return;

    if (video.readyState >= 2) {
      const now = performance.now();
      const result = landmarker.detectForVideo(video, now);
      const categories = result.faceBlendshapes?.[0]?.categories ?? [];
      if (categories.length > 0) {
        const scores: Record<string, number> = {};
        for (const c of categories) scores[c.categoryName] = c.score;
        const current = classifyFace(scores);

        if (current.suggestedKeys.length > 0) {
          if (dwellLabelRef.current !== current.label) {
            dwellLabelRef.current = current.label;
            dwellStartRef.current = now;
          }
          const elapsedSec = (now - (dwellStartRef.current ?? now)) / 1000;
          if (elapsedSec >= FACE_EMOTION_DWELL_SECONDS) {
            setReading(current);
            finish();
            return;
          }
        } else {
          dwellLabelRef.current = null;
          dwellStartRef.current = null;
        }
      }
    }
    rafRef.current = requestAnimationFrame(loop);
  }

  function finish() {
    cleanup();
    setStatus('done');
  }

  function cancel() {
    cleanup();
    setStatus('idle');
    setReading(null);
  }

  const candidateKeys = reading?.suggestedKeys.filter((k) => !selectedKeys.includes(k)) ?? [];

  return (
    <div style={{ marginTop: 10 }}>
      <video ref={videoRef} muted playsInline
        style={{
          display: status === 'scanning' || status === 'loading' ? 'block' : 'none',
          width: 96, height: 72, borderRadius: 10, objectFit: 'cover',
          transform: 'scaleX(-1)', background: '#000', marginBottom: 8,
        }} />

      {status === 'idle' && (
        <button type="button" onClick={start} style={{
          padding: '8px 12px', borderRadius: 8, border: '1.5px dashed #ccc',
          background: '#fafafa', color: '#888', fontSize: 12, cursor: 'pointer',
        }}>
          🎥 表情からAIに感情を提案してもらう（任意・端末内のみ）
        </button>
      )}

      {status === 'loading' && (
        <p style={{ fontSize: 12, color: '#999' }}>準備中…</p>
      )}

      {status === 'scanning' && (
        <>
          <p style={{ fontSize: 12, color: '#999', margin: '0 0 6px' }}>表情を見ています…</p>
          <button type="button" onClick={cancel} style={{
            padding: '6px 10px', borderRadius: 8, border: 'none',
            background: 'none', color: '#bbb', fontSize: 12, cursor: 'pointer',
          }}>やめる</button>
        </>
      )}

      {status === 'error' && (
        <p style={{ fontSize: 12, color: '#E55039' }}>{errorMsg}</p>
      )}

      {status === 'done' && (
        <div>
          {candidateKeys.length > 0 ? (
            <>
              <p style={{ fontSize: 12, color: '#999', margin: '0 0 6px' }}>
                {reading?.emoji} {reading?.label}な表情でした。よければ追加できます：
              </p>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {candidateKeys.map((key) => {
                  const e = getEmotion(key);
                  if (!e) return null;
                  return (
                    <button key={key} type="button" onClick={() => { onAdd(key); setStatus('idle'); }} style={{
                      display: 'flex', alignItems: 'center', gap: 4,
                      padding: '8px 12px', borderRadius: 20, border: `1.5px solid ${e.color}`,
                      background: '#fff', color: e.color, fontSize: 13, fontWeight: 700, cursor: 'pointer',
                    }}>
                      <span>{e.emoji}</span>{e.label}を追加
                    </button>
                  );
                })}
                <button type="button" onClick={() => setStatus('idle')} style={{
                  padding: '8px 10px', borderRadius: 20, border: 'none',
                  background: 'none', color: '#bbb', fontSize: 12, cursor: 'pointer',
                }}>不要</button>
              </div>
            </>
          ) : (
            <p style={{ fontSize: 12, color: '#bbb' }}>提案できる表情の変化は見つかりませんでした</p>
          )}
        </div>
      )}
    </div>
  );
}
