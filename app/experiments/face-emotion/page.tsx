'use client';

import { useEffect, useRef, useState } from 'react';

// ============================================================
// 実験ページ：インカメラの表情から感情を推定できるか試すデモ。
// 投稿フォーム・API・DBには一切接続しない。映像は解析後すぐ破棄し、
// どこにも送信しない（すべて端末内＝ブラウザ内で完結する）。
// 会長への提案「視線×AIレコーダー」構想の第一歩として、
// まず「表情からの感情推定はどこまで実用的か」を検証するための小さな検証。
// ============================================================

type Guess = { emoji: string; label: string; note: string };
type InterestMoment = { time: string; emoji: string; label: string; dwellSec: number };

const NEUTRAL: Guess = { emoji: '😐', label: 'おだやか', note: '目立った表情の動きなし' };
const GAZE_DEVIATION_THRESHOLD = 0.25; // これ未満なら「視線がほぼ正面＝画面/対象を見ている」とみなす
const DWELL_SECONDS_FOR_INTEREST = 2; // この秒数、視線が安定＋表情が動いたら「気になった瞬間」とする
const LOG_COOLDOWN_MS = 4000; // 同じ注視の間に何度も記録しないためのクールダウン

function classify(scores: Record<string, number>): Guess {
  const smile = ((scores.mouthSmileLeft ?? 0) + (scores.mouthSmileRight ?? 0)) / 2;
  const surprise = ((scores.browInnerUp ?? 0) + (scores.eyeWideLeft ?? 0) + (scores.eyeWideRight ?? 0) + (scores.jawOpen ?? 0)) / 4;
  const frown = ((scores.browDownLeft ?? 0) + (scores.browDownRight ?? 0) + (scores.mouthFrownLeft ?? 0) + (scores.mouthFrownRight ?? 0)) / 4;

  if (smile > 0.4 && smile >= surprise && smile >= frown) {
    return { emoji: '😊', label: 'うれしそう', note: `笑顔スコア ${smile.toFixed(2)}` };
  }
  if (surprise > 0.4 && surprise > frown) {
    return { emoji: '😲', label: 'おどろいてそう', note: `驚きスコア ${surprise.toFixed(2)}` };
  }
  if (frown > 0.3) {
    return { emoji: '😟', label: 'こまってそう', note: `困り顔スコア ${frown.toFixed(2)}` };
  }
  return NEUTRAL;
}

// MediaPipeが返す内部名（英語）を、見て分かる日本語ラベルに変換する。
// 未対応の名前はそのまま表示するが、内訳に出やすい主要なものは網羅している。
const BLENDSHAPE_LABELS: Record<string, string> = {
  mouthSmileLeft: '口角（左）が上がる', mouthSmileRight: '口角（右）が上がる',
  mouthFrownLeft: '口角（左）が下がる', mouthFrownRight: '口角（右）が下がる',
  browDownLeft: '眉（左）が下がる', browDownRight: '眉（右）が下がる',
  browInnerUp: '眉間が上がる', browOuterUpLeft: '眉（左外側）が上がる', browOuterUpRight: '眉（右外側）が上がる',
  eyeWideLeft: '目（左）が見開く', eyeWideRight: '目（右）が見開く',
  eyeSquintLeft: '目（左）が細まる', eyeSquintRight: '目（右）が細まる',
  eyeBlinkLeft: 'まばたき（左）', eyeBlinkRight: 'まばたき（右）',
  jawOpen: '口が開く', jawLeft: 'あごが左に動く', jawRight: 'あごが右に動く',
  cheekPuff: 'ほおが膨らむ', cheekSquintLeft: 'ほお（左）が上がる', cheekSquintRight: 'ほお（右）が上がる',
  noseSneerLeft: '鼻（左）にしわ', noseSneerRight: '鼻（右）にしわ',
  mouthPucker: '口をすぼめる', mouthPressLeft: '口を結ぶ（左）', mouthPressRight: '口を結ぶ（右）',
  eyeLookInLeft: '視線（左目）が内側', eyeLookInRight: '視線（右目）が内側',
  eyeLookOutLeft: '視線（左目）が外側', eyeLookOutRight: '視線（右目）が外側',
  eyeLookUpLeft: '視線（左目）が上', eyeLookUpRight: '視線（右目）が上',
  eyeLookDownLeft: '視線（左目）が下', eyeLookDownRight: '視線（右目）が下',
};

function blendshapeLabel(name: string): string {
  return BLENDSHAPE_LABELS[name] ?? name;
}

// 視線が正面（＝目の前のものを見ている）からどれだけ逸れているかを、
// 眼球の内外上下の動きを表すblendshapeから概算する。
// 数値が小さいほど「視線が安定して正面を向いている」＝何かに注目している可能性が高い。
function gazeDeviation(scores: Record<string, number>): number {
  const horizontal = Math.max(
    (scores.eyeLookInLeft ?? 0) + (scores.eyeLookOutRight ?? 0),
    (scores.eyeLookOutLeft ?? 0) + (scores.eyeLookInRight ?? 0)
  ) / 2;
  const vertical = Math.max(
    (scores.eyeLookUpLeft ?? 0) + (scores.eyeLookUpRight ?? 0),
    (scores.eyeLookDownLeft ?? 0) + (scores.eyeLookDownRight ?? 0)
  ) / 2;
  return Math.max(horizontal, vertical);
}

export default function FaceEmotionExperiment() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const landmarkerRef = useRef<import('@mediapipe/tasks-vision').FaceLandmarker | null>(null);
  const rafRef = useRef<number | null>(null);

  const [status, setStatus] = useState<'idle' | 'loading' | 'running' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [guess, setGuess] = useState<Guess>(NEUTRAL);
  const [topScores, setTopScores] = useState<{ name: string; score: number }[]>([]);
  const [dwellSec, setDwellSec] = useState(0);
  const [interestLog, setInterestLog] = useState<InterestMoment[]>([]);

  const dwellStartRef = useRef<number | null>(null);
  const lastLoggedAtRef = useRef(0);

  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      landmarkerRef.current?.close();
    };
  }, []);

  async function start() {
    setStatus('loading');
    setErrorMsg('');
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

      setStatus('running');
      loop();
    } catch (err) {
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
        const currentGuess = classify(scores);
        setGuess(currentGuess);
        setTopScores(
          [...categories]
            .sort((a, b) => b.score - a.score)
            .slice(0, 5)
            .map((c) => ({ name: c.categoryName, score: c.score }))
        );

        // 視線が安定して正面（＝目の前の対象）を向き続けているかを追跡する。
        // 「一定時間、注視が続いた」＋「表情がニュートラルでない」の両方が揃った瞬間を
        // 「気になった瞬間」として自動でログに残す＝将来の自動記録機能の縮小版デモ。
        const isCentered = gazeDeviation(scores) < GAZE_DEVIATION_THRESHOLD;
        if (isCentered) {
          if (dwellStartRef.current === null) dwellStartRef.current = now;
          const elapsedSec = (now - dwellStartRef.current) / 1000;
          setDwellSec(elapsedSec);

          if (
            elapsedSec >= DWELL_SECONDS_FOR_INTEREST &&
            currentGuess.label !== NEUTRAL.label &&
            now - lastLoggedAtRef.current > LOG_COOLDOWN_MS
          ) {
            lastLoggedAtRef.current = now;
            setInterestLog((prev) => [
              {
                time: new Date().toLocaleTimeString('ja-JP'),
                emoji: currentGuess.emoji,
                label: currentGuess.label,
                dwellSec: Math.round(elapsedSec * 10) / 10,
              },
              ...prev,
            ].slice(0, 20));
          }
        } else {
          dwellStartRef.current = null;
          setDwellSec(0);
        }
      }
    }
    rafRef.current = requestAnimationFrame(loop);
  }

  function stop() {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    landmarkerRef.current?.close();
    landmarkerRef.current = null;
    streamRef.current = null;
    setStatus('idle');
    setGuess(NEUTRAL);
    setTopScores([]);
    setDwellSec(0);
    dwellStartRef.current = null;
  }

  return (
    <main style={{ maxWidth: 480, margin: '0 auto', padding: '20px 16px 60px', fontFamily: 'inherit' }}>
      <div style={{
        background: '#FFF3CD', color: '#856404', borderRadius: 10,
        padding: '10px 14px', fontSize: 13, marginBottom: 20, lineHeight: 1.6,
      }}>
        🧪 これは実験ページです。ヒトマップ本体の投稿・記録機能には一切接続していません。
        カメラ映像は解析後すぐに破棄され、外部やヒトマップのサーバーには送信されません（すべて端末内で処理）。
      </div>

      <h1 style={{ fontSize: 18, margin: '0 0 6px' }}>視線×表情で「気になった瞬間」を自動検出（検証）</h1>
      <p style={{ fontSize: 13, color: '#888', margin: '0 0 8px', lineHeight: 1.7 }}>
        インカメラで①表情から感情を推定し、②視線が正面に安定して向いているか（＝何かに注目しているか）を追跡します。
        <br />
        「視線が{DWELL_SECONDS_FOR_INTEREST}秒以上安定」＋「表情が動く」が同時に起きた瞬間を、手入力なしで自動記録します。
      </p>
      <p style={{ fontSize: 12, color: '#bbb', margin: '0 0 20px', lineHeight: 1.6 }}>
        ⚠️ 精度は参考程度です。スマホ前面カメラでは「画面上のどこを見ているか」しか分からず、実際に目の前の物体を認識しているわけではありません。
      </p>

      <div style={{ borderRadius: 14, overflow: 'hidden', background: '#000', marginBottom: 16, aspectRatio: '4 / 3' }}>
        <video ref={videoRef} muted playsInline style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }} />
      </div>

      {status === 'idle' && (
        <button type="button" onClick={start} style={{
          width: '100%', padding: 14, borderRadius: 12, border: 'none',
          background: '#FF6B9D', color: '#fff', fontWeight: 700, fontSize: 15, cursor: 'pointer',
        }}>
          📷 カメラを許可して開始
        </button>
      )}

      {status === 'loading' && (
        <p style={{ textAlign: 'center', color: '#999', fontSize: 13 }}>モデルを読み込み中…（数秒かかります）</p>
      )}

      {status === 'error' && (
        <>
          <p style={{ color: '#E55039', fontSize: 13, marginBottom: 10 }}>{errorMsg}</p>
          <button type="button" onClick={start} style={{
            width: '100%', padding: 12, borderRadius: 10, border: '1.5px solid #ddd',
            background: '#fff', color: '#555', fontWeight: 700, cursor: 'pointer',
          }}>もう一度試す</button>
        </>
      )}

      {status === 'running' && (
        <>
          <div style={{
            textAlign: 'center', padding: '20px 0', background: '#fafafa', borderRadius: 14, marginBottom: 12,
          }}>
            <div style={{ fontSize: 48 }}>{guess.emoji}</div>
            <div style={{ fontSize: 16, fontWeight: 700, marginTop: 4 }}>{guess.label}</div>
            <div style={{ fontSize: 11, color: '#aaa', marginTop: 2 }}>{guess.note}</div>
          </div>

          <div style={{
            display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16,
            padding: '10px 14px', borderRadius: 10,
            borderLeft: `4px solid ${dwellSec >= DWELL_SECONDS_FOR_INTEREST ? '#38ADA9' : '#ddd'}`,
            background: dwellSec >= DWELL_SECONDS_FOR_INTEREST ? '#E8F8F7' : '#fafafa',
            transition: 'background 0.2s, border-color 0.2s',
          }}>
            <span style={{ fontSize: 20 }}>👁️</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: dwellSec >= DWELL_SECONDS_FOR_INTEREST ? '#38ADA9' : '#999' }}>
                注視の安定度：{dwellSec.toFixed(1)}秒
              </div>
              <div style={{ height: 4, background: '#eee', borderRadius: 4, overflow: 'hidden', marginTop: 4 }}>
                <div style={{
                  width: `${Math.min(100, (dwellSec / DWELL_SECONDS_FOR_INTEREST) * 100)}%`,
                  height: '100%', background: '#38ADA9', transition: 'width 0.1s linear',
                }} />
              </div>
            </div>
          </div>

          {interestLog.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <p style={{ fontSize: 11, color: '#aaa', margin: '0 0 6px', fontWeight: 700 }}>
                🔎 自動検出された「気になった瞬間」ログ
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {interestLog.map((m, i) => (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '8px 10px', borderRadius: 8, background: '#fafafa', fontSize: 12,
                    borderLeft: '3px solid #FF6B9D',
                  }}>
                    <span style={{ fontSize: 16 }}>{m.emoji}</span>
                    <span style={{ fontWeight: 700, color: '#555' }}>{m.label}</span>
                    <span style={{ color: '#bbb', marginLeft: 'auto' }}>{m.time} ・ 注視{m.dwellSec}秒</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div style={{ marginBottom: 16 }}>
            <p style={{ fontSize: 11, color: '#aaa', margin: '0 0 6px', fontWeight: 700 }}>内訳（上位5項目）</p>
            {topScores.map((s) => (
              <div key={s.name} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <span
                  title={s.name}
                  style={{
                    fontSize: 11, color: '#666', width: 148, flexShrink: 0,
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  }}
                >{blendshapeLabel(s.name)}</span>
                <div style={{ flex: 1, height: 6, background: '#eee', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{ width: `${Math.round(s.score * 100)}%`, height: '100%', background: '#38ADA9' }} />
                </div>
                <span style={{ fontSize: 11, color: '#999', width: 32, textAlign: 'right' }}>{Math.round(s.score * 100)}%</span>
              </div>
            ))}
          </div>

          <button type="button" onClick={stop} style={{
            width: '100%', padding: 12, borderRadius: 10, border: '1.5px solid #ddd',
            background: '#fff', color: '#555', fontWeight: 700, cursor: 'pointer',
          }}>停止する</button>
        </>
      )}
    </main>
  );
}
