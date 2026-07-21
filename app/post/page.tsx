'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import EmotionPicker from '@/components/form/EmotionPicker';
import FaceEmotionSuggest from '@/components/form/FaceEmotionSuggest';
import { TRACE_TYPES } from '@/lib/traceTypes';
import type { CreateTraceResponse } from '@/lib/types';
import type { Quest } from '@/lib/quests';
import { getEmotion } from '@/lib/emotions';
import { computeBadges, type Badge } from '@/lib/badges';
import { computeCharacter, type CharacterState } from '@/lib/character';
import CharacterScene from '@/components/profile/CharacterScene';

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
  const [traceType, setTraceType] = useState<string | null>(null);
  const [companionTag, setCompanionTag] = useState('');
  const [title, setTitle] = useState('');
  const [why, setWhy] = useState('');
  const [interpretation, setInterpretation] = useState('');
  const [selfReflection, setSelfReflection] = useState('');
  const [wantRevisit, setWantRevisit] = useState(false);
  const [wantToShare, setWantToShare] = useState(false);
  const [nickname, setNickname] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [uploadProgress, setUploadProgress] = useState('');

  const [locationDrafts, setLocationDrafts] = useState<LocationDraft[]>([]);
  const [activeDraftId, setActiveDraftId] = useState<string | null>(null);
  const [restoredNotice, setRestoredNotice] = useState(false);
  const [quickSaveMsg, setQuickSaveMsg] = useState('');

  // 今日の問い（お題）：map/page.tsxと同じAPIを使い、記録画面自体でもきっかけを示す
  // （続けて記録するハードルを下げる施策・2026-07-21）
  const [currentQuest, setCurrentQuest] = useState<Quest & { quest_type?: string; target_emotion_key?: string | null } | null>(null);
  const [questDismissed, setQuestDismissed] = useState(false);

  // 投稿完了直後にバッジ・連続記録をその場で見せる演出（続けて記録するハードルを下げる施策）。
  // ログインユーザーのみ対象。取得できなければ静かにスキップして通常どおり遷移する。
  const [celebration, setCelebration] = useState<{
    badges: Badge[]; totalPosts: number;
    before: CharacterState; after: CharacterState; gainedExp: number; leveledUp: boolean;
  } | null>(null);

  useEffect(() => {
    fetch('/api/quests/active')
      .then((r) => r.json())
      .then((d) => { if (d.ok) setCurrentQuest(d.quest); })
      .catch(() => {});
  }, []);

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
        if (d.traceType) setTraceType(d.traceType as string);
        if (d.companionTag) setCompanionTag(d.companionTag as string);
        if (d.title) setTitle(d.title as string);
        if (d.why) setWhy(d.why as string);
        if (d.interpretation) setInterpretation(d.interpretation as string);
        if (d.selfReflection) setSelfReflection(d.selfReflection as string);
        if (d.wantRevisit) setWantRevisit(Boolean(d.wantRevisit));
        if (d.wantToShare) setWantToShare(Boolean(d.wantToShare));
        if (d.nickname) setNickname(d.nickname as string);
        if (d.activeDraftId) setActiveDraftId(d.activeDraftId as string);
        // 折りたたみ内の項目が書きかけなら、復元時に開いた状態にする
        if (d.why || d.interpretation || d.selfReflection || d.nickname || d.wantRevisit || d.wantToShare) setShowAdvanced(true);
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
        lat, lng, emotionKeys, intensity, traceType, companionTag, title, why, interpretation,
        selfReflection, wantRevisit, wantToShare, nickname, activeDraftId,
      }));
    } catch {
      // 保存できなくても投稿自体は継続できる
    }
  }, [lat, lng, emotionKeys, intensity, traceType, companionTag, title, why, interpretation, selfReflection, wantRevisit, wantToShare, nickname, activeDraftId]);

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
          title: title.trim() || null, // 空欄ならサーバー側で「✨ときめきの記録・7/17」形式に自動生成

          why: why.trim() || null,
          interpretation: interpretation.trim() || null,
          self_reflection: selfReflection.trim() || null,
          want_revisit: wantRevisit,
          want_to_share: wantToShare,
          emotion_key: emotionKeys[0] ?? null,
          emotion_keys: emotionKeys.length > 0 ? emotionKeys : null,
          intensity,
          trace_type: traceType,
          companion_tag: companionTag.trim() || null,
          nickname: nickname.trim() || null,
          revisit_of: revisitOf,
        }),
      });

      const data: CreateTraceResponse = await res.json();
      if (data.ok || res.status === 503) {
        clearAutosave();
        if (activeDraftId) removeLocationDraft(activeDraftId);

        // 投稿直後にバッジ・連続記録をその場で見せる（ログイン中のみ。取れなければ即遷移）
        try {
          const { createAuthBrowserClient } = await import('@/lib/supabase/authClient');
          const supabase = createAuthBrowserClient();
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            const [tracesRes, routeRes] = await Promise.all([
              fetch(`/api/traces?user_id=${user.id}&limit=500`).then((r) => r.json()).catch(() => null),
              fetch(`/api/routes/completions?user_id=${user.id}`).then((r) => r.json()).catch(() => null),
            ]);
            if (tracesRes?.ok) {
              const allTraces = tracesRes.traces ?? [];
              const badges = computeBadges(allTraces, routeRes?.ok ? routeRes.count ?? 0 : 0);
              // 今回投稿した分だけを除いた状態と比べて、キャラの成長分を演出する
              const sorted = [...allTraces].sort(
                (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
              );
              const before = computeCharacter(sorted.slice(0, -1));
              const after = computeCharacter(sorted);
              setCelebration({
                badges, totalPosts: allTraces.length,
                before, after,
                gainedExp: after.totalExp - before.totalExp,
                leveledUp: after.level > before.level,
              });
              return; // 遷移はcelebrationの「続ける」ボタンで行う
            }
          }
        } catch {
          // 取得できなくても投稿自体は成功しているので、そのまま通常どおり遷移する
        }
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

  const canSubmit = Boolean(lat && lng && locationConfirmed && !submitting);
  const statusText = uploadProgress || (submitting ? '記録中…' : '記録する →');

  // 投稿直後のバッジ・連続記録の演出（続けて記録するハードルを下げる施策）。
  // フォームは表示せず、この画面だけを見せて「続ける」を押すとレポートへ遷移する。
  if (celebration) {
    return (
      <main style={{ maxWidth: 480, margin: '0 auto', padding: '40px 20px', textAlign: 'center' }}>
        <p style={{ fontSize: 48, margin: '0 0 8px' }}>✨</p>
        <h1 style={{ fontSize: 20, margin: '0 0 4px' }}>記録しました</h1>
        <p style={{ color: '#888', fontSize: 13, margin: '0 0 20px' }}>これで{celebration.totalPosts}件目の痕跡です</p>

        <div style={{ marginBottom: 12 }}>
          <CharacterScene character={celebration.after} compact />
        </div>
        <p style={{ margin: '0 0 4px', fontSize: 13, fontWeight: 700, color: '#F6B93B' }}>+{celebration.gainedExp} EXP!</p>
        {celebration.leveledUp && (
          <p style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 800, color: '#8E44AD' }}>
            🎉 レベルアップ！ Lv.{celebration.after.level}
          </p>
        )}
        {celebration.after.mood === 'justWoke' && (
          <p style={{ margin: '0 0 4px', fontSize: 13, fontWeight: 700, color: '#38ADA9' }}>😊 キャラクターが目を覚ました！</p>
        )}
        <div style={{ height: 16 }} />

        {celebration.badges.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 28 }}>
            {celebration.badges.map((b) => (
              <div key={b.id} style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px',
                background: '#FFF8F5', border: '1.5px solid #FFE3D6', borderRadius: 14, textAlign: 'left',
              }}>
                <span style={{ fontSize: 30 }}>{b.emoji}</span>
                <div>
                  <p style={{ margin: 0, fontWeight: 700, fontSize: 15 }}>{b.label}</p>
                  <p style={{ margin: '2px 0 0', fontSize: 12, color: '#999' }}>{b.description}</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p style={{ fontSize: 13, color: '#aaa', marginBottom: 28 }}>次の記録で最初のバッジが手に入ります</p>
        )}
        <button type="button" onClick={() => router.push('/report')}
          style={{
            width: '100%', padding: '14px', background: '#FF6B9D', color: '#fff',
            border: 'none', borderRadius: 12, fontSize: 15, fontWeight: 700, cursor: 'pointer',
          }}>
          続ける →
        </button>
      </main>
    );
  }

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

        {/* 今日の問い：記録画面自体できっかけを示す（map/page.tsxと同じAPI・見た目を踏襲） */}
        {!questDismissed && currentQuest && (
          <div style={{
            background: 'linear-gradient(135deg, #F8F4E9, #FFF)', border: '1.5px solid #F3EDDE',
            borderRadius: 14, padding: '12px 14px', marginBottom: 16, position: 'relative',
          }}>
            <button type="button" onClick={() => setQuestDismissed(true)} style={{
              position: 'absolute', top: 8, right: 10, background: 'none', border: 'none',
              color: '#A79E8A', fontSize: 16, cursor: 'pointer', lineHeight: 1,
            }}>✕</button>
            <p style={{ margin: '0 0 4px', fontSize: 11, color: '#8A6B3F', fontWeight: 700 }}>今日の問い</p>
            <p style={{ margin: '0 0 4px', fontSize: 14, fontWeight: 800, color: '#23231F' }}>
              {currentQuest.emoji} {currentQuest.title}
            </p>
            {currentQuest.quest_type === 'emotion' && currentQuest.target_emotion_key && (
              <p style={{ margin: '0 0 4px' }}>
                <span style={{
                  display: 'inline-block', padding: '2px 10px', borderRadius: 20,
                  background: getEmotion(currentQuest.target_emotion_key)?.color + '22',
                  color: getEmotion(currentQuest.target_emotion_key)?.color, fontSize: 12, fontWeight: 700,
                }}>
                  {getEmotion(currentQuest.target_emotion_key)?.emoji} {getEmotion(currentQuest.target_emotion_key)?.label}
                </span>
              </p>
            )}
            <p style={{ margin: 0, fontSize: 12, color: '#726C5E', lineHeight: 1.6, paddingRight: 20 }}>
              {currentQuest.hint}
            </p>
          </div>
        )}

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
            <p style={{ margin: '-4px 0 8px', fontSize: 11, color: '#aaa', lineHeight: 1.5 }}>
              表札・車のナンバープレート・人の顔がはっきり写っている場合は、避けるかぼかしてから投稿してください
            </p>
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

          {/* ③ 感情タグ（1タップで強度3が入り、そのまま投稿できる） */}
          <section style={sectionStyle}>
            <label style={labelStyle}>✨ なにを感じた？（1タップでOK・複数選べます）</label>
            <EmotionPicker
              value={emotionKeys} onChange={setEmotionKeys}
              intensity={intensity} onIntensityChange={setIntensity}
            />
            <FaceEmotionSuggest
              selectedKeys={emotionKeys}
              onAdd={(key) => setEmotionKeys((prev) => prev.includes(key) ? prev : [...prev, key])}
            />
          </section>

          {/* ③.5 何と出会った？ ヒトマップの本義（出会い→感情→愛着）を結ぶ唯一の項目のため、
              折りたたみの奥ではなく感情選択のすぐ後、常に見える位置に置く */}
          <section style={sectionStyle}>
            <label style={labelStyle}>🤝 何と出会った？（任意）</label>
            <div style={{ display: 'flex', gap: 8, marginBottom: traceType === 'person' ? 12 : 0 }}>
              {TRACE_TYPES.map((tt) => (
                <button key={tt.key} type="button"
                  onClick={() => setTraceType(traceType === tt.key ? null : tt.key)}
                  style={{
                    flex: 1, padding: '11px 8px', borderRadius: 10, fontSize: 14,
                    border: `2px solid ${traceType === tt.key ? tt.color : '#ddd'}`,
                    background: traceType === tt.key ? tt.color + '18' : '#fff',
                    color: traceType === tt.key ? tt.color : '#999',
                    fontWeight: traceType === tt.key ? 700 : 400, cursor: 'pointer',
                    WebkitTapHighlightColor: 'transparent',
                  }}>
                  {tt.emoji} {tt.label}
                </button>
              ))}
            </div>
            {traceType === 'person' && (
              <>
                <input type="text" value={companionTag} onChange={(e) => setCompanionTag(e.target.value)}
                  placeholder="誰と出会いましたか？（例：地元のおばあちゃん）"
                  style={inputStyle} />
                <p style={hintStyle}>人との出会いは、この町とあなたを結ぶいちばん強い縁になります</p>
              </>
            )}
          </section>

          {/* ④ タイトル（任意。空欄なら感情＋日付から自動生成される） */}
          <section style={sectionStyle}>
            <label style={labelStyle}>📝 何を見つけた？（任意）</label>
            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)}
              placeholder="空欄なら自動でタイトルが付きます"
              style={inputStyle} />
          </section>

          {/* ⑤ くわしく記録する（任意・折りたたみ）。気軽さ優先で長文項目はここに格納する */}
          <section style={sectionStyle}>
            <button type="button" onClick={() => setShowAdvanced(!showAdvanced)}
              style={{
                width: '100%', padding: '12px', borderRadius: 10,
                border: '1.5px dashed #ccc', background: showAdvanced ? '#f5f5f5' : '#fafafa',
                color: '#777', fontSize: 13, fontWeight: 700, cursor: 'pointer',
                WebkitTapHighlightColor: 'transparent',
              }}>
              {showAdvanced ? '− とじる' : '＋ くわしく記録する（任意）'}
            </button>

            {showAdvanced && (
              <div style={{ marginTop: 20 }}>
                {/* 3つの問い */}
                <div style={sectionStyle}>
                  <label style={labelStyle}>💬 言葉にしてみる</label>
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
                </div>

                {/* 2択トグル */}
                <div style={sectionStyle}>
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
                </div>

                {/* ニックネーム */}
                <div style={{ marginBottom: 0 }}>
                  <label style={labelStyle}>👤 ニックネーム（任意）</label>
                  <input type="text" value={nickname} onChange={(e) => setNickname(e.target.value)}
                    placeholder="匿名でもOK" style={inputStyle} />
                </div>
              </div>
            )}
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
