'use client';

// 公開イベント：route/relay/煩悩イベントの作成・管理。page.tsx monolith分割で切り出し。
import { useCallback, useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import type { Route, Trace } from '@/lib/types';
import { getEmotion } from '@/lib/emotions';
import { Card, inputStyle } from '@/components/admin/adminShared';

const LocationPickerMap = dynamic(() => import('@/components/form/LocationPickerMap'), {
  ssr: false,
  loading: () => <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f0f0f0', color: '#aaa', fontSize: 12 }}>地図を読み込み中…</div>,
});

export function isoToInputValue(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
export function inputValueToIso(v: string): string | null {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

interface EventFieldsForm {
  event_slug: string;
  event_cover_url: string;
  event_starts_at: string;
  event_ends_at: string;
  event_area: string;
  event_mode: 'route' | 'relay' | 'bonno';
  event_session_code: string;
  event_start_lat: number | null;
  event_start_lng: number | null;
  event_start_label: string;
  event_end_lat: number | null;
  event_end_lng: number | null;
  event_end_label: string;
  event_waypoints: { lat: number; lng: number; label: string }[];
  event_fee: string;
  event_meeting_info: string;
  event_photo_urls: string[];
  is_public_recommendation: boolean;
  bonno_requires_moderation: boolean;
}

const emptyEventFields: EventFieldsForm = {
  event_slug: '', event_cover_url: '', event_starts_at: '', event_ends_at: '', event_area: '',
  event_mode: 'route', event_session_code: '',
  event_start_lat: null, event_start_lng: null, event_start_label: '',
  event_end_lat: null, event_end_lng: null, event_end_label: '',
  event_waypoints: [],
  event_fee: '', event_meeting_info: '', event_photo_urls: [],
  is_public_recommendation: false,
  bonno_requires_moderation: false,
};

interface RelayCreateForm {
  title: string;
  description: string;
  event_mode: 'relay' | 'bonno';
  event_session_code: string;
  event_slug: string;
  event_cover_url: string;
  event_area: string;
  event_starts_at: string;
  event_ends_at: string;
  event_start_lat: number | null;
  event_start_lng: number | null;
  event_start_label: string;
  event_end_lat: number | null;
  event_end_lng: number | null;
  event_end_label: string;
  event_waypoints: { lat: number; lng: number; label: string }[];
  event_fee: string;
  event_meeting_info: string;
  event_photo_urls: string[];
  bonno_requires_moderation: boolean;
}

const emptyRelayForm: RelayCreateForm = {
  title: '', description: '', event_mode: 'relay', event_session_code: '', event_slug: '', event_cover_url: '',
  event_area: '', event_starts_at: '', event_ends_at: '',
  event_start_lat: null, event_start_lng: null, event_start_label: '',
  event_end_lat: null, event_end_lng: null, event_end_label: '',
  event_waypoints: [],
  event_fee: '', event_meeting_info: '', event_photo_urls: [],
  bonno_requires_moderation: false,
};

// スタート/ゴール地点ピッカー：地図タップで座標を決め、ラベルを添える（イベントページのRouteMap/TraceMapに反映される）
function StartEndPicker({ kind, lat, lng, label, onChange }: {
  kind: 'start' | 'end';
  lat: number | null; lng: number | null; label: string;
  onChange: (v: { lat: number | null; lng: number | null; label: string }) => void;
}) {
  const [open, setOpen] = useState(false);
  const emoji = kind === 'start' ? '🚩' : '🏁';
  const title = kind === 'start' ? 'スタート地点' : 'ゴール地点';
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: open ? 6 : 0 }}>
        <button type="button" onClick={() => setOpen(v => !v)} style={{
          padding: '6px 12px', borderRadius: 8, fontSize: 12, cursor: 'pointer',
          border: `1.5px solid ${lat != null ? (kind === 'start' ? '#27AE60' : '#E55039') : '#ddd'}`,
          background: lat != null ? (kind === 'start' ? '#E8F8F1' : '#FFF0F0') : '#fff',
          color: lat != null ? (kind === 'start' ? '#27AE60' : '#E55039') : '#888', fontWeight: 700,
        }}>
          {emoji} {title}{lat != null ? '設定済み' : '未設定'} {open ? '▴' : '▾'}
        </button>
        {lat != null && (
          <button type="button" onClick={() => onChange({ lat: null, lng: null, label: '' })} style={{
            background: 'none', border: 'none', color: '#ccc', fontSize: 11, cursor: 'pointer',
          }}>解除</button>
        )}
      </div>
      {open && (
        <div style={{ marginTop: 6 }}>
          <input placeholder={`${title}の名前（例：渋谷駅ハチ公口）`} value={label}
            onChange={e => onChange({ lat, lng, label: e.target.value })}
            style={{ ...inputStyle, width: '100%', boxSizing: 'border-box', marginBottom: 6 }} />
          <div style={{ height: 200, borderRadius: 8, overflow: 'hidden', border: '1px solid #eee' }}>
            <LocationPickerMap
              lat={lat ?? 35.681236} lng={lng ?? 139.767125}
              onChange={(la, ln) => onChange({ lat: la, lng: ln, label })}
            />
          </div>
          <p style={{ margin: '4px 0 0', fontSize: 11, color: '#aaa' }}>地図をタップして{title}を指定してください</p>
        </div>
      )}
    </div>
  );
}

// フィールドの下に添える、非エンジニアにも分かる一言説明
function Hint({ children }: { children: React.ReactNode }) {
  return <p style={{ margin: '-2px 0 2px', fontSize: 11, color: '#aaa', lineHeight: 1.5 }}>{children}</p>;
}

// 経由地点：スタートとゴールの間に何箇所でも置け、順番どおりに線でつながる
function WaypointsEditor({ waypoints, onChange }: {
  waypoints: { lat: number; lng: number; label: string }[];
  onChange: (waypoints: { lat: number; lng: number; label: string }[]) => void;
}) {
  const [open, setOpen] = useState(false);

  function addWaypoint() {
    onChange([...waypoints, { lat: 35.681236, lng: 139.767125, label: '' }]);
    setOpen(true);
  }
  function updateWaypoint(i: number, patch: Partial<{ lat: number; lng: number; label: string }>) {
    onChange(waypoints.map((w, idx) => idx === i ? { ...w, ...patch } : w));
  }
  function removeWaypoint(i: number) {
    onChange(waypoints.filter((_, idx) => idx !== i));
  }
  function moveWaypoint(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= waypoints.length) return;
    const next = [...waypoints];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  }

  return (
    <div>
      <button type="button" onClick={() => setOpen(v => !v)} style={{
        padding: '6px 12px', borderRadius: 8, fontSize: 12, cursor: 'pointer',
        border: `1.5px solid ${waypoints.length > 0 ? '#38ADA9' : '#ddd'}`,
        background: waypoints.length > 0 ? '#E8F8F7' : '#fff',
        color: waypoints.length > 0 ? '#38ADA9' : '#888', fontWeight: 700,
      }}>
        📍 経由地点{waypoints.length > 0 ? `（${waypoints.length}件）` : 'なし'} {open ? '▴' : '▾'}
      </button>
      {open && (
        <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {waypoints.map((w, i) => (
            <div key={i} style={{ border: '1px solid #eee', borderRadius: 8, padding: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                <span style={{
                  width: 20, height: 20, borderRadius: '50%', background: '#38ADA9', color: '#fff',
                  fontSize: 11, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>{i + 1}</span>
                <input placeholder={`経由地点${i + 1}の名前（例：〇〇商店街）`} value={w.label}
                  onChange={e => updateWaypoint(i, { label: e.target.value })}
                  style={{ ...inputStyle, flex: 1 }} />
                <button type="button" onClick={() => moveWaypoint(i, -1)} disabled={i === 0} style={{
                  background: 'none', border: 'none', cursor: i === 0 ? 'default' : 'pointer', color: i === 0 ? '#eee' : '#888', fontSize: 14,
                }}>▲</button>
                <button type="button" onClick={() => moveWaypoint(i, 1)} disabled={i === waypoints.length - 1} style={{
                  background: 'none', border: 'none', cursor: i === waypoints.length - 1 ? 'default' : 'pointer', color: i === waypoints.length - 1 ? '#eee' : '#888', fontSize: 14,
                }}>▼</button>
                <button type="button" onClick={() => removeWaypoint(i)} style={{
                  background: 'none', border: 'none', color: '#E55039', fontSize: 12, cursor: 'pointer',
                }}>削除</button>
              </div>
              <div style={{ height: 160, borderRadius: 8, overflow: 'hidden', border: '1px solid #eee' }}>
                <LocationPickerMap lat={w.lat} lng={w.lng} onChange={(la, ln) => updateWaypoint(i, { lat: la, lng: ln })} />
              </div>
            </div>
          ))}
          <button type="button" onClick={addWaypoint} style={{
            padding: '8px 0', borderRadius: 8, border: '1.5px dashed #38ADA9',
            background: '#fff', color: '#38ADA9', fontWeight: 700, fontSize: 12, cursor: 'pointer',
          }}>＋ 経由地点を追加</button>
        </div>
      )}
    </div>
  );
}

// イベント写真（複数枚）：1枚目が自動でヒーロー画像になる
function EventPhotosUploader({ urls, onChange }: { urls: string[]; onChange: (urls: string[]) => void }) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const MAX_PHOTOS = 6;

  async function handleFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []).slice(0, MAX_PHOTOS - urls.length);
    if (files.length === 0) return;
    setUploading(true);
    setError('');
    try {
      const { uploadTracePhoto } = await import('@/lib/supabase/upload');
      const uploaded: string[] = [];
      for (const file of files) uploaded.push(await uploadTracePhoto(file));
      onChange([...urls, ...uploaded]);
    } catch (err) {
      setError(err instanceof Error ? err.message : '画像のアップロードに失敗しました');
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }
  function removeAt(i: number) {
    onChange(urls.filter((_, idx) => idx !== i));
  }

  return (
    <div>
      {urls.length > 0 && (
        <div style={{ display: 'flex', gap: 6, overflowX: 'auto', marginBottom: 6 }}>
          {urls.map((url, i) => (
            <div key={i} style={{ position: 'relative', flexShrink: 0 }}>
              <img src={url} alt="" style={{ width: 90, height: 70, objectFit: 'cover', borderRadius: 8, display: 'block' }} />
              {i === 0 && (
                <span style={{
                  position: 'absolute', top: 2, left: 2, padding: '1px 6px', borderRadius: 8,
                  background: 'rgba(0,0,0,0.6)', color: '#fff', fontSize: 9, fontWeight: 700,
                }}>ヒーロー</span>
              )}
              <button type="button" onClick={() => removeAt(i)} style={{
                position: 'absolute', top: -6, right: -6, width: 20, height: 20, borderRadius: '50%',
                background: 'rgba(0,0,0,0.65)', color: '#fff', border: 'none', fontSize: 11, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>✕</button>
            </div>
          ))}
        </div>
      )}
      <input ref={inputRef} type="file" accept="image/*" multiple onChange={handleFiles} style={{ display: 'none' }} />
      <button type="button" onClick={() => inputRef.current?.click()} disabled={uploading || urls.length >= MAX_PHOTOS} style={{
        width: '100%', padding: '9px 0', borderRadius: 8, border: '1.5px solid #ddd',
        background: '#fafafa', color: '#555', fontSize: 12, fontWeight: 700,
        cursor: uploading ? 'wait' : 'pointer',
      }}>{uploading ? 'アップロード中…' : `🖼 写真を追加（任意・最大${MAX_PHOTOS}枚、${urls.length}/${MAX_PHOTOS}）`}</button>
      {error && <p style={{ margin: '6px 0 0', fontSize: 11, color: '#E55039' }}>{error}</p>}
    </div>
  );
}

export default function RoutesTab({ authHeaders }: { authHeaders: () => HeadersInit }) {
  const [routes, setRoutes] = useState<Route[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [sponsorName, setSponsorName] = useState('');
  const [sponsorUrl, setSponsorUrl] = useState('');
  const [eventEditingId, setEventEditingId] = useState<string | null>(null);
  const [eventFields, setEventFields] = useState<EventFieldsForm>(emptyEventFields);
  const [eventSaving, setEventSaving] = useState(false);
  const [showRelayCreate, setShowRelayCreate] = useState(false);
  const [relayForm, setRelayForm] = useState<RelayCreateForm>(emptyRelayForm);
  const [relaySaving, setRelaySaving] = useState(false);
  const [expandedRouteId, setExpandedRouteId] = useState<string | null>(null);
  const [routeTraces, setRouteTraces] = useState<Record<string, Trace[]>>({});
  const [routeTracesLoading, setRouteTracesLoading] = useState<string | null>(null);

  async function toggleExpand(id: string) {
    if (expandedRouteId === id) { setExpandedRouteId(null); return; }
    setExpandedRouteId(id);
    if (!routeTraces[id]) {
      setRouteTracesLoading(id);
      try {
        const res = await fetch(`/api/routes/${id}`).then(r => r.json());
        if (res.ok) setRouteTraces(prev => ({ ...prev, [id]: res.traces ?? [] }));
      } finally {
        setRouteTracesLoading(null);
      }
    }
  }

  const load = useCallback(() => {
    setLoading(true);
    fetch('/api/routes')
      .then(r => r.json())
      .then(d => { if (d.ok) setRoutes(d.routes); else setError(d.error ?? '取得に失敗しました'); })
      .catch(() => setError('通信エラー'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  function startEdit(r: Route) {
    setEditingId(r.id);
    setSponsorName(r.sponsor_name ?? '');
    setSponsorUrl(r.sponsor_url ?? '');
  }

  async function saveSponsor(id: string) {
    const res = await fetch(`/api/admin/routes/${id}`, {
      method: 'PATCH', headers: authHeaders(),
      body: JSON.stringify({ sponsor_name: sponsorName || null, sponsor_url: sponsorUrl || null }),
    });
    const data = await res.json();
    if (data.ok) { setEditingId(null); load(); } else setError(data.error ?? '更新に失敗しました');
  }

  function startEventEdit(r: Route) {
    setEventEditingId(r.id);
    setEventFields({
      event_slug: r.event_slug ?? '',
      event_cover_url: r.event_cover_url ?? '',
      event_starts_at: isoToInputValue(r.event_starts_at),
      event_ends_at: isoToInputValue(r.event_ends_at),
      event_area: r.event_area ?? '',
      event_mode: r.event_mode === 'relay' ? 'relay' : r.event_mode === 'bonno' ? 'bonno' : 'route',
      event_session_code: r.event_session_code ?? '',
      event_start_lat: r.event_start_lat, event_start_lng: r.event_start_lng, event_start_label: r.event_start_label ?? '',
      event_end_lat: r.event_end_lat, event_end_lng: r.event_end_lng, event_end_label: r.event_end_label ?? '',
      event_waypoints: r.event_waypoints ?? [],
      event_fee: r.event_fee ?? '', event_meeting_info: r.event_meeting_info ?? '',
      event_photo_urls: r.event_photo_urls ?? (r.event_cover_url ? [r.event_cover_url] : []),
      is_public_recommendation: r.is_public_recommendation ?? false,
      bonno_requires_moderation: r.bonno_requires_moderation ?? false,
    });
  }

  async function saveEventFields(id: string) {
    setEventSaving(true);
    try {
      const res = await fetch(`/api/admin/routes/${id}`, {
        method: 'PATCH', headers: authHeaders(),
        body: JSON.stringify({
          event_slug: eventFields.event_slug.trim() || null,
          event_cover_url: eventFields.event_photo_urls[0] ?? null,
          event_photo_urls: eventFields.event_photo_urls.length > 0 ? eventFields.event_photo_urls : null,
          event_starts_at: inputValueToIso(eventFields.event_starts_at),
          event_ends_at: inputValueToIso(eventFields.event_ends_at),
          event_area: eventFields.event_area.trim() || null,
          event_mode: eventFields.event_mode,
          event_session_code: eventFields.event_mode === 'relay' ? (eventFields.event_session_code.trim() || null) : null,
          event_start_lat: eventFields.event_start_lat, event_start_lng: eventFields.event_start_lng,
          event_start_label: eventFields.event_start_label.trim() || null,
          event_end_lat: eventFields.event_end_lat, event_end_lng: eventFields.event_end_lng,
          event_end_label: eventFields.event_end_label.trim() || null,
          event_waypoints: eventFields.event_waypoints.length > 0 ? eventFields.event_waypoints : null,
          event_fee: eventFields.event_fee.trim() || null,
          event_meeting_info: eventFields.event_meeting_info.trim() || null,
          is_public_recommendation: eventFields.is_public_recommendation,
          bonno_requires_moderation: eventFields.bonno_requires_moderation,
        }),
      });
      const data = await res.json();
      if (data.ok) { setEventEditingId(null); load(); } else setError(data.error ?? '更新に失敗しました');
    } finally {
      setEventSaving(false);
    }
  }

  async function createRelayEvent() {
    if (!relayForm.title.trim()) { setError('タイトルは必須です'); return; }
    setRelaySaving(true);
    try {
      const res = await fetch('/api/routes', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: relayForm.title.trim(),
          description: relayForm.description.trim() || null,
          trace_ids: [],
          event_mode: 'relay',
          event_session_code: relayForm.event_session_code.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!data.ok) { setError(data.error ?? '作成に失敗しました'); return; }

      // 続けて event_slug 等の公開情報を設定（bonno型は/api/routesが受けないため、ここでモードを確定させる）
      const patchRes = await fetch(`/api/admin/routes/${data.route.id}`, {
        method: 'PATCH', headers: authHeaders(),
        body: JSON.stringify({
          event_mode: relayForm.event_mode,
          event_slug: relayForm.event_slug.trim() || null,
          event_cover_url: relayForm.event_photo_urls[0] ?? null,
          event_photo_urls: relayForm.event_photo_urls.length > 0 ? relayForm.event_photo_urls : null,
          event_area: relayForm.event_area.trim() || null,
          event_starts_at: inputValueToIso(relayForm.event_starts_at),
          event_ends_at: inputValueToIso(relayForm.event_ends_at),
          event_start_lat: relayForm.event_start_lat, event_start_lng: relayForm.event_start_lng,
          event_start_label: relayForm.event_start_label.trim() || null,
          event_end_lat: relayForm.event_end_lat, event_end_lng: relayForm.event_end_lng,
          event_end_label: relayForm.event_end_label.trim() || null,
          event_waypoints: relayForm.event_waypoints.length > 0 ? relayForm.event_waypoints : null,
          event_fee: relayForm.event_fee.trim() || null,
          event_meeting_info: relayForm.event_meeting_info.trim() || null,
          bonno_requires_moderation: relayForm.bonno_requires_moderation,
        }),
      });
      const patchData = await patchRes.json();
      if (!patchData.ok) { setError(patchData.error ?? '公開情報の設定に失敗しました'); }

      setShowRelayCreate(false);
      setRelayForm(emptyRelayForm);
      load();
    } finally {
      setRelaySaving(false);
    }
  }

  async function reviewRoute(id: string, status: 'approved' | 'rejected') {
    const res = await fetch(`/api/admin/routes/${id}`, {
      method: 'PATCH', headers: authHeaders(),
      body: JSON.stringify({ review_status: status }),
    });
    const data = await res.json();
    if (data.ok) load(); else setError(data.error ?? '更新に失敗しました');
  }

  if (loading) return <p style={{ color: '#999' }}>読み込み中…</p>;

  const pendingRoutes = routes.filter(r => r.review_status === 'pending');

  return (
    <div>
      {error && <p style={{ color: '#E74C3C', fontSize: 13 }}>{error}</p>}

      {pendingRoutes.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <p style={{ margin: '0 0 8px', fontWeight: 800, fontSize: 14, color: '#B7791F' }}>✨ おすすめルート承認待ち（{pendingRoutes.length}件）</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {pendingRoutes.map(r => (
              <Card key={r.id} style={{ background: '#FFFAF0', border: '1px solid #F6E4B8' }}>
                <p style={{ margin: '0 0 4px', fontWeight: 700, fontSize: 14 }}>{r.title}</p>
                {r.description && <p style={{ margin: '0 0 6px', fontSize: 12, color: '#888' }}>{r.description}</p>}
                {r.highlights && (
                  <p style={{ margin: '0 0 8px', fontSize: 12, color: '#8E44AD', background: '#FBF6FF', padding: '8px 10px', borderRadius: 8, whiteSpace: 'pre-wrap' }}>
                    👀 {r.highlights}
                  </p>
                )}
                <p style={{ margin: '0 0 8px', fontSize: 12, color: '#aaa' }}>{r.trace_ids.length}地点 ・ <a href={`/routes/${r.id}`} target="_blank" rel="noopener noreferrer" style={{ color: '#8E44AD' }}>プレビュー ↗</a></p>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => reviewRoute(r.id, 'approved')} style={{
                    flex: 1, padding: '7px 0', borderRadius: 8, border: 'none',
                    background: '#38ADA9', color: '#fff', fontWeight: 700, cursor: 'pointer', fontSize: 12,
                  }}>承認する</button>
                  <button onClick={() => reviewRoute(r.id, 'rejected')} style={{
                    flex: 1, padding: '7px 0', borderRadius: 8, border: '1px solid #ddd',
                    background: '#fff', color: '#E74C3C', cursor: 'pointer', fontSize: 12,
                  }}>却下する</button>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {showRelayCreate ? (
        <Card>
          <p style={{ margin: '0 0 10px', fontWeight: 800, fontSize: 14, color: '#38ADA9' }}>＋ 新規イベントを作成</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontSize: 11, color: '#666', fontWeight: 700 }}>イベント形式</label>
            <Hint>relay＝参加者が街で発見して投稿していく型。煩悩＝会場で参加者が煩悩を投稿し、壁一面に投影する型（煩悩オークションなど）。</Hint>
            <div style={{ display: 'flex', gap: 6 }}>
              <button onClick={() => setRelayForm(f => ({ ...f, event_mode: 'relay' }))} style={{
                flex: 1, padding: '7px 0', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 700,
                border: relayForm.event_mode === 'relay' ? '1.5px solid #38ADA9' : '1.5px solid #ddd',
                background: relayForm.event_mode === 'relay' ? '#38ADA9' : '#fff',
                color: relayForm.event_mode === 'relay' ? '#fff' : '#888',
              }}>🏃 relay（発見連鎖型）</button>
              <button onClick={() => setRelayForm(f => ({ ...f, event_mode: 'bonno' }))} style={{
                flex: 1, padding: '7px 0', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 700,
                border: relayForm.event_mode === 'bonno' ? '1.5px solid #B7791F' : '1.5px solid #ddd',
                background: relayForm.event_mode === 'bonno' ? '#B7791F' : '#fff',
                color: relayForm.event_mode === 'bonno' ? '#fff' : '#888',
              }}>🔥 煩悩（会場投影型）</button>
            </div>
            {relayForm.event_mode === 'bonno' && (
              <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 12, color: '#555', cursor: 'pointer', padding: '8px 10px', background: '#FFF8EC', borderRadius: 8 }}>
                <input type="checkbox" checked={relayForm.bonno_requires_moderation}
                  onChange={e => setRelayForm(f => ({ ...f, bonno_requires_moderation: e.target.checked }))}
                  style={{ marginTop: 2 }} />
                <span>投稿を運営が確認してから壁に出す（学校・法人向けイベントでは推奨）</span>
              </label>
            )}
            <label style={{ fontSize: 11, color: '#666', fontWeight: 700 }}>① イベント名</label>
            <input placeholder="例：ヒトマップ×山手線一周プロジェクト" value={relayForm.title}
              onChange={e => setRelayForm(f => ({ ...f, title: e.target.value }))} style={inputStyle} />
            <label style={{ fontSize: 11, color: '#666', fontWeight: 700 }}>② 説明文</label>
            <textarea placeholder="どんなイベントか、参加者に伝えたいことを書いてください" value={relayForm.description} rows={3}
              onChange={e => setRelayForm(f => ({ ...f, description: e.target.value }))} style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }} />

            {relayForm.event_mode === 'relay' && (
              <>
                <label style={{ fontSize: 11, color: '#666', fontWeight: 700 }}>③ 参加コード</label>
                <Hint>参加者が投稿するときにこの文字を入力してもらうと、投稿がこのイベントに自動でまとまります。</Hint>
                <input placeholder="例：yamanote2026（好きな英数字でOK）" value={relayForm.event_session_code}
                  onChange={e => setRelayForm(f => ({ ...f, event_session_code: e.target.value }))} style={inputStyle} />
              </>
            )}

            <label style={{ fontSize: 11, color: '#666', fontWeight: 700 }}>④ イベントページのアドレス</label>
            <Hint>「hitomap.com/events/○○」の○○の部分になります。英数字とハイフンだけで、他と被らない文字にしてください。</Hint>
            <input placeholder="例：yamanote-2026" value={relayForm.event_slug}
              onChange={e => setRelayForm(f => ({ ...f, event_slug: e.target.value }))} style={inputStyle} />

            <label style={{ fontSize: 11, color: '#666', fontWeight: 700 }}>⑤ イベント写真</label>
            <Hint>1枚目がページ上部の大きな画像になります。設定しなくてもきれいな色の背景が自動で使われます。</Hint>
            <EventPhotosUploader urls={relayForm.event_photo_urls} onChange={urls => setRelayForm(f => ({ ...f, event_photo_urls: urls }))} />

            <label style={{ fontSize: 11, color: '#666', fontWeight: 700 }}>⑥ エリア名</label>
            <Hint>ページ上部に表示される、開催場所のざっくりした名前です。</Hint>
            <input placeholder="例：山手線" value={relayForm.event_area}
              onChange={e => setRelayForm(f => ({ ...f, event_area: e.target.value }))} style={inputStyle} />

            <label style={{ fontSize: 11, color: '#666', fontWeight: 700 }}>⑦ 参加費（任意）</label>
            <Hint>「無料」「500円（当日集合場所で徴収）」のように自由に書いてください。</Hint>
            <input placeholder="例：無料" value={relayForm.event_fee}
              onChange={e => setRelayForm(f => ({ ...f, event_fee: e.target.value }))} style={inputStyle} />

            <label style={{ fontSize: 11, color: '#666', fontWeight: 700 }}>⑧ 集合場所・持ち物などの詳細（任意）</label>
            <Hint>参加者に事前に伝えておきたいことを自由に書いてください（例：集合時間・持ち物・雨天時の対応など）。</Hint>
            <textarea placeholder="例：JR渋谷駅ハチ公口に10時集合。歩きやすい靴でお越しください。雨天決行。" value={relayForm.event_meeting_info} rows={3}
              onChange={e => setRelayForm(f => ({ ...f, event_meeting_info: e.target.value }))} style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }} />

            <label style={{ fontSize: 11, color: '#666', fontWeight: 700 }}>⑨ 開催期間（任意）</label>
            <div style={{ display: 'flex', gap: 6 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <label style={{ fontSize: 10, color: '#aaa', display: 'block' }}>開始日時</label>
                <input type="datetime-local" value={relayForm.event_starts_at}
                  onChange={e => setRelayForm(f => ({ ...f, event_starts_at: e.target.value }))} style={{ ...inputStyle, width: '100%', boxSizing: 'border-box' }} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <label style={{ fontSize: 10, color: '#aaa', display: 'block' }}>終了日時</label>
                <input type="datetime-local" value={relayForm.event_ends_at}
                  onChange={e => setRelayForm(f => ({ ...f, event_ends_at: e.target.value }))} style={{ ...inputStyle, width: '100%', boxSizing: 'border-box' }} />
              </div>
            </div>

            {relayForm.event_mode === 'relay' && (
              <>
                <label style={{ fontSize: 11, color: '#666', fontWeight: 700 }}>⑩ スタート・ゴール地点（任意）</label>
                <Hint>歩くルートがまだ決まっていなくても、待ち合わせ場所だけ地図で先に決められます。</Hint>
                <StartEndPicker kind="start"
                  lat={relayForm.event_start_lat} lng={relayForm.event_start_lng} label={relayForm.event_start_label}
                  onChange={v => setRelayForm(f => ({ ...f, event_start_lat: v.lat, event_start_lng: v.lng, event_start_label: v.label }))} />
                <WaypointsEditor waypoints={relayForm.event_waypoints}
                  onChange={wp => setRelayForm(f => ({ ...f, event_waypoints: wp }))} />
                <StartEndPicker kind="end"
                  lat={relayForm.event_end_lat} lng={relayForm.event_end_lng} label={relayForm.event_end_label}
                  onChange={v => setRelayForm(f => ({ ...f, event_end_lat: v.lat, event_end_lng: v.lng, event_end_label: v.label }))} />
                <p style={{ margin: '-4px 0 0', fontSize: 11, color: '#aaa' }}>スタート→経由地点→ゴールの順で地図に線が引かれます。</p>
              </>
            )}
            <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
              <button onClick={createRelayEvent} disabled={relaySaving} style={{
                flex: 1, padding: '9px 0', borderRadius: 8, border: 'none',
                background: '#38ADA9', color: '#fff', fontWeight: 700, cursor: relaySaving ? 'wait' : 'pointer', fontSize: 13,
              }}>{relaySaving ? '作成中…' : '作成する'}</button>
              <button onClick={() => { setShowRelayCreate(false); setRelayForm(emptyRelayForm); }} style={{
                flex: 1, padding: '9px 0', borderRadius: 8, border: '1px solid #ddd',
                background: '#fff', color: '#888', cursor: 'pointer', fontSize: 13,
              }}>キャンセル</button>
            </div>
          </div>
        </Card>
      ) : (
        <button onClick={() => setShowRelayCreate(true)} style={{
          display: 'block', width: '100%', padding: '10px 0', borderRadius: 10, border: '1.5px dashed #38ADA9',
          background: '#fff', color: '#38ADA9', fontWeight: 700, fontSize: 13, cursor: 'pointer', marginBottom: 12,
        }}>＋ 新規イベントを作成（relay / 煩悩）</button>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {routes.length === 0 && <p style={{ color: '#aaa' }}>公開中のイベントはありません。</p>}
        {routes.map(r => (
          <Card key={r.id}>
            <p style={{ margin: '0 0 4px', fontWeight: 700, fontSize: 14 }}>{r.title}</p>
            {r.description && <p style={{ margin: '0 0 6px', fontSize: 12, color: '#666' }}>{r.description}</p>}
            {r.highlights && (
              <p style={{ margin: '0 0 6px', fontSize: 12, color: '#8E44AD', background: '#FBF6FF', padding: '6px 9px', borderRadius: 8, whiteSpace: 'pre-wrap' }}>
                👀 {r.highlights}
              </p>
            )}
            <p style={{ margin: '0 0 4px', fontSize: 12, color: '#888' }}>
              {r.trace_ids.length}地点 ・ {new Date(r.created_at).toLocaleDateString('ja-JP')}
              {r.sponsor_name && ` ・ 協賛：${r.sponsor_name}`}
              {r.review_status === 'approved' && <span style={{ color: '#38ADA9', fontWeight: 700 }}> ・ ✨承認済み</span>}
              {r.review_status === 'rejected' && <span style={{ color: '#E74C3C', fontWeight: 700 }}> ・ 却下済み</span>}
            </p>
            {r.trace_ids.length > 0 && (
              <button onClick={() => toggleExpand(r.id)} style={{
                background: 'none', border: 'none', color: '#38ADA9', fontSize: 12, fontWeight: 700, cursor: 'pointer', padding: 0, marginBottom: 8,
              }}>
                {expandedRouteId === r.id ? '▴ 地点を閉じる' : '▾ 地点の中身を見る'}
              </button>
            )}
            {expandedRouteId === r.id && (
              <div style={{ marginBottom: 8, paddingLeft: 4, borderLeft: '2px solid #eee' }}>
                {routeTracesLoading === r.id ? (
                  <p style={{ fontSize: 12, color: '#aaa', margin: 0 }}>読み込み中…</p>
                ) : (routeTraces[r.id] ?? []).length === 0 ? (
                  <p style={{ fontSize: 12, color: '#aaa', margin: 0 }}>地点データがありません。</p>
                ) : (
                  (routeTraces[r.id] ?? []).map((t, i) => (
                    <p key={t.id} style={{ margin: '2px 0', fontSize: 12, color: '#555', display: 'flex', gap: 6 }}>
                      <span style={{ color: '#bbb' }}>{i + 1}.</span>
                      {t.photo_url && <img src={t.photo_url} alt="" style={{ width: 18, height: 18, borderRadius: 4, objectFit: 'cover' }} />}
                      {t.title}
                      {getEmotion(t.emotion_key) && <span>{getEmotion(t.emotion_key)!.emoji}</span>}
                    </p>
                  ))
                )}
              </div>
            )}
            {r.event_slug && (
              <p style={{ margin: '0 0 8px', fontSize: 12 }}>
                <a href={`/events/${r.event_slug}`} target="_blank" rel="noopener noreferrer" style={{ color: r.event_mode === 'relay' ? '#38ADA9' : r.event_mode === 'bonno' ? '#B7791F' : '#8E44AD', fontWeight: 700 }}>
                  {r.event_mode === 'relay' ? '🏃 relay' : r.event_mode === 'bonno' ? '🔥 煩悩' : '🎪 route'} ・ /events/{r.event_slug} を公開中 ↗
                </a>
                {r.event_mode === 'relay' && r.event_session_code && (
                  <span style={{ marginLeft: 8, color: '#999' }}>コード: {r.event_session_code}</span>
                )}
                {r.event_mode === 'bonno' && (
                  <span style={{ marginLeft: 8 }}>
                    <a href={`/events/${r.event_slug}/wall`} target="_blank" rel="noopener noreferrer" style={{ color: '#B7791F', marginRight: 8 }}>投影ウォール ↗</a>
                    <a href={`/events/${r.event_slug}/console`} target="_blank" rel="noopener noreferrer" style={{ color: '#B7791F', marginRight: 8 }}>運営 ↗</a>
                    <a href={`/events/${r.event_slug}/invest`} target="_blank" rel="noopener noreferrer" style={{ color: '#B7791F', marginRight: 8 }}>投資ページ ↗</a>
                    <a href={`/events/${r.event_slug}/board`} target="_blank" rel="noopener noreferrer" style={{ color: '#B7791F' }}>投資ボード ↗</a>
                  </span>
                )}
              </p>
            )}

            {editingId === r.id ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10 }}>
                <input placeholder="協賛企業名" value={sponsorName} onChange={e => setSponsorName(e.target.value)} style={inputStyle} />
                <input placeholder="協賛企業URL" value={sponsorUrl} onChange={e => setSponsorUrl(e.target.value)} style={inputStyle} />
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => saveSponsor(r.id)} style={{
                    flex: 1, padding: '7px 0', borderRadius: 8, border: 'none',
                    background: '#38ADA9', color: '#fff', fontWeight: 700, cursor: 'pointer', fontSize: 12,
                  }}>保存</button>
                  <button onClick={() => setEditingId(null)} style={{
                    flex: 1, padding: '7px 0', borderRadius: 8, border: '1px solid #ddd',
                    background: '#fff', color: '#888', cursor: 'pointer', fontSize: 12,
                  }}>キャンセル</button>
                </div>
              </div>
            ) : (
              <button onClick={() => startEdit(r)} style={{
                padding: '6px 12px', borderRadius: 8, border: '1px solid #eee', marginRight: 8, marginBottom: 8,
                background: '#fff', color: '#38ADA9', fontSize: 12, fontWeight: 700, cursor: 'pointer',
              }}>協賛を設定</button>
            )}

            {eventEditingId === r.id ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 4, padding: 10, background: '#FBF6FF', borderRadius: 8 }}>
                <label style={{ fontSize: 11, color: '#8E44AD', fontWeight: 700 }}>イベント形式</label>
                <Hint>route＝運営が決めた順路を歩いてもらう型。relay＝参加者が自由に見つけて投稿していく型（コースは決まっていなくてもOK）。煩悩＝会場で参加者が煩悩を投稿し、壁に投影する型。</Hint>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button onClick={() => setEventFields(f => ({ ...f, event_mode: 'route' }))} style={{
                    flex: 1, padding: '7px 0', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 700,
                    border: eventFields.event_mode === 'route' ? '1.5px solid #8E44AD' : '1.5px solid #ddd',
                    background: eventFields.event_mode === 'route' ? '#8E44AD' : '#fff',
                    color: eventFields.event_mode === 'route' ? '#fff' : '#888',
                  }}>🚶 route（事前ルート型）</button>
                  <button onClick={() => setEventFields(f => ({ ...f, event_mode: 'relay' }))} style={{
                    flex: 1, padding: '7px 0', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 700,
                    border: eventFields.event_mode === 'relay' ? '1.5px solid #38ADA9' : '1.5px solid #ddd',
                    background: eventFields.event_mode === 'relay' ? '#38ADA9' : '#fff',
                    color: eventFields.event_mode === 'relay' ? '#fff' : '#888',
                  }}>🏃 relay（発見連鎖型）</button>
                  <button onClick={() => setEventFields(f => ({ ...f, event_mode: 'bonno' }))} style={{
                    flex: 1, padding: '7px 0', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 700,
                    border: eventFields.event_mode === 'bonno' ? '1.5px solid #B7791F' : '1.5px solid #ddd',
                    background: eventFields.event_mode === 'bonno' ? '#B7791F' : '#fff',
                    color: eventFields.event_mode === 'bonno' ? '#fff' : '#888',
                  }}>🔥 煩悩（会場投影型）</button>
                </div>
                {eventFields.event_mode === 'bonno' && (
                  <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 12, color: '#555', cursor: 'pointer', padding: '8px 10px', background: '#FFF8EC', borderRadius: 8 }}>
                    <input type="checkbox" checked={eventFields.bonno_requires_moderation}
                      onChange={e => setEventFields(f => ({ ...f, bonno_requires_moderation: e.target.checked }))}
                      style={{ marginTop: 2 }} />
                    <span>投稿を運営が確認してから壁に出す（学校・法人向けイベントでは推奨）</span>
                  </label>
                )}
                {eventFields.event_mode === 'relay' && (
                  <>
                    <label style={{ fontSize: 11, color: '#8E44AD', fontWeight: 700 }}>参加コード</label>
                    <Hint>参加者が投稿するときにこの文字を入力してもらうと、投稿がこのイベントに自動でまとまります。</Hint>
                    <input placeholder="例：yamanote2026（好きな英数字でOK）" value={eventFields.event_session_code}
                      onChange={e => setEventFields(f => ({ ...f, event_session_code: e.target.value }))} style={inputStyle} />
                  </>
                )}
                <label style={{ fontSize: 11, color: '#8E44AD', fontWeight: 700 }}>イベントページのアドレス</label>
                <Hint>「hitomap.com/events/○○」の○○の部分になります。英数字とハイフンだけで、他と被らない文字にしてください。</Hint>
                <input placeholder="例：shibuya-2026" value={eventFields.event_slug}
                  onChange={e => setEventFields(f => ({ ...f, event_slug: e.target.value }))} style={inputStyle} />
                <label style={{ fontSize: 11, color: '#8E44AD', fontWeight: 700 }}>イベント写真</label>
                <Hint>1枚目がページ上部の大きな画像になります。設定しなくてもきれいな色の背景が自動で使われます。</Hint>
                <EventPhotosUploader urls={eventFields.event_photo_urls} onChange={urls => setEventFields(f => ({ ...f, event_photo_urls: urls }))} />
                <label style={{ fontSize: 11, color: '#8E44AD', fontWeight: 700 }}>エリア名</label>
                <Hint>ページ上部に表示される、開催場所のざっくりした名前です（例：渋谷、山手線）。</Hint>
                <input placeholder="例：渋谷" value={eventFields.event_area}
                  onChange={e => setEventFields(f => ({ ...f, event_area: e.target.value }))} style={inputStyle} />
                <label style={{ fontSize: 11, color: '#8E44AD', fontWeight: 700 }}>参加費（任意）</label>
                <Hint>「無料」「500円（当日集合場所で徴収）」のように自由に書いてください。</Hint>
                <input placeholder="例：無料" value={eventFields.event_fee}
                  onChange={e => setEventFields(f => ({ ...f, event_fee: e.target.value }))} style={inputStyle} />
                <label style={{ fontSize: 11, color: '#8E44AD', fontWeight: 700 }}>集合場所・持ち物などの詳細（任意）</label>
                <Hint>参加者に事前に伝えておきたいことを自由に書いてください（例：集合時間・持ち物・雨天時の対応など）。</Hint>
                <textarea placeholder="例：JR渋谷駅ハチ公口に10時集合。歩きやすい靴でお越しください。雨天決行。" value={eventFields.event_meeting_info} rows={3}
                  onChange={e => setEventFields(f => ({ ...f, event_meeting_info: e.target.value }))} style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }} />
                <label style={{ fontSize: 11, color: '#8E44AD', fontWeight: 700 }}>開催期間（任意）</label>
                <div style={{ display: 'flex', gap: 6 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <label style={{ fontSize: 10, color: '#c3a6dd', display: 'block' }}>開始日時</label>
                    <input type="datetime-local" value={eventFields.event_starts_at}
                      onChange={e => setEventFields(f => ({ ...f, event_starts_at: e.target.value }))} style={{ ...inputStyle, width: '100%', boxSizing: 'border-box' }} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <label style={{ fontSize: 10, color: '#c3a6dd', display: 'block' }}>終了日時</label>
                    <input type="datetime-local" value={eventFields.event_ends_at}
                      onChange={e => setEventFields(f => ({ ...f, event_ends_at: e.target.value }))} style={{ ...inputStyle, width: '100%', boxSizing: 'border-box' }} />
                  </div>
                </div>
                <label style={{ fontSize: 11, color: '#8E44AD', fontWeight: 700 }}>スタート・ゴール地点（任意）</label>
                <Hint>歩くルートがまだ決まっていなくても、待ち合わせ場所だけ地図で先に決められます。</Hint>
                <StartEndPicker kind="start"
                  lat={eventFields.event_start_lat} lng={eventFields.event_start_lng} label={eventFields.event_start_label}
                  onChange={v => setEventFields(f => ({ ...f, event_start_lat: v.lat, event_start_lng: v.lng, event_start_label: v.label }))} />
                <WaypointsEditor waypoints={eventFields.event_waypoints}
                  onChange={wp => setEventFields(f => ({ ...f, event_waypoints: wp }))} />
                <StartEndPicker kind="end"
                  lat={eventFields.event_end_lat} lng={eventFields.event_end_lng} label={eventFields.event_end_label}
                  onChange={v => setEventFields(f => ({ ...f, event_end_lat: v.lat, event_end_lng: v.lng, event_end_label: v.label }))} />
                <p style={{ margin: '-4px 0 0', fontSize: 11, color: '#c3a6dd' }}>スタート→経由地点→ゴールの順で地図に線が引かれます。</p>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#8E44AD', fontWeight: 700, cursor: 'pointer', marginTop: 4 }}>
                  <input type="checkbox" checked={eventFields.is_public_recommendation}
                    onChange={e => setEventFields(f => ({ ...f, is_public_recommendation: e.target.checked }))} />
                  「イベント一覧」（/routes）にも掲載する
                </label>
                <Hint>チェックすると審査待ちを経由せず即座に一覧に載ります（会長がここで直接判断するため）。</Hint>
                <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                  <button onClick={() => saveEventFields(r.id)} disabled={eventSaving} style={{
                    flex: 1, padding: '7px 0', borderRadius: 8, border: 'none',
                    background: '#8E44AD', color: '#fff', fontWeight: 700, cursor: eventSaving ? 'wait' : 'pointer', fontSize: 12,
                  }}>{eventSaving ? '保存中…' : '保存してイベント公開'}</button>
                  <button onClick={() => setEventEditingId(null)} style={{
                    flex: 1, padding: '7px 0', borderRadius: 8, border: '1px solid #ddd',
                    background: '#fff', color: '#888', cursor: 'pointer', fontSize: 12,
                  }}>キャンセル</button>
                </div>
              </div>
            ) : (
              <button onClick={() => startEventEdit(r)} style={{
                padding: '6px 12px', borderRadius: 8, border: '1px solid #eee',
                background: '#fff', color: '#8E44AD', fontSize: 12, fontWeight: 700, cursor: 'pointer',
              }}>{r.event_slug ? 'イベント情報を編集' : '🎪 イベントとして公開'}</button>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}

