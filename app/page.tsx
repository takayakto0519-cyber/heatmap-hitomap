'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import dynamic from 'next/dynamic';
import type { Trace, ListTracesResponse, CreateTraceResponse } from '@/lib/types';
import { EMOTIONS, getEmotion } from '@/lib/emotions';
import { CATEGORIES, getCategory } from '@/lib/categories';
import EmotionPicker from '@/components/form/EmotionPicker';
import IntensityPicker from '@/components/form/IntensityPicker';
import TraceCard from '@/components/report/TraceCard';
import TraceDetail from '@/components/TraceDetail';
import QRModal from '@/components/QRModal';

const TraceMap = dynamic(() => import('@/components/map/TraceMap'), {
  ssr: false,
  loading: () => <div style={mapLoading}>地図を読み込み中…</div>,
});
const LocationPickerMap = dynamic(() => import('@/components/form/LocationPickerMap'), {
  ssr: false,
  loading: () => <div style={mapLoading}>地図を読み込み中…</div>,
});

const SUPABASE_READY = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL);
type Tab = 'map' | 'post' | 'list';
type MapMode = 'pin' | 'heat';
const NEARBY_RADIUS = 500;

function haversine(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const mapLoading: React.CSSProperties = {
  height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
  background: '#f0f0f0', color: '#aaa', fontSize: 14,
};
const inputStyle: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box', padding: '11px 13px', fontSize: 15,
  border: '1.5px solid #ddd', borderRadius: 10, fontFamily: 'inherit',
  resize: 'vertical' as const, outline: 'none', background: '#fff',
};
const labelStyle: React.CSSProperties = { display: 'block', fontWeight: 700, fontSize: 14, marginBottom: 6 };
const secStyle: React.CSSProperties = { marginBottom: 22 };

export default function App() {
  const [tab, setTab] = useState<Tab>('map');
  const [traces, setTraces] = useState<Trace[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [mapMode, setMapMode] = useState<MapMode>('pin');
  const [filterEmotion, setFilterEmotion] = useState<string | null>(null);
  const [filterCategory, setFilterCategory] = useState<string | null>(null);
  const [sessionCode, setSessionCode] = useState('');
  const [userPos, setUserPos] = useState<[number, number] | null>(null);
  const [nearbyOnly, setNearbyOnly] = useState(false);
  const [quickMode, setQuickMode] = useState(true);
  const [selectedTrace, setSelectedTrace] = useState<Trace | null>(null);
  const [myTraceIds, setMyTraceIds] = useState<string[]>([]);
  const [myEmotions, setMyEmotions] = useState<string[]>([]);
  const [showQR, setShowQR] = useState(false);

  // 投稿フォーム
  const fileRef = useRef<HTMLInputElement>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsError, setGpsError] = useState('');
  const [emotionKey, setEmotionKey] = useState<string | null>(null);
  const [intensity, setIntensity] = useState(3);
  const [categoryKey, setCategoryKey] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [why, setWhy] = useState('');
  const [interpretation, setInterpretation] = useState('');
  const [selfReflection, setSelfReflection] = useState('');
  const [wantRevisit, setWantRevisit] = useState(false);
  const [wantToShare, setWantToShare] = useState(false);
  const [nickname, setNickname] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');
  const [submitError, setSubmitError] = useState('');
  const [submitDone, setSubmitDone] = useState(false);

  // localStorage 初期化
  useEffect(() => {
    try {
      const code = localStorage.getItem('hitomap_session_code') || '';
      setSessionCode(code);
      const ids = JSON.parse(localStorage.getItem('hitomap_my_traces') || '[]');
      setMyTraceIds(Array.isArray(ids) ? ids : []);
      const emo = JSON.parse(localStorage.getItem('hitomap_my_emotions') || '[]');
      setMyEmotions(Array.isArray(emo) ? emo : []);
    } catch { /* ignore */ }
  }, []);

  function saveSessionCode(code: string) {
    setSessionCode(code);
    localStorage.setItem('hitomap_session_code', code);
  }

  // データ取得
  const fetchTraces = useCallback(() => {
    const url = sessionCode ? `/api/traces?session_code=${encodeURIComponent(sessionCode)}` : '/api/traces';
    setLoading(true);
    setFetchError(null);
    fetch(url)
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json() as Promise<ListTracesResponse>; })
      .then(d => setTraces(d.ok ? d.traces : []))
      .catch(e => setFetchError(e instanceof Error ? e.message : '通信エラー'))
      .finally(() => setLoading(false));
  }, [sessionCode]);

  useEffect(() => { fetchTraces(); }, [fetchTraces]);

  // フィルタリング
  const filtered = traces.filter(t => {
    if (filterEmotion && t.emotion_key !== filterEmotion) return false;
    if (filterCategory && t.category !== filterCategory) return false;
    if (nearbyOnly && userPos) {
      return haversine(userPos[0], userPos[1], t.latitude, t.longitude) <= NEARBY_RADIUS;
    }
    return true;
  });

  const emotionCounts = EMOTIONS.map(e => ({
    ...e, count: traces.filter(t => t.emotion_key === e.key).length,
  })).filter(e => e.count > 0);

  const myProfile = EMOTIONS.map(e => ({
    ...e, count: myEmotions.filter(k => k === e.key).length,
  })).filter(e => e.count > 0).sort((a, b) => b.count - a.count);

  // ⑦ 高精度GPS
  function detectGPS() {
    if (!navigator.geolocation) { setGpsError('GPSが使えません'); return; }
    setGpsLoading(true); setGpsError('');
    navigator.geolocation.getCurrentPosition(
      pos => { setLat(pos.coords.latitude); setLng(pos.coords.longitude); setGpsLoading(false); },
      () => { setGpsError('位置取得失敗。地図でピンを置いてください'); setGpsLoading(false); if (!lat) { setLat(35.6812); setLng(139.7671); } },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  }

  function handlePhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return;
    setPhotoFile(file);
    const reader = new FileReader();
    reader.onload = ev => setPhotoPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  }

  // 送信（① session_code を含める）
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) { setSubmitError('タイトルを入力してください'); return; }
    if (!lat || !lng) { setSubmitError('位置情報を取得してください'); return; }
    setSubmitting(true); setSubmitError('');
    try {
      let photoUrl: string | null = null;
      if (photoFile) {
        if (SUPABASE_READY) {
          setUploadProgress('写真を圧縮・アップロード中…');
          const { uploadTracePhoto } = await import('@/lib/supabase/upload');
          photoUrl = await uploadTracePhoto(photoFile);
          setUploadProgress('');
        } else {
          photoUrl = photoPreview;
        }
      }
      const res = await fetch('/api/traces', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          photo_url: photoUrl, latitude: lat, longitude: lng,
          title: title.trim(),
          why: why.trim() || null,
          interpretation: quickMode ? null : (interpretation.trim() || null),
          self_reflection: quickMode ? null : (selfReflection.trim() || null),
          want_revisit: wantRevisit, want_to_share: wantToShare,
          emotion_key: emotionKey, intensity,
          category: categoryKey,
          session_code: sessionCode.trim() || null,  // ① session_code を投稿に含める
          nickname: nickname.trim() || null,
        }),
      });
      const data: CreateTraceResponse = await res.json();
      if (data.ok || res.status === 503) {
        // ③ 自分の投稿IDをlocalStorageに記録
        if (data.trace?.id) {
          const updated = [...myTraceIds, data.trace.id];
          setMyTraceIds(updated);
          localStorage.setItem('hitomap_my_traces', JSON.stringify(updated));
        }
        // マイ感情プロフィール更新
        if (emotionKey) {
          const updated = [...myEmotions, emotionKey];
          setMyEmotions(updated);
          localStorage.setItem('hitomap_my_emotions', JSON.stringify(updated));
        }
        setSubmitDone(true);
        setTimeout(() => {
          setTitle(''); setWhy(''); setInterpretation(''); setSelfReflection('');
          setPhotoPreview(null); setPhotoFile(null); setLat(null); setLng(null);
          setEmotionKey(null); setIntensity(3); setWantRevisit(false); setWantToShare(false);
          setNickname(''); setCategoryKey(null); setSubmitDone(false);
          fetchTraces(); setTab('map');
        }, 1200);
      } else {
        setSubmitError(data.error ?? '送信に失敗しました');
      }
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : '送信に失敗しました');
    } finally {
      setSubmitting(false);
    }
  }

  // ③ 詳細モーダルのコールバック
  function handleTraceUpdate(updated: Trace) {
    setTraces(prev => prev.map(t => t.id === updated.id ? updated : t));
    setSelectedTrace(updated);
  }
  function handleTraceDelete(id: string) {
    setTraces(prev => prev.filter(t => t.id !== id));
    setSelectedTrace(null);
  }

  const canSubmit = Boolean(title.trim() && lat && lng && !submitting && !submitDone);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh', overflow: 'hidden' }}>

      {/* ヘッダー */}
      <header style={{ padding: '10px 14px 8px', background: '#fff', borderBottom: '1px solid #eee', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 7 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <h1 style={{ margin: 0, fontSize: 17, fontWeight: 800 }}>ヒトマップ</h1>
            <button onClick={() => setShowQR(true)} style={{
              background: 'none', border: 'none', cursor: 'pointer',
              fontSize: 18, padding: 0, lineHeight: 1, opacity: 0.6,
            }} title="QRコード">⬛</button>
          </div>

          {tab === 'map' && (
            <div style={{ display: 'flex', gap: 5 }}>
              <button onClick={() => {
                if (!nearbyOnly && !userPos) {
                  navigator.geolocation.getCurrentPosition(p => {
                    setUserPos([p.coords.latitude, p.coords.longitude]);
                    setNearbyOnly(true);
                  }, undefined, { enableHighAccuracy: true });
                } else {
                  setNearbyOnly(n => !n);
                }
              }} style={{
                padding: '5px 10px', borderRadius: 7, fontSize: 12, cursor: 'pointer',
                border: `1.5px solid ${nearbyOnly ? '#38ADA9' : '#ddd'}`,
                background: nearbyOnly ? '#E8F8F7' : '#fff',
                color: nearbyOnly ? '#38ADA9' : '#666',
                fontWeight: nearbyOnly ? 700 : 400,
              }}>📍 近くのみ</button>
              {(['pin', 'heat'] as MapMode[]).map(m => (
                <button key={m} onClick={() => setMapMode(m)} style={{
                  padding: '5px 10px', borderRadius: 7, fontSize: 12, cursor: 'pointer',
                  border: '1.5px solid #ddd',
                  background: mapMode === m ? '#222' : '#fff',
                  color: mapMode === m ? '#fff' : '#666',
                  fontWeight: mapMode === m ? 700 : 400,
                }}>{m === 'pin' ? '📍 ピン' : '🌡 ヒート'}</button>
              ))}
            </div>
          )}

          {tab === 'post' && (
            <div style={{ display: 'flex', borderRadius: 8, border: '1.5px solid #eee', overflow: 'hidden' }}>
              {([['かんたん', true], ['くわしく', false]] as [string, boolean][]).map(([label, isQuick]) => (
                <button key={label} onClick={() => setQuickMode(isQuick)} style={{
                  padding: '5px 11px', fontSize: 12, border: 'none', cursor: 'pointer',
                  background: quickMode === isQuick ? '#FF6B9D' : '#fff',
                  color: quickMode === isQuick ? '#fff' : '#999',
                  fontWeight: quickMode === isQuick ? 700 : 400,
                }}>{label}</button>
              ))}
            </div>
          )}

          {tab === 'list' && <span style={{ fontSize: 13, color: '#aaa' }}>{filtered.length} 件</span>}
        </div>

        {/* 感情フィルター */}
        {(tab === 'map' || tab === 'list') && emotionCounts.length > 0 && (
          <div style={{ display: 'flex', gap: 5, overflowX: 'auto', paddingBottom: 2 }}>
            <button onClick={() => setFilterEmotion(null)} style={{
              padding: '3px 9px', borderRadius: 16, fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap',
              border: `1.5px solid ${!filterEmotion ? '#444' : '#ddd'}`,
              background: !filterEmotion ? '#444' : '#fff',
              color: !filterEmotion ? '#fff' : '#666',
            }}>すべて</button>
            {emotionCounts.map(e => (
              <button key={e.key} onClick={() => setFilterEmotion(filterEmotion === e.key ? null : e.key)} style={{
                padding: '3px 9px', borderRadius: 16, fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap',
                border: `1.5px solid ${filterEmotion === e.key ? e.color : '#ddd'}`,
                background: filterEmotion === e.key ? e.color : '#fff',
                color: filterEmotion === e.key ? '#fff' : '#666',
              }}>{e.emoji} {e.label} {e.count}</button>
            ))}
          </div>
        )}
      </header>

      {/* メインコンテンツ */}
      <main style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>

        {/* ⑧ 通信エラー表示 */}
        {fetchError && (
          <div style={{
            position: 'absolute', top: 10, left: '50%', transform: 'translateX(-50%)',
            background: '#E55039', color: '#fff', padding: '8px 16px',
            borderRadius: 20, fontSize: 13, zIndex: 500,
            display: 'flex', gap: 10, alignItems: 'center', whiteSpace: 'nowrap',
          }}>
            ⚠ {fetchError}
            <button onClick={fetchTraces} style={{
              background: 'rgba(255,255,255,0.3)', border: 'none',
              color: '#fff', borderRadius: 12, padding: '3px 9px', fontSize: 12, cursor: 'pointer',
            }}>再試行</button>
          </div>
        )}

        {/* マップタブ */}
        {tab === 'map' && (
          <div style={{ height: '100%', position: 'relative' }}>
            <TraceMap
              traces={filtered}
              mode={mapMode}
              center={userPos ?? undefined}
              onLocate={pos => setUserPos(pos)}
              onTraceClick={setSelectedTrace}
            />
            {loading && !fetchError && (
              <div style={{
                position: 'absolute', top: 10, left: '50%', transform: 'translateX(-50%)',
                background: 'rgba(0,0,0,0.6)', color: '#fff', padding: '4px 12px',
                borderRadius: 20, fontSize: 12, zIndex: 500,
              }}>読み込み中…</div>
            )}
            {nearbyOnly && userPos && (
              <div style={{
                position: 'absolute', bottom: 16, left: '50%', transform: 'translateX(-50%)',
                background: '#38ADA9', color: '#fff', padding: '6px 14px',
                borderRadius: 20, fontSize: 12, zIndex: 500, whiteSpace: 'nowrap',
              }}>
                現在地から{NEARBY_RADIUS}m以内：{filtered.length}件
              </div>
            )}
            {/* ⑤ ヒートマップ凡例 */}
            {mapMode === 'heat' && filtered.length > 0 && (
              <div style={{
                position: 'absolute', bottom: 30, left: 10, zIndex: 500,
                background: 'rgba(255,255,255,0.93)', borderRadius: 10,
                padding: '8px 12px', boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
                backdropFilter: 'blur(6px)',
              }}>
                {EMOTIONS.filter(e => filtered.some(t => t.emotion_key === e.key)).map(e => (
                  <div key={e.key} style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12, lineHeight: 1.9 }}>
                    <span style={{ width: 10, height: 10, borderRadius: '50%', background: e.color, display: 'inline-block', flexShrink: 0 }} />
                    <span style={{ color: '#444' }}>{e.label}</span>
                  </div>
                ))}
                <div style={{ borderTop: '1px solid #eee', marginTop: 5, paddingTop: 5, fontSize: 10, color: '#bbb' }}>
                  円が大きい＝強度が高い
                </div>
              </div>
            )}
          </div>
        )}

        {/* 投稿タブ */}
        {tab === 'post' && (
          <div style={{ height: '100%', overflowY: 'auto', padding: '16px 16px 130px' }}>
            {submitDone && (
              <div style={{ textAlign: 'center', padding: '40px 20px', fontSize: 20, fontWeight: 700, color: '#38ADA9' }}>
                ✓ 記録しました<br />
                <span style={{ fontSize: 13, fontWeight: 400, color: '#aaa', marginTop: 8, display: 'block' }}>地図に戻ります…</span>
              </div>
            )}
            {!submitDone && (
              <form id="trace-form" onSubmit={handleSubmit}>

                {/* ① 実験回コード（冒頭に常時表示） */}
                <section style={{ ...secStyle, padding: '12px', background: '#F8F9FA', borderRadius: 10 }}>
                  <label style={{ ...labelStyle, fontSize: 12, color: '#888', marginBottom: 4 }}>🔖 実験回コード（任意・グループで同じコードを入力）</label>
                  <input
                    type="text"
                    value={sessionCode}
                    onChange={e => saveSessionCode(e.target.value)}
                    placeholder="例: yanaka-20260701"
                    style={{ ...inputStyle, fontSize: 13, background: '#fff' }}
                  />
                </section>

                {/* 写真 */}
                <section style={secStyle}>
                  <label style={labelStyle}>📷 写真</label>
                  <input ref={fileRef} type="file" accept="image/*" capture="environment"
                    style={{ display: 'none' }} onChange={handlePhoto} />
                  {photoPreview ? (
                    <div style={{ position: 'relative' }}>
                      <img src={photoPreview} alt="preview"
                        style={{ width: '100%', maxHeight: 200, objectFit: 'cover', borderRadius: 10 }} />
                      <button type="button" onClick={() => fileRef.current?.click()} style={{
                        position: 'absolute', bottom: 8, right: 8,
                        background: 'rgba(0,0,0,0.55)', color: '#fff',
                        border: 'none', borderRadius: 7, padding: '5px 10px', fontSize: 12, cursor: 'pointer',
                      }}>撮り直す</button>
                    </div>
                  ) : (
                    <button type="button" onClick={() => fileRef.current?.click()} style={{
                      width: '100%', height: 120, borderRadius: 10,
                      border: '2px dashed #ccc', background: '#fafafa',
                      cursor: 'pointer', display: 'flex', flexDirection: 'column',
                      alignItems: 'center', justifyContent: 'center', gap: 6,
                    }}>
                      <span style={{ fontSize: 28 }}>📷</span>
                      <span style={{ fontSize: 13, color: '#aaa' }}>タップして写真を撮る</span>
                    </button>
                  )}
                </section>

                {/* 位置情報 */}
                <section style={secStyle}>
                  <label style={labelStyle}>📍 いまいる場所 <span style={{ color: '#E55039' }}>*</span></label>
                  {!lat ? (
                    <button type="button" onClick={detectGPS} disabled={gpsLoading} style={{
                      width: '100%', padding: '13px', borderRadius: 10,
                      border: '2px solid #4A90E2', background: '#EEF4FF',
                      color: '#4A90E2', fontSize: 14, fontWeight: 700,
                      cursor: gpsLoading ? 'wait' : 'pointer',
                    }}>{gpsLoading ? '取得中（GPS精度優先）…' : '📡 現在地を自動取得'}</button>
                  ) : (
                    <>
                      <p style={{ fontSize: 12, color: '#888', margin: '0 0 6px' }}>
                        {lat.toFixed(5)}, {lng!.toFixed(5)}
                        <button type="button" onClick={detectGPS} style={{
                          background: 'none', border: 'none', color: '#4A90E2',
                          cursor: 'pointer', fontSize: 12, marginLeft: 8,
                        }}>再取得</button>
                      </p>
                      <div style={{ height: 180, borderRadius: 10, overflow: 'hidden' }}>
                        <LocationPickerMap lat={lat} lng={lng!} onChange={(la, ln) => { setLat(la); setLng(ln); }} />
                      </div>
                      <p style={{ fontSize: 11, color: '#aaa', margin: '4px 0 0' }}>地図をタップしてピンを微調整</p>
                    </>
                  )}
                  {gpsError && <p style={{ color: '#E55039', fontSize: 12, margin: '6px 0 0' }}>{gpsError}</p>}
                </section>

                {/* 感情 */}
                <section style={secStyle}>
                  <label style={labelStyle}>✨ なにを感じた？</label>
                  <EmotionPicker value={emotionKey} onChange={setEmotionKey} />
                </section>

                {/* 強度 */}
                <section style={secStyle}>
                  <label style={labelStyle}>💫 どのくらい強く？</label>
                  <IntensityPicker value={intensity} onChange={setIntensity} />
                </section>

                {/* カテゴリ */}
                <section style={secStyle}>
                  <label style={labelStyle}>🏷 何を見つけた？（種類）</label>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {CATEGORIES.map(c => (
                      <button key={c.key} type="button"
                        onClick={() => setCategoryKey(categoryKey === c.key ? null : c.key)} style={{
                          padding: '6px 11px', borderRadius: 20, fontSize: 13, cursor: 'pointer',
                          border: `1.5px solid ${categoryKey === c.key ? '#555' : '#ddd'}`,
                          background: categoryKey === c.key ? '#555' : '#fff',
                          color: categoryKey === c.key ? '#fff' : '#666',
                        }}>{c.emoji} {c.label}</button>
                    ))}
                  </div>
                </section>

                {/* タイトル */}
                <section style={secStyle}>
                  <label style={labelStyle}>📝 何を見つけた？ <span style={{ color: '#E55039' }}>*</span></label>
                  <input type="text" value={title} onChange={e => setTitle(e.target.value)}
                    placeholder="例：修理された木の椅子" style={inputStyle} required />
                </section>

                {/* かんたんモード */}
                {quickMode && (
                  <section style={secStyle}>
                    <label style={labelStyle}>💬 なぜ気になった？（任意）</label>
                    <textarea value={why} onChange={e => setWhy(e.target.value)}
                      placeholder="直感でOK。うまく書かなくていい。" rows={2} style={inputStyle} />
                  </section>
                )}

                {/* くわしくモード */}
                {!quickMode && (
                  <>
                    <section style={secStyle}>
                      <label style={labelStyle}>💬 言葉にしてみる（任意）</label>
                      {[
                        { label: 'なぜ気になった？', val: why, set: setWhy, ph: '直感でOK。うまく書かなくていい。' },
                        { label: '誰のどんな暮らし・想いが見えた？', val: interpretation, set: setInterpretation, ph: 'このものを使っていた人を想像してみる' },
                        { label: '自分のどんな記憶・感情とつながった？', val: selfReflection, set: setSelfReflection, ph: 'なぜ自分はこれに反応したのか' },
                      ].map(({ label, val, set, ph }) => (
                        <div key={label} style={{ marginBottom: 12 }}>
                          <p style={{ fontSize: 12, color: '#666', margin: '0 0 5px' }}>{label}</p>
                          <textarea value={val} onChange={e => set(e.target.value)} placeholder={ph} rows={3} style={inputStyle} />
                        </div>
                      ))}
                    </section>
                    <section style={secStyle}>
                      <div style={{ display: 'flex', gap: 10 }}>
                        {([
                          { label: '🔁 また来たい', val: wantRevisit, toggle: () => setWantRevisit(!wantRevisit) },
                          { label: '🗣 誰かに話したい', val: wantToShare, toggle: () => setWantToShare(!wantToShare) },
                        ] as { label: string; val: boolean; toggle: () => void }[]).map(({ label, val, toggle }) => (
                          <button key={label} type="button" onClick={toggle} style={{
                            flex: 1, padding: '11px 6px', borderRadius: 10, fontSize: 13,
                            border: `2px solid ${val ? '#38ADA9' : '#ddd'}`,
                            background: val ? '#E8F8F7' : '#fff',
                            color: val ? '#38ADA9' : '#aaa',
                            fontWeight: val ? 700 : 400, cursor: 'pointer',
                          }}>{label}</button>
                        ))}
                      </div>
                    </section>
                  </>
                )}

                {/* ニックネーム */}
                <section style={secStyle}>
                  <label style={labelStyle}>👤 ニックネーム（任意）</label>
                  <input type="text" value={nickname} onChange={e => setNickname(e.target.value)}
                    placeholder="匿名でもOK" style={inputStyle} />
                </section>
              </form>
            )}
          </div>
        )}

        {/* 一覧タブ */}
        {tab === 'list' && (
          <div style={{ height: '100%', overflowY: 'auto', padding: '12px 12px 80px' }}>

            {/* マイ感情プロフィール */}
            {myProfile.length > 0 && (
              <div style={{
                background: '#FFF8FC', border: '1.5px solid #FFD6E7',
                borderRadius: 12, padding: '12px 14px', marginBottom: 14,
              }}>
                <p style={{ margin: '0 0 8px', fontSize: 12, fontWeight: 700, color: '#FF6B9D' }}>✨ あなたの感情プロフィール</p>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {myProfile.map((e, i) => (
                    <span key={e.key} style={{
                      padding: '4px 10px', borderRadius: 20, fontSize: 12,
                      background: i === 0 ? e.color : e.color + '33',
                      color: i === 0 ? '#fff' : e.color,
                      fontWeight: i === 0 ? 700 : 400,
                    }}>{e.emoji} {e.label} {e.count}回</span>
                  ))}
                </div>
                <p style={{ margin: '7px 0 0', fontSize: 11, color: '#aaa' }}>
                  「{myProfile[0].label}」に最もよく動かされています
                </p>
              </div>
            )}

            {/* カテゴリフィルター */}
            {traces.some(t => t.category) && (
              <div style={{ display: 'flex', gap: 5, overflowX: 'auto', marginBottom: 10, paddingBottom: 2 }}>
                <button onClick={() => setFilterCategory(null)} style={{
                  padding: '3px 9px', borderRadius: 16, fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap',
                  border: `1.5px solid ${!filterCategory ? '#444' : '#ddd'}`,
                  background: !filterCategory ? '#444' : '#fff',
                  color: !filterCategory ? '#fff' : '#666',
                }}>すべて</button>
                {CATEGORIES.filter(c => traces.some(t => t.category === c.key)).map(c => (
                  <button key={c.key} onClick={() => setFilterCategory(filterCategory === c.key ? null : c.key)} style={{
                    padding: '3px 9px', borderRadius: 16, fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap',
                    border: `1.5px solid ${filterCategory === c.key ? '#555' : '#ddd'}`,
                    background: filterCategory === c.key ? '#555' : '#fff',
                    color: filterCategory === c.key ? '#fff' : '#666',
                  }}>{c.emoji} {c.label}</button>
                ))}
              </div>
            )}

            {/* ① 実験回コード絞り込み */}
            <div style={{ marginBottom: 12 }}>
              <input
                placeholder="実験回コードで絞り込み（例: yanaka-20260701）"
                value={sessionCode}
                onChange={e => saveSessionCode(e.target.value)}
                style={{ ...inputStyle, fontSize: 13 }}
              />
            </div>

            {loading ? (
              <p style={{ color: '#aaa', textAlign: 'center', marginTop: 40 }}>読み込み中…</p>
            ) : filtered.length === 0 ? (
              <p style={{ color: '#aaa', textAlign: 'center', marginTop: 40 }}>
                {sessionCode ? `「${sessionCode}」の記録はまだありません。` : 'まだ記録がありません。'}<br />
                まちを歩いて最初の痕跡を記録しましょう。
              </p>
            ) : (
              /* ④ カードタップで詳細モーダル */
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 12 }}>
                {filtered.map(t => (
                  <TraceCard
                    key={t.id}
                    trace={t}
                    onClick={() => setSelectedTrace(t)}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* 投稿ボタン */}
      {tab === 'post' && !submitDone && (
        <div style={{
          position: 'fixed', bottom: 60, left: 0, right: 0, padding: '8px 14px',
          background: 'rgba(250,250,250,0.95)', backdropFilter: 'blur(8px)',
          borderTop: '1px solid #eee', zIndex: 200,
        }}>
          {submitError && (
            <p style={{ color: '#E55039', fontSize: 12, margin: '0 0 6px', textAlign: 'center' }}>{submitError}</p>
          )}
          <button type="submit" form="trace-form" disabled={!canSubmit} style={{
            width: '100%', padding: '14px',
            background: canSubmit ? '#FF6B9D' : '#ddd',
            color: '#fff', border: 'none', borderRadius: 11,
            fontSize: 16, fontWeight: 700,
            cursor: canSubmit ? 'pointer' : 'not-allowed',
          }}>
            {uploadProgress || (submitting ? '記録中…' : '記録する →')}
          </button>
        </div>
      )}

      {/* ボトムナビ */}
      <nav style={{
        display: 'flex', borderTop: '1px solid #eee',
        background: '#fff', flexShrink: 0, zIndex: 300,
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}>
        {([
          { id: 'map',  icon: '🗺',  label: 'マップ' },
          { id: 'post', icon: '✏️', label: '記録する' },
          { id: 'list', icon: '📋', label: '一覧' },
        ] as { id: Tab; icon: string; label: string }[]).map(({ id, icon, label }) => (
          <button key={id} onClick={() => setTab(id)} style={{
            flex: 1, padding: '10px 4px 8px',
            background: 'none', border: 'none', cursor: 'pointer',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
            color: tab === id ? '#FF6B9D' : '#999',
            fontWeight: tab === id ? 700 : 400,
            borderTop: `2px solid ${tab === id ? '#FF6B9D' : 'transparent'}`,
          }}>
            <span style={{ fontSize: 20 }}>{icon}</span>
            <span style={{ fontSize: 11 }}>{label}</span>
          </button>
        ))}
      </nav>

      {/* ④ 詳細モーダル */}
      {showQR && <QRModal onClose={() => setShowQR(false)} />}

      {selectedTrace && (
        <TraceDetail
          trace={selectedTrace}
          isOwn={myTraceIds.includes(selectedTrace.id)}
          onClose={() => setSelectedTrace(null)}
          onUpdate={handleTraceUpdate}
          onDelete={handleTraceDelete}
        />
      )}
    </div>
  );
}
