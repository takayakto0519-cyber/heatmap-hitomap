'use client';

import { useEffect, useState, useRef, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import type { Trace, ListTracesResponse, CreateTraceResponse, Sponsor, ListSponsorsResponse } from '@/lib/types';
import { EMOTIONS, getEmotion } from '@/lib/emotions';
import { CATEGORIES } from '@/lib/categories';
import { TRACE_TYPES } from '@/lib/traceTypes';
import { ARCHIVE_TYPES, getArchiveType, VOICE_RELATIONS } from '@/lib/archiveTypes';
import EmotionPicker from '@/components/form/EmotionPicker';
import IntensityPicker from '@/components/form/IntensityPicker';
import AudioRecorder from '@/components/form/AudioRecorder';
import TraceCard from '@/components/report/TraceCard';
import TraceDetail from '@/components/TraceDetail';
import StatsPanel from '@/components/list/StatsPanel';

const TraceMap = dynamic(() => import('@/components/map/TraceMap'), {
  ssr: false,
  loading: () => <div style={mapLoadingStyle}>地図を読み込み中…</div>,
});
const LocationPickerMap = dynamic(() => import('@/components/form/LocationPickerMap'), {
  ssr: false,
  loading: () => <div style={mapLoadingStyle}>地図を読み込み中…</div>,
});

const SUPABASE_READY = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL);
type Tab = 'map' | 'post' | 'list';
type MapMode = 'pin' | 'heat';
type SortOrder = 'new' | 'old';
const NEARBY_RADIUS = 500;
const DEFAULT_CENTER: [number, number] = [35.681236, 139.767125];

function haversine(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const mapLoadingStyle: React.CSSProperties = {
  height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
  background: '#f0f0f0', color: '#aaa', fontSize: 14,
};
const inputStyle: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box', padding: '11px 13px', fontSize: 15,
  border: '1.5px solid #e8e8e8', borderRadius: 10, fontFamily: 'inherit',
  resize: 'vertical' as const, outline: 'none', background: '#fff',
};
const labelStyle: React.CSSProperties = { display: 'block', fontWeight: 700, fontSize: 14, marginBottom: 6, color: '#333' };

export default function MapPage() {
  return (
    <Suspense fallback={<div style={mapLoadingStyle}>読み込み中…</div>}>
      <MapApp />
    </Suspense>
  );
}

function MapApp() {
  const searchParams = useSearchParams();
  const regionParam = searchParams.get('region');

  // ── タブ・マップ ──────────────────────────
  const [tab, setTab] = useState<Tab>('map');
  const [mapMode, setMapMode] = useState<MapMode>('pin');
  const [userPos, setUserPos] = useState<[number, number] | null>(null);
  const [nearbyOnly, setNearbyOnly] = useState(false);
  const [filterEmotion, setFilterEmotion] = useState<string | null>(null);
  const [filterCategory, setFilterCategory] = useState<string | null>(null);
  // 'trace' = 痕跡のみ / それ以外は archive_type のキー / null = すべて
  const [filterArchive, setFilterArchive] = useState<string | null>(null);
  const [sortOrder, setSortOrder] = useState<SortOrder>('new');
  const [mapFlyTo, setMapFlyTo] = useState<[number, number] | null>(null);
  const [mapFlyToZoom, setMapFlyToZoom] = useState<number>(17);
  const [mapFitBounds, setMapFitBounds] = useState<[[number, number], [number, number]] | null>(null);
  const hasAutoLocatedRef = useRef(false);

  // 地図タブの地域ジャンプ検索
  const [regionQuery, setRegionQuery] = useState('');
  const [regionSearching, setRegionSearching] = useState(false);
  const [regionError, setRegionError] = useState('');
  const [regionCandidates, setRegionCandidates] = useState<{ display_name: string; lat: string; lon: string; boundingbox: string[] }[]>([]);
  const [showRegionSearch, setShowRegionSearch] = useState(false);

  // ルート作成モード（一覧タブ）
  const [routeMode, setRouteMode] = useState(false);
  const [routeSelection, setRouteSelection] = useState<string[]>([]);
  const [routeTitle, setRouteTitle] = useState('');
  const [routeNickname, setRouteNickname] = useState('');
  const [routeSaving, setRouteSaving] = useState(false);
  const [routeSaveError, setRouteSaveError] = useState('');

  function toggleRouteSelection(id: string) {
    setRouteSelection(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }

  async function saveRoute() {
    if (!routeTitle.trim() || routeSelection.length < 2) return;
    setRouteSaving(true);
    setRouteSaveError('');
    try {
      const res = await fetch('/api/routes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: routeTitle.trim(),
          trace_ids: routeSelection,
          nickname: routeNickname.trim() || undefined,
          session_code: sessionCode.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (data.ok && data.route?.id) {
        window.location.href = `/routes/${data.route.id}`;
      } else {
        setRouteSaveError(data.error ?? '保存に失敗しました');
      }
    } catch (err) {
      setRouteSaveError(err instanceof Error ? err.message : '保存に失敗しました');
    } finally {
      setRouteSaving(false);
    }
  }

  // 寄り道モード（地図タブ：目的地までの経路沿いにある痕跡を提案する）
  const [detourMode, setDetourMode] = useState(false);
  const [detourQuery, setDetourQuery] = useState('');
  const [detourSearching, setDetourSearching] = useState(false);
  const [detourError, setDetourError] = useState('');
  const [detourCandidates, setDetourCandidates] = useState<{ display_name: string; lat: string; lon: string }[]>([]);
  const [detourDestination, setDetourDestination] = useState<{ name: string; pos: [number, number] } | null>(null);

  async function searchDetourDestination() {
    if (!detourQuery.trim()) return;
    setDetourSearching(true);
    setDetourError('');
    setDetourCandidates([]);
    try {
      const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(detourQuery)}&format=json&limit=5&accept-language=ja&countrycodes=jp`;
      const results = await fetch(url, { headers: { 'Accept-Language': 'ja' } }).then(r => r.json()) as { display_name: string; lat: string; lon: string }[];
      if (results.length === 0) setDetourError('見つかりませんでした');
      setDetourCandidates(results);
    } catch {
      setDetourError('検索に失敗しました');
    } finally {
      setDetourSearching(false);
    }
  }

  function pickDetourDestination(c: { display_name: string; lat: string; lon: string }) {
    setDetourDestination({ name: c.display_name, pos: [Number(c.lat), Number(c.lon)] });
    setDetourCandidates([]);
    setDetourQuery('');
  }

  // 寄り道モードのPRスポンサー地点（手動登録。決済は伴わない）
  const [detourSponsors, setDetourSponsors] = useState<Sponsor[]>([]);
  useEffect(() => {
    if (!detourMode) return;
    fetch('/api/sponsors?placement=detour')
      .then(r => r.json() as Promise<ListSponsorsResponse>)
      .then(d => { if (d.ok) setDetourSponsors(d.sponsors); })
      .catch(() => {});
  }, [detourMode]);

  // ── データ ──────────────────────────────
  const [traces, setTraces] = useState<Trace[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [sessionCode, setSessionCode] = useState('');

  // ── モーダル ─────────────────────────────
  const [selectedTrace, setSelectedTrace] = useState<Trace | null>(null);

  // ── ユーザー設定 ─────────────────────────
  const [myTraceIds, setMyTraceIds] = useState<string[]>([]);
  const [myEmotions, setMyEmotions] = useState<string[]>([]);

  // ── 投稿フォーム ─────────────────────────
  const fileRef = useRef<HTMLInputElement>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsError, setGpsError] = useState('');
  const [addressQuery, setAddressQuery] = useState('');
  const [addressSearching, setAddressSearching] = useState(false);
  const [addressError, setAddressError] = useState('');
  const [addressCandidates, setAddressCandidates] = useState<{ display_name: string; lat: string; lon: string }[]>([]);
  const [showAddressSearch, setShowAddressSearch] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [emotionKey, setEmotionKey] = useState<string | null>(null);
  const [intensity, setIntensity] = useState(3);
  // 投稿タイプ：null = 痕跡 / chimei | denshou | bunken | koe = アーカイブ
  const [archiveTypeKey, setArchiveTypeKey] = useState<string | null>(null);
  const [yomi, setYomi] = useState('');
  const [altNames, setAltNames] = useState('');
  const [eraLabel, setEraLabel] = useState('');
  const [sourceRef, setSourceRef] = useState('');
  const [voiceRelation, setVoiceRelation] = useState<string | null>(null);
  const [categoryKey, setCategoryKey] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [why, setWhy] = useState('');
  const [interpretation, setInterpretation] = useState('');
  const [selfReflection, setSelfReflection] = useState('');
  const [wantRevisit, setWantRevisit] = useState(false);
  const [wantToShare, setWantToShare] = useState(false);
  const [nickname, setNickname] = useState('');
  const [traceTypeKey, setTraceTypeKey] = useState<string | null>(null);
  const [isPastMemory, setIsPastMemory] = useState(false);
  const [memoryDate, setMemoryDate] = useState('');
  const [customTags, setCustomTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');
  const [submitError, setSubmitError] = useState('');
  const [submitDone, setSubmitDone] = useState(false);
  const [currentUser, setCurrentUser] = useState<{ id: string; email?: string } | null>(null);
  const [postVisibility, setPostVisibility] = useState<'private' | 'followers' | 'pending_review'>('private');

  useEffect(() => {
    fetch('/api/profile').then(r => r.json()).then(d => setCurrentUser(d.user ?? null)).catch(() => {});
  }, []);

  // ── 初期化 ──────────────────────────────
  useEffect(() => {
    try {
      setSessionCode(localStorage.getItem('hitomap_session_code') || '');
      const ids = JSON.parse(localStorage.getItem('hitomap_my_traces') || '[]');
      setMyTraceIds(Array.isArray(ids) ? ids : []);
      const emo = JSON.parse(localStorage.getItem('hitomap_my_emotions') || '[]');
      setMyEmotions(Array.isArray(emo) ? emo : []);
    } catch { /* ignore */ }
    fetch('/api/migrate').catch(() => {});
  }, []);

  // 地図タブを開いたとき、まだ位置不明なら自動取得試みる。
  // 初回の1回だけ、取得できた現在地の町スケール（zoom15）へ地図を飛ばす。
  useEffect(() => {
    if (tab === 'map' && !userPos && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        p => {
          const pos: [number, number] = [p.coords.latitude, p.coords.longitude];
          setUserPos(pos);
          if (!hasAutoLocatedRef.current) {
            hasAutoLocatedRef.current = true;
            setMapFlyToZoom(15);
            setMapFlyTo(pos);
          }
        },
        () => { /* サイレント失敗 */ },
        { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 }
      );
    }
  }, [tab, userPos]);

  async function searchRegion() {
    if (!regionQuery.trim()) return;
    setRegionSearching(true);
    setRegionError('');
    setRegionCandidates([]);
    try {
      const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(regionQuery)}&format=json&limit=5&accept-language=ja&countrycodes=jp`;
      const results = await fetch(url, { headers: { 'Accept-Language': 'ja' } }).then(r => r.json()) as { display_name: string; lat: string; lon: string; boundingbox: string[] }[];
      if (results.length === 0) setRegionError('見つかりませんでした');
      setRegionCandidates(results);
    } catch {
      setRegionError('検索に失敗しました');
    } finally {
      setRegionSearching(false);
    }
  }

  function jumpToRegion(c: { display_name: string; lat: string; lon: string; boundingbox: string[] }) {
    const [south, north, west, east] = c.boundingbox.map(Number);
    setMapFitBounds([[south, west], [north, east]]);
    setRegionQuery('');
    setRegionCandidates([]);
    setShowRegionSearch(false);
  }

  function saveSessionCode(code: string) {
    setSessionCode(code);
    localStorage.setItem('hitomap_session_code', code);
  }

  // ?region= 付きで開いた場合、その自治体の範囲に自動でfitBoundsする
  useEffect(() => {
    if (!regionParam) return;
    (async () => {
      try {
        const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(regionParam)}&format=json&limit=1&accept-language=ja&countrycodes=jp`;
        const results = await fetch(url, { headers: { 'Accept-Language': 'ja' } }).then(r => r.json()) as { boundingbox: string[] }[];
        if (results[0]) {
          const [south, north, west, east] = results[0].boundingbox.map(Number);
          setMapFitBounds([[south, west], [north, east]]);
        }
      } catch { /* 失敗しても地図自体は表示できるので無視 */ }
    })();
  }, [regionParam]);

  // ── データ取得（常に全件取得。session_codeフィルタはクライアント側で行う）──
  const fetchTraces = useCallback(() => {
    setLoading(true);
    setFetchError(null);
    fetch('/api/traces')
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json() as Promise<ListTracesResponse>; })
      .then(d => setTraces(d.ok ? d.traces : []))
      .catch(e => setFetchError(e instanceof Error ? e.message : '通信エラー'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { fetchTraces(); }, [fetchTraces]);

  // ── フィルタ・ソート ─────────────────────
  // マップ用：感情・カテゴリ・近くのみ（セッションコードでは絞らない→全件見える）
  const filteredForMap = traces.filter(t => {
    if (regionParam && t.region !== regionParam) return false;
    if (filterArchive === 'trace' && t.archive_type) return false;
    if (filterArchive && filterArchive !== 'trace' && t.archive_type !== filterArchive) return false;
    if (filterEmotion && t.emotion_key !== filterEmotion) return false;
    if (filterCategory && t.category !== filterCategory) return false;
    if (nearbyOnly && userPos) {
      return haversine(userPos[0], userPos[1], t.latitude, t.longitude) <= NEARBY_RADIUS;
    }
    return true;
  });

  // リスト用：上記＋セッションコードでクライアント側絞り込み
  const filtered = filteredForMap.filter(t => {
    if (sessionCode && t.session_code !== sessionCode) return false;
    return true;
  });

  // 寄り道モード：現在地→目的地の直線付近にある痕跡を、通過順に並べて提案する
  const DETOUR_BUFFER_METERS = 400;
  const detourWaypoints = (() => {
    if (!detourMode || !userPos || !detourDestination) return [];
    const [oLat, oLng] = userPos;
    const [dLat, dLng] = detourDestination.pos;
    // 局所的な平面近似（数km範囲なら十分な精度）
    const mPerDegLat = 111320;
    const mPerDegLng = 111320 * Math.cos(oLat * Math.PI / 180);
    const toXY = (lat: number, lng: number): [number, number] => [(lng - oLng) * mPerDegLng, (lat - oLat) * mPerDegLat];
    const [ox, oy] = toXY(oLat, oLng);
    const [dx, dy] = toXY(dLat, dLng);
    const segX = dx - ox, segY = dy - oy;
    const segLenSq = segX * segX + segY * segY || 1;

    return traces
      .map(t => {
        const [px, py] = toXY(t.latitude, t.longitude);
        const relX = px - ox, relY = py - oy;
        const proj = (relX * segX + relY * segY) / segLenSq;
        const clampedProj = Math.max(0, Math.min(1, proj));
        const closestX = ox + segX * clampedProj, closestY = oy + segY * clampedProj;
        const perpDist = Math.hypot(px - closestX, py - closestY);
        return { trace: t, proj, perpDist };
      })
      .filter(w => w.proj >= -0.05 && w.proj <= 1.05 && w.perpDist <= DETOUR_BUFFER_METERS)
      .sort((a, b) => a.proj - b.proj);
  })();

  // 経路沿いのPRスポンサー地点（1件だけ。露骨な広告にならないよう混在は最小限に留める）
  const detourSponsorNearby = (() => {
    if (!detourMode || !userPos || !detourDestination || detourSponsors.length === 0) return null;
    const [oLat, oLng] = userPos;
    const [dLat, dLng] = detourDestination.pos;
    const mPerDegLat = 111320;
    const mPerDegLng = 111320 * Math.cos(oLat * Math.PI / 180);
    const toXY = (lat: number, lng: number): [number, number] => [(lng - oLng) * mPerDegLng, (lat - oLat) * mPerDegLat];
    const [ox, oy] = toXY(oLat, oLng);
    const [dx, dy] = toXY(dLat, dLng);
    const segX = dx - ox, segY = dy - oy;
    const segLenSq = segX * segX + segY * segY || 1;

    const candidates = detourSponsors
      .filter(s => s.latitude != null && s.longitude != null)
      .map(s => {
        const [px, py] = toXY(s.latitude!, s.longitude!);
        const relX = px - ox, relY = py - oy;
        const proj = (relX * segX + relY * segY) / segLenSq;
        const clampedProj = Math.max(0, Math.min(1, proj));
        const closestX = ox + segX * clampedProj, closestY = oy + segY * clampedProj;
        const perpDist = Math.hypot(px - closestX, py - closestY);
        return { sponsor: s, proj, perpDist };
      })
      .filter(w => w.proj >= -0.05 && w.proj <= 1.05 && w.perpDist <= DETOUR_BUFFER_METERS)
      .sort((a, b) => a.perpDist - b.perpDist);
    return candidates[0] ?? null;
  })();

  const sorted = [...filtered].sort((a, b) => {
    const ta = new Date(a.created_at).getTime();
    const tb = new Date(b.created_at).getTime();
    return sortOrder === 'new' ? tb - ta : ta - tb;
  });

  const archiveCounts = ARCHIVE_TYPES
    .map(a => ({ ...a, count: traces.filter(t => t.archive_type === a.key).length }))
    .filter(a => a.count > 0);
  const hasArchive = archiveCounts.length > 0;
  const selectedArchiveType = getArchiveType(archiveTypeKey);

  const emotionCounts = EMOTIONS
    .map(e => ({ ...e, count: traces.filter(t => t.emotion_key === e.key).length }))
    .filter(e => e.count > 0);

  const myProfile = EMOTIONS
    .map(e => ({ ...e, count: myEmotions.filter(k => k === e.key).length }))
    .filter(e => e.count > 0)
    .sort((a, b) => b.count - a.count);

  // ── 住所検索 ────────────────────────────
  async function searchAddress() {
    const q = addressQuery.trim(); if (!q) return;
    setAddressSearching(true); setAddressError(''); setAddressCandidates([]);
    try {
      const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=5&accept-language=ja&countrycodes=jp`;
      const results = await fetch(url, { headers: { 'Accept-Language': 'ja' } }).then(r => r.json()) as { display_name: string; lat: string; lon: string }[];
      if (results.length === 0) { setAddressError('住所が見つかりませんでした'); }
      else if (results.length === 1) { setLat(parseFloat(results[0].lat)); setLng(parseFloat(results[0].lon)); setAddressQuery(results[0].display_name.split(',')[0]); }
      else { setAddressCandidates(results); }
    } catch { setAddressError('検索に失敗しました'); }
    finally { setAddressSearching(false); }
  }

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

  // ── 投稿 ────────────────────────────────
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) { setSubmitError('タイトルを入力してください'); return; }
    if (!lat || !lng) { setSubmitError('位置情報を取得してください'); return; }
    setSubmitting(true); setSubmitError('');
    try {
      let photoUrl: string | null = null;
      if (photoFile) {
        if (SUPABASE_READY) {
          setUploadProgress('写真をアップロード中…');
          const { uploadTracePhoto } = await import('@/lib/supabase/upload');
          photoUrl = await uploadTracePhoto(photoFile);
          setUploadProgress('');
        } else {
          photoUrl = photoPreview;
        }
      }
      let audioUrl: string | null = null;
      if (audioBlob) {
        if (SUPABASE_READY) {
          setUploadProgress('録音をアップロード中…');
          const { uploadTraceAudio } = await import('@/lib/supabase/upload');
          audioUrl = await uploadTraceAudio(audioBlob);
          setUploadProgress('');
        }
      }
      const res = await fetch('/api/traces', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          photo_url: photoUrl, latitude: lat, longitude: lng,
          title: title.trim(),
          why: why.trim() || null,
          interpretation: interpretation.trim() || null,
          self_reflection: selfReflection.trim() || null,
          want_revisit: wantRevisit, want_to_share: wantToShare,
          emotion_key: archiveTypeKey ? null : emotionKey,
          intensity: archiveTypeKey ? null : intensity,
          category: archiveTypeKey ? null : categoryKey,
          trace_type: archiveTypeKey ? null : traceTypeKey,
          archive_type: archiveTypeKey,
          yomi: yomi.trim() || null,
          alt_names: altNames.trim() || null,
          era_label: eraLabel.trim() || null,
          source_ref: sourceRef.trim() || null,
          voice_relation: archiveTypeKey === 'koe' ? voiceRelation : null,
          audio_url: audioUrl,
          is_past_memory: isPastMemory,
          memory_date: isPastMemory && memoryDate ? memoryDate : null,
          custom_tags: customTags.length > 0 ? customTags : null,
          session_code: sessionCode.trim() || null,
          nickname: nickname.trim() || null,
          visibility: currentUser ? postVisibility : undefined,
        }),
      });
      const data: CreateTraceResponse = await res.json();
      if (data.ok || res.status === 503) {
        if (data.trace?.id) {
          const updated = [...myTraceIds, data.trace.id];
          setMyTraceIds(updated);
          localStorage.setItem('hitomap_my_traces', JSON.stringify(updated));
        }
        if (emotionKey) {
          const updated = [...myEmotions, emotionKey];
          setMyEmotions(updated);
          localStorage.setItem('hitomap_my_emotions', JSON.stringify(updated));
        }
        // 投稿位置を先に保存（setLatで消える前に）
        const postedLat = lat;
        const postedLng = lng;
        setSubmitDone(true);
        setTimeout(() => {
          setTitle(''); setWhy(''); setInterpretation(''); setSelfReflection('');
          setPhotoPreview(null); setPhotoFile(null); setLat(null); setLng(null);
          setEmotionKey(null); setIntensity(3); setWantRevisit(false); setWantToShare(false);
          setNickname(''); setCategoryKey(null); setTraceTypeKey(null);
          setIsPastMemory(false); setMemoryDate(''); setCustomTags([]); setTagInput('');
          setArchiveTypeKey(null); setYomi(''); setAltNames(''); setEraLabel(''); setSourceRef(''); setVoiceRelation(null);
          setAudioBlob(null);
          setAddressQuery(''); setAddressCandidates([]); setAddressError(''); setShowAddressSearch(false);
          setShowAdvanced(false); setSubmitDone(false);
          fetchTraces();
          if (postedLat && postedLng) { setMapFlyToZoom(17); setMapFlyTo([postedLat, postedLng]); }
          setTab('map');
        }, 1500);
      } else {
        setSubmitError(data.error ?? '送信に失敗しました');
      }
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : '送信に失敗しました');
    } finally { setSubmitting(false); }
  }

  function handleTraceUpdate(updated: Trace) {
    setTraces(prev => prev.map(t => t.id === updated.id ? updated : t));
    setSelectedTrace(updated);
  }
  function handleTraceDelete(id: string) {
    setTraces(prev => prev.filter(t => t.id !== id));
    setSelectedTrace(null);
  }

  // カードから地図へジャンプ
  function handleShowOnMap(trace: Trace) {
    setTab('map');
    setMapFlyToZoom(17);
    setMapFlyTo([trace.latitude, trace.longitude]);
    setTimeout(() => setMapFlyTo(null), 2000);
  }

  const canSubmit = Boolean(title.trim() && lat && lng && !submitting && !submitDone);

  // ── 必須フィールド進捗 ───────────────────
  const steps = [
    { label: 'タイトル', done: !!title.trim() },
    { label: '位置', done: !!(lat && lng) },
  ];
  const stepsDone = steps.filter(s => s.done).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh', overflow: 'hidden', background: '#f8f8f8' }}>

      {/* ── ヘッダー ── */}
      <header style={{ padding: '10px 14px 8px', background: '#fff', borderBottom: '1px solid #eee', flexShrink: 0 }}>
        {regionParam && (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            marginBottom: 6, padding: '4px 10px', background: '#F3EAFB', borderRadius: 8,
          }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#8E44AD' }}>🏘 {regionParam}</span>
            <a href="/" style={{ fontSize: 11, color: '#8E44AD', textDecoration: 'none' }}>← 他の地域へ</a>
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          {currentUser ? (
            <button onClick={async () => {
              const { createAuthBrowserClient } = await import('@/lib/supabase/authClient');
              await createAuthBrowserClient().auth.signOut();
              setCurrentUser(null);
            }} style={{
              background: 'none', border: 'none', color: '#999', fontSize: 11, cursor: 'pointer', padding: 0,
            }}>👤 {currentUser.email} ・ ログアウト</button>
          ) : (
            <a href="/login" style={{ color: '#38ADA9', fontSize: 11, fontWeight: 700, textDecoration: 'none' }}>ログイン / 新規登録</a>
          )}

          {/* タブ別コントロール */}
          {tab === 'map' && (
            <div style={{ display: 'flex', gap: 5 }}>
              <button onClick={() => {
                if (!nearbyOnly && !userPos) {
                  navigator.geolocation.getCurrentPosition(
                    p => { setUserPos([p.coords.latitude, p.coords.longitude]); setNearbyOnly(true); },
                    undefined, { enableHighAccuracy: true }
                  );
                } else { setNearbyOnly(n => !n); }
              }} style={{
                padding: '5px 10px', borderRadius: 7, fontSize: 12, cursor: 'pointer',
                border: `1.5px solid ${nearbyOnly ? '#38ADA9' : '#ddd'}`,
                background: nearbyOnly ? '#E8F8F7' : '#fff',
                color: nearbyOnly ? '#38ADA9' : '#666', fontWeight: nearbyOnly ? 700 : 400,
              }}>📍 近く</button>
              <button onClick={() => setShowRegionSearch(v => !v)} style={{
                padding: '5px 10px', borderRadius: 7, fontSize: 12, cursor: 'pointer',
                border: `1.5px solid ${showRegionSearch ? '#38ADA9' : '#ddd'}`,
                background: showRegionSearch ? '#E8F8F7' : '#fff',
                color: showRegionSearch ? '#38ADA9' : '#666', fontWeight: showRegionSearch ? 700 : 400,
              }}>🔍 地域</button>
              <button onClick={() => {
                setDetourMode(v => !v);
                if (detourMode) { setDetourDestination(null); setDetourQuery(''); setDetourCandidates([]); }
              }} style={{
                padding: '5px 10px', borderRadius: 7, fontSize: 12, cursor: 'pointer',
                border: `1.5px solid ${detourMode ? '#38ADA9' : '#ddd'}`,
                background: detourMode ? '#E8F8F7' : '#fff',
                color: detourMode ? '#38ADA9' : '#666', fontWeight: detourMode ? 700 : 400,
              }}>🚶 寄り道</button>
              {(['pin', 'heat'] as MapMode[]).map(m => (
                <button key={m} onClick={() => {
                  setMapMode(m);
                  // ヒートは感情データを持つ痕跡のみが対象。アーカイブ種別で絞られたままだと0件になるためリセットする。
                  if (m === 'heat' && filterArchive && filterArchive !== 'trace') setFilterArchive(null);
                }} style={{
                  padding: '5px 10px', borderRadius: 7, fontSize: 12, cursor: 'pointer',
                  border: '1.5px solid #ddd',
                  background: mapMode === m ? '#222' : '#fff',
                  color: mapMode === m ? '#fff' : '#666', fontWeight: mapMode === m ? 700 : 400,
                }}>{m === 'pin' ? '📍 ピン' : '🌡 ヒート'}</button>
              ))}
            </div>
          )}

          {tab === 'list' && (
            <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
              <span style={{ fontSize: 12, color: '#aaa' }}>{filtered.length}件</span>
              <button onClick={() => setSortOrder(o => o === 'new' ? 'old' : 'new')} style={{
                padding: '5px 10px', borderRadius: 7, fontSize: 12, cursor: 'pointer',
                border: '1.5px solid #ddd', background: '#fff', color: '#555',
              }}>
                {sortOrder === 'new' ? '🕐 新しい順' : '🕰 古い順'}
              </button>
              <button onClick={() => { setRouteMode(v => !v); setRouteSelection([]); }} style={{
                padding: '5px 10px', borderRadius: 7, fontSize: 12, cursor: 'pointer',
                border: `1.5px solid ${routeMode ? '#8E44AD' : '#ddd'}`,
                background: routeMode ? '#F3EAFB' : '#fff',
                color: routeMode ? '#8E44AD' : '#666', fontWeight: routeMode ? 700 : 400,
              }}>🥾 {routeMode ? 'ルート作成中' : 'ルートを作る'}</button>
            </div>
          )}

          {tab === 'post' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {/* 進捗インジケーター */}
              {stepsDone < steps.length && (
                <span style={{ fontSize: 11, color: '#aaa' }}>
                  必須 {stepsDone}/{steps.length}
                </span>
              )}
            </div>
          )}
        </div>

        {/* アーカイブタイプフィルター（マップ・一覧）。ヒートは感情データを持つ痕跡専用のため、ヒート表示中は出さない */}
        {(tab === 'map' || tab === 'list') && hasArchive && !(tab === 'map' && mapMode === 'heat') && (
          <div style={{ display: 'flex', gap: 5, overflowX: 'auto', paddingBottom: 4, scrollbarWidth: 'none' }}>
            <button onClick={() => setFilterArchive(null)} style={{
              padding: '3px 9px', borderRadius: 16, fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0,
              border: `1.5px solid ${!filterArchive ? '#444' : '#ddd'}`,
              background: !filterArchive ? '#444' : '#fff',
              color: !filterArchive ? '#fff' : '#666',
            }}>すべて</button>
            <button onClick={() => setFilterArchive(filterArchive === 'trace' ? null : 'trace')} style={{
              padding: '3px 9px', borderRadius: 16, fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0,
              border: `1.5px solid ${filterArchive === 'trace' ? '#FF6B9D' : '#ddd'}`,
              background: filterArchive === 'trace' ? '#FF6B9D' : '#fff',
              color: filterArchive === 'trace' ? '#fff' : '#666',
            }}>📍 痕跡</button>
            {archiveCounts.map(a => (
              <button key={a.key} onClick={() => setFilterArchive(filterArchive === a.key ? null : a.key)} style={{
                padding: '3px 9px', borderRadius: 16, fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0,
                border: `1.5px solid ${filterArchive === a.key ? a.color : '#ddd'}`,
                background: filterArchive === a.key ? a.color : '#fff',
                color: filterArchive === a.key ? '#fff' : '#666',
              }}>{a.emoji} {a.label} {a.count}</button>
            ))}
          </div>
        )}
        {tab === 'map' && mapMode === 'heat' && (
          <p style={{ fontSize: 11, color: '#aaa', margin: '0 0 4px' }}>🌡 ヒートは感情を記録した「痕跡」投稿のみが対象です</p>
        )}

        {/* 地域ジャンプ検索（マップ） */}
        {tab === 'map' && showRegionSearch && (
          <div style={{ marginBottom: 6 }}>
            <div style={{ display: 'flex', gap: 6 }}>
              <input
                value={regionQuery}
                onChange={e => setRegionQuery(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') searchRegion(); }}
                placeholder="例：渋谷区、別府市…"
                style={{
                  flex: 1, padding: '7px 10px', borderRadius: 8, fontSize: 13,
                  border: '1.5px solid #ddd', outline: 'none',
                }}
              />
              <button onClick={searchRegion} disabled={regionSearching} style={{
                padding: '7px 14px', borderRadius: 8, border: 'none',
                background: '#38ADA9', color: '#fff', fontSize: 13, fontWeight: 700,
                cursor: regionSearching ? 'wait' : 'pointer',
              }}>{regionSearching ? '検索中…' : '移動'}</button>
            </div>
            {regionError && <p style={{ color: '#E55039', fontSize: 12, margin: '4px 0 0' }}>{regionError}</p>}
            {regionCandidates.length > 0 && (
              <div style={{ marginTop: 6, background: '#fff', border: '1px solid #eee', borderRadius: 8, overflow: 'hidden' }}>
                {regionCandidates.map((c, i) => (
                  <button key={i} onClick={() => jumpToRegion(c)} style={{
                    display: 'block', width: '100%', textAlign: 'left', padding: '8px 10px',
                    border: 'none', borderBottom: i < regionCandidates.length - 1 ? '1px solid #f0f0f0' : 'none',
                    background: '#fff', fontSize: 12, color: '#444', cursor: 'pointer',
                  }}>{c.display_name}</button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 寄り道モード（マップ） */}
        {tab === 'map' && detourMode && (
          <div style={{ marginBottom: 6 }}>
            {!userPos ? (
              <p style={{ fontSize: 12, color: '#aaa', margin: 0 }}>現在地を取得しています…（位置情報を許可してください）</p>
            ) : !detourDestination ? (
              <>
                <div style={{ display: 'flex', gap: 6 }}>
                  <input
                    value={detourQuery}
                    onChange={e => setDetourQuery(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') searchDetourDestination(); }}
                    placeholder="目的地は？（例：〇〇駅）"
                    style={{ flex: 1, padding: '7px 10px', borderRadius: 8, fontSize: 13, border: '1.5px solid #ddd', outline: 'none' }}
                  />
                  <button onClick={searchDetourDestination} disabled={detourSearching} style={{
                    padding: '7px 14px', borderRadius: 8, border: 'none',
                    background: '#38ADA9', color: '#fff', fontSize: 13, fontWeight: 700,
                    cursor: detourSearching ? 'wait' : 'pointer',
                  }}>{detourSearching ? '検索中…' : '検索'}</button>
                </div>
                {detourError && <p style={{ color: '#E55039', fontSize: 12, margin: '4px 0 0' }}>{detourError}</p>}
                {detourCandidates.length > 0 && (
                  <div style={{ marginTop: 6, background: '#fff', border: '1px solid #eee', borderRadius: 8, overflow: 'hidden' }}>
                    {detourCandidates.map((c, i) => (
                      <button key={i} onClick={() => pickDetourDestination(c)} style={{
                        display: 'block', width: '100%', textAlign: 'left', padding: '8px 10px',
                        border: 'none', borderBottom: i < detourCandidates.length - 1 ? '1px solid #f0f0f0' : 'none',
                        background: '#fff', fontSize: 12, color: '#444', cursor: 'pointer',
                      }}>{c.display_name}</button>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <div style={{ background: '#E8F8F7', border: '1.5px solid #38ADA933', borderRadius: 10, padding: '8px 12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <p style={{ margin: 0, fontSize: 12, color: '#38ADA9', fontWeight: 700 }}>
                    🚶 {detourDestination.name.split('、')[0]} まで・寄り道スポット {detourWaypoints.length}件
                  </p>
                  <button onClick={() => setDetourDestination(null)} style={{
                    background: 'none', border: 'none', color: '#999', fontSize: 11, cursor: 'pointer',
                  }}>やり直す</button>
                </div>
                {(detourWaypoints.length > 0 || detourSponsorNearby) && (
                  <div style={{ display: 'flex', gap: 6, overflowX: 'auto', marginTop: 6, paddingBottom: 2 }}>
                    {detourWaypoints.map(w => (
                      <button key={w.trace.id} onClick={() => { setMapFlyToZoom(17); setMapFlyTo([w.trace.latitude, w.trace.longitude]); }} style={{
                        flexShrink: 0, padding: '5px 10px', borderRadius: 14, fontSize: 11,
                        border: '1.5px solid #38ADA9', background: '#fff', color: '#38ADA9', cursor: 'pointer', whiteSpace: 'nowrap',
                      }}>{w.trace.title}</button>
                    ))}
                    {detourSponsorNearby && (
                      <a
                        href={detourSponsorNearby.sponsor.url ?? undefined}
                        target={detourSponsorNearby.sponsor.url ? '_blank' : undefined}
                        rel="noopener noreferrer"
                        style={{
                          flexShrink: 0, padding: '5px 10px', borderRadius: 14, fontSize: 11,
                          border: '1.5px solid #F0C36D', background: '#FFF8E8', color: '#B7791F',
                          textDecoration: 'none', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 4,
                        }}
                      ><span style={{ fontWeight: 800, fontSize: 9 }}>PR</span>{detourSponsorNearby.sponsor.name}</a>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* 感情フィルター（マップ・一覧） */}
        {(tab === 'map' || tab === 'list') && emotionCounts.length > 0 && (
          <div style={{ display: 'flex', gap: 5, overflowX: 'auto', paddingBottom: 2, scrollbarWidth: 'none' }}>
            <button onClick={() => setFilterEmotion(null)} style={{
              padding: '3px 9px', borderRadius: 16, fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0,
              border: `1.5px solid ${!filterEmotion ? '#444' : '#ddd'}`,
              background: !filterEmotion ? '#444' : '#fff',
              color: !filterEmotion ? '#fff' : '#666',
            }}>すべて</button>
            {emotionCounts.map(e => (
              <button key={e.key} onClick={() => setFilterEmotion(filterEmotion === e.key ? null : e.key)} style={{
                padding: '3px 9px', borderRadius: 16, fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0,
                border: `1.5px solid ${filterEmotion === e.key ? e.color : '#ddd'}`,
                background: filterEmotion === e.key ? e.color : '#fff',
                color: filterEmotion === e.key ? '#fff' : '#666',
              }}>{e.emoji} {e.label} {e.count}</button>
            ))}
          </div>
        )}
      </header>

      {/* ── メインコンテンツ ── */}
      <main style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>

        {/* エラーバナー */}
        {fetchError && (
          <div style={{
            position: 'absolute', top: 10, left: '50%', transform: 'translateX(-50%)',
            background: '#E55039', color: '#fff', padding: '8px 16px',
            borderRadius: 20, fontSize: 13, zIndex: 500,
            display: 'flex', gap: 10, alignItems: 'center', whiteSpace: 'nowrap',
          }}>
            ⚠ {fetchError}
            <button onClick={fetchTraces} style={{
              background: 'rgba(255,255,255,0.25)', border: 'none',
              color: '#fff', borderRadius: 12, padding: '3px 9px', fontSize: 12, cursor: 'pointer',
            }}>再試行</button>
          </div>
        )}

        {/* ─── マップ ─── */}
        {tab === 'map' && (
          <div style={{ height: '100%', position: 'relative' }}>
            <TraceMap
              traces={filteredForMap}
              mode={mapMode}
              center={userPos ?? undefined}
              flyTo={mapFlyTo ?? undefined}
              flyToZoom={mapFlyToZoom}
              fitBounds={
                (detourDestination && userPos)
                  ? [
                      [Math.min(userPos[0], detourDestination.pos[0]), Math.min(userPos[1], detourDestination.pos[1])],
                      [Math.max(userPos[0], detourDestination.pos[0]), Math.max(userPos[1], detourDestination.pos[1])],
                    ]
                  : mapFitBounds ?? undefined
              }
              routeLine={(detourDestination && userPos) ? [userPos, detourDestination.pos] : undefined}
              highlightIds={detourDestination ? detourWaypoints.map(w => w.trace.id) : undefined}
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
            {/* ヒートマップ凡例 */}
            {mapMode === 'heat' && filtered.length > 0 && (
              <div style={{
                position: 'absolute', bottom: 30, left: 10, zIndex: 500,
                background: 'rgba(255,255,255,0.93)', borderRadius: 10,
                padding: '8px 12px', boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
              }}>
                {EMOTIONS.filter(e => filtered.some(t => t.emotion_key === e.key)).map(e => (
                  <div key={e.key} style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12, lineHeight: 1.9 }}>
                    <span style={{ width: 10, height: 10, borderRadius: '50%', background: e.color, display: 'inline-block' }} />
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

        {/* ─── 投稿フォーム ─── */}
        {tab === 'post' && (
          <div style={{ height: '100%', overflowY: 'auto', padding: '16px 16px 140px', background: '#f8f8f8' }}>

            {/* 送信完了 */}
            {submitDone && (
              <div style={{
                textAlign: 'center', padding: '60px 20px',
                fontSize: 22, fontWeight: 800, color: '#38ADA9',
              }}>
                ✓ 記録しました<br />
                <span style={{ fontSize: 13, fontWeight: 400, color: '#aaa', marginTop: 10, display: 'block' }}>
                  地図に戻ります…
                </span>
              </div>
            )}

            {!submitDone && (
              <form id="trace-form" onSubmit={handleSubmit}>

                {/* STEP 0: 何を記録する？（痕跡 or アーカイブ） */}
                <div style={{ background: '#fff', borderRadius: 14, padding: '14px', marginBottom: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                  <label style={{ ...labelStyle, fontSize: 12, color: '#aaa', fontWeight: 600, marginBottom: 8 }}>
                    何を記録する？
                  </label>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <button type="button" onClick={() => setArchiveTypeKey(null)} style={{
                      padding: '8px 12px', borderRadius: 10, fontSize: 13, cursor: 'pointer',
                      border: `2px solid ${!archiveTypeKey ? '#FF6B9D' : '#ddd'}`,
                      background: !archiveTypeKey ? '#FFF0F5' : '#fff',
                      color: !archiveTypeKey ? '#FF6B9D' : '#666',
                      fontWeight: !archiveTypeKey ? 700 : 400,
                    }}>📍 痕跡</button>
                    {ARCHIVE_TYPES.map(a => (
                      <button key={a.key} type="button"
                        onClick={() => setArchiveTypeKey(archiveTypeKey === a.key ? null : a.key)} style={{
                          padding: '8px 12px', borderRadius: 10, fontSize: 13, cursor: 'pointer',
                          border: `2px solid ${archiveTypeKey === a.key ? a.color : '#ddd'}`,
                          background: archiveTypeKey === a.key ? a.color + '18' : '#fff',
                          color: archiveTypeKey === a.key ? a.color : '#666',
                          fontWeight: archiveTypeKey === a.key ? 700 : 400,
                        }}>{a.emoji} {a.label}</button>
                    ))}
                  </div>
                  {selectedArchiveType && (
                    <p style={{ fontSize: 11, color: '#aaa', margin: '8px 0 0' }}>
                      この土地の記憶を後世に残す記録です。知っていることをそのまま書いてください。
                    </p>
                  )}
                </div>

                {/* STEP 1: 写真 */}
                <div style={{ background: '#fff', borderRadius: 14, marginBottom: 12, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                  <input ref={fileRef} type="file" accept="image/*" capture="environment"
                    style={{ display: 'none' }} onChange={handlePhoto} />
                  {photoPreview ? (
                    <div style={{ position: 'relative' }}>
                      <img src={photoPreview} alt="preview"
                        style={{ width: '100%', maxHeight: 220, objectFit: 'cover', display: 'block' }} />
                      <button type="button" onClick={() => fileRef.current?.click()} style={{
                        position: 'absolute', bottom: 10, right: 10,
                        background: 'rgba(0,0,0,0.6)', color: '#fff',
                        border: 'none', borderRadius: 8, padding: '6px 12px', fontSize: 12, cursor: 'pointer',
                      }}>撮り直す</button>
                    </div>
                  ) : (
                    <button type="button" onClick={() => fileRef.current?.click()} style={{
                      width: '100%', height: 130, border: 'none', background: '#fafafa',
                      cursor: 'pointer', display: 'flex', flexDirection: 'column',
                      alignItems: 'center', justifyContent: 'center', gap: 8,
                    }}>
                      <span style={{ fontSize: 36 }}>📷</span>
                      <span style={{ fontSize: 14, color: '#bbb' }}>タップして写真を撮る</span>
                    </button>
                  )}
                </div>

                {/* STEP 2: タイトル（必須） */}
                <div style={{ background: '#fff', borderRadius: 14, padding: '14px 14px', marginBottom: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                  <label style={{ ...labelStyle, fontSize: 12, color: '#aaa', fontWeight: 600, marginBottom: 6 }}>
                    {selectedArchiveType ? selectedArchiveType.titleLabel : '何を見つけた？'} <span style={{ color: '#FF6B9D' }}>*</span>
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                    placeholder={selectedArchiveType ? selectedArchiveType.titlePlaceholder : '例：修理された木の椅子、古い看板…'}
                    style={{ ...inputStyle, fontSize: 16, fontWeight: 600, border: '2px solid ' + (title.trim() ? '#38ADA9' : '#eee') }}
                    required
                  />
                </div>

                {/* STEP 3a: アーカイブの詳細（タイプ別） */}
                {selectedArchiveType && (
                  <div style={{ background: '#fff', borderRadius: 14, padding: '14px', marginBottom: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {archiveTypeKey === 'chimei' && (
                      <>
                        <div>
                          <label style={{ ...labelStyle, fontSize: 12, color: '#aaa', fontWeight: 600 }}>よみ（ひらがな）</label>
                          <input type="text" value={yomi} onChange={e => setYomi(e.target.value)}
                            placeholder="例：どんどやきば" style={inputStyle} />
                        </div>
                        <div>
                          <label style={{ ...labelStyle, fontSize: 12, color: '#aaa', fontWeight: 600 }}>別名・旧称（カンマ区切り）</label>
                          <input type="text" value={altNames} onChange={e => setAltNames(e.target.value)}
                            placeholder="例：才の神焼き場、どんどん場" style={inputStyle} />
                        </div>
                      </>
                    )}

                    <div>
                      <label style={{ ...labelStyle, fontSize: 12, color: '#aaa', fontWeight: 600 }}>
                        {selectedArchiveType.bodyLabel}
                      </label>
                      <textarea value={why} onChange={e => setWhy(e.target.value)}
                        placeholder={selectedArchiveType.bodyPlaceholder}
                        rows={archiveTypeKey === 'denshou' || archiveTypeKey === 'koe' ? 4 : 2} style={inputStyle} />
                    </div>

                    {(archiveTypeKey === 'denshou' || archiveTypeKey === 'koe') && (
                      <div>
                        <label style={{ ...labelStyle, fontSize: 12, color: '#aaa', fontWeight: 600 }}>🎙️ 音声で残す（任意）</label>
                        <AudioRecorder value={audioBlob} onChange={setAudioBlob} />
                        <p style={{ fontSize: 11, color: '#bbb', margin: '6px 0 0' }}>
                          話し言葉のまま残すと、文字にならないニュアンスも伝わります
                        </p>
                      </div>
                    )}

                    {archiveTypeKey === 'bunken' && (
                      <div>
                        <label style={{ ...labelStyle, fontSize: 12, color: '#aaa', fontWeight: 600 }}>出典・URL</label>
                        <input type="text" value={sourceRef} onChange={e => setSourceRef(e.target.value)}
                          placeholder="例：〇〇村誌 p.123 / https://…" style={inputStyle} />
                      </div>
                    )}

                    {archiveTypeKey === 'koe' && (
                      <div>
                        <label style={{ ...labelStyle, fontSize: 12, color: '#aaa', fontWeight: 600 }}>この土地との関係</label>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          {VOICE_RELATIONS.map(r => (
                            <button key={r.key} type="button"
                              onClick={() => setVoiceRelation(voiceRelation === r.key ? null : r.key)} style={{
                                padding: '6px 11px', borderRadius: 20, fontSize: 13, cursor: 'pointer',
                                border: `1.5px solid ${voiceRelation === r.key ? selectedArchiveType.color : '#ddd'}`,
                                background: voiceRelation === r.key ? selectedArchiveType.color : '#fff',
                                color: voiceRelation === r.key ? '#fff' : '#666',
                              }}>{r.label}</button>
                          ))}
                        </div>
                      </div>
                    )}

                    {archiveTypeKey !== 'koe' && (
                      <div>
                        <label style={{ ...labelStyle, fontSize: 12, color: '#aaa', fontWeight: 600 }}>時代・年代（わかれば）</label>
                        <input type="text" value={eraLabel} onChange={e => setEraLabel(e.target.value)}
                          placeholder="例：昭和40年代まで、明治期、江戸末期…" style={inputStyle} />
                      </div>
                    )}
                    {archiveTypeKey === 'koe' && (
                      <div>
                        <label style={{ ...labelStyle, fontSize: 12, color: '#aaa', fontWeight: 600 }}>いつ頃の話？（わかれば）</label>
                        <input type="text" value={eraLabel} onChange={e => setEraLabel(e.target.value)}
                          placeholder="例：1960年代、戦後すぐ…" style={inputStyle} />
                      </div>
                    )}
                  </div>
                )}

                {/* STEP 3: 感情（痕跡のみ） */}
                {!selectedArchiveType && (
                  <div style={{ background: '#fff', borderRadius: 14, padding: '14px', marginBottom: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                    <label style={{ ...labelStyle, fontSize: 12, color: '#aaa', fontWeight: 600, marginBottom: 8 }}>
                      なにを感じた？
                    </label>
                    <EmotionPicker value={emotionKey} onChange={setEmotionKey} />
                  </div>
                )}

                {/* STEP 4: 位置（必須） */}
                <div style={{ background: '#fff', borderRadius: 14, padding: '14px', marginBottom: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                  <label style={{ ...labelStyle, fontSize: 12, color: '#aaa', fontWeight: 600, marginBottom: 8 }}>
                    {selectedArchiveType ? 'その場所はどこ？' : 'いまいる場所'} <span style={{ color: '#FF6B9D' }}>*</span>
                  </label>

                  {/* 地図をタップして記録（メインの記録方法） */}
                  <div style={{ height: 200, borderRadius: 10, overflow: 'hidden', marginBottom: 6 }}>
                    <LocationPickerMap
                      lat={lat ?? userPos?.[0] ?? DEFAULT_CENTER[0]}
                      lng={lng ?? userPos?.[1] ?? DEFAULT_CENTER[1]}
                      onChange={(la, ln) => { setLat(la); setLng(ln); }}
                    />
                  </div>
                  <p style={{ fontSize: 11, color: '#999', margin: '0 0 8px' }}>
                    {lat ? 'タップしてピンの位置を調整できます' : '☝️ 地図をタップして場所を選んでください'}
                  </p>

                  {lat && (
                    <p style={{ fontSize: 11, color: '#aaa', margin: '0 0 8px', display: 'flex', justifyContent: 'space-between' } as React.CSSProperties}>
                      <span>✓ {lat.toFixed(5)}, {lng!.toFixed(5)}</span>
                      <button type="button" onClick={() => { setLat(null); setLng(null); }}
                        style={{ background: 'none', border: 'none', color: '#E55039', cursor: 'pointer', fontSize: 11 }}>
                        リセット
                      </button>
                    </p>
                  )}

                  <button type="button" onClick={detectGPS} disabled={gpsLoading} style={{
                    width: '100%', padding: '11px', borderRadius: 10, marginBottom: 8,
                    border: `2px solid ${lat ? '#38ADA9' : '#4A90E2'}`,
                    background: lat ? '#E8F8F7' : '#EEF4FF',
                    color: lat ? '#38ADA9' : '#4A90E2', fontSize: 13, fontWeight: 700, cursor: 'pointer',
                  }}>
                    {gpsLoading ? '取得中…' : lat ? '✓ 現在地を再取得' : '📡 現在地を自動取得'}
                  </button>
                  {gpsError && <p style={{ color: '#E55039', fontSize: 12, margin: '0 0 8px' }}>{gpsError}</p>}

                  {/* 住所検索（任意・折りたたみ） */}
                  <button type="button" onClick={() => setShowAddressSearch(v => !v)} style={{
                    background: 'none', border: 'none', color: '#aaa', fontSize: 12, cursor: 'pointer', padding: 0,
                  }}>
                    {showAddressSearch ? '▲ 住所検索を閉じる' : '🔍 住所で検索したい場合はこちら（任意）'}
                  </button>

                  {showAddressSearch && (
                    <div style={{ marginTop: 8 }}>
                      <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                        <input
                          type="text" value={addressQuery}
                          onChange={e => setAddressQuery(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); searchAddress(); } }}
                          placeholder="地名・住所で検索"
                          style={{ ...inputStyle, flex: 1, fontSize: 13 }}
                        />
                        <button type="button" onClick={searchAddress} disabled={addressSearching} style={{
                          padding: '0 12px', borderRadius: 10, border: '1.5px solid #e0e0e0',
                          background: '#fff', color: '#555', cursor: 'pointer', fontSize: 13, whiteSpace: 'nowrap',
                        }}>{addressSearching ? '…' : '🔍'}</button>
                      </div>

                      {addressCandidates.length > 0 && (
                        <div style={{ border: '1px solid #eee', borderRadius: 10, overflow: 'hidden', marginBottom: 8 }}>
                          {addressCandidates.map((c, i) => (
                            <button key={i} type="button" onClick={() => {
                              setLat(parseFloat(c.lat)); setLng(parseFloat(c.lon));
                              setAddressQuery(c.display_name.split(',')[0]); setAddressCandidates([]);
                            }} style={{
                              width: '100%', padding: '9px 12px', background: '#fff',
                              border: 'none', borderBottom: i < addressCandidates.length - 1 ? '1px solid #f5f5f5' : 'none',
                              cursor: 'pointer', textAlign: 'left' as const, fontSize: 12, color: '#333',
                            }}>
                              📍 {c.display_name.split(',').slice(0, 3).join(', ')}
                            </button>
                          ))}
                        </div>
                      )}
                      {addressError && <p style={{ color: '#E55039', fontSize: 12, margin: '0 0 6px' }}>{addressError}</p>}
                    </div>
                  )}
                </div>

                {/* くわしく記録する トグル */}
                <button
                  type="button"
                  onClick={() => setShowAdvanced(v => !v)}
                  style={{
                    width: '100%', padding: '12px', borderRadius: 12, marginBottom: 12,
                    border: `1.5px dashed ${showAdvanced ? '#FF6B9D' : '#ddd'}`,
                    background: showAdvanced ? '#FFF0F5' : '#fafafa',
                    color: showAdvanced ? '#FF6B9D' : '#999',
                    fontSize: 13, fontWeight: 700, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  }}
                >
                  {showAdvanced ? '▲ くわしい記録を閉じる' : '＋ くわしく記録する（任意）'}
                </button>

                {/* 詳細フィールド */}
                {showAdvanced && (
                  <div style={{ background: '#fff', borderRadius: 14, padding: '16px 14px', marginBottom: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', display: 'flex', flexDirection: 'column', gap: 18 }}>

                    {/* なぜ気になった（アーカイブ投稿では本文欄が上にあるため非表示） */}
                    {!archiveTypeKey && (
                      <section>
                        <label style={labelStyle}>💬 なぜ気になった？</label>
                        <textarea value={why} onChange={e => setWhy(e.target.value)}
                          placeholder="直感でOK。うまく書かなくていい。" rows={2} style={inputStyle} />
                      </section>
                    )}

                    {/* 見えた暮らし・自分との接点 */}
                    <section>
                      <label style={labelStyle}>🔍 もっと深く</label>
                      {[
                        { label: '誰のどんな暮らし・想いが見えた？', val: interpretation, set: setInterpretation, ph: 'このものを使っていた人を想像してみる' },
                        { label: '自分のどんな記憶・感情とつながった？', val: selfReflection, set: setSelfReflection, ph: 'なぜ自分はこれに反応したのか' },
                      ].map(({ label, val, set, ph }) => (
                        <div key={label} style={{ marginBottom: 10 }}>
                          <p style={{ fontSize: 12, color: '#888', margin: '0 0 4px' }}>{label}</p>
                          <textarea value={val} onChange={e => set(e.target.value)} placeholder={ph} rows={2} style={inputStyle} />
                        </div>
                      ))}
                    </section>

                    {/* 強度 */}
                    <section>
                      <label style={labelStyle}>💫 どのくらい強く感じた？</label>
                      <IntensityPicker value={intensity} onChange={setIntensity} />
                    </section>

                    {/* カテゴリ */}
                    <section>
                      <label style={labelStyle}>🏷 何の種類？</label>
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

                    {/* 人・もの・こと */}
                    <section>
                      <label style={labelStyle}>👤 人・もの・こと？</label>
                      <div style={{ display: 'flex', gap: 6 }}>
                        {TRACE_TYPES.map(t => (
                          <button key={t.key} type="button"
                            onClick={() => setTraceTypeKey(traceTypeKey === t.key ? null : t.key)} style={{
                              flex: 1, padding: '10px 6px', borderRadius: 10, fontSize: 13, cursor: 'pointer',
                              border: `2px solid ${traceTypeKey === t.key ? t.color : '#ddd'}`,
                              background: traceTypeKey === t.key ? t.color + '18' : '#fff',
                              color: traceTypeKey === t.key ? t.color : '#666',
                              fontWeight: traceTypeKey === t.key ? 700 : 400,
                            }}>
                            {t.emoji} {t.label}
                          </button>
                        ))}
                      </div>
                    </section>

                    {/* 過去の記憶 */}
                    <section>
                      <button type="button" onClick={() => setIsPastMemory(v => !v)} style={{
                        width: '100%', padding: '12px', borderRadius: 10, cursor: 'pointer',
                        border: `2px solid ${isPastMemory ? '#F6B93B' : '#ddd'}`,
                        background: isPastMemory ? '#FFFBF0' : '#fff',
                        color: isPastMemory ? '#856404' : '#aaa', fontWeight: isPastMemory ? 700 : 400, fontSize: 14,
                      }}>
                        {isPastMemory ? '🕰 過去の記憶として登録する' : '📍 今の記録として登録する'}
                      </button>
                      {isPastMemory && (
                        <input type="date" value={memoryDate} onChange={e => setMemoryDate(e.target.value)}
                          style={{ ...inputStyle, marginTop: 8, fontSize: 14 }} />
                      )}
                    </section>

                    {/* タグ */}
                    <section>
                      <label style={labelStyle}>🏷️ タグ（自由入力）</label>
                      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 6 }}>
                        {customTags.map(tag => (
                          <span key={tag} style={{
                            padding: '4px 10px', borderRadius: 20, fontSize: 12,
                            background: '#f0f0f0', color: '#444',
                            display: 'flex', alignItems: 'center', gap: 4,
                          }}>
                            #{tag}
                            <button type="button" onClick={() => setCustomTags(tags => tags.filter(t => t !== tag))}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, color: '#aaa', padding: 0 }}>×</button>
                          </span>
                        ))}
                      </div>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <input type="text" value={tagInput} onChange={e => setTagInput(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') { e.preventDefault(); const t = tagInput.trim(); if (t && !customTags.includes(t)) setCustomTags(tags => [...tags, t]); setTagInput(''); }
                          }}
                          placeholder="例: 木造り、昭和…" style={{ ...inputStyle, flex: 1, fontSize: 13 }} />
                        <button type="button" onClick={() => { const t = tagInput.trim(); if (t && !customTags.includes(t)) setCustomTags(tags => [...tags, t]); setTagInput(''); }} style={{
                          padding: '0 12px', borderRadius: 10, border: '1.5px solid #ddd', background: '#fff', cursor: 'pointer', fontSize: 13, whiteSpace: 'nowrap',
                        }}>追加</button>
                      </div>
                    </section>

                    {/* また来たい・話したい */}
                    <section>
                      <div style={{ display: 'flex', gap: 10 }}>
                        {([
                          { label: '🔁 また来たい', val: wantRevisit, toggle: () => setWantRevisit(!wantRevisit) },
                          { label: '🗣 誰かに話したい', val: wantToShare, toggle: () => setWantToShare(!wantToShare) },
                        ] as { label: string; val: boolean; toggle: () => void }[]).map(({ label, val, toggle }) => (
                          <button key={label} type="button" onClick={toggle} style={{
                            flex: 1, padding: '11px 6px', borderRadius: 10, fontSize: 13,
                            border: `2px solid ${val ? '#38ADA9' : '#ddd'}`,
                            background: val ? '#E8F8F7' : '#fff', color: val ? '#38ADA9' : '#aaa',
                            fontWeight: val ? 700 : 400, cursor: 'pointer',
                          }}>{label}</button>
                        ))}
                      </div>
                    </section>

                    {/* ニックネーム + 実験回コード */}
                    <section>
                      <label style={labelStyle}>👤 ニックネーム（任意）</label>
                      <input type="text" value={nickname} onChange={e => setNickname(e.target.value)}
                        placeholder="匿名でもOK" style={inputStyle} />
                    </section>

                    <section style={{ padding: '10px', background: '#F8F9FA', borderRadius: 10, marginBottom: 0 }}>
                      <label style={{ ...labelStyle, fontSize: 12, color: '#888', marginBottom: 4 }}>🔖 実験回コード（グループ共通）</label>
                      <input type="text" value={sessionCode} onChange={e => saveSessionCode(e.target.value)}
                        placeholder="例: yanaka-20260701" style={{ ...inputStyle, fontSize: 13, background: '#fff' }} />
                    </section>
                  </div>
                )}
              </form>
            )}
          </div>
        )}

        {/* ─── 一覧 ─── */}
        {tab === 'list' && (
          <div style={{ height: '100%', overflowY: 'auto', padding: '12px 12px 80px', background: '#f8f8f8' }}>

            {/* 統計パネル */}
            <StatsPanel traces={filtered} sessionCode={sessionCode || undefined} />

            {/* マイ感情プロフィール */}
            {myProfile.length > 0 && (
              <div style={{
                background: '#FFF8FC', border: '1.5px solid #FFD6E7',
                borderRadius: 12, padding: '12px 14px', marginBottom: 14,
              }}>
                <p style={{ margin: '0 0 7px', fontSize: 12, fontWeight: 700, color: '#FF6B9D' }}>✨ あなたの感情プロフィール</p>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {myProfile.map((e, i) => (
                    <span key={e.key} style={{
                      padding: '4px 10px', borderRadius: 20, fontSize: 12,
                      background: i === 0 ? e.color : e.color + '33',
                      color: i === 0 ? '#fff' : e.color, fontWeight: i === 0 ? 700 : 400,
                    }}>{e.emoji} {e.label} {e.count}回</span>
                  ))}
                </div>
              </div>
            )}

            {/* カテゴリフィルター */}
            {traces.some(t => t.category) && (
              <div style={{ display: 'flex', gap: 5, overflowX: 'auto', marginBottom: 10, paddingBottom: 2, scrollbarWidth: 'none' }}>
                <button onClick={() => setFilterCategory(null)} style={{
                  padding: '3px 9px', borderRadius: 16, fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0,
                  border: `1.5px solid ${!filterCategory ? '#444' : '#ddd'}`,
                  background: !filterCategory ? '#444' : '#fff', color: !filterCategory ? '#fff' : '#666',
                }}>すべて</button>
                {CATEGORIES.filter(c => traces.some(t => t.category === c.key)).map(c => (
                  <button key={c.key} onClick={() => setFilterCategory(filterCategory === c.key ? null : c.key)} style={{
                    padding: '3px 9px', borderRadius: 16, fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0,
                    border: `1.5px solid ${filterCategory === c.key ? '#555' : '#ddd'}`,
                    background: filterCategory === c.key ? '#555' : '#fff', color: filterCategory === c.key ? '#fff' : '#666',
                  }}>{c.emoji} {c.label}</button>
                ))}
              </div>
            )}

            {/* 実験回コード絞り込み */}
            <input
              placeholder="🔖 実験回コードで絞り込み（例: yanaka-20260701）"
              value={sessionCode}
              onChange={e => saveSessionCode(e.target.value)}
              style={{ ...inputStyle, fontSize: 13, marginBottom: 12 }}
            />

            {/* ルート作成モードの案内 */}
            {routeMode && (
              <div style={{
                background: '#F3EAFB', border: '1.5px solid #8E44AD33', borderRadius: 12,
                padding: '10px 14px', marginBottom: 12, fontSize: 12, color: '#8E44AD',
              }}>
                🥾 歩いた順にカードをタップして選んでください（{routeSelection.length}件選択中、2件以上必要）
              </div>
            )}

            {/* カード一覧 */}
            {loading ? (
              <p style={{ color: '#aaa', textAlign: 'center', marginTop: 40 }}>読み込み中…</p>
            ) : sorted.length === 0 ? (
              <div style={{ textAlign: 'center', marginTop: 50, color: '#bbb' }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>🗺</div>
                <p style={{ fontSize: 14, margin: 0 }}>
                  {sessionCode ? `「${sessionCode}」の記録はまだありません` : 'まだ記録がありません'}
                </p>
                <p style={{ fontSize: 12, marginTop: 6 }}>まちを歩いて最初の痕跡を記録しましょう</p>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 10 }}>
                {sorted.map(t => {
                  const selectedIndex = routeSelection.indexOf(t.id);
                  return (
                    <div key={t.id} style={{ position: 'relative' }}>
                      <TraceCard
                        trace={t}
                        userPos={userPos}
                        onClick={() => routeMode ? toggleRouteSelection(t.id) : setSelectedTrace(t)}
                        onShowOnMap={routeMode ? undefined : handleShowOnMap}
                      />
                      {routeMode && (
                        <div style={{
                          position: 'absolute', top: 8, left: 8, width: 26, height: 26, borderRadius: 13,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          background: selectedIndex >= 0 ? '#8E44AD' : 'rgba(255,255,255,0.85)',
                          color: selectedIndex >= 0 ? '#fff' : '#bbb',
                          border: selectedIndex >= 0 ? 'none' : '1.5px solid #ddd',
                          fontSize: 12, fontWeight: 800, pointerEvents: 'none',
                        }}>{selectedIndex >= 0 ? selectedIndex + 1 : ''}</div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </main>

      {/* ルート保存バー */}
      {tab === 'list' && routeMode && (
        <div style={{
          position: 'fixed', bottom: 60, left: 0, right: 0, padding: '10px 14px',
          background: 'rgba(250,250,250,0.97)', backdropFilter: 'blur(10px)',
          borderTop: '1px solid #eee', zIndex: 200, display: 'flex', flexDirection: 'column', gap: 8,
        }}>
          <input
            value={routeTitle}
            onChange={e => setRouteTitle(e.target.value)}
            placeholder="ルート名（例：谷中の路地を歩く道）"
            style={{ padding: '9px 12px', borderRadius: 8, border: '1.5px solid #ddd', fontSize: 13 }}
          />
          <input
            value={routeNickname}
            onChange={e => setRouteNickname(e.target.value)}
            placeholder="ニックネーム（削除・編集時の確認用、任意）"
            style={{ padding: '9px 12px', borderRadius: 8, border: '1.5px solid #ddd', fontSize: 13 }}
          />
          {routeSaveError && <p style={{ color: '#E55039', fontSize: 12, margin: 0 }}>{routeSaveError}</p>}
          <button
            onClick={saveRoute}
            disabled={!routeTitle.trim() || routeSelection.length < 2 || routeSaving}
            style={{
              padding: '12px', borderRadius: 10, border: 'none',
              background: (!routeTitle.trim() || routeSelection.length < 2 || routeSaving) ? '#e0e0e0' : '#8E44AD',
              color: '#fff', fontWeight: 800, fontSize: 14,
              cursor: (!routeTitle.trim() || routeSelection.length < 2 || routeSaving) ? 'not-allowed' : 'pointer',
            }}
          >{routeSaving ? '保存中…' : `このルートを保存する（${routeSelection.length}件）`}</button>
        </div>
      )}

      {/* 記録するボタン */}
      {tab === 'post' && !submitDone && (
        <div style={{
          position: 'fixed', bottom: 60, left: 0, right: 0, padding: '8px 14px',
          background: 'rgba(250,250,250,0.96)', backdropFilter: 'blur(10px)',
          borderTop: '1px solid #eee', zIndex: 200,
        }}>
          {currentUser && (
            <div style={{ display: 'flex', gap: 5, marginBottom: 6 }}>
              {([
                { key: 'private', label: '🔒 非公開' },
                { key: 'followers', label: '👥 フォロワー限定' },
                { key: 'pending_review', label: '🌏 全国公開を申請' },
              ] as const).map(v => (
                <button key={v.key} type="button" onClick={() => setPostVisibility(v.key)} style={{
                  flex: 1, padding: '6px 4px', borderRadius: 8, fontSize: 11, cursor: 'pointer',
                  border: `1.5px solid ${postVisibility === v.key ? '#38ADA9' : '#ddd'}`,
                  background: postVisibility === v.key ? '#E8F8F7' : '#fff',
                  color: postVisibility === v.key ? '#38ADA9' : '#888',
                  fontWeight: postVisibility === v.key ? 700 : 400,
                }}>{v.label}</button>
              ))}
            </div>
          )}
          {submitError && (
            <p style={{ color: '#E55039', fontSize: 12, margin: '0 0 6px', textAlign: 'center' }}>{submitError}</p>
          )}
          <button type="submit" form="trace-form" disabled={!canSubmit} style={{
            width: '100%', padding: '15px',
            background: canSubmit
              ? `linear-gradient(135deg, #FF6B9D, #FF8C42)`
              : '#e0e0e0',
            color: '#fff', border: 'none', borderRadius: 12,
            fontSize: 16, fontWeight: 800,
            cursor: canSubmit ? 'pointer' : 'not-allowed',
            boxShadow: canSubmit ? '0 4px 15px rgba(255,107,157,0.35)' : 'none',
            transition: 'all 0.2s',
          }}>
            {uploadProgress || (submitting ? '記録中…' : '記録する →')}
          </button>
        </div>
      )}

      {/* ── ボトムナビ ── */}
      <nav style={{
        display: 'flex', borderTop: '1px solid #eee',
        background: '#fff', flexShrink: 0, zIndex: 300,
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}>
        {([
          { id: 'map', icon: '🗺', label: 'マップ' },
          { id: 'post', icon: '✚', label: '記録する' },
          { id: 'list', icon: '📋', label: '一覧' },
        ] as { id: Tab; icon: string; label: string }[]).map(({ id, icon, label }) => (
          <button key={id} onClick={() => setTab(id)} style={{
            flex: 1, padding: '10px 4px 8px',
            background: 'none', border: 'none', cursor: 'pointer',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
            color: tab === id ? '#FF6B9D' : '#999', fontWeight: tab === id ? 700 : 400,
            borderTop: `2.5px solid ${tab === id ? '#FF6B9D' : 'transparent'}`,
            transition: 'color 0.15s',
          }}>
            <span style={{ fontSize: id === 'post' ? 22 : 20 }}>{icon}</span>
            <span style={{ fontSize: 11 }}>{label}</span>
          </button>
        ))}
      </nav>

      {/* ── モーダル ── */}
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
