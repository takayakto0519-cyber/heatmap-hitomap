'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import EmotionPicker from '@/components/form/EmotionPicker';
import IntensityPicker from '@/components/form/IntensityPicker';
import type { CreateTraceResponse } from '@/lib/types';

const LocationPickerMap = dynamic(
  () => import('@/components/form/LocationPickerMap'),
  { ssr: false, loading: () => <div style={mapPlaceholder}>地図を読み込み中…</div> }
);

// Supabaseが設定されているかどうか（クライアント側で判定）
const SUPABASE_READY = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL);

const mapPlaceholder: React.CSSProperties = {
  height: 220, borderRadius: 12, background: '#f0f0f0',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  color: '#aaa', fontSize: 14,
};

const inputStyle: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box',
  padding: '12px 14px', fontSize: 15,
  border: '1.5px solid #ddd', borderRadius: 10,
  fontFamily: 'inherit', resize: 'vertical' as const,
  outline: 'none', background: '#fff',
};

const labelStyle: React.CSSProperties = {
  display: 'block', fontWeight: 700, fontSize: 15, marginBottom: 8,
};

const sectionStyle: React.CSSProperties = { marginBottom: 28 };
const hintStyle: React.CSSProperties = { fontSize: 12, color: '#aaa', marginTop: 4, marginBottom: 0 };

// ──────────────────────────────────────────────
export default function PostPage() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsError, setGpsError] = useState('');
  const [emotionKey, setEmotionKey] = useState<string | null>(null);
  const [intensity, setIntensity] = useState(3);
  const [title, setTitle] = useState('');
  const [why, setWhy] = useState('');
  const [interpretation, setInterpretation] = useState('');
  const [selfReflection, setSelfReflection] = useState('');
  const [wantRevisit, setWantRevisit] = useState(false);
  const [wantToShare, setWantToShare] = useState(false);
  const [nickname, setNickname] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [uploadProgress, setUploadProgress] = useState('');

  function handlePhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setPhotoPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  }

  function detectGPS() {
    if (!navigator.geolocation) { setGpsError('このブラウザはGPSに対応していません'); return; }
    setGpsLoading(true);
    setGpsError('');
    navigator.geolocation.getCurrentPosition(
      (pos) => { setLat(pos.coords.latitude); setLng(pos.coords.longitude); setGpsLoading(false); },
      () => {
        setGpsError('位置情報の取得に失敗しました。地図でピンを置いてください');
        setGpsLoading(false);
        if (!lat) { setLat(35.6812); setLng(139.7671); }
      },
      { timeout: 10000 }
    );
  }

  async function resolvePhotoUrl(): Promise<string | null> {
    if (!photoFile) return null;

    // Supabase Storage が使える場合はアップロード
    if (SUPABASE_READY) {
      setUploadProgress('写真をアップロード中…');
      const { uploadTracePhoto } = await import('@/lib/supabase/upload');
      const url = await uploadTracePhoto(photoFile);
      setUploadProgress('');
      return url;
    }

    // ローカル確認モード: Base64 DataURL をそのまま使う（Supabase接続後は上のパスを通る）
    return photoPreview;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) { setSubmitError('タイトルを入力してください'); return; }
    if (!lat || !lng) { setSubmitError('位置情報を取得してください'); return; }

    setSubmitting(true);
    setSubmitError('');

    try {
      const photoUrl = await resolvePhotoUrl();

      const res = await fetch('/api/traces', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          photo_url: photoUrl,
          latitude: lat,
          longitude: lng,
          title: title.trim(),
          why: why.trim() || null,
          interpretation: interpretation.trim() || null,
          self_reflection: selfReflection.trim() || null,
          want_revisit: wantRevisit,
          want_to_share: wantToShare,
          emotion_key: emotionKey,
          intensity,
          nickname: nickname.trim() || null,
        }),
      });

      const data: CreateTraceResponse = await res.json();
      if (data.ok || res.status === 503) {
        router.push('/report');
      } else {
        setSubmitError(data.error ?? '送信に失敗しました');
        setSubmitting(false);
      }
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : '送信に失敗しました');
      setSubmitting(false);
    }
  }

  const canSubmit = Boolean(title.trim() && lat && lng && !submitting);
  const statusText = uploadProgress || (submitting ? '記録中…' : '記録する →');

  return (
    <>
      {/* メインコンテンツ（下部fixedボタン分の余白） */}
      <main style={{ maxWidth: 600, margin: '0 auto', padding: '16px 16px 100px' }}>
        {/* ヘッダー */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
          <button type="button" onClick={() => router.push('/report')}
            style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', padding: 4 }}>
            ←
          </button>
          <h1 style={{ margin: 0, fontSize: 20 }}>痕跡を記録する</h1>
        </div>

        <form id="trace-form" onSubmit={handleSubmit}>
          {/* ① 写真 */}
          <section style={sectionStyle}>
            <label style={labelStyle}>📷 写真</label>
            <input ref={fileRef} type="file" accept="image/*" capture="environment"
              style={{ display: 'none' }} onChange={handlePhoto} />
            {photoPreview ? (
              <div style={{ position: 'relative' }}>
                <img src={photoPreview} alt="preview"
                  style={{ width: '100%', maxHeight: 260, objectFit: 'cover', borderRadius: 12 }} />
                <button type="button" onClick={() => fileRef.current?.click()}
                  style={{
                    position: 'absolute', bottom: 10, right: 10,
                    background: 'rgba(0,0,0,0.55)', color: '#fff',
                    border: 'none', borderRadius: 8, padding: '6px 12px',
                    fontSize: 13, cursor: 'pointer',
                  }}>
                  撮り直す
                </button>
              </div>
            ) : (
              <button type="button" onClick={() => fileRef.current?.click()}
                style={{
                  width: '100%', height: 150, borderRadius: 12,
                  border: '2px dashed #ccc', background: '#fafafa',
                  cursor: 'pointer', fontSize: 34,
                  display: 'flex', flexDirection: 'column',
                  alignItems: 'center', justifyContent: 'center', gap: 8,
                }}>
                <span>📷</span>
                <span style={{ fontSize: 14, color: '#aaa' }}>タップして写真を撮る</span>
              </button>
            )}
          </section>

          {/* ② 位置情報 */}
          <section style={sectionStyle}>
            <label style={labelStyle}>📍 いまいる場所</label>
            {!lat && (
              <button type="button" onClick={detectGPS} disabled={gpsLoading}
                style={{
                  width: '100%', padding: '14px', borderRadius: 10,
                  border: '2px solid #4A90E2', background: '#EEF4FF',
                  color: '#4A90E2', fontSize: 15, fontWeight: 700,
                  cursor: gpsLoading ? 'wait' : 'pointer', marginBottom: 10,
                }}>
                {gpsLoading ? '取得中…' : '📡 現在地を自動取得'}
              </button>
            )}
            {gpsError && <p style={{ color: '#E55039', fontSize: 13, margin: '0 0 10px' }}>{gpsError}</p>}
            {lat && lng && (
              <>
                <p style={{ ...hintStyle, marginBottom: 8, color: '#555' }}>
                  緯度 {lat.toFixed(5)} / 経度 {lng.toFixed(5)}
                  <button type="button" onClick={detectGPS}
                    style={{ background: 'none', border: 'none', color: '#4A90E2', cursor: 'pointer', fontSize: 12, marginLeft: 8 }}>
                    再取得
                  </button>
                </p>
                <LocationPickerMap lat={lat} lng={lng}
                  onChange={(la, ln) => { setLat(la); setLng(ln); }} />
                <p style={hintStyle}>地図をタップしてピンを微調整できます</p>
              </>
            )}
          </section>

          {/* ③ 感情タグ */}
          <section style={sectionStyle}>
            <label style={labelStyle}>✨ なにを感じた？</label>
            <EmotionPicker value={emotionKey} onChange={setEmotionKey} />
          </section>

          {/* ④ 強度 */}
          <section style={sectionStyle}>
            <label style={labelStyle}>💫 どのくらい強く？</label>
            <IntensityPicker value={intensity} onChange={setIntensity} />
          </section>

          {/* ⑤ タイトル（必須） */}
          <section style={sectionStyle}>
            <label style={labelStyle}>
              📝 何を見つけた？ <span style={{ color: '#E55039' }}>*</span>
            </label>
            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)}
              placeholder="例：修理された木の椅子"
              style={inputStyle} required />
          </section>

          {/* ⑥ 3つの問い（任意） */}
          <section style={sectionStyle}>
            <label style={labelStyle}>💬 言葉にしてみる（任意）</label>
            <p style={{ ...hintStyle, marginBottom: 6, color: '#666' }}>なぜ気になった？</p>
            <textarea value={why} onChange={(e) => setWhy(e.target.value)}
              placeholder="直感でOK。うまく書かなくていい。"
              rows={3} style={{ ...inputStyle, marginBottom: 14 }} />
            <p style={{ ...hintStyle, marginBottom: 6, color: '#666' }}>誰のどんな暮らし・想いが見えた？</p>
            <textarea value={interpretation} onChange={(e) => setInterpretation(e.target.value)}
              placeholder="このものを使っていた人を想像してみる"
              rows={3} style={{ ...inputStyle, marginBottom: 14 }} />
            <p style={{ ...hintStyle, marginBottom: 6, color: '#666' }}>自分のどんな記憶・感情とつながった？</p>
            <textarea value={selfReflection} onChange={(e) => setSelfReflection(e.target.value)}
              placeholder="なぜ自分はこれに反応したのか"
              rows={3} style={inputStyle} />
          </section>

          {/* ⑦ 2択トグル */}
          <section style={sectionStyle}>
            <div style={{ display: 'flex', gap: 12 }}>
              {[
                { label: '🔁 また来たい', val: wantRevisit, toggle: () => setWantRevisit(!wantRevisit) },
                { label: '🗣 誰かに話したい', val: wantToShare, toggle: () => setWantToShare(!wantToShare) },
              ].map(({ label, val, toggle }) => (
                <button key={label} type="button" onClick={toggle}
                  style={{
                    flex: 1, padding: '13px 8px', borderRadius: 10, fontSize: 14,
                    border: `2px solid ${val ? '#38ADA9' : '#ddd'}`,
                    background: val ? '#E8F8F7' : '#fff',
                    color: val ? '#38ADA9' : '#999',
                    fontWeight: val ? 700 : 400, cursor: 'pointer',
                    WebkitTapHighlightColor: 'transparent',
                  }}>
                  {label}
                </button>
              ))}
            </div>
          </section>

          {/* ⑧ ニックネーム */}
          <section style={sectionStyle}>
            <label style={labelStyle}>👤 ニックネーム（任意）</label>
            <input type="text" value={nickname} onChange={(e) => setNickname(e.target.value)}
              placeholder="匿名でもOK" style={inputStyle} />
          </section>
        </form>
      </main>

      {/* 画面下部に固定された送信ボタン */}
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        padding: '12px 16px 20px',
        background: 'rgba(250,250,250,0.95)',
        backdropFilter: 'blur(8px)',
        borderTop: '1px solid #eee',
        zIndex: 100,
      }}>
        {submitError && (
          <p style={{ color: '#E55039', fontSize: 13, margin: '0 0 8px', textAlign: 'center' }}>
            {submitError}
          </p>
        )}
        <button
          type="submit"
          form="trace-form"
          disabled={!canSubmit}
          style={{
            width: '100%', maxWidth: 600, display: 'block', margin: '0 auto',
            padding: '15px',
            background: canSubmit ? '#FF6B9D' : '#ddd',
            color: '#fff', border: 'none', borderRadius: 12,
            fontSize: 17, fontWeight: 700,
            cursor: canSubmit ? 'pointer' : 'not-allowed',
            transition: 'background 0.2s',
          }}>
          {statusText}
        </button>
      </div>
    </>
  );
}
