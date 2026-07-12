'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import EmotionPicker from '@/components/form/EmotionPicker';
import IntensityPicker from '@/components/form/IntensityPicker';
import FaceEmotionSuggest from '@/components/form/FaceEmotionSuggest';
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
// 「あとで保存」機能：現地では位置だけ記録し、写真・言葉は帰宅後に追記できるようにする
interface LocationDraft {
  id: string;
  lat: number;
  lng: number;
  createdAt: string;
}

const LOCATION_DRAFTS_KEY = 'hitomap_location_drafts';
const FORM_AUTOSAVE_KEY = 'hitomap_post_autosave';

function loadLocationDrafts(): LocationDraft[] {
  try {
    const raw = localStorage.getItem(LOCATION_DRAFTS_KEY);
    return raw ? JSON.parse(raw) as LocationDraft[] : [];
  } catch {
    return [];
  }
}

function saveLocationDrafts(drafts: LocationDraft[]) {
  try {
    localStorage.setItem(LOCATION_DRAFTS_KEY, JSON.stringify(drafts));
  } catch {
    // 保存できない環境では諦める（機能を諦めるだけで投稿自体は継続できる）
  }
}

// ──────────────────────────────────────────────
export default function PostPage() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  // 写真は最大4枚まで（バックエンドのphoto_urlsの上限に合わせる）
  const [photos, setPhotos] = useState<{ file: File; preview: string }[]>([]);
  const MAX_PHOTOS = 4;
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsError, setGpsError] = useState('');
  // GPS取得に失敗した場合、地図を「仮の中心」で表示して手動でピンを動かしてもらう。
  // その仮の位置のまま送信されてしまわないよう、ピンを動かすまでは送信を禁止する。
  const [locationConfirmed, setLocationConfirmed] = useState(false);
  const [emotionKeys, setEmotionKeys] = useState<string[]>([]);
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

  const [locationDrafts, setLocationDrafts] = useState<LocationDraft[]>([]);
  const [activeDraftId, setActiveDraftId] = useState<string | null>(null);
  const [restoredNotice, setRestoredNotice] = useState(false);
  const [quickSaveMsg, setQuickSaveMsg] = useState('');

  // 「その後」の記録：TraceDetailの「その後を記録する」から遷移してきた場合、
  // 元の痕跡のidと位置をクエリパラメータで受け取る
  const [revisitOf, setRevisitOf] = useState<string | null>(null);
  const [revisitOfTitle, setRevisitOfTitle] = useState<string | null>(null);

  // 初回マウント時：URLクエリ（その後の記録）・未完了の位置記録一覧・書きかけの下書きを復元
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const revisitId = params.get('revisit_of');
    if (revisitId) {
      setRevisitOf(revisitId);
      setRevisitOfTitle(params.get('revisit_of_title'));
      const qLat = Number(params.get('lat'));
      const qLng = Number(params.get('lng'));
      if (Number.isFinite(qLat) && Number.isFinite(qLng)) {
        setLat(qLat);
        setLng(qLng);
        setLocationConfirmed(true);
      }
    }
    setLocationDrafts(loadLocationDrafts());
    try {
      const raw = localStorage.getItem(FORM_AUTOSAVE_KEY);
      if (raw) {
        const d = JSON.parse(raw) as Record<string, unknown>;
        if (d.lat && d.lng) { setLat(d.lat as number); setLng(d.lng as number); setLocationConfirmed(true); }
        if (Array.isArray(d.emotionKeys)) setEmotionKeys(d.emotionKeys as string[]);
        else if (d.emotionKey) setEmotionKeys([d.emotionKey as string]);
        if (typeof d.intensity === 'number') setIntensity(d.intensity);
        if (d.title) setTitle(d.title as string);
        if (d.why) setWhy(d.why as string);
        if (d.interpretation) setInterpretation(d.interpretation as string);
        if (d.selfReflection) setSelfReflection(d.selfReflection as string);
        if (d.wantRevisit) setWantRevisit(Boolean(d.wantRevisit));
        if (d.wantToShare) setWantToShare(Boolean(d.wantToShare));
        if (d.nickname) setNickname(d.nickname as string);
        if (d.activeDraftId) setActiveDraftId(d.activeDraftId as string);
        setRestoredNotice(true);
      }
    } catch {
      // 復元できなくても投稿自体は継続できる
    }
  }, []);

  // 入力のたびに自動保存（アプリを閉じても書きかけの内容が消えないように）
  useEffect(() => {
    const hasContent = Boolean(title || why || interpretation || selfReflection || lat);
    if (!hasContent) return;
    try {
      localStorage.setItem(FORM_AUTOSAVE_KEY, JSON.stringify({
        lat, lng, emotionKeys, intensity, title, why, interpretation,
        selfReflection, wantRevisit, wantToShare, nickname, activeDraftId,
      }));
    } catch {
      // 保存できなくても投稿自体は継続できる
    }
  }, [lat, lng, emotionKeys, intensity, title, why, interpretation, selfReflection, wantRevisit, wantToShare, nickname, activeDraftId]);

  function clearAutosave() {
    try { localStorage.removeItem(FORM_AUTOSAVE_KEY); } catch { /* 無視 */ }
  }

  // 「位置だけ先に記録」：現地ではGPSだけ押して、写真・言葉は帰宅後に書く
  function quickSaveLocation() {
    if (!navigator.geolocation) { setGpsError('このブラウザはGPSに対応していません'); return; }
    setGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const draft: LocationDraft = {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          createdAt: new Date().toISOString(),
        };
        const next = [draft, ...locationDrafts];
        setLocationDrafts(next);
        saveLocationDrafts(next);
        setGpsLoading(false);
        setQuickSaveMsg('記録しました。あとで「続きを書く」から仕上げられます');
        setTimeout(() => setQuickSaveMsg(''), 3500);
      },
      () => { setGpsError('位置情報の取得に失敗しました'); setGpsLoading(false); },
      { timeout: 10000 }
    );
  }

  function resumeDraft(draft: LocationDraft) {
    setLat(draft.lat);
    setLng(draft.lng);
    setLocationConfirmed(true);
    setActiveDraftId(draft.id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function removeLocationDraft(id: string) {
    const next = locationDrafts.filter((d) => d.id !== id);
    setLocationDrafts(next);
    saveLocationDrafts(next);
  }

  function handlePhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []).slice(0, MAX_PHOTOS - photos.length);
    if (files.length === 0) return;
    files.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        setPhotos((prev) => prev.length >= MAX_PHOTOS ? prev : [...prev, { file, preview: ev.target?.result as string }]);
      };
      reader.readAsDataURL(file);
    });
    e.target.value = '';
  }

  function removePhoto(index: number) {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  }

  function detectGPS() {
    if (!navigator.geolocation) { setGpsError('このブラウザはGPSに対応していません'); return; }
    setGpsLoading(true);
    setGpsError('');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(pos.coords.latitude);
        setLng(pos.coords.longitude);
        setLocationConfirmed(true);
        setGpsLoading(false);
      },
      () => {
        setGpsError('位置情報の取得に失敗しました。地図をタップして正確な位置に合わせてください');
        setGpsLoading(false);
        setLocationConfirmed(false);
        // 地図を表示するための仮の中心地点（実際の投稿位置ではない。ピンを動かすまで送信不可にする）
        if (!lat) { setLat(35.6812); setLng(139.7671); }
      },
      { timeout: 10000 }
    );
  }

  function moveLocationPin(la: number, ln: number) {
    setLat(la);
    setLng(ln);
    setLocationConfirmed(true);
  }

  async function resolvePhotoUrls(): Promise<string[]> {
    if (photos.length === 0) return [];

    // Supabase Storage が使える場合は順番にアップロード
    if (SUPABASE_READY) {
      const { uploadTracePhoto } = await import('@/lib/supabase/upload');
      const urls: string[] = [];
      for (let i = 0; i < photos.length; i++) {
        setUploadProgress(`写真をアップロード中…（${i + 1}/${photos.length}）`);
        urls.push(await uploadTracePhoto(photos[i].file));
      }
      setUploadProgress('');
      return urls;
    }

    // ローカル確認モード: Base64 DataURL をそのまま使う（Supabase接続後は上のパスを通る）
    return photos.map((p) => p.preview);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) { setSubmitError('タイトルを入力してください'); return; }
    if (!lat || !lng) { setSubmitError('位置情報を取得してください'); return; }
    if (!locationConfirmed) { setSubmitError('地図をタップして、実際の場所にピンを合わせてください'); return; }

    setSubmitting(true);
    setSubmitError('');

    try {
      const photoUrls = await resolvePhotoUrls();

      const res = await fetch('/api/traces', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          photo_url: photoUrls[0] ?? null,
          photo_urls: photoUrls.length > 0 ? photoUrls : null,
          latitude: lat,
          longitude: lng,
          title: title.trim(),
          why: why.trim() || null,
          interpretation: interpretation.trim() || null,
          self_reflection: selfReflection.trim() || null,
          want_revisit: wantRevisit,
          want_to_share: wantToShare,
          emotion_key: emotionKeys[0] ?? null,
          emotion_keys: emotionKeys.length > 0 ? emotionKeys : null,
          intensity,
          nickname: nickname.trim() || null,
          revisit_of: revisitOf,
        }),
      });

      const data: CreateTraceResponse = await res.json();
      if (data.ok || res.status === 503) {
        clearAutosave();
        if (activeDraftId) removeLocationDraft(activeDraftId);
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

  const canSubmit = Boolean(title.trim() && lat && lng && locationConfirmed && !submitting);
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
          <h1 style={{ margin: 0, fontSize: 20 }}>{revisitOf ? 'その後を記録する' : '痕跡を記録する'}</h1>
        </div>

        {revisitOf && (
          <p style={{
            fontSize: 12, color: '#8E44AD', background: '#F4ECFB',
            borderRadius: 8, padding: '8px 12px', margin: '0 0 16px', lineHeight: 1.6,
          }}>
            🔁 「{revisitOfTitle ?? '元の痕跡'}」のその後の変化として記録します
          </p>
        )}

        {restoredNotice && (
          <p style={{
            fontSize: 12, color: '#38ADA9', background: '#E8F8F7',
            borderRadius: 8, padding: '8px 12px', margin: '0 0 16px',
          }}>
            📝 書きかけの内容を復元しました
          </p>
        )}

        {quickSaveMsg && (
          <p style={{
            fontSize: 12, color: '#4A90E2', background: '#EEF4FF',
            borderRadius: 8, padding: '8px 12px', margin: '0 0 16px',
          }}>
            ✓ {quickSaveMsg}
          </p>
        )}

        {!activeDraftId && !lat && (
          <button type="button" onClick={quickSaveLocation} disabled={gpsLoading}
            style={{
              width: '100%', padding: '13px', borderRadius: 10, marginBottom: 20,
              border: '2px dashed #bbb', background: '#fafafa',
              color: '#777', fontSize: 13, fontWeight: 700,
              cursor: gpsLoading ? 'wait' : 'pointer',
            }}>
            {gpsLoading ? '記録中…' : '📍 今は位置だけ記録して、あとで書く'}
          </button>
        )}

        {locationDrafts.length > 0 && (
          <section style={{ ...sectionStyle, marginBottom: 20 }}>
            <label style={labelStyle}>🕓 未完了の記録（{locationDrafts.length}）</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {locationDrafts.map((d) => (
                <div key={d.id} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '10px 12px', border: '1.5px solid #eee', borderRadius: 10, background: '#fff',
                }}>
                  <div>
                    <div style={{ fontSize: 12, color: '#999' }}>
                      {new Date(d.createdAt).toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </div>
                    <div style={{ fontSize: 11, color: '#bbb' }}>
                      {d.lat.toFixed(4)} / {d.lng.toFixed(4)}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button type="button" onClick={() => resumeDraft(d)}
                      style={{
                        padding: '7px 14px', borderRadius: 8, border: 'none',
                        background: '#FF6B9D', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer',
                      }}>
                      続きを書く →
                    </button>
                    <button type="button" onClick={() => removeLocationDraft(d.id)}
                      style={{
                        padding: '7px 10px', borderRadius: 8, border: 'none',
                        background: 'none', color: '#ccc', fontSize: 12, cursor: 'pointer',
                      }}>
                      削除
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        <form id="trace-form" onSubmit={handleSubmit}>
          {/* ① 写真（最大4枚） */}
          <section style={sectionStyle}>
            <label style={labelStyle}>📷 写真（最大{MAX_PHOTOS}枚）</label>
            <input ref={fileRef} type="file" accept="image/*" multiple
              style={{ display: 'none' }} onChange={handlePhoto} />
            {photos.length > 0 && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, marginBottom: photos.length < MAX_PHOTOS ? 8 : 0 }}>
                {photos.map((p, i) => (
                  <div key={i} style={{ position: 'relative' }}>
                    <img src={p.preview} alt={`写真 ${i + 1}`}
                      style={{ width: '100%', height: 130, objectFit: 'cover', borderRadius: 10, display: 'block' }} />
                    <button type="button" onClick={() => removePhoto(i)}
                      style={{
                        position: 'absolute', top: 6, right: 6,
                        width: 24, height: 24, borderRadius: 12,
                        background: 'rgba(0,0,0,0.55)', color: '#fff',
                        border: 'none', fontSize: 14, cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0,
                      }}>×</button>
                  </div>
                ))}
              </div>
            )}
            {photos.length < MAX_PHOTOS && (
              <button type="button" onClick={() => fileRef.current?.click()}
                style={{
                  width: '100%', height: photos.length > 0 ? 60 : 150, borderRadius: 12,
                  border: '2px dashed #ccc', background: '#fafafa',
                  cursor: 'pointer', fontSize: photos.length > 0 ? 20 : 34,
                  display: 'flex', flexDirection: 'column',
                  alignItems: 'center', justifyContent: 'center', gap: 8,
                }}>
                <span>📷</span>
                {photos.length === 0 && <span style={{ fontSize: 14, color: '#aaa' }}>タップして写真を撮る・選ぶ</span>}
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
                {!locationConfirmed && (
                  <p style={{ color: '#E55039', fontSize: 13, margin: '0 0 8px', fontWeight: 700 }}>
                    ⚠️ まだ正確な位置ではありません。地図をタップして実際の場所にピンを合わせてください
                  </p>
                )}
                <p style={{ ...hintStyle, marginBottom: 8, color: '#555' }}>
                  緯度 {lat.toFixed(5)} / 経度 {lng.toFixed(5)}
                  <button type="button" onClick={detectGPS}
                    style={{ background: 'none', border: 'none', color: '#4A90E2', cursor: 'pointer', fontSize: 12, marginLeft: 8 }}>
                    再取得
                  </button>
                </p>
                <LocationPickerMap lat={lat} lng={lng} onChange={moveLocationPin} />
                <p style={hintStyle}>地図をタップしてピンを微調整できます</p>
              </>
            )}
          </section>

          {/* ③ 感情タグ */}
          <section style={sectionStyle}>
            <label style={labelStyle}>✨ なにを感じた？（複数選べます）</label>
            <EmotionPicker value={emotionKeys} onChange={setEmotionKeys} />
            <FaceEmotionSuggest
              selectedKeys={emotionKeys}
              onAdd={(key) => setEmotionKeys((prev) => prev.includes(key) ? prev : [...prev, key])}
            />
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
