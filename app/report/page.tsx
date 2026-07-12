'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import type { Trace, ListTracesResponse } from '@/lib/types';
import { EMOTIONS, getEmotion, summarizeValence } from '@/lib/emotions';
import TraceCard from '@/components/report/TraceCard';

const TraceMap = dynamic(() => import('@/components/map/TraceMap'), {
  ssr: false,
  loading: () => <div style={{ padding: 16, color: '#aaa' }}>地図を読み込み中…</div>,
});

type MapMode = 'pin' | 'heat';

// フィルター状態をURLクエリと同期する（リロードしても絞り込みが消えないように）
function readFiltersFromUrl() {
  if (typeof window === 'undefined') return { session: '', emotion: null as string | null, mode: 'pin' as MapMode };
  const params = new URLSearchParams(window.location.search);
  const mode = params.get('mode');
  return {
    session: params.get('session') ?? '',
    emotion: params.get('emotion'),
    mode: mode === 'heat' ? 'heat' as MapMode : 'pin' as MapMode,
  };
}

export default function ReportPage() {
  const [traces, setTraces] = useState<Trace[]>([]);
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState('');
  const [mapMode, setMapMode] = useState<MapMode>('pin');
  const [filterEmotion, setFilterEmotion] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [mobilityMsg, setMobilityMsg] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/mobility/context')
      .then((r) => r.json())
      .then((d) => { if (d.ok && !d.configured) setMobilityMsg(d.message); })
      .catch(() => {});
  }, []);

  // 初回マウント時：URLクエリから絞り込み状態を復元
  useEffect(() => {
    const initial = readFiltersFromUrl();
    setSession(initial.session);
    setFilterEmotion(initial.emotion);
    setMapMode(initial.mode);
    setHydrated(true);
  }, []);

  // 絞り込みが変わるたびにURLへ反映（履歴は積まずreplace）
  useEffect(() => {
    if (!hydrated) return;
    const params = new URLSearchParams();
    if (session) params.set('session', session);
    if (filterEmotion) params.set('emotion', filterEmotion);
    if (mapMode !== 'pin') params.set('mode', mapMode);
    const qs = params.toString();
    window.history.replaceState(null, '', qs ? `?${qs}` : window.location.pathname);
  }, [session, filterEmotion, mapMode, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    const url = session
      ? `/api/traces?session_code=${encodeURIComponent(session)}`
      : '/api/traces';
    setLoading(true);
    fetch(url)
      .then((r) => r.json() as Promise<ListTracesResponse>)
      .then((d) => setTraces(d.ok ? d.traces : []))
      .finally(() => setLoading(false));
  }, [session, hydrated]);

  const visible = filterEmotion
    ? traces.filter((t) => t.emotion_key === filterEmotion)
    : traces;

  // 感情ごとの件数（フィルターボタン用）
  const emotionCounts = EMOTIONS.map((e) => ({
    ...e,
    count: traces.filter((t) => t.emotion_key === e.key).length,
  })).filter((e) => e.count > 0);

  // 自治体向けの粗いサマリー：好意的／否定的／中立の内訳
  const valence = summarizeValence(visible.map((t) => t.emotion_key));

  return (
    <main style={{ maxWidth: 960, margin: '0 auto', padding: 16 }}>
      {/* ヘッダー */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
        <div>
          <h1 style={{ fontSize: 20, margin: '0 0 4px' }}>地域理解レポート</h1>
          <p style={{ color: '#777', fontSize: 13, margin: 0 }}>
            まちに残された痕跡 {visible.length} 件
            {filterEmotion && (
              <span style={{ color: getEmotion(filterEmotion)?.color ?? '#888', marginLeft: 6 }}>
                （{getEmotion(filterEmotion)?.emoji} {getEmotion(filterEmotion)?.label} で絞り込み中）
              </span>
            )}
          </p>
          {valence.total > 0 && (
            <p style={{ margin: '4px 0 0', fontSize: 12, color: '#999' }}>
              自治体向けサマリー：
              <span style={{ color: '#639922', fontWeight: 700, marginLeft: 4 }}>😊 好意的 {Math.round((valence.positive / valence.total) * 100)}%</span>
              <span style={{ marginLeft: 10, color: '#888' }}>😐 中立 {Math.round((valence.neutral / valence.total) * 100)}%</span>
              <span style={{ marginLeft: 10, color: '#E24B4A', fontWeight: 700 }}>😟 否定的 {Math.round((valence.negative / valence.total) * 100)}%</span>
            </p>
          )}
          {mobilityMsg && (
            <p style={{ margin: '4px 0 0', fontSize: 11, color: '#bbb' }}>
              🚶 人流データとの比較：{mobilityMsg}
            </p>
          )}
        </div>
        <Link href="/post"
          style={{
            padding: '10px 18px', background: '#FF6B9D', color: '#fff',
            borderRadius: 10, fontSize: 14, fontWeight: 700,
            textDecoration: 'none', whiteSpace: 'nowrap',
          }}>
          ＋ 記録する
        </Link>
      </div>

      {/* セッション絞り込み */}
      <input
        placeholder="実験回コードで絞り込み（例: ws-20260620）"
        value={session}
        onChange={(e) => setSession(e.target.value)}
        style={{
          marginBottom: 12, width: '100%', maxWidth: 360,
          padding: '8px 10px', border: '1px solid #ddd',
          borderRadius: 8, fontSize: 14, boxSizing: 'border-box',
        }}
      />

      {/* 感情フィルター */}
      {emotionCounts.length > 0 && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
          <button
            onClick={() => setFilterEmotion(null)}
            style={{
              padding: '6px 12px', borderRadius: 20, fontSize: 13, cursor: 'pointer',
              border: `2px solid ${!filterEmotion ? '#555' : '#ddd'}`,
              background: !filterEmotion ? '#555' : '#fff',
              color: !filterEmotion ? '#fff' : '#555',
            }}>
            すべて
          </button>
          {emotionCounts.map((e) => (
            <button key={e.key} onClick={() => setFilterEmotion(filterEmotion === e.key ? null : e.key)}
              style={{
                padding: '6px 12px', borderRadius: 20, fontSize: 13, cursor: 'pointer',
                border: `2px solid ${filterEmotion === e.key ? e.color : '#ddd'}`,
                background: filterEmotion === e.key ? e.color : '#fff',
                color: filterEmotion === e.key ? '#fff' : '#555',
              }}>
              {e.emoji} {e.label} {e.count}
            </button>
          ))}
        </div>
      )}

      {/* ピン ⇄ ヒートマップ 切替 */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
        {(['pin', 'heat'] as MapMode[]).map((m) => (
          <button key={m} onClick={() => setMapMode(m)}
            style={{
              padding: '7px 16px', borderRadius: 8, fontSize: 13, cursor: 'pointer',
              border: '1.5px solid #ddd',
              background: mapMode === m ? '#222' : '#fff',
              color: mapMode === m ? '#fff' : '#555',
              fontWeight: mapMode === m ? 700 : 400,
            }}>
            {m === 'pin' ? '📍 ピン表示' : '🌡 感情ヒートマップ'}
          </button>
        ))}
      </div>

      {/* 地図 */}
      <section style={{ height: 380, borderRadius: 12, overflow: 'hidden', marginBottom: 20 }}>
        <TraceMap traces={visible} mode={mapMode} />
      </section>

      {/* 凡例（ヒートマップ時） */}
      {mapMode === 'heat' && emotionCounts.length > 0 && (
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
          {emotionCounts.map((e) => (
            <span key={e.key} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}>
              <span style={{ width: 12, height: 12, borderRadius: '50%', background: e.color, display: 'inline-block' }} />
              {e.emoji} {e.label}
            </span>
          ))}
          <span style={{ fontSize: 12, color: '#aaa' }}>
            ※ 円の大きさ＝感情の強度、重なりが濃いエリアほど多くの人が心を動かされた場所
          </span>
        </div>
      )}

      {/* カード一覧 */}
      {loading ? (
        <p style={{ color: '#aaa' }}>読み込み中…</p>
      ) : (
        <section style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
          gap: 14,
        }}>
          {visible.map((t) => <TraceCard key={t.id} trace={t} />)}
        </section>
      )}
    </main>
  );
}
