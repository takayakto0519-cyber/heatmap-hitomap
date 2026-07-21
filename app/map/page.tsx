'use client';

import { useEffect, useState, useRef, useCallback, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import type { Trace, ListTracesResponse, CreateTraceResponse, Sponsor, ListSponsorsResponse } from '@/lib/types';
import { EMOTIONS, getEmotion } from '@/lib/emotions';
import { CATEGORIES } from '@/lib/categories';
import { TRACE_TYPES } from '@/lib/traceTypes';
import { ARCHIVE_TYPES, getArchiveType, VOICE_RELATIONS } from '@/lib/archiveTypes';
import { haversine } from '@/lib/geo';
import { colors, shadows } from '@/lib/theme';
import EmotionPicker from '@/components/form/EmotionPicker';
import AudioRecorder from '@/components/form/AudioRecorder';
import TraceCard from '@/components/report/TraceCard';
import TraceDetail from '@/components/TraceDetail';
import QuickAddSheet from '@/components/QuickAddSheet';
import StatsPanel from '@/components/list/StatsPanel';
import Onboarding from '@/components/Onboarding';
import BottomNav from '@/components/BottomNav';
import { PinIcon, FlameIcon, SearchIcon, WalkIcon, CompassIcon, TrailIcon, ClockIcon } from '@/components/icons';
import { ARCHIVE_TYPE_ICONS } from '@/components/report/tagIcons';
import type { Quest } from '@/lib/quests';

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

// 昔の思い出は「正確な日付」までは思い出せないことが多い（特にご年配の方）。
// 年＋季節のだいたいの記憶から、DB保存用のISO日付に変換する。
const MEMORY_YEARS = Array.from({ length: new Date().getFullYear() - 1925 + 1 }, (_, i) => new Date().getFullYear() - i);
const MEMORY_SEASONS: { key: string; label: string; month: string }[] = [
  { key: '', label: 'わからない', month: '01' },
  { key: 'spring', label: '春ごろ', month: '03' },
  { key: 'summer', label: '夏ごろ', month: '06' },
  { key: 'autumn', label: '秋ごろ', month: '09' },
  { key: 'winter', label: '冬ごろ', month: '12' },
];
function memoryDateFromYearSeason(year: string, season: string): string {
  const month = MEMORY_SEASONS.find((s) => s.key === season)?.month ?? '01';
  return `${year}-${month}-01`;
}

const mapLoadingStyle: React.CSSProperties = {
  height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
  background: '#FAF9F6', color: '#8C8579', fontSize: 14,
};
const inputStyle: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box', padding: '11px 13px', fontSize: 15,
  border: '1.5px solid #e8e8e8', borderRadius: 10, fontFamily: 'inherit',
  resize: 'vertical' as const, outline: 'none', background: '#fff',
};
const labelStyle: React.CSSProperties = { display: 'block', fontWeight: 700, fontSize: 14, marginBottom: 6, color: '#23231F' };

// 「薄い日常」「深い想い」「時間で見る」レイヤータブ：使い勝手が悪いため一時的に非表示。
// stateとロジックは残してあるので、trueに戻せば即復活する。
const SHOW_LEGACY_LAYER_TABS = false;

export default function MapPage() {
  return (
    <Suspense fallback={<div style={mapLoadingStyle}>読み込み中…</div>}>
      <MapApp />
    </Suspense>
  );
}

function MapApp() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const regionParam = searchParams.get('region');

  // ── タブ・マップ ──────────────────────────
  const [tab, setTab] = useState<Tab>(() => {
    const t = searchParams.get('tab');
    return t === 'post' || t === 'list' ? t : 'map';
  });
  const [mapMode, setMapMode] = useState<MapMode>('pin');
  // 感情レイヤー：「薄い日常」（intensity 1-2）と「深い想い」（intensity 4-5）を層として切り替える
  const [intensityLayer, setIntensityLayer] = useState<'all' | 'light' | 'deep'>('all');
  // ヒートマップの時間スライダー：「1ヶ月前→今」のように感情の堆積が動いて見えるようにする
  const [timeSliderOn, setTimeSliderOn] = useState(false);
  const [timeSliderPct, setTimeSliderPct] = useState(100);
  // 眠っている痕跡発見：現在地の近くで開拓余地がある町を提案する
  const [unexploredOpen, setUnexploredOpen] = useState(false);
  const [unexploredLoading, setUnexploredLoading] = useState(false);
  const [unexploredResult, setUnexploredResult] = useState<{
    sparse: { region: string; count: number; distanceKm: number }[];
    blank: { region: string; distanceKm: number; direction: string }[];
  } | null>(null);
  const [userPos, setUserPos] = useState<[number, number] | null>(null);
  // GPSピンポイントの「近く」ではなく、地域単位の閲覧をデフォルトにする（下の地域自動サジェストと対）
  const [nearbyOnly, setNearbyOnly] = useState(false);
  const [filterEmotion, setFilterEmotion] = useState<string | null>(null);
  const [filterCategory, setFilterCategory] = useState<string | null>(null);
  // 'trace' = 痕跡のみ / それ以外は archive_type のキー / null = すべて
  const [filterArchive, setFilterArchive] = useState<string | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [sortOrder, setSortOrder] = useState<SortOrder>('new');
  const [mapFlyTo, setMapFlyTo] = useState<[number, number] | null>(null);
  const [mapFlyToZoom, setMapFlyToZoom] = useState<number>(17);
  const [mapFitBounds, setMapFitBounds] = useState<[[number, number], [number, number]] | null>(null);
  const hasAutoLocatedRef = useRef(false);

  // 全体マップから直接ピンを立てて投稿する導線
  const [pinDropMode, setPinDropMode] = useState(false);

  // クイック記録モード：現地では位置＋その場の感情だけ記録し、写真・言葉は後から追記する。
  // 「感情の変化を見える化する」という本来の目的のため、感情の記録は省略できない必須ステップにする
  // （位置解決→感情選択→確定の3段階。感情を選ぶまでは/api/tracesへのPOSTは発生しない）。
  type QuickRecordStage = 'idle' | 'resolving-position' | 'picking-emotion' | 'submitting';
  const [quickRecordStage, setQuickRecordStage] = useState<QuickRecordStage>('idle');
  const [quickRecordError, setQuickRecordError] = useState('');
  const [quickPendingPos, setQuickPendingPos] = useState<{ pos: [number, number]; usedFallback: boolean; usedTap: boolean } | null>(null);
  const [quickEmotionKeys, setQuickEmotionKeys] = useState<string[]>([]);
  const [quickIntensity, setQuickIntensity] = useState(3);
  // 地図をタップした場所（未指定ならGPS位置を使う）。タップ後1回のクイック記録で使い切る
  const [quickTapPos, setQuickTapPos] = useState<[number, number] | null>(null);

  // 地図タブの地域ジャンプ検索
  const [regionQuery, setRegionQuery] = useState('');
  const [regionSearching, setRegionSearching] = useState(false);
  const [regionError, setRegionError] = useState('');
  const [regionCandidates, setRegionCandidates] = useState<{ display_name: string; lat: string; lon: string; boundingbox: string[] }[]>([]);
  // regionもnearbyもない「文脈なし」の直接アクセスは、地域検索パネルをデフォルトで開いておく（全国が一気に見えるのを避けつつ、GPS「近く」を強制しない）
  const [showRegionSearch, setShowRegionSearch] = useState(() => !regionParam);
  const hasAutoSuggestedRegionRef = useRef(false);

  // ルート作成モード（一覧タブ）
  const [routeMode, setRouteMode] = useState(false);
  const [routeSelection, setRouteSelection] = useState<string[]>([]);
  const [routeTitle, setRouteTitle] = useState('');
  const [routeNickname, setRouteNickname] = useState('');
  const [routeHighlights, setRouteHighlights] = useState('');
  const [routeRecommend, setRouteRecommend] = useState(false);
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
          highlights: routeHighlights.trim() || undefined,
          is_public_recommendation: currentUser ? routeRecommend : undefined,
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
      const res = await fetch(`/api/geocode/search?q=${encodeURIComponent(detourQuery)}`).then(r => r.json());
      if (!res.ok) throw new Error(res.error);
      const results = res.candidates as { display_name: string; lat: string; lon: string }[];
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
  const [openInEditMode, setOpenInEditMode] = useState(false);
  // クイック記録の直後に出す、感情・写真の1タップ追記シート
  const [quickAddTrace, setQuickAddTrace] = useState<Trace | null>(null);
  // クイック記録直後、立ち止まらず見られる軽い確認（タップした時だけ詳細シートを開く）
  const [quickToast, setQuickToast] = useState<Trace | null>(null);
  const [quickToastUsedFallback, setQuickToastUsedFallback] = useState(false);
  const quickToastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── ユーザー設定 ─────────────────────────
  const [myTraceIds, setMyTraceIds] = useState<string[]>([]);
  const [myEmotions, setMyEmotions] = useState<string[]>([]);

  // ── 投稿フォーム ─────────────────────────
  const fileRef = useRef<HTMLInputElement>(null);
  const MAX_PHOTOS = 4;
  const [photos, setPhotos] = useState<{ file: File; preview: string }[]>([]);
  const videoRef = useRef<HTMLInputElement>(null);
  const [video, setVideo] = useState<{ file: File; preview: string } | null>(null);
  const [videoError, setVideoError] = useState('');
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
  const [audioTranscript, setAudioTranscript] = useState('');
  const [currentQuest, setCurrentQuest] = useState<Quest & { quest_type?: string; target_emotion_key?: string | null } | null>(null);
  const [questDismissed, setQuestDismissed] = useState(false);

  useEffect(() => {
    fetch('/api/quests/active')
      .then(r => r.json())
      .then(d => { if (d.ok) setCurrentQuest(d.quest); })
      .catch(() => {});
  }, []);
  const [emotionKeys, setEmotionKeys] = useState<string[]>([]);
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
  const [team, setTeam] = useState('');
  const [companionTag, setCompanionTag] = useState('');
  const [traceTypeKey, setTraceTypeKey] = useState<string | null>(null);
  const [isPastMemory, setIsPastMemory] = useState(false);
  const [memoryYear, setMemoryYear] = useState('');
  const [memorySeason, setMemorySeason] = useState('');
  const [customTags, setCustomTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');
  const [submitError, setSubmitError] = useState('');
  const [submitDone, setSubmitDone] = useState(false);
  const [lastPostedTrace, setLastPostedTrace] = useState<{ id: string; title: string; visibility: string } | null>(null);
  const submitDoneTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const postedPosRef = useRef<{ lat: number | null; lng: number | null }>({ lat: null, lng: null });
  const [currentUser, setCurrentUser] = useState<{ id: string; email?: string } | null>(null);
  const [currentProfile, setCurrentProfile] = useState<{ username: string; display_name: string | null; avatar_url: string | null } | null>(null);
  const [postVisibility, setPostVisibility] = useState<'private' | 'followers' | 'pending_review'>('private');

  // ログイン済みだがプロフィール未作成の場合に、その場でユーザー名を設定してもらう
  const [usernameSetupOpen, setUsernameSetupOpen] = useState(false);
  const [usernameSetupValue, setUsernameSetupValue] = useState('');
  const [usernameSetupError, setUsernameSetupError] = useState('');
  const [usernameSetupBusy, setUsernameSetupBusy] = useState(false);

  useEffect(() => {
    fetch('/api/profile').then(r => r.json()).then(d => {
      setCurrentUser(d.user ?? null);
      setCurrentProfile(d.profile ?? null);
    }).catch(() => {});
  }, []);

  async function submitUsernameSetup() {
    if (!usernameSetupValue.trim()) { setUsernameSetupError('ユーザー名を入力してください'); return; }
    setUsernameSetupBusy(true);
    setUsernameSetupError('');
    try {
      const res = await fetch('/api/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: usernameSetupValue.trim() }),
      });
      const data = await res.json();
      if (data.ok) {
        setCurrentProfile(data.profile);
        setUsernameSetupOpen(false);
      } else {
        setUsernameSetupError(data.error ?? 'ユーザー名の設定に失敗しました');
      }
    } finally {
      setUsernameSetupBusy(false);
    }
  }

  // すれ違い通知：ログイン中のみ、未読件数をベルアイコンに出す
  interface AppNotification {
    id: string; type: string; trace_id: string | null; actor_trace_id: string | null;
    message: string; is_read: boolean; created_at: string;
  }
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNotifPanel, setShowNotifPanel] = useState(false);
  const [dmUnreadCount, setDmUnreadCount] = useState(0);

  const fetchNotifications = useCallback(() => {
    fetch('/api/notifications').then(r => r.json()).then(d => {
      if (d.ok) { setNotifications(d.notifications ?? []); setUnreadCount(d.unreadCount ?? 0); }
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!currentUser) return;
    fetchNotifications();
    fetch('/api/messages').then(r => r.json()).then(d => {
      if (d.ok) setDmUnreadCount((d.conversations ?? []).reduce((sum: number, c: { unreadCount: number }) => sum + c.unreadCount, 0));
    }).catch(() => {});
  }, [currentUser, fetchNotifications]);

  async function openNotifPanel() {
    setShowNotifPanel(v => !v);
    if (!showNotifPanel && unreadCount > 0) {
      await fetch('/api/notifications', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ all: true }),
      });
      setUnreadCount(0);
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    }
  }

  // ── 初期化 ──────────────────────────────
  useEffect(() => {
    try {
      setSessionCode(localStorage.getItem('hitomap_session_code') || '');
      const ids = JSON.parse(localStorage.getItem('hitomap_my_traces') || '[]');
      setMyTraceIds(Array.isArray(ids) ? ids : []);
      const emo = JSON.parse(localStorage.getItem('hitomap_my_emotions') || '[]');
      setMyEmotions(Array.isArray(emo) ? emo : []);
    } catch { /* ignore */ }
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

  // regionパラメータなしの初回アクセス時、現在地からおおまかな地域名をサジェストする（近くの投稿に絞り込むのではなく、地域を選んでもらう導線）
  useEffect(() => {
    if (!showRegionSearch || regionParam || hasAutoSuggestedRegionRef.current || !userPos) return;
    hasAutoSuggestedRegionRef.current = true;
    (async () => {
      try {
        const res = await fetch(`/api/geocode/reverse?lat=${userPos[0]}&lon=${userPos[1]}`).then(r => r.json());
        if (!res.ok) return;
        const addr = res.result?.address ?? {};
        const suggestion = addr.city || addr.town || addr.county || addr.state;
        if (suggestion) setRegionQuery(suggestion);
      } catch { /* サイレント失敗：手動検索で代替できる */ }
    })();
  }, [showRegionSearch, regionParam, userPos]);

  async function searchRegion() {
    if (!regionQuery.trim()) return;
    setRegionSearching(true);
    setRegionError('');
    setRegionCandidates([]);
    try {
      const res = await fetch(`/api/geocode/search?q=${encodeURIComponent(regionQuery)}`).then(r => r.json());
      if (!res.ok) throw new Error(res.error);
      const results = res.candidates as { display_name: string; lat: string; lon: string; boundingbox: string[] }[];
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
    // そのイベントで前に使ったチーム名があれば呼び出し、参加のたびに入力しなくて済むようにする
    if (code.trim()) {
      const savedTeam = localStorage.getItem(`hitomap_team_${code.trim()}`);
      if (savedTeam) setTeam(savedTeam);
    }
  }

  function saveTeam(code: string, teamName: string) {
    setTeam(teamName);
    if (code.trim() && teamName.trim()) {
      localStorage.setItem(`hitomap_team_${code.trim()}`, teamName.trim());
    }
  }

  // ?region= 付きで開いた場合、その自治体の範囲に自動でfitBoundsする
  useEffect(() => {
    if (!regionParam) return;
    (async () => {
      try {
        const res = await fetch(`/api/geocode/search?q=${encodeURIComponent(regionParam)}&limit=1`).then(r => r.json());
        if (!res.ok) return;
        const results = res.candidates as { boundingbox: string[] }[];
        if (results[0]) {
          const [south, north, west, east] = results[0].boundingbox.map(Number);
          setMapFitBounds([[south, west], [north, east]]);
        }
      } catch { /* 失敗しても地図自体は表示できるので無視 */ }
    })();
  }, [regionParam]);

  // PWAのホーム画面ショートカット（/map?quick=1）から起動された場合、開いた瞬間にクイック記録を1回だけ実行する
  // イベント参加リンク（/map?session_code=xxx&team=yyy）から開かれた場合、実験回コード・チーム名を自動でセットする
  // （そのまま &quick=1 を付ければ、開いた瞬間にクイック記録まで済ませられる）
  const joinAutoTriggeredRef = useRef(false);
  useEffect(() => {
    const joinCode = searchParams.get('session_code');
    const joinTeam = searchParams.get('team');
    if ((!joinCode && !joinTeam) || joinAutoTriggeredRef.current) return;
    joinAutoTriggeredRef.current = true;
    if (joinCode) saveSessionCode(joinCode);
    if (joinCode && joinTeam) saveTeam(joinCode, joinTeam);
    router.replace('/map');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const quickAutoTriggeredRef = useRef(false);
  useEffect(() => {
    if (searchParams.get('quick') !== '1' || quickAutoTriggeredRef.current) return;
    quickAutoTriggeredRef.current = true;
    setTab('map');
    beginQuickRecord();
    router.replace('/map');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

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

  // 共感ヒート：表示中の痕跡の反応数をまとめて取得し、ピンの色濃度・サイズに反映する
  const [reactionCounts, setReactionCounts] = useState<Record<string, number>>({});
  useEffect(() => {
    if (traces.length === 0) return;
    const ids = traces.map(t => t.id).join(',');
    fetch(`/api/reactions?trace_ids=${ids}`)
      .then(r => r.json())
      .then(d => {
        if (!d.ok) return;
        const totals: Record<string, number> = {};
        for (const [traceId, byType] of Object.entries(d.counts ?? {}) as [string, Record<string, number>][]) {
          totals[traceId] = Object.values(byType).reduce((sum, n) => sum + n, 0);
        }
        setReactionCounts(totals);
      })
      .catch(() => {});
  }, [traces]);

  // 誰の痕跡かひと目で分かるよう、投稿者のアイコンをまとめて取得する
  const [avatarUrls, setAvatarUrls] = useState<Record<string, string>>({});
  useEffect(() => {
    const userIds = [...new Set(traces.map(t => t.user_id).filter((id): id is string => Boolean(id)))];
    if (userIds.length === 0) return;
    fetch(`/api/profiles/avatars?ids=${userIds.join(',')}`)
      .then(r => r.json())
      .then(d => { if (d.ok) setAvatarUrls(d.avatars ?? {}); })
      .catch(() => {});
  }, [traces]);

  // 書きかけの記録：自分のクイック記録で、感情も写真もまだ足せていないもの
  // 本仕様変更後は新規クイック記録には発生しない想定（感情選択がPOST前の必須ステップになったため）。
  // ここは仕様変更前に作られた過去分の救済用として残す。
  const unfinishedOwn = traces.filter(t =>
    myTraceIds.includes(t.id) && !t.archive_type && !t.emotion_key && !t.photo_url
  );

  // 時間スライダー：投稿の created_at の範囲を0〜100%のつまみに割り当て、選んだ時点までの投稿だけを見せる
  const traceTimes = traces.map(t => new Date(t.created_at).getTime());
  const timeMin = traceTimes.length > 0 ? Math.min(...traceTimes) : 0;
  const timeMax = traceTimes.length > 0 ? Math.max(...traceTimes) : 0;
  const timeSliderCutoff = timeMin + ((timeMax - timeMin) * timeSliderPct) / 100;

  // ── フィルタ・ソート ─────────────────────
  // マップ用：感情・カテゴリ・近くのみ（セッションコードでは絞らない→全件見える）
  const filteredForMap = traces.filter(t => {
    if (regionParam && t.region !== regionParam) return false;
    if (filterArchive === 'trace' && t.archive_type) return false;
    if (filterArchive && filterArchive !== 'trace' && t.archive_type !== filterArchive) return false;
    if (filterEmotion && t.emotion_key !== filterEmotion) return false;
    if (filterCategory && t.category !== filterCategory) return false;
    if (intensityLayer !== 'all' && !t.archive_type) {
      if (t.intensity == null) return false;
      if (intensityLayer === 'light' && t.intensity > 2) return false;
      if (intensityLayer === 'deep' && t.intensity < 4) return false;
    }
    if (timeSliderOn && new Date(t.created_at).getTime() > timeSliderCutoff) return false;
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
      const res = await fetch(`/api/geocode/search?q=${encodeURIComponent(q)}`).then(r => r.json());
      if (!res.ok) throw new Error(res.error);
      const results = res.candidates as { display_name: string; lat: string; lon: string }[];
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
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    if (files.length === 0) return;
    const room = MAX_PHOTOS - photos.length;
    const accepted = files.slice(0, room);
    accepted.forEach(file => {
      const reader = new FileReader();
      reader.onload = ev => setPhotos(prev => [...prev, { file, preview: ev.target?.result as string }]);
      reader.readAsDataURL(file);
    });
  }

  function removePhoto(index: number) {
    setPhotos(prev => prev.filter((_, i) => i !== index));
  }

  const MAX_VIDEO_MB = 30;
  function handleVideo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setVideoError('');
    if (file.size > MAX_VIDEO_MB * 1024 * 1024) {
      setVideoError(`動画は${MAX_VIDEO_MB}MBまでです。短く撮り直してください`);
      return;
    }
    setVideo({ file, preview: URL.createObjectURL(file) });
  }
  function removeVideo() {
    if (video) URL.revokeObjectURL(video.preview);
    setVideo(null);
  }

  // 投稿完了画面から地図に戻る（自動タイマー・手動「続ける」ボタンの両方から呼ばれる）
  const finishSubmitPost = useCallback(() => {
    if (submitDoneTimerRef.current) { clearTimeout(submitDoneTimerRef.current); submitDoneTimerRef.current = null; }
    const { lat: postedLat, lng: postedLng } = postedPosRef.current;
    setTitle(''); setWhy(''); setInterpretation(''); setSelfReflection('');
    setPhotos([]); setVideo(null); setVideoError(''); setLat(null); setLng(null);
    setEmotionKeys([]); setIntensity(3); setWantRevisit(false); setWantToShare(false);
    setNickname(''); setCategoryKey(null); setTraceTypeKey(null);
    setIsPastMemory(false); setMemoryYear(''); setMemorySeason(''); setCustomTags([]); setTagInput('');
    setArchiveTypeKey(null); setYomi(''); setAltNames(''); setEraLabel(''); setSourceRef(''); setVoiceRelation(null);
    setAudioBlob(null); setAudioTranscript('');
    setAddressQuery(''); setAddressCandidates([]); setAddressError(''); setShowAddressSearch(false);
    setShowAdvanced(false); setSubmitDone(false); setLastPostedTrace(null);
    fetchTraces();
    if (postedLat && postedLng) { setMapFlyToZoom(17); setMapFlyTo([postedLat, postedLng]); }
    setTab('map');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchTraces]);

  // ── 投稿 ────────────────────────────────
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    // 通常の痕跡はタイトル未入力でも投稿できる（サーバー側で自動生成）。
    // アーカイブ投稿（地名・言い伝え等）は名前そのものが本体なので従来どおり必須。
    if (selectedArchiveType && !title.trim()) { setSubmitError('タイトルを入力してください'); return; }
    if (!lat || !lng) { setSubmitError('位置情報を取得してください'); return; }
    setSubmitting(true); setSubmitError('');
    try {
      let photoUrls: string[] = [];
      if (photos.length > 0) {
        if (SUPABASE_READY) {
          const { uploadTracePhoto } = await import('@/lib/supabase/upload');
          for (let i = 0; i < photos.length; i++) {
            setUploadProgress(`写真をアップロード中…（${i + 1}/${photos.length}）`);
            photoUrls.push(await uploadTracePhoto(photos[i].file));
          }
          setUploadProgress('');
        } else {
          photoUrls = photos.map(p => p.preview);
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
      let videoUrl: string | null = null;
      if (video && SUPABASE_READY) {
        setUploadProgress('動画をアップロード中…');
        const { uploadTraceVideo } = await import('@/lib/supabase/upload');
        videoUrl = await uploadTraceVideo(video.file);
        setUploadProgress('');
      }
      const res = await fetch('/api/traces', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          photo_url: photoUrls[0] ?? null, photo_urls: photoUrls.length > 0 ? photoUrls : null,
          video_url: videoUrl,
          latitude: lat, longitude: lng,
          title: title.trim() || null, // 空欄ならサーバー側で「✨ときめきの記録・7/17」形式に自動生成
          why: why.trim() || null,
          interpretation: interpretation.trim() || null,
          self_reflection: selfReflection.trim() || null,
          want_revisit: wantRevisit, want_to_share: wantToShare,
          emotion_key: archiveTypeKey ? null : (emotionKeys[0] ?? null),
          emotion_keys: archiveTypeKey ? null : (emotionKeys.length > 0 ? emotionKeys : null),
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
          audio_transcript: audioTranscript.trim() || null,
          is_past_memory: isPastMemory,
          memory_date: isPastMemory && memoryYear ? memoryDateFromYearSeason(memoryYear, memorySeason) : null,
          custom_tags: customTags.length > 0 ? customTags : null,
          session_code: sessionCode.trim() || null,
          nickname: nickname.trim() || null,
          team: team.trim() || null,
          companion_tag: companionTag.trim() || null,
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
        if (emotionKeys.length > 0) {
          const updated = [...myEmotions, ...emotionKeys];
          setMyEmotions(updated);
          localStorage.setItem('hitomap_my_emotions', JSON.stringify(updated));
        }
        // 投稿位置を先に保存（setLatで消える前に）
        postedPosRef.current = { lat, lng };
        setSubmitDone(true);
        if (data.trace) {
          setLastPostedTrace({ id: data.trace.id, title: data.trace.title, visibility: data.trace.visibility });
        }
        submitDoneTimerRef.current = setTimeout(finishSubmitPost, 4000);
      } else {
        setSubmitError(data.error ?? '送信に失敗しました');
      }
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : '送信に失敗しました');
    } finally { setSubmitting(false); }
  }

  // 位置情報が使えない／許可されていない場合のフォールバック中心地点：
  // 地域検索で絞り込み済みならその範囲の中心、それも無ければ東京駅周辺にしておく
  // （クイック記録・ここに記録するを、位置情報オフでも必ず完了できるようにするため）。
  function fallbackCenter(): [number, number] {
    if (mapFitBounds) {
      const [[south, west], [north, east]] = mapFitBounds;
      return [(south + north) / 2, (west + east) / 2];
    }
    return DEFAULT_CENTER;
  }

  // クイック記録 第1段階：位置だけを先に解決する。ここではまだ何も送信しない
  // （感情を選ぶまで/api/tracesへのPOSTを発生させないことで、「ピンだけ」の記録が生まれないようにする）。
  async function beginQuickRecord() {
    setQuickRecordError('');
    setQuickRecordStage('resolving-position');
    try {
      let usedFallback = false;
      const usedTap = quickTapPos !== null;
      const pos = quickTapPos ?? userPos ?? await new Promise<[number, number]>((resolve) => {
        if (!navigator.geolocation) { usedFallback = true; resolve(fallbackCenter()); return; }
        navigator.geolocation.getCurrentPosition(
          p => resolve([p.coords.latitude, p.coords.longitude]),
          () => { usedFallback = true; resolve(fallbackCenter()); },
          { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
        );
      });
      setQuickPendingPos({ pos, usedFallback, usedTap });
      setQuickRecordStage('picking-emotion');
    } catch (err) {
      setQuickRecordError(err instanceof Error ? err.message : '位置の取得に失敗しました');
      setQuickRecordStage('idle');
    }
  }

  // クイック記録 第2段階：感情（複数可）・強さを選んだうえで「この気持ちで記録する」を押した時点で確定送信する
  async function confirmQuickRecord() {
    if (!quickPendingPos || quickEmotionKeys.length === 0) return;
    const { pos, usedFallback, usedTap } = quickPendingPos;
    setQuickRecordError('');
    setQuickRecordStage('submitting');
    try {
      const now = new Date();
      const quickTitle = `クイック記録・${now.getMonth() + 1}/${now.getDate()} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      const res = await fetch('/api/traces', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          latitude: pos[0], longitude: pos[1],
          title: quickTitle,
          emotion_key: quickEmotionKeys[0],
          emotion_keys: quickEmotionKeys,
          intensity: quickIntensity,
          session_code: sessionCode.trim() || undefined,
          nickname: nickname.trim() || undefined,
          team: team.trim() || undefined,
          visibility: currentUser ? postVisibility : undefined,
        }),
      });
      const data: CreateTraceResponse = await res.json();
      if (!data.ok || !data.trace) {
        // 失敗時は選択済みの感情を失わせず、同じ画面で再送できるようにする
        setQuickRecordError(data.error ?? '記録に失敗しました');
        setQuickRecordStage('picking-emotion');
        return;
      }
      if (!usedFallback && !usedTap) setUserPos(pos);
      if (usedTap) setQuickTapPos(null);
      setTraces(prev => [data.trace as Trace, ...prev]);
      const updatedIds = [...myTraceIds, data.trace.id];
      setMyTraceIds(updatedIds);
      localStorage.setItem('hitomap_my_traces', JSON.stringify(updatedIds));
      // 画面を注視しなくても分かるよう振動でも知らせ、確認は軽いトーストだけにする（歩きながらでも立ち止まらず続けられる）
      if (navigator.vibrate) navigator.vibrate(80);
      if (quickToastTimerRef.current) clearTimeout(quickToastTimerRef.current);
      setQuickToastUsedFallback(usedFallback);
      setQuickToast(data.trace);
      quickToastTimerRef.current = setTimeout(() => setQuickToast(null), usedFallback ? 6000 : 4000);
      setQuickPendingPos(null);
      setQuickEmotionKeys([]);
      setQuickIntensity(3);
      setQuickRecordStage('idle');
    } catch (err) {
      setQuickRecordError(err instanceof Error ? err.message : '記録に失敗しました');
      setQuickRecordStage('picking-emotion');
    }
  }

  // クイック記録を途中でやめる：まだ何もサーバーに送っていないため、ローカルの状態を戻すだけでよい
  function cancelQuickRecord() {
    setQuickPendingPos(null);
    setQuickEmotionKeys([]);
    setQuickIntensity(3);
    setQuickRecordStage('idle');
    setQuickRecordError('');
  }

  function handleTraceUpdate(updated: Trace) {
    setTraces(prev => prev.map(t => t.id === updated.id ? updated : t));
    setSelectedTrace(updated);
  }
  function handleQuickAddUpdate(updated: Trace) {
    setTraces(prev => prev.map(t => t.id === updated.id ? updated : t));
    setQuickAddTrace(updated);
  }
  function handleTraceDelete(id: string) {
    setTraces(prev => prev.filter(t => t.id !== id));
    setSelectedTrace(null);
  }

  // カードから地図へジャンプ
  async function openUnexplored() {
    setUnexploredOpen(true);
    if (!userPos) return;
    setUnexploredLoading(true);
    try {
      const res = await fetch(`/api/discover/unexplored?lat=${userPos[0]}&lng=${userPos[1]}`).then(r => r.json());
      if (res.ok) setUnexploredResult({ sparse: res.sparse ?? [], blank: res.blank ?? [] });
    } finally {
      setUnexploredLoading(false);
    }
  }

  function goToUnexploredRegion(region: string) {
    setUnexploredOpen(false);
    router.push(`/map?region=${encodeURIComponent(region)}`);
  }

  function handleShowOnMap(trace: Trace) {
    setTab('map');
    setMapFlyToZoom(17);
    setMapFlyTo([trace.latitude, trace.longitude]);
    setTimeout(() => setMapFlyTo(null), 2000);
  }

  function isOwnTrace(t: Trace): boolean {
    return t.user_id ? t.user_id === currentUser?.id : myTraceIds.includes(t.id);
  }

  // 一覧カードの✏️編集：詳細画面を編集モードで開いた状態にする
  function handleCardEdit(t: Trace) {
    setOpenInEditMode(true);
    setSelectedTrace(t);
  }

  // 一覧カードの🗑削除：ニックネーム確認が要る匿名投稿だけは詳細画面に任せ、それ以外はその場で削除する
  async function handleCardDelete(t: Trace) {
    if (!t.user_id && t.nickname) {
      setSelectedTrace(t);
      return;
    }
    if (!confirm(`「${t.title}」を削除しますか？`)) return;
    const res = await fetch(`/api/traces/${t.id}`, {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}),
    });
    const data = await res.json();
    if (data.ok) {
      setTraces(prev => prev.filter(x => x.id !== t.id));
    } else {
      alert(data.error ?? '削除に失敗しました');
    }
  }

  const canSubmit = Boolean((selectedArchiveType ? title.trim() : true) && lat && lng && !submitting && !submitDone);

  // ── 必須フィールド進捗（通常の痕跡はタイトル任意になったため位置のみ。アーカイブは名前が本体なので必須のまま） ──
  const steps = [
    ...(selectedArchiveType ? [{ label: 'タイトル', done: !!title.trim() }] : []),
    { label: '位置', done: !!(lat && lng) },
  ];
  const stepsDone = steps.filter(s => s.done).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh', overflow: 'hidden', background: '#F4F1E8' }}>
      <Onboarding />

      {usernameSetupOpen && (
        <>
          <div onClick={() => setUsernameSetupOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1000 }} />
          <div style={{
            position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 1001,
            background: '#fff', borderRadius: '20px 20px 0 0',
            padding: '18px 16px calc(18px + env(safe-area-inset-bottom))',
            boxShadow: '0 -4px 30px rgba(0,0,0,0.18)',
          }}>
            <p style={{ margin: '0 0 4px', fontWeight: 800, fontSize: 16 }}>👤 マイページを作成</p>
            <p style={{ margin: '0 0 14px', fontSize: 12, color: '#726C5E' }}>
              ユーザー名を設定すると、マイページ（プロフィール編集・アイコン設定）が使えるようになります。
            </p>
            <input
              value={usernameSetupValue}
              onChange={(e) => { setUsernameSetupValue(e.target.value); setUsernameSetupError(''); }}
              placeholder="ユーザー名（半角英数字推奨）"
              style={{
                width: '100%', boxSizing: 'border-box', padding: '11px 12px', fontSize: 15,
                border: `1.5px solid ${usernameSetupError ? '#B23A2E' : '#D7CFB8'}`, borderRadius: 10, marginBottom: 8,
              }}
            />
            {usernameSetupError && <p style={{ margin: '0 0 8px', fontSize: 12, color: '#B23A2E' }}>{usernameSetupError}</p>}
            <button onClick={submitUsernameSetup} disabled={usernameSetupBusy} style={{
              width: '100%', padding: '13px', borderRadius: 10, border: 'none',
              background: usernameSetupBusy ? '#D7CFB8' : '#566246', color: '#fff',
              fontWeight: 700, fontSize: 15, cursor: usernameSetupBusy ? 'default' : 'pointer',
            }}>
              {usernameSetupBusy ? '設定中…' : '設定する'}
            </button>
          </div>
        </>
      )}

      {/* ── ヘッダー ── */}
      <header style={{ padding: '10px 14px 8px', background: '#fff', borderBottom: '1px solid #E9E3D2', flexShrink: 0 }}>
        {regionParam && (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            marginBottom: 6, padding: '4px 10px', background: '#F3EDDE', borderRadius: 8,
          }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#8A6B3F' }}>🏘 {regionParam}</span>
            <a href="/" style={{ fontSize: 11, color: '#8A6B3F', textDecoration: 'none' }}>← 他の地域へ</a>
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {currentUser ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {currentProfile?.username ? (
                <a href={`/profile/${currentProfile.username}`} style={{
                  display: 'flex', alignItems: 'center', gap: 5, color: '#55524A24A', fontSize: 11,
                  fontWeight: 700, textDecoration: 'none',
                }}>
                  {currentProfile.avatar_url ? (
                    <img src={currentProfile.avatar_url} alt="" style={{ width: 18, height: 18, borderRadius: '50%', objectFit: 'cover' }} />
                  ) : '👤'}
                  {currentProfile.display_name ?? currentProfile.username}
                </a>
              ) : (
                <button
                  onClick={() => { setUsernameSetupOpen(true); setUsernameSetupValue(''); setUsernameSetupError(''); }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 5, color: '#726C5E', fontSize: 11,
                    fontWeight: 700, background: 'none', border: 'none', padding: 0, cursor: 'pointer',
                  }}>
                  👤 マイページ（ユーザー名未設定）
                </button>
              )}
              <button onClick={async () => {
                const { createAuthBrowserClient } = await import('@/lib/supabase/authClient');
                await createAuthBrowserClient().auth.signOut();
                setCurrentUser(null);
                setCurrentProfile(null);
              }} style={{
                background: 'none', border: 'none', color: '#726C5E', fontSize: 11, cursor: 'pointer', padding: 0,
              }}>・ ログアウト</button>
            </div>
          ) : (
            <a href="/login" style={{ color: '#2F8C88', fontSize: 11, fontWeight: 700, textDecoration: 'none' }}>ログイン / 新規登録</a>
          )}

          {currentUser && (
            <button onClick={() => router.push('/messages')} title="メッセージ" style={{
              position: 'relative', background: 'none', border: 'none', cursor: 'pointer',
              fontSize: 18, padding: '2px 6px',
            }}>
              💬
              {dmUnreadCount > 0 && (
                <span style={{
                  position: 'absolute', top: -2, right: 0, minWidth: 14, height: 14, borderRadius: 7,
                  background: '#B23A2E', color: '#fff', fontSize: 9, fontWeight: 800,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 3px',
                }}>{dmUnreadCount > 9 ? '9+' : dmUnreadCount}</span>
              )}
            </button>
          )}

          {currentUser && (
            <div style={{ position: 'relative' }}>
              <button onClick={openNotifPanel} style={{
                position: 'relative', background: 'none', border: 'none', cursor: 'pointer',
                fontSize: 18, padding: '2px 6px',
              }}>
                🔔
                {unreadCount > 0 && (
                  <span style={{
                    position: 'absolute', top: -2, right: 0, minWidth: 14, height: 14, borderRadius: 7,
                    background: '#B23A2E', color: '#fff', fontSize: 9, fontWeight: 800,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 3px',
                  }}>{unreadCount > 9 ? '9+' : unreadCount}</span>
                )}
              </button>
              {showNotifPanel && (
                <>
                  <div onClick={() => setShowNotifPanel(false)} style={{ position: 'fixed', inset: 0, zIndex: 998 }} />
                  <div style={{
                    position: 'absolute', top: 30, right: 0, width: 260, maxHeight: 320, overflowY: 'auto',
                    background: '#fff', borderRadius: 12, boxShadow: '0 4px 20px rgba(0,0,0,0.15)', zIndex: 999,
                    padding: 8,
                  }}>
                    {notifications.length === 0 ? (
                      <p style={{ margin: 0, padding: 12, fontSize: 12, color: '#A79E8A', textAlign: 'center' }}>まだ通知はありません</p>
                    ) : notifications.map(n => (
                      <a key={n.id} href={n.trace_id ? `/t/${n.trace_id}` : '#'} style={{
                        display: 'block', padding: '8px 10px', borderRadius: 8, textDecoration: 'none',
                        color: '#3E3B34', fontSize: 12, lineHeight: 1.5,
                        background: n.is_read ? 'transparent' : '#E6E9DE',
                      }}>
                        {n.type === 'crossed_paths' ? '🚶 ' : n.type === 'revisit_prompt' ? '🔁 ' : ''}{n.message}
                        <span style={{ display: 'block', fontSize: 10, color: '#A79E8A', marginTop: 2 }}>
                          {new Date(n.created_at).toLocaleString('ja-JP')}
                        </span>
                      </a>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
          </div>

          {/* タブ別コントロール：常時見せるのは「今見るモード」の1組だけに絞り、それ以外は下の「絞り込み・発見」に集約する */}
          {tab === 'map' && (
            <div style={{ display: 'flex', gap: 3, background: colors.trackBg, borderRadius: 10, padding: 3 }}>
              {(['pin', 'heat'] as MapMode[]).map(m => (
                <button key={m} onClick={() => {
                  setMapMode(m);
                  // ヒートは感情データを持つ痕跡のみが対象。アーカイブ種別で絞られたままだと0件になるためリセットする。
                  if (m === 'heat' && filterArchive && filterArchive !== 'trace') setFilterArchive(null);
                }} style={{
                  padding: '6px 14px', borderRadius: 8, fontSize: 13, cursor: 'pointer', border: 'none',
                  display: 'inline-flex', alignItems: 'center', gap: 5,
                  background: mapMode === m ? colors.surface : 'transparent',
                  color: mapMode === m ? colors.textPrimary : colors.textMuted, fontWeight: 700,
                  boxShadow: mapMode === m ? shadows.segment : 'none',
                  transition: 'background 0.15s ease, box-shadow 0.15s ease',
                }}>{m === 'pin' ? <><PinIcon size={13} /> ピン</> : <><FlameIcon size={13} /> ヒート</>}</button>
              ))}
            </div>
          )}

          {tab === 'list' && (
            <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
              <span style={{ fontSize: 12, color: '#8C8579' }}>{filtered.length}件</span>
              <button onClick={() => setSortOrder(o => o === 'new' ? 'old' : 'new')} style={{
                padding: '5px 10px', borderRadius: 7, fontSize: 12, cursor: 'pointer',
                border: '1.5px solid #D7CFB8', background: '#fff', color: '#55524A',
              }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <ClockIcon size={12} /> {sortOrder === 'new' ? '新しい順' : '古い順'}
                </span>
              </button>
              <button onClick={() => { setRouteMode(v => !v); setRouteSelection([]); }} style={{
                padding: '5px 10px', borderRadius: 7, fontSize: 12, cursor: 'pointer',
                display: 'inline-flex', alignItems: 'center', gap: 4,
                border: `1.5px solid ${routeMode ? '#8A6B3F' : '#D7CFB8'}`,
                background: routeMode ? '#F3EDDE' : '#fff',
                color: routeMode ? '#8A6B3F' : '#55524A24A', fontWeight: routeMode ? 700 : 400,
              }}><TrailIcon size={12} /> {routeMode ? 'ルート作成中' : 'ルートを作る'}</button>
            </div>
          )}

          {tab === 'post' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {/* 進捗インジケーター */}
              {stepsDone < steps.length && (
                <span style={{ fontSize: 11, color: '#8C8579' }}>
                  必須 {stepsDone}/{steps.length}
                </span>
              )}
            </div>
          )}
        </div>

        {/* 町検索：AllTrails（検索がヒーロー）の構成を踏襲し、マップタブでは常時最上部に出す */}
        {tab === 'map' && (
          <div style={{ marginBottom: 8 }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              background: '#fff', border: '1.5px solid #D7CFB8', borderRadius: 999,
              padding: '4px 6px 4px 14px',
              boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
            }}>
              <span style={{ color: '#726C5E', display: 'inline-flex', flexShrink: 0 }}><SearchIcon size={16} /></span>
              <input
                value={regionQuery}
                onChange={e => setRegionQuery(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') searchRegion(); }}
                placeholder="歩く町をさがす（例：渋谷区、別府市…）"
                style={{
                  flex: 1, minWidth: 0, padding: '7px 0', fontSize: 13,
                  border: 'none', outline: 'none', background: 'transparent',
                }}
              />
              <button onClick={searchRegion} disabled={regionSearching} style={{
                padding: '7px 16px', borderRadius: 999, border: 'none', flexShrink: 0,
                background: '#2F8C88', color: '#fff', fontSize: 13, fontWeight: 700,
                cursor: regionSearching ? 'wait' : 'pointer',
              }}>{regionSearching ? '検索中…' : '移動'}</button>
            </div>
            {regionError && <p style={{ color: '#B23A2E', fontSize: 12, margin: '4px 0 0' }}>{regionError}</p>}
            {regionCandidates.length > 0 && (
              <div style={{ marginTop: 6, background: '#fff', border: '1px solid #E9E3D2', borderRadius: 8, overflow: 'hidden' }}>
                {regionCandidates.map((c, i) => (
                  <button key={i} onClick={() => jumpToRegion(c)} style={{
                    display: 'block', width: '100%', textAlign: 'left', padding: '8px 10px',
                    border: 'none', borderBottom: i < regionCandidates.length - 1 ? '1px solid #E9E3D2' : 'none',
                    background: '#fff', fontSize: 12, color: '#3E3B34', cursor: 'pointer',
                  }}>{c.display_name}</button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 今日の問い：ホーム相当のmapタブを開いた瞬間に見えるよう、投稿タブから移設 */}
        {tab === 'map' && !questDismissed && currentQuest && (
          <div style={{
            background: 'linear-gradient(135deg, #F8F4E9, #FFF)', border: '1.5px solid #F3EDDE',
            borderRadius: 14, padding: '12px 14px', marginBottom: 8, position: 'relative',
          }}>
            <button type="button" onClick={() => setQuestDismissed(true)} style={{
              position: 'absolute', top: 8, right: 10, background: 'none', border: 'none',
              color: '#A79E8A', fontSize: 16, cursor: 'pointer', lineHeight: 1,
            }}>✕</button>
            {currentQuest.quest_type === 'emotion' ? (
              <>
                <p style={{ margin: '0 0 4px', fontSize: 11, color: '#8A6B3F', fontWeight: 700 }}>今日の問い・今こんな感情を集めています</p>
                <p style={{ margin: '0 0 4px', fontSize: 14, fontWeight: 800, color: '#23231F' }}>
                  {currentQuest.emoji} {currentQuest.title}
                </p>
                {currentQuest.target_emotion_key && (
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
              </>
            ) : (
              <>
                <p style={{ margin: '0 0 4px', fontSize: 11, color: '#8A6B3F', fontWeight: 700 }}>今日の問い</p>
                <p style={{ margin: '0 0 4px', fontSize: 14, fontWeight: 800, color: '#23231F' }}>
                  {currentQuest.emoji} {currentQuest.title}
                </p>
                <p style={{ margin: 0, fontSize: 12, color: '#726C5E', lineHeight: 1.6, paddingRight: 20 }}>
                  {currentQuest.hint}
                </p>
              </>
            )}
          </div>
        )}

        {/* 絞り込み・発見の開閉トグル：位置／感情レイヤー／時間／種別 の操作をすべてここに集約し、常時表示のボタン数を減らす */}
        {/* 一覧タブでも常に表示する（「近くのみ」を解除する手段がここにしかないため。無いと0件のまま抜け出せなくなる） */}
        {(tab === 'map' || tab === 'list') && (() => {
          const isActive = Boolean(
            filterArchive || filterEmotion || nearbyOnly || detourMode ||
            intensityLayer !== 'all' || timeSliderOn
          );
          return (
            <button onClick={() => setFiltersOpen(v => !v)} style={{
              display: 'flex', alignItems: 'center', gap: 4, alignSelf: 'flex-start',
              padding: '5px 12px', borderRadius: 14, fontSize: 12, cursor: 'pointer', marginBottom: 4,
              border: `1.5px solid ${isActive ? '#566246' : '#D7CFB8'}`,
              background: isActive ? '#E6E9DE' : '#fff',
              color: isActive ? '#566246' : '#55524A24A', fontWeight: isActive ? 700 : 400,
            }}>
              絞り込み・発見{isActive ? '中' : ''} {filtersOpen ? '▴' : '▾'}
            </button>
          );
        })()}

        {/* 位置・発見ツール：近く／地域／寄り道／眠る痕跡（一覧タブでも「近く」を解除できるよう表示する） */}
        {filtersOpen && (tab === 'map' || tab === 'list') && (
          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 8 }}>
            <button onClick={() => {
              if (!nearbyOnly && !userPos) {
                navigator.geolocation.getCurrentPosition(
                  p => { setUserPos([p.coords.latitude, p.coords.longitude]); setNearbyOnly(true); },
                  undefined, { enableHighAccuracy: true }
                );
              } else { setNearbyOnly(n => !n); }
            }} style={{
              padding: '5px 10px', borderRadius: 7, fontSize: 12, cursor: 'pointer',
              display: 'inline-flex', alignItems: 'center', gap: 4,
              border: `1.5px solid ${nearbyOnly ? '#2F8C88' : '#D7CFB8'}`,
              background: nearbyOnly ? '#E9F3F2' : '#fff',
              color: nearbyOnly ? '#2F8C88' : '#55524A24A', fontWeight: nearbyOnly ? 700 : 400,
            }}><PinIcon size={12} /> 近く</button>
            <button onClick={() => {
              setDetourMode(v => !v);
              if (detourMode) { setDetourDestination(null); setDetourQuery(''); setDetourCandidates([]); }
            }} style={{
              padding: '5px 10px', borderRadius: 7, fontSize: 12, cursor: 'pointer',
              display: 'inline-flex', alignItems: 'center', gap: 4,
              border: `1.5px solid ${detourMode ? '#2F8C88' : '#D7CFB8'}`,
              background: detourMode ? '#E9F3F2' : '#fff',
              color: detourMode ? '#2F8C88' : '#55524A24A', fontWeight: detourMode ? 700 : 400,
            }}><WalkIcon size={12} /> 寄り道</button>
            <button onClick={openUnexplored} style={{
              padding: '5px 10px', borderRadius: 7, fontSize: 12, cursor: 'pointer',
              display: 'inline-flex', alignItems: 'center', gap: 4,
              border: '1.5px solid #F3EDDE', background: '#F8F4E9', color: '#8A6B3F', fontWeight: 700,
            }}><CompassIcon size={12} /> 眠る痕跡</button>
          </div>
        )}

        {/* 感情レイヤー・時間（マップのみ、ヒート以外） */}
        {SHOW_LEGACY_LAYER_TABS && filtersOpen && tab === 'map' && !(mapMode === 'heat') && (
          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 8 }}>
            {([
              ['all', 'すべて'],
              ['light', '☁ 薄い日常'],
              ['deep', '🌊 深い想い'],
            ] as [typeof intensityLayer, string][]).map(([key, label]) => (
              <button key={key} onClick={() => setIntensityLayer(key)} style={{
                padding: '4px 10px', borderRadius: 7, fontSize: 11, cursor: 'pointer',
                border: `1.5px solid ${intensityLayer === key ? '#8A6B3F' : '#D7CFB8'}`,
                background: intensityLayer === key ? '#F3EDDE' : '#fff',
                color: intensityLayer === key ? '#8A6B3F' : '#726C5E', fontWeight: intensityLayer === key ? 700 : 400,
              }}>{label}</button>
            ))}
            <button onClick={() => setTimeSliderOn(v => !v)} style={{
              padding: '4px 10px', borderRadius: 7, fontSize: 11, cursor: 'pointer',
              border: `1.5px solid ${timeSliderOn ? '#2F8C88' : '#D7CFB8'}`,
              background: timeSliderOn ? '#E9F3F2' : '#fff',
              color: timeSliderOn ? '#2F8C88' : '#726C5E', fontWeight: timeSliderOn ? 700 : 400,
            }}>🕰 時間で見る</button>
          </div>
        )}

        {/* アーカイブタイプフィルター（マップ・一覧）。ヒートは感情データを持つ痕跡専用のため、ヒート表示中は出さない */}
        {filtersOpen && (tab === 'map' || tab === 'list') && hasArchive && !(tab === 'map' && mapMode === 'heat') && (
          <div style={{ display: 'flex', gap: 5, overflowX: 'auto', paddingBottom: 4, scrollbarWidth: 'none' }}>
            <button onClick={() => setFilterArchive(null)} style={{
              padding: '3px 9px', borderRadius: 16, fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0,
              border: `1.5px solid ${!filterArchive ? '#3E3B34' : '#D7CFB8'}`,
              background: !filterArchive ? '#3E3B34' : '#fff',
              color: !filterArchive ? '#fff' : '#55524A24A',
            }}>すべて</button>
            <button onClick={() => setFilterArchive(filterArchive === 'trace' ? null : 'trace')} style={{
              padding: '3px 9px', borderRadius: 16, fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0,
              display: 'inline-flex', alignItems: 'center', gap: 4,
              border: `1.5px solid ${filterArchive === 'trace' ? '#566246' : '#D7CFB8'}`,
              background: filterArchive === 'trace' ? '#566246' : '#fff',
              color: filterArchive === 'trace' ? '#fff' : '#55524A24A',
            }}><PinIcon size={12} /> 痕跡</button>
            {archiveCounts.map(a => {
              const ArchiveIcon = ARCHIVE_TYPE_ICONS[a.key];
              return (
                <button key={a.key} onClick={() => setFilterArchive(filterArchive === a.key ? null : a.key)} style={{
                  padding: '3px 9px', borderRadius: 16, fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0,
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                  border: `1.5px solid ${filterArchive === a.key ? a.color : '#D7CFB8'}`,
                  background: filterArchive === a.key ? a.color : '#fff',
                  color: filterArchive === a.key ? '#fff' : '#55524A24A',
                }}>{ArchiveIcon && <ArchiveIcon size={12} />} {a.label} {a.count}</button>
              );
            })}
          </div>
        )}
        {tab === 'map' && mapMode === 'heat' && (
          <p style={{ fontSize: 11, color: '#8C8579', margin: '0 0 4px' }}>ヒートは感情を記録した「痕跡」投稿のみが対象です</p>
        )}

        {/* 寄り道モード（マップ） */}
        {tab === 'map' && detourMode && (
          <div style={{ marginBottom: 6 }}>
            {!userPos ? (
              <p style={{ fontSize: 12, color: '#8C8579', margin: 0 }}>現在地を取得しています…（位置情報を許可してください）</p>
            ) : !detourDestination ? (
              <>
                <div style={{ display: 'flex', gap: 6 }}>
                  <input
                    value={detourQuery}
                    onChange={e => setDetourQuery(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') searchDetourDestination(); }}
                    placeholder="目的地は？（例：〇〇駅）"
                    style={{ flex: 1, padding: '7px 10px', borderRadius: 8, fontSize: 13, border: '1.5px solid #D7CFB8', outline: 'none' }}
                  />
                  <button onClick={searchDetourDestination} disabled={detourSearching} style={{
                    padding: '7px 14px', borderRadius: 8, border: 'none',
                    background: '#2F8C88', color: '#fff', fontSize: 13, fontWeight: 700,
                    cursor: detourSearching ? 'wait' : 'pointer',
                  }}>{detourSearching ? '検索中…' : '検索'}</button>
                </div>
                {detourError && <p style={{ color: '#B23A2E', fontSize: 12, margin: '4px 0 0' }}>{detourError}</p>}
                {detourCandidates.length > 0 && (
                  <div style={{ marginTop: 6, background: '#fff', border: '1px solid #E9E3D2', borderRadius: 8, overflow: 'hidden' }}>
                    {detourCandidates.map((c, i) => (
                      <button key={i} onClick={() => pickDetourDestination(c)} style={{
                        display: 'block', width: '100%', textAlign: 'left', padding: '8px 10px',
                        border: 'none', borderBottom: i < detourCandidates.length - 1 ? '1px solid #E9E3D2' : 'none',
                        background: '#fff', fontSize: 12, color: '#3E3B34', cursor: 'pointer',
                      }}>{c.display_name}</button>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <div style={{ background: '#E9F3F2', border: '1.5px solid #2F8C8833', borderRadius: 10, padding: '8px 12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <p style={{ margin: 0, fontSize: 12, color: '#2F8C88', fontWeight: 700 }}>
                    🚶 {detourDestination.name.split('、')[0]} まで・寄り道スポット {detourWaypoints.length}件
                  </p>
                  <button onClick={() => setDetourDestination(null)} style={{
                    background: 'none', border: 'none', color: '#726C5E', fontSize: 11, cursor: 'pointer',
                  }}>やり直す</button>
                </div>
                {(detourWaypoints.length > 0 || detourSponsorNearby) && (
                  <div style={{ display: 'flex', gap: 6, overflowX: 'auto', marginTop: 6, paddingBottom: 2 }}>
                    {detourWaypoints.map(w => (
                      <button key={w.trace.id} onClick={() => { setMapFlyToZoom(17); setMapFlyTo([w.trace.latitude, w.trace.longitude]); }} style={{
                        flexShrink: 0, padding: '5px 10px', borderRadius: 14, fontSize: 11,
                        border: '1.5px solid #2F8C88', background: '#fff', color: '#2F8C88', cursor: 'pointer', whiteSpace: 'nowrap',
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
        {filtersOpen && (tab === 'map' || tab === 'list') && emotionCounts.length > 0 && (
          <div style={{ display: 'flex', gap: 5, overflowX: 'auto', paddingBottom: 2, scrollbarWidth: 'none' }}>
            <button onClick={() => setFilterEmotion(null)} style={{
              padding: '3px 9px', borderRadius: 16, fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0,
              border: `1.5px solid ${!filterEmotion ? '#3E3B34' : '#D7CFB8'}`,
              background: !filterEmotion ? '#3E3B34' : '#fff',
              color: !filterEmotion ? '#fff' : '#55524A24A',
            }}>すべて</button>
            {emotionCounts.map(e => (
              <button key={e.key} onClick={() => setFilterEmotion(filterEmotion === e.key ? null : e.key)} style={{
                padding: '3px 9px', borderRadius: 16, fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0,
                border: `1.5px solid ${filterEmotion === e.key ? e.color : '#D7CFB8'}`,
                background: filterEmotion === e.key ? e.color : '#fff',
                color: filterEmotion === e.key ? '#fff' : '#55524A24A',
              }}>{e.emoji} {e.label} {e.count}</button>
            ))}
          </div>
        )}

        {/* 時間スライダー：「1ヶ月前→今」のように感情の堆積が動いて見える（見やすさ優先でヘッダー内に固定表示） */}
        {tab === 'map' && timeSliderOn && timeMax > timeMin && (
          <div style={{
            marginTop: 8, padding: '12px 14px', borderRadius: 12,
            background: '#E9F3F2', border: '1.5px solid #2F8C88',
          }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 8 }}>
              <p style={{ margin: 0, fontSize: 14, color: '#1F7A76', fontWeight: 800 }}>
                🕰 {new Date(timeSliderCutoff).toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' })}
              </p>
              <p style={{ margin: 0, fontSize: 12, color: '#2F8C88', fontWeight: 700 }}>{filtered.length}件を表示中</p>
            </div>
            <input
              type="range" min={0} max={100} value={timeSliderPct}
              onChange={e => setTimeSliderPct(Number(e.target.value))}
              style={{ width: '100%', height: 28, accentColor: '#2F8C88', cursor: 'pointer' }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#5FA8A4', fontWeight: 600, marginTop: 2 }}>
              <span>{new Date(timeMin).toLocaleDateString('ja-JP')}</span>
              <span>今</span>
            </div>
          </div>
        )}
      </header>

      {/* ── メインコンテンツ ── */}
      <main style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>

        {/* 書きかけの記録：クイック記録した位置に、感情・写真をまだ足せていない分を知らせる */}
        {tab === 'map' && !fetchError && unfinishedOwn.length > 0 && !quickAddTrace && (
          <button
            onClick={() => setQuickAddTrace(unfinishedOwn[0])}
            style={{
              position: 'absolute', top: 10, left: '50%', transform: 'translateX(-50%)',
              background: '#8A6B3F', color: '#fff', padding: '7px 16px', border: 'none',
              borderRadius: 20, fontSize: 12, fontWeight: 700, cursor: 'pointer', zIndex: 500,
              whiteSpace: 'nowrap', boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
            }}
          >
            ✍️ 書きかけの記録が{unfinishedOwn.length}件あります・続きを書く
          </button>
        )}

        {/* ピン設置モード中の案内：ボタンのラベル変化だけでは気づかれにくいため、はっきり案内を出す */}
        {tab === 'map' && pinDropMode && (
          <div style={{
            position: 'absolute', top: 10, left: '50%', transform: 'translateX(-50%)',
            background: '#566246', color: '#fff', padding: '8px 16px',
            borderRadius: 20, fontSize: 13, fontWeight: 700, zIndex: 500,
            whiteSpace: 'nowrap', boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
          }}>
            👆 地図をタップして場所を指定してください
          </div>
        )}

        {/* エラーバナー */}
        {fetchError && (
          <div style={{
            position: 'absolute', top: 10, left: '50%', transform: 'translateX(-50%)',
            background: '#B23A2E', color: '#fff', padding: '8px 16px',
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
              currentUserId={currentUser?.id}
              avatarUrls={avatarUrls}
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
              reactionCounts={reactionCounts}
              onLocate={pos => setUserPos(pos)}
              onTraceClick={setSelectedTrace}
              pinDropPos={!pinDropMode ? quickTapPos ?? undefined : undefined}
              onMapClick={pinDropMode ? (la, ln) => {
                setLat(la); setLng(ln);
                setPinDropMode(false);
                setTab('post');
              } : (la, ln) => {
                // クイック記録は既定でGPS位置に記録するが、先に地図をタップしておけば
                // そのタップ地点にピンが立つ（GPSの誤差を避けたい／別の場所を記録したい時のため）
                setQuickTapPos([la, ln]);
                if (navigator.vibrate) navigator.vibrate(30);
              }}
            />
            {/* ピンを立てる（地図タップで場所を指定して本記録） */}
            <div style={{
              position: 'absolute', bottom: 16, right: 16, zIndex: 500,
              display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8,
            }}>
              <button
                type="button"
                onClick={() => setPinDropMode(v => !v)}
                style={{
                  padding: '12px 16px', borderRadius: 24, border: 'none',
                  display: 'inline-flex', alignItems: 'center', gap: 5,
                  background: pinDropMode ? '#566246' : '#fff',
                  color: pinDropMode ? '#fff' : '#23231F',
                  fontWeight: 700, fontSize: 13, cursor: 'pointer',
                  boxShadow: '0 2px 10px rgba(0,0,0,0.2)',
                }}
              >
                {pinDropMode ? '✕ 取消（地図をタップ）' : <><PinIcon size={14} /> ここに記録する</>}
              </button>
            </div>
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
                background: '#2F8C88', color: '#fff', padding: '6px 14px',
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
                    <span style={{ color: '#3E3B34' }}>{e.label}</span>
                  </div>
                ))}
                <div style={{ borderTop: '1px solid #E9E3D2', marginTop: 5, paddingTop: 5, fontSize: 10, color: '#A79E8A' }}>
                  円が大きい＝強度が高い
                </div>
              </div>
            )}

          </div>
        )}

        {/* ─── 投稿フォーム ─── */}
        {tab === 'post' && (
          // 下部固定の公開範囲ボタン＋記録するボタン＋ボトムナビの高さ分、確実に見えるよう余白を確保
          <div style={{ height: '100%', overflowY: 'auto', padding: '16px 16px 230px', background: '#F4F1E8' }}>

            {/* 送信完了 */}
            {submitDone && (
              <div style={{ textAlign: 'center', padding: '48px 20px 20px' }}>
                <div style={{ fontSize: 22, fontWeight: 800, color: '#2F8C88' }}>✓ 記録しました</div>

                {lastPostedTrace?.visibility === 'public' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 280, margin: '20px auto 0' }}>
                    <button onClick={async () => {
                      const shareUrl = `${window.location.origin}/t/${lastPostedTrace.id}`;
                      if (navigator.share) {
                        await navigator.share({ title: 'ヒトマップの痕跡', text: lastPostedTrace.title, url: shareUrl }).catch(() => {});
                      } else {
                        await navigator.clipboard.writeText(`${lastPostedTrace.title}\n${shareUrl}`);
                        alert('クリップボードにコピーしました');
                      }
                    }} style={{
                      padding: '12px 0', borderRadius: 10, border: 'none',
                      background: 'linear-gradient(135deg, #566246, #FF9068)',
                      color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer',
                    }}>📤 シェアする</button>
                    <a
                      href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(lastPostedTrace.title)}&url=${encodeURIComponent(`${window.location.origin}/t/${lastPostedTrace.id}`)}`}
                      target="_blank" rel="noopener noreferrer"
                      style={{
                        display: 'block', padding: '12px 0', borderRadius: 10, border: '1.5px solid #D7CFB8',
                        color: '#3E3B34', fontWeight: 700, fontSize: 14, textDecoration: 'none',
                      }}
                    >𝕏 でシェア</a>
                  </div>
                )}

                <button onClick={finishSubmitPost} style={{
                  marginTop: 16, background: 'none', border: 'none', color: '#726C5E', fontSize: 13, cursor: 'pointer',
                }}>続ける →</button>
              </div>
            )}

            {!submitDone && (
              <form id="trace-form" onSubmit={handleSubmit}>

                {/* STEP 0: 何を記録する？（痕跡 or アーカイブ） */}
                <div style={{ background: '#fff', borderRadius: 14, padding: '14px', marginBottom: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                  <label style={{ ...labelStyle, fontSize: 12, color: '#8C8579', fontWeight: 600, marginBottom: 8 }}>
                    何を記録する？
                  </label>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <button type="button" onClick={() => setArchiveTypeKey(null)} style={{
                      padding: '8px 12px', borderRadius: 10, fontSize: 13, cursor: 'pointer',
                      border: `2px solid ${!archiveTypeKey ? '#566246' : '#D7CFB8'}`,
                      background: !archiveTypeKey ? '#E6E9DE' : '#fff',
                      color: !archiveTypeKey ? '#566246' : '#55524A24A',
                      fontWeight: !archiveTypeKey ? 700 : 400,
                    }}>📍 痕跡</button>
                    {ARCHIVE_TYPES.map(a => (
                      <button key={a.key} type="button"
                        onClick={() => setArchiveTypeKey(archiveTypeKey === a.key ? null : a.key)} style={{
                          padding: '8px 12px', borderRadius: 10, fontSize: 13, cursor: 'pointer',
                          border: `2px solid ${archiveTypeKey === a.key ? a.color : '#D7CFB8'}`,
                          background: archiveTypeKey === a.key ? a.color + '18' : '#fff',
                          color: archiveTypeKey === a.key ? a.color : '#55524A24A',
                          fontWeight: archiveTypeKey === a.key ? 700 : 400,
                        }}>{a.emoji} {a.label}</button>
                    ))}
                  </div>
                  {selectedArchiveType && (
                    <p style={{ fontSize: 11, color: '#8C8579', margin: '8px 0 0' }}>
                      この土地の記憶を後世に残す記録です。知っていることをそのまま書いてください。
                    </p>
                  )}
                </div>

                {/* STEP 1: 写真（最大4枚） */}
                <div style={{ background: '#fff', borderRadius: 14, marginBottom: 12, padding: photos.length > 0 ? 10 : 0, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                  <input ref={fileRef} type="file" accept="image/*" multiple
                    style={{ display: 'none' }} onChange={handlePhoto} />
                  {photos.length > 0 ? (
                    <div style={{ display: 'flex', gap: 8, overflowX: 'auto' }}>
                      {photos.map((p, i) => (
                        <div key={i} style={{ position: 'relative', flexShrink: 0 }}>
                          <img src={p.preview} alt={`写真${i + 1}`}
                            style={{ width: 100, height: 100, borderRadius: 10, objectFit: 'cover', display: 'block' }} />
                          <button type="button" onClick={() => removePhoto(i)} style={{
                            position: 'absolute', top: -6, right: -6, width: 22, height: 22, borderRadius: '50%',
                            background: 'rgba(0,0,0,0.65)', color: '#fff', border: 'none', fontSize: 12, cursor: 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                          }}>✕</button>
                        </div>
                      ))}
                      {photos.length < MAX_PHOTOS && (
                        <button type="button" onClick={() => fileRef.current?.click()} style={{
                          width: 100, height: 100, borderRadius: 10, border: '1.5px dashed #D7CFB8', background: '#F4F1E8',
                          cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                          gap: 4, flexShrink: 0, color: '#A79E8A', fontSize: 11,
                        }}>
                          <span style={{ fontSize: 22 }}>＋</span>追加（{photos.length}/{MAX_PHOTOS}）
                        </button>
                      )}
                    </div>
                  ) : (
                    <button type="button" onClick={() => fileRef.current?.click()} style={{
                      width: '100%', height: 130, border: 'none', background: '#F4F1E8',
                      cursor: 'pointer', display: 'flex', flexDirection: 'column',
                      alignItems: 'center', justifyContent: 'center', gap: 8,
                    }}>
                      <span style={{ fontSize: 36 }}>📷</span>
                      <span style={{ fontSize: 14, color: '#A79E8A' }}>タップして写真を撮る・選ぶ（最大{MAX_PHOTOS}枚）</span>
                    </button>
                  )}
                </div>

                {/* 短い動画（任意・1本まで）：言い伝え・語り部の記録に効果的 */}
                <div style={{ background: '#fff', borderRadius: 14, marginBottom: 12, padding: video ? 10 : 0, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                  <input ref={videoRef} type="file" accept="video/*"
                    style={{ display: 'none' }} onChange={handleVideo} />
                  {video ? (
                    <div style={{ position: 'relative' }}>
                      <video src={video.preview} controls style={{ width: '100%', maxHeight: 200, borderRadius: 10, display: 'block', background: '#000' }} />
                      <button type="button" onClick={removeVideo} style={{
                        position: 'absolute', top: -6, right: -6, width: 22, height: 22, borderRadius: '50%',
                        background: 'rgba(0,0,0,0.65)', color: '#fff', border: 'none', fontSize: 12, cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>✕</button>
                    </div>
                  ) : (
                    <button type="button" onClick={() => videoRef.current?.click()} style={{
                      width: '100%', height: 90, border: 'none', background: '#F4F1E8',
                      cursor: 'pointer', display: 'flex', flexDirection: 'column',
                      alignItems: 'center', justifyContent: 'center', gap: 6,
                    }}>
                      <span style={{ fontSize: 26 }}>🎥</span>
                      <span style={{ fontSize: 13, color: '#A79E8A' }}>短い動画を撮る・選ぶ（任意・最大{MAX_VIDEO_MB}MB）</span>
                    </button>
                  )}
                  {videoError && <p style={{ margin: '6px 10px 0', fontSize: 11, color: '#B23A2E' }}>{videoError}</p>}
                </div>

                {/* STEP 2: タイトル（アーカイブは必須・通常の痕跡は任意で自動生成） */}
                <div style={{ background: '#fff', borderRadius: 14, padding: '14px 14px', marginBottom: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                  <label style={{ ...labelStyle, fontSize: 12, color: '#8C8579', fontWeight: 600, marginBottom: 6 }}>
                    {selectedArchiveType ? selectedArchiveType.titleLabel : '何を見つけた？（任意）'} {selectedArchiveType && <span style={{ color: '#566246' }}>*</span>}
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                    placeholder={selectedArchiveType ? selectedArchiveType.titlePlaceholder : '空欄なら自動でタイトルが付きます'}
                    style={{ ...inputStyle, fontSize: 16, fontWeight: 600, border: '2px solid ' + (title.trim() ? '#2F8C88' : '#E9E3D2') }}
                    required={Boolean(selectedArchiveType)}
                  />
                </div>

                {/* STEP 3a: アーカイブの詳細（タイプ別） */}
                {selectedArchiveType && (
                  <div style={{ background: '#fff', borderRadius: 14, padding: '14px', marginBottom: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {archiveTypeKey === 'chimei' && (
                      <>
                        <div>
                          <label style={{ ...labelStyle, fontSize: 12, color: '#8C8579', fontWeight: 600 }}>よみ（ひらがな）</label>
                          <input type="text" value={yomi} onChange={e => setYomi(e.target.value)}
                            placeholder="例：どんどやきば" style={inputStyle} />
                        </div>
                        <div>
                          <label style={{ ...labelStyle, fontSize: 12, color: '#8C8579', fontWeight: 600 }}>別名・旧称（カンマ区切り）</label>
                          <input type="text" value={altNames} onChange={e => setAltNames(e.target.value)}
                            placeholder="例：才の神焼き場、どんどん場" style={inputStyle} />
                        </div>
                      </>
                    )}

                    <div>
                      <label style={{ ...labelStyle, fontSize: 12, color: '#8C8579', fontWeight: 600 }}>
                        {selectedArchiveType.bodyLabel}
                      </label>
                      <textarea value={why} onChange={e => setWhy(e.target.value)}
                        placeholder={selectedArchiveType.bodyPlaceholder}
                        rows={archiveTypeKey === 'denshou' || archiveTypeKey === 'koe' ? 4 : 2} style={inputStyle} />
                    </div>

                    {(archiveTypeKey === 'denshou' || archiveTypeKey === 'koe') && (
                      <div>
                        <label style={{ ...labelStyle, fontSize: 12, color: '#8C8579', fontWeight: 600 }}>🎙️ 音声で残す（任意）</label>
                        <AudioRecorder value={audioBlob} onChange={setAudioBlob} />
                        <p style={{ fontSize: 11, color: '#A79E8A', margin: '6px 0 0' }}>
                          話し言葉のまま残すと、文字にならないニュアンスも伝わります
                        </p>
                        {audioBlob && (
                          <div style={{ marginTop: 10 }}>
                            <label style={{ ...labelStyle, fontSize: 12, color: '#8C8579', fontWeight: 600 }}>📝 文字起こし（任意）</label>
                            <textarea value={audioTranscript} onChange={e => setAudioTranscript(e.target.value)}
                              placeholder="話した内容をそのまま書き起こしておくと、後から探しやすくなります"
                              rows={3} style={inputStyle} />
                          </div>
                        )}
                      </div>
                    )}

                    {archiveTypeKey === 'bunken' && (
                      <div>
                        <label style={{ ...labelStyle, fontSize: 12, color: '#8C8579', fontWeight: 600 }}>出典・URL</label>
                        <input type="text" value={sourceRef} onChange={e => setSourceRef(e.target.value)}
                          placeholder="例：〇〇村誌 p.123 / https://…" style={inputStyle} />
                      </div>
                    )}

                    {archiveTypeKey === 'koe' && (
                      <div>
                        <label style={{ ...labelStyle, fontSize: 12, color: '#8C8579', fontWeight: 600 }}>この土地との関係</label>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          {VOICE_RELATIONS.map(r => (
                            <button key={r.key} type="button"
                              onClick={() => setVoiceRelation(voiceRelation === r.key ? null : r.key)} style={{
                                padding: '6px 11px', borderRadius: 20, fontSize: 13, cursor: 'pointer',
                                border: `1.5px solid ${voiceRelation === r.key ? selectedArchiveType.color : '#D7CFB8'}`,
                                background: voiceRelation === r.key ? selectedArchiveType.color : '#fff',
                                color: voiceRelation === r.key ? '#fff' : '#55524A24A',
                              }}>{r.label}</button>
                          ))}
                        </div>
                      </div>
                    )}

                    {archiveTypeKey !== 'koe' && (
                      <div>
                        <label style={{ ...labelStyle, fontSize: 12, color: '#8C8579', fontWeight: 600 }}>時代・年代（わかれば）</label>
                        <input type="text" value={eraLabel} onChange={e => setEraLabel(e.target.value)}
                          placeholder="例：昭和40年代まで、明治期、江戸末期…" style={inputStyle} />
                      </div>
                    )}
                    {archiveTypeKey === 'koe' && (
                      <div>
                        <label style={{ ...labelStyle, fontSize: 12, color: '#8C8579', fontWeight: 600 }}>いつ頃の話？（わかれば）</label>
                        <input type="text" value={eraLabel} onChange={e => setEraLabel(e.target.value)}
                          placeholder="例：1960年代、戦後すぐ…" style={inputStyle} />
                      </div>
                    )}
                  </div>
                )}

                {/* STEP 3: 感情（痕跡のみ） */}
                {!selectedArchiveType && (
                  <div style={{ background: '#fff', borderRadius: 14, padding: '14px', marginBottom: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                    <label style={{ ...labelStyle, fontSize: 12, color: '#8C8579', fontWeight: 600, marginBottom: 8 }}>
                      なにを感じた？（1タップでOK・複数選べます）
                    </label>
                    <EmotionPicker
                      value={emotionKeys} onChange={setEmotionKeys}
                      intensity={intensity} onIntensityChange={setIntensity}
                    />
                  </div>
                )}

                {/* STEP 4: 位置（必須） */}
                <div style={{ background: '#fff', borderRadius: 14, padding: '14px', marginBottom: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                  <label style={{ ...labelStyle, fontSize: 12, color: '#8C8579', fontWeight: 600, marginBottom: 8 }}>
                    {selectedArchiveType ? 'その場所はどこ？' : 'いまいる場所'} <span style={{ color: '#566246' }}>*</span>
                  </label>

                  {/* 地図をタップして記録（メインの記録方法） */}
                  <div style={{ height: 200, borderRadius: 10, overflow: 'hidden', marginBottom: 6 }}>
                    <LocationPickerMap
                      lat={lat ?? userPos?.[0] ?? DEFAULT_CENTER[0]}
                      lng={lng ?? userPos?.[1] ?? DEFAULT_CENTER[1]}
                      onChange={(la, ln) => { setLat(la); setLng(ln); }}
                    />
                  </div>
                  <p style={{ fontSize: 11, color: '#726C5E', margin: '0 0 8px' }}>
                    {lat ? 'タップしてピンの位置を調整できます' : '☝️ 地図をタップして場所を選んでください'}
                  </p>

                  {lat && (
                    <p style={{ fontSize: 11, color: '#8C8579', margin: '0 0 8px', display: 'flex', justifyContent: 'space-between' } as React.CSSProperties}>
                      <span>✓ {lat.toFixed(5)}, {lng!.toFixed(5)}</span>
                      <button type="button" onClick={() => { setLat(null); setLng(null); }}
                        style={{ background: 'none', border: 'none', color: '#B23A2E', cursor: 'pointer', fontSize: 11 }}>
                        リセット
                      </button>
                    </p>
                  )}

                  <button type="button" onClick={detectGPS} disabled={gpsLoading} style={{
                    width: '100%', padding: '11px', borderRadius: 10, marginBottom: 8,
                    border: `2px solid ${lat ? '#2F8C88' : '#4A90E2'}`,
                    background: lat ? '#E9F3F2' : '#EEF4FF',
                    color: lat ? '#2F8C88' : '#4A90E2', fontSize: 13, fontWeight: 700, cursor: 'pointer',
                  }}>
                    {gpsLoading ? '取得中…' : lat ? '✓ 現在地を再取得' : '📡 現在地を自動取得'}
                  </button>
                  {gpsError && <p style={{ color: '#B23A2E', fontSize: 12, margin: '0 0 8px' }}>{gpsError}</p>}

                  {/* 住所検索（任意・折りたたみ） */}
                  <button type="button" onClick={() => setShowAddressSearch(v => !v)} style={{
                    width: '100%', padding: '10px', borderRadius: 10, marginBottom: showAddressSearch ? 8 : 0,
                    border: '1.5px solid #D7CFB8', background: '#F4F1E8',
                    color: '#55524A24A', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                  }}>
                    {showAddressSearch ? '▲ 住所検索を閉じる' : '🔍 住所・地名で検索する'}
                  </button>

                  {showAddressSearch && (
                    <div style={{ marginTop: 8 }}>
                      <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                        <input
                          type="text" value={addressQuery}
                          onChange={e => setAddressQuery(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); searchAddress(); } }}
                          placeholder="地名・住所で検索"
                          style={{ ...inputStyle, flex: 1, fontSize: 16, padding: '14px 16px' }}
                        />
                        <button type="button" onClick={searchAddress} disabled={addressSearching} style={{
                          padding: '0 18px', borderRadius: 10, border: 'none',
                          background: '#4A90E2', color: '#fff', cursor: 'pointer', fontSize: 15, fontWeight: 700, whiteSpace: 'nowrap',
                        }}>{addressSearching ? '…' : '🔍 検索'}</button>
                      </div>

                      {addressCandidates.length > 0 && (
                        <div style={{ border: '1px solid #E9E3D2', borderRadius: 10, overflow: 'hidden', marginBottom: 8 }}>
                          {addressCandidates.map((c, i) => (
                            <button key={i} type="button" onClick={() => {
                              setLat(parseFloat(c.lat)); setLng(parseFloat(c.lon));
                              setAddressQuery(c.display_name.split(',')[0]); setAddressCandidates([]);
                            }} style={{
                              width: '100%', padding: '13px 14px', background: '#fff',
                              border: 'none', borderBottom: i < addressCandidates.length - 1 ? '1px solid #f5f5f5' : 'none',
                              cursor: 'pointer', textAlign: 'left' as const, fontSize: 14, color: '#23231F',
                            }}>
                              📍 {c.display_name.split(',').slice(0, 3).join(', ')}
                            </button>
                          ))}
                        </div>
                      )}
                      {addressError && <p style={{ color: '#B23A2E', fontSize: 12, margin: '0 0 6px' }}>{addressError}</p>}
                    </div>
                  )}
                </div>

                {/* くわしく記録する トグル */}
                <button
                  type="button"
                  onClick={() => setShowAdvanced(v => !v)}
                  style={{
                    width: '100%', padding: '12px', borderRadius: 12, marginBottom: 12,
                    border: `1.5px dashed ${showAdvanced ? '#566246' : '#D7CFB8'}`,
                    background: showAdvanced ? '#E6E9DE' : '#F4F1E8',
                    color: showAdvanced ? '#566246' : '#726C5E',
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
                          <p style={{ fontSize: 12, color: '#726C5E', margin: '0 0 4px' }}>{label}</p>
                          <textarea value={val} onChange={e => set(e.target.value)} placeholder={ph} rows={2} style={inputStyle} />
                        </div>
                      ))}
                    </section>

                    {/* 強度は感情ピッカー直下（EmotionPicker内蔵の5ドット）へ統合済み */}

                    {/* カテゴリ */}
                    <section>
                      <label style={labelStyle}>🏷 何の種類？</label>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {CATEGORIES.map(c => (
                          <button key={c.key} type="button"
                            onClick={() => setCategoryKey(categoryKey === c.key ? null : c.key)} style={{
                              padding: '6px 11px', borderRadius: 20, fontSize: 13, cursor: 'pointer',
                              border: `1.5px solid ${categoryKey === c.key ? '#55524A' : '#D7CFB8'}`,
                              background: categoryKey === c.key ? '#55524A' : '#fff',
                              color: categoryKey === c.key ? '#fff' : '#55524A24A',
                            }}>{c.emoji} {c.label}</button>
                        ))}
                      </div>
                    </section>

                    {/* 人・もの・こと（ヒトマップの本義＝人との出会いの記録。「人」を選んだら出会いの中身を促す） */}
                    <section>
                      <label style={labelStyle}>👤 人・もの・こと？</label>
                      <div style={{ display: 'flex', gap: 6 }}>
                        {TRACE_TYPES.map(t => (
                          <button key={t.key} type="button"
                            onClick={() => setTraceTypeKey(traceTypeKey === t.key ? null : t.key)} style={{
                              flex: 1, padding: '10px 6px', borderRadius: 10, fontSize: 13, cursor: 'pointer',
                              border: `2px solid ${traceTypeKey === t.key ? t.color : '#D7CFB8'}`,
                              background: traceTypeKey === t.key ? t.color + '18' : '#fff',
                              color: traceTypeKey === t.key ? t.color : '#55524A24A',
                              fontWeight: traceTypeKey === t.key ? 700 : 400,
                            }}>
                            {t.emoji} {t.label}
                          </button>
                        ))}
                      </div>
                      {traceTypeKey === 'person' && (
                        <div style={{ marginTop: 10, padding: '12px', borderRadius: 10, background: '#F7F0FA', border: '1.5px solid #D7BDE2' }}>
                          <p style={{ fontSize: 12.5, color: '#6C3483', margin: '0 0 8px', fontWeight: 700 }}>
                            🤝 人との出会いは、この町とあなたを結ぶいちばん強い縁になります
                          </p>
                          <p style={{ fontSize: 12, color: '#726C5E', margin: '0 0 4px' }}>誰と出会いましたか？</p>
                          <input type="text" value={companionTag} onChange={e => setCompanionTag(e.target.value)}
                            placeholder="例: 八百屋のおばあちゃん、宿のご主人" style={inputStyle} />
                          <p style={{ fontSize: 11, color: '#8C8579', margin: '6px 0 0' }}>
                            もらった言葉や交わした話は「🔍 もっと深く」の欄に残しておくと、後で読み返したとき宝物になります
                          </p>
                        </div>
                      )}
                    </section>

                    {/* 過去の記憶：正確な日付を思い出せなくても、だいたいの年でOKにする（ご年配の方の思い出も記録しやすいように） */}
                    <section>
                      <button type="button" onClick={() => setIsPastMemory(v => !v)} style={{
                        width: '100%', padding: '16px', borderRadius: 10, cursor: 'pointer',
                        border: `2px solid ${isPastMemory ? '#9C6B23' : '#D7CFB8'}`,
                        background: isPastMemory ? '#FFFBF0' : '#fff',
                        color: isPastMemory ? '#856404' : '#726C5E', fontWeight: isPastMemory ? 700 : 400, fontSize: 16,
                      }}>
                        {isPastMemory ? '🕰 昔の思い出として登録する' : '📍 今の記録として登録する'}
                      </button>
                      {isPastMemory && (
                        <div style={{ marginTop: 10 }}>
                          <p style={{ fontSize: 13, color: '#726C5E', margin: '0 0 8px' }}>
                            何十年も前の思い出でも大丈夫です。だいたいの年でけっこうです。
                          </p>
                          <div style={{ display: 'flex', gap: 8 }}>
                            <select value={memoryYear} onChange={e => setMemoryYear(e.target.value)}
                              style={{ ...inputStyle, fontSize: 16, flex: 1.4 }}>
                              <option value="">年を選ぶ</option>
                              {MEMORY_YEARS.map((y) => (
                                <option key={y} value={y}>{y}年</option>
                              ))}
                            </select>
                            <select value={memorySeason} onChange={e => setMemorySeason(e.target.value)}
                              style={{ ...inputStyle, fontSize: 16, flex: 1 }}>
                              {MEMORY_SEASONS.map((s) => (
                                <option key={s.key} value={s.key}>{s.label}</option>
                              ))}
                            </select>
                          </div>
                        </div>
                      )}
                    </section>

                    {/* タグ */}
                    <section>
                      <label style={labelStyle}>🏷️ タグ（自由入力）</label>
                      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 6 }}>
                        {customTags.map(tag => (
                          <span key={tag} style={{
                            padding: '4px 10px', borderRadius: 20, fontSize: 12,
                            background: '#E9E3D2', color: '#3E3B34',
                            display: 'flex', alignItems: 'center', gap: 4,
                          }}>
                            #{tag}
                            <button type="button" onClick={() => setCustomTags(tags => tags.filter(t => t !== tag))}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, color: '#8C8579', padding: 0 }}>×</button>
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
                          padding: '0 12px', borderRadius: 10, border: '1.5px solid #D7CFB8', background: '#fff', cursor: 'pointer', fontSize: 13, whiteSpace: 'nowrap',
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
                            border: `2px solid ${val ? '#2F8C88' : '#D7CFB8'}`,
                            background: val ? '#E9F3F2' : '#fff', color: val ? '#2F8C88' : '#8C8579',
                            fontWeight: val ? 700 : 400, cursor: 'pointer',
                          }}>{label}</button>
                        ))}
                      </div>
                    </section>

                    {/* ニックネーム + 同行者 + 実験回コード */}
                    <section>
                      <label style={labelStyle}>👤 ニックネーム（任意）</label>
                      <input type="text" value={nickname} onChange={e => setNickname(e.target.value)}
                        placeholder="匿名でもOK" style={inputStyle} />
                    </section>

                    {/* 「人」を選んだ場合は上の出会い欄で入力済みのため二重表示しない */}
                    {traceTypeKey !== 'person' && (
                      <section>
                        <label style={labelStyle}>🧑‍🤝‍🧑 誰と一緒に見つけた？（任意）</label>
                        <input type="text" value={companionTag} onChange={e => setCompanionTag(e.target.value)}
                          placeholder="例: 田中さん、地元の人と2人で" style={inputStyle} />
                      </section>
                    )}

                    <section style={{ padding: '10px', background: '#F8F9FA', borderRadius: 10, marginBottom: 0 }}>
                      <label style={{ ...labelStyle, fontSize: 12, color: '#726C5E', marginBottom: 4 }}>🔖 実験回コード（グループ共通）</label>
                      <input type="text" value={sessionCode} onChange={e => saveSessionCode(e.target.value)}
                        placeholder="例: yanaka-20260701" style={{ ...inputStyle, fontSize: 13, background: '#fff' }} />
                    </section>

                    {sessionCode && (
                      <section style={{ padding: '10px', background: '#F8F4E9', borderRadius: 10, marginBottom: 0, marginTop: 8 }}>
                        <label style={{ ...labelStyle, fontSize: 12, color: '#8A6B3F', marginBottom: 4 }}>🏳 チーム名（イベント参加時）</label>
                        <input type="text" value={team} onChange={e => setTeam(e.target.value)}
                          placeholder="例: 新宿チーム" style={{ ...inputStyle, fontSize: 13, background: '#fff' }} />
                        <p style={{ fontSize: 11, color: '#8C8579', margin: '4px 0 0' }}>
                          チーム名を入れると、この投稿はチームメンバー全員に見える公開投稿になります
                        </p>
                      </section>
                    )}
                  </div>
                )}
              </form>
            )}
          </div>
        )}

        {/* ─── 一覧 ─── */}
        {tab === 'list' && (
          <div style={{ height: '100%', overflowY: 'auto', padding: '12px 12px 80px', background: '#F4F1E8' }}>

            {/* 統計パネル */}
            <StatsPanel traces={filtered} sessionCode={sessionCode || undefined} />

            {/* マイ感情プロフィール */}
            {myProfile.length > 0 && (
              <div style={{
                background: '#FFF8FC', border: '1.5px solid #FFD6E7',
                borderRadius: 12, padding: '12px 14px', marginBottom: 14,
              }}>
                <p style={{ margin: '0 0 7px', fontSize: 12, fontWeight: 700, color: '#566246' }}>✨ あなたの感情プロフィール</p>
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
                  border: `1.5px solid ${!filterCategory ? '#3E3B34' : '#D7CFB8'}`,
                  background: !filterCategory ? '#3E3B34' : '#fff', color: !filterCategory ? '#fff' : '#55524A24A',
                }}>すべて</button>
                {CATEGORIES.filter(c => traces.some(t => t.category === c.key)).map(c => (
                  <button key={c.key} onClick={() => setFilterCategory(filterCategory === c.key ? null : c.key)} style={{
                    padding: '3px 9px', borderRadius: 16, fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0,
                    border: `1.5px solid ${filterCategory === c.key ? '#55524A' : '#D7CFB8'}`,
                    background: filterCategory === c.key ? '#55524A' : '#fff', color: filterCategory === c.key ? '#fff' : '#55524A24A',
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
                background: '#F3EDDE', border: '1.5px solid #8A6B3F33', borderRadius: 12,
                padding: '10px 14px', marginBottom: 12, fontSize: 12, color: '#8A6B3F',
              }}>
                🥾 歩いた順にカードをタップして選んでください（{routeSelection.length}件選択中、2件以上必要）
              </div>
            )}

            {/* カード一覧 */}
            {loading ? (
              <p style={{ color: '#8C8579', textAlign: 'center', marginTop: 40 }}>読み込み中…</p>
            ) : sorted.length === 0 ? (
              <div style={{ textAlign: 'center', marginTop: 50, color: '#A79E8A' }}>
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
                        avatarUrl={t.user_id ? avatarUrls[t.user_id] : undefined}
                        isOwn={!routeMode && isOwnTrace(t)}
                        onEdit={routeMode ? undefined : handleCardEdit}
                        onDelete={routeMode ? undefined : handleCardDelete}
                        onClick={() => routeMode ? toggleRouteSelection(t.id) : setSelectedTrace(t)}
                        onShowOnMap={routeMode ? undefined : handleShowOnMap}
                      />
                      {routeMode && (
                        <div style={{
                          position: 'absolute', top: 8, left: 8, width: 26, height: 26, borderRadius: 13,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          background: selectedIndex >= 0 ? '#8A6B3F' : 'rgba(255,255,255,0.85)',
                          color: selectedIndex >= 0 ? '#fff' : '#A79E8A',
                          border: selectedIndex >= 0 ? 'none' : '1.5px solid #D7CFB8',
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
          borderTop: '1px solid #E9E3D2', zIndex: 200, display: 'flex', flexDirection: 'column', gap: 8,
        }}>
          <input
            value={routeTitle}
            onChange={e => setRouteTitle(e.target.value)}
            placeholder="ルート名（例：谷中の路地を歩く道）"
            style={{ padding: '9px 12px', borderRadius: 8, border: '1.5px solid #D7CFB8', fontSize: 13 }}
          />
          <input
            value={routeNickname}
            onChange={e => setRouteNickname(e.target.value)}
            placeholder="ニックネーム（削除・編集時の確認用、任意）"
            style={{ padding: '9px 12px', borderRadius: 8, border: '1.5px solid #D7CFB8', fontSize: 13 }}
          />
          {currentUser && (
            <>
              <textarea
                value={routeHighlights}
                onChange={e => setRouteHighlights(e.target.value)}
                placeholder="見どころ・おすすめポイント（任意）"
                rows={2}
                style={{ padding: '9px 12px', borderRadius: 8, border: '1.5px solid #D7CFB8', fontSize: 13, fontFamily: 'inherit', resize: 'vertical' }}
              />
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#8A6B3F' }}>
                <input type="checkbox" checked={routeRecommend} onChange={e => setRouteRecommend(e.target.checked)} />
                ✨ おすすめルートとして公開申請する（運営の承認後、ルート一覧に掲載されます）
              </label>
            </>
          )}
          {routeSaveError && <p style={{ color: '#B23A2E', fontSize: 12, margin: 0 }}>{routeSaveError}</p>}
          <button
            onClick={saveRoute}
            disabled={!routeTitle.trim() || routeSelection.length < 2 || routeSaving}
            style={{
              padding: '12px', borderRadius: 10, border: 'none',
              background: (!routeTitle.trim() || routeSelection.length < 2 || routeSaving) ? '#D7CFB8' : '#8A6B3F',
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
          borderTop: '1px solid #E9E3D2', zIndex: 200,
        }}>
          {currentUser && (
            <div style={{ marginBottom: 8 }}>
              <p style={{ margin: '0 0 5px', fontSize: 11, color: '#726C5E', fontWeight: 700 }}>
                🔓 だれに見せる？
              </p>
              <div style={{ display: 'flex', gap: 5 }}>
              {([
                { key: 'private', label: '🔒 非公開' },
                { key: 'followers', label: '👥 フォロワー限定' },
                { key: 'pending_review', label: '🌏 全国公開を申請' },
              ] as const).map(v => (
                <button key={v.key} type="button" onClick={() => setPostVisibility(v.key)} style={{
                  flex: 1, padding: '6px 4px', borderRadius: 8, fontSize: 11, cursor: 'pointer',
                  border: `1.5px solid ${postVisibility === v.key ? '#2F8C88' : '#D7CFB8'}`,
                  background: postVisibility === v.key ? '#E9F3F2' : '#fff',
                  color: postVisibility === v.key ? '#2F8C88' : '#726C5E',
                  fontWeight: postVisibility === v.key ? 700 : 400,
                }}>{v.label}</button>
              ))}
              </div>
            </div>
          )}
          {submitError && (
            <p style={{ color: '#B23A2E', fontSize: 12, margin: '0 0 6px', textAlign: 'center' }}>{submitError}</p>
          )}
          <button type="submit" form="trace-form" disabled={!canSubmit} style={{
            width: '100%', padding: '15px',
            background: canSubmit
              ? `linear-gradient(135deg, #566246, #FF8C42)`
              : '#D7CFB8',
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

      {/* ── クイック記録（全タブ共通）：町歩き中も立ち止まらず、位置＋その場の感情をその場で記録する ── */}
      {tab !== 'post' && (
        <div style={{
          position: 'fixed', right: 16, bottom: tab === 'map' ? 150 : 78, zIndex: 600,
          display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8,
        }}>
          {quickToast && (
            <button
              onClick={() => { setQuickAddTrace(quickToast); setQuickToast(null); }}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2,
                padding: '10px 14px', borderRadius: 14, border: 'none', cursor: 'pointer',
                background: 'rgba(30,30,30,0.92)', color: '#fff', textAlign: 'right',
                boxShadow: '0 2px 10px rgba(0,0,0,0.25)', maxWidth: 220,
              }}
            >
              <span style={{ fontSize: 13, fontWeight: 700 }}>📍 記録しました</span>
              {quickToastUsedFallback ? (
                <span style={{ fontSize: 11, opacity: 0.8 }}>位置情報オフのため周辺の地点で記録・タップで場所を調整 →</span>
              ) : (
                <span style={{ fontSize: 11, opacity: 0.8 }}>タップで写真・ひとことを追加 →</span>
              )}
            </button>
          )}
          {quickRecordError && (
            <p style={{
              margin: 0, fontSize: 11, color: '#fff', background: '#B23A2E',
              padding: '5px 10px', borderRadius: 8, maxWidth: 220, textAlign: 'right',
            }}>{quickRecordError}</p>
          )}
          {tab === 'map' && quickTapPos && quickRecordStage === 'idle' && (
            <button
              type="button"
              onClick={() => setQuickTapPos(null)}
              style={{
                display: 'flex', alignItems: 'center', gap: 4,
                padding: '6px 12px', borderRadius: 14, border: 'none', cursor: 'pointer',
                background: '#566246', color: '#fff', fontSize: 11.5, fontWeight: 700,
                boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
              }}
            >
              <PinIcon size={12} /> タップした場所に記録 ✕取消
            </button>
          )}
          {quickRecordStage === 'picking-emotion' && quickPendingPos && (
            <div style={{
              background: colors.surface, borderRadius: 16, padding: '14px 14px 12px',
              boxShadow: shadows.floating, maxWidth: 280, textAlign: 'left',
            }}>
              <p style={{ margin: '0 0 8px', fontSize: 12, fontWeight: 700, color: colors.textFaint }}>
                今どんな気持ち？
              </p>
              <EmotionPicker
                value={quickEmotionKeys}
                onChange={setQuickEmotionKeys}
                intensity={quickIntensity}
                onIntensityChange={setQuickIntensity}
              />
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 12 }}>
                <button
                  type="button"
                  onClick={cancelQuickRecord}
                  style={{ border: 'none', background: 'transparent', color: colors.textFaint, fontSize: 12, cursor: 'pointer', padding: '6px 0' }}
                >やめる</button>
                <button
                  type="button"
                  onClick={confirmQuickRecord}
                  disabled={quickEmotionKeys.length === 0}
                  style={{
                    flex: 1, padding: '10px 0', borderRadius: 10, border: 'none',
                    background: quickEmotionKeys.length === 0 ? '#ccc' : colors.gold, color: colors.surface,
                    fontWeight: 700, fontSize: 13, cursor: quickEmotionKeys.length === 0 ? 'not-allowed' : 'pointer',
                  }}
                >この気持ちで記録する →</button>
              </div>
            </div>
          )}
          <button
            type="button"
            onClick={beginQuickRecord}
            disabled={quickRecordStage !== 'idle'}
            style={{
              height: 52, padding: '0 22px', borderRadius: 26, border: 'none',
              background: colors.gold, color: colors.surface,
              fontWeight: 700, fontSize: 15, cursor: quickRecordStage !== 'idle' ? 'wait' : 'pointer',
              boxShadow: shadows.floating, opacity: quickRecordStage !== 'idle' ? 0.7 : 1,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              whiteSpace: 'nowrap',
            }}
          >
            {quickRecordStage === 'resolving-position' ? '位置を確認中…'
              : quickRecordStage === 'picking-emotion' ? '感情を選んでください ↑'
              : quickRecordStage === 'submitting' ? '記録中…'
              : (
                <>
                  <span style={{ display: 'inline-flex' }}><PinIcon size={18} /></span>
                  <span>痕跡を見つけた</span>
                </>
              )}
          </button>
        </div>
      )}

      {/* ── ボトムナビ ── */}
      <BottomNav active={tab} onTabChange={setTab} />

      {/* ── モーダル ── */}
      {selectedTrace && (
        <TraceDetail
          key={selectedTrace.id}
          trace={selectedTrace}
          isOwn={isOwnTrace(selectedTrace)}
          initialEditing={openInEditMode}
          onClose={() => { setSelectedTrace(null); setOpenInEditMode(false); }}
          onUpdate={handleTraceUpdate}
          onDelete={handleTraceDelete}
          onNavigateTo={t => { setOpenInEditMode(false); setSelectedTrace(t); }}
          onFilterEmotion={key => { setFilterEmotion(key); setSelectedTrace(null); setTab('map'); }}
        />
      )}
      {quickAddTrace && (
        <QuickAddSheet
          key={quickAddTrace.id}
          trace={quickAddTrace}
          onClose={() => setQuickAddTrace(null)}
          onUpdate={handleQuickAddUpdate}
        />
      )}
      {unexploredOpen && (
        <>
          <div onClick={() => setUnexploredOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1000 }} />
          <div style={{
            position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 1001,
            background: '#fff', borderRadius: '20px 20px 0 0', maxHeight: '70dvh', overflowY: 'auto',
            padding: '18px 16px calc(18px + env(safe-area-inset-bottom))', boxShadow: '0 -4px 30px rgba(0,0,0,0.18)',
          }}>
            <p style={{ margin: '0 0 2px', fontWeight: 800, fontSize: 16 }}>🧭 眠っている痕跡を探す</p>
            <p style={{ margin: '0 0 16px', fontSize: 12, color: '#726C5E' }}>現在地の近くで、まだ記録が少ない・全くない町を提案します</p>

            {!userPos ? (
              <p style={{ fontSize: 13, color: '#B23A2E' }}>現在地が分からないため探せません。「📍 近く」で位置を取得してください</p>
            ) : unexploredLoading ? (
              <p style={{ fontSize: 13, color: '#726C5E' }}>探しています…（数秒かかります）</p>
            ) : unexploredResult && (unexploredResult.sparse.length > 0 || unexploredResult.blank.length > 0) ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {unexploredResult.blank.length > 0 && (
                  <div>
                    <p style={{ margin: '0 0 8px', fontSize: 12, color: '#8A6B3F', fontWeight: 700 }}>⚪ まだ誰の痕跡もない町</p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {unexploredResult.blank.map(b => (
                        <button key={b.region} onClick={() => goToUnexploredRegion(b.region)} style={{
                          textAlign: 'left', padding: '10px 12px', borderRadius: 10, border: '1.5px solid #F3EDDE',
                          background: '#F8F4E9', cursor: 'pointer', fontSize: 13, color: '#23231F',
                        }}>
                          <strong>{b.region}</strong>
                          <span style={{ color: '#726C5E', fontSize: 11 }}> ・ {b.direction}へ約{b.distanceKm}km</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {unexploredResult.sparse.length > 0 && (
                  <div>
                    <p style={{ margin: '0 0 8px', fontSize: 12, color: '#2F8C88', fontWeight: 700 }}>🌱 記録がまだ少ない町</p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {unexploredResult.sparse.map(s => (
                        <button key={s.region} onClick={() => goToUnexploredRegion(s.region)} style={{
                          textAlign: 'left', padding: '10px 12px', borderRadius: 10, border: '1.5px solid #E9F3F2',
                          background: '#F3FDFC', cursor: 'pointer', fontSize: 13, color: '#23231F',
                        }}>
                          <strong>{s.region}</strong>
                          <span style={{ color: '#726C5E', fontSize: 11 }}> ・ {s.count}件 ・ 約{s.distanceKm}km</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : unexploredResult ? (
              <p style={{ fontSize: 13, color: '#726C5E' }}>近くはすでによく歩かれているようです。範囲を広げて探してみましょう。</p>
            ) : null}
          </div>
        </>
      )}
    </div>
  );
}
