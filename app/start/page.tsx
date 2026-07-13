'use client';

import { useState } from 'react';
import Onboarding from '@/components/Onboarding';

interface Candidate {
  display_name: string;
  lat: string;
  lon: string;
  address?: Record<string, string>;
}

function regionNameFromAddress(c: Candidate): string {
  const a = c.address ?? {};
  const city = a.city || a.town || a.village || a.county;
  if (!city) return c.display_name.split('、')[0];
  return a.state ? `${a.state}${city}` : city;
}

export default function StartPage() {
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState('');
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [locating, setLocating] = useState(false);

  async function search() {
    if (!query.trim()) return;
    setSearching(true);
    setError('');
    setCandidates([]);
    try {
      const res = await fetch(`/api/geocode/search?q=${encodeURIComponent(query)}`).then(r => r.json());
      if (!res.ok) { setError(res.error ?? '検索に失敗しました'); return; }
      const results = res.candidates as Candidate[];
      if (results.length === 0) setError('見つかりませんでした');
      setCandidates(results);
    } catch {
      setError('検索に失敗しました');
    } finally {
      setSearching(false);
    }
  }

  function goToRegion(name: string) {
    window.location.href = `/map?region=${encodeURIComponent(name)}`;
  }

  function useCurrentLocation() {
    if (!navigator.geolocation) { setError('この端末では現在地を取得できません'); return; }
    setLocating(true);
    setError('');
    navigator.geolocation.getCurrentPosition(
      async (p) => {
        try {
          const res = await fetch(`/api/geocode/reverse?lat=${p.coords.latitude}&lon=${p.coords.longitude}`).then(r => r.json());
          if (!res.ok) throw new Error(res.error);
          goToRegion(regionNameFromAddress(res.result as Candidate));
        } catch {
          setError('現在地から自治体を特定できませんでした');
          setLocating(false);
        }
      },
      () => { setError('位置情報を取得できませんでした'); setLocating(false); },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  return (
    <div style={{
      minHeight: '100dvh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', padding: 24, background: '#fafafa',
    }}>
      <Onboarding />
      <div style={{ width: '100%', maxWidth: 400 }}>
        <a href="/" style={{ display: 'block', textAlign: 'center', marginBottom: 12, fontSize: 12, color: '#bbb', textDecoration: 'none' }}>← ヒトマップとは</a>
        <h1 style={{ fontSize: 26, fontWeight: 800, margin: '0 0 4px', textAlign: 'center' }}>ヒトマップ</h1>
        <p style={{ fontSize: 13, color: '#999', textAlign: 'center', margin: '0 0 28px' }}>
          歩く町を選んでください。<br />そこに残された痕跡から歩きはじめます。
        </p>

        <button onClick={useCurrentLocation} disabled={locating} style={{
          width: '100%', padding: '14px', borderRadius: 12, border: 'none', marginBottom: 16,
          background: locating ? '#e0e0e0' : 'linear-gradient(135deg, #FF6B9D, #FF9068)',
          color: '#fff', fontWeight: 800, fontSize: 15, cursor: locating ? 'wait' : 'pointer',
        }}>{locating ? '現在地を確認中…' : '📍 現在地の町からはじめる'}</button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '4px 0 16px' }}>
          <div style={{ flex: 1, height: 1, background: '#eee' }} />
          <span style={{ fontSize: 11, color: '#bbb' }}>または</span>
          <div style={{ flex: 1, height: 1, background: '#eee' }} />
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') search(); }}
            placeholder="町の名前で探す（例：渋谷区、別府市…）"
            style={{ flex: 1, padding: '11px 14px', borderRadius: 10, border: '1.5px solid #e0e0e0', fontSize: 14, outline: 'none' }}
          />
          <button onClick={search} disabled={searching} style={{
            padding: '11px 18px', borderRadius: 10, border: 'none',
            background: '#38ADA9', color: '#fff', fontWeight: 700, fontSize: 14,
            cursor: searching ? 'wait' : 'pointer',
          }}>{searching ? '検索中…' : '検索'}</button>
        </div>

        {error && <p style={{ color: '#E55039', fontSize: 12, margin: '8px 0 0' }}>{error}</p>}

        {candidates.length > 0 && (
          <div style={{ marginTop: 10, background: '#fff', border: '1px solid #eee', borderRadius: 10, overflow: 'hidden' }}>
            {candidates.map((c, i) => (
              <button key={i} onClick={() => goToRegion(regionNameFromAddress(c))} style={{
                display: 'block', width: '100%', textAlign: 'left', padding: '11px 14px',
                border: 'none', borderBottom: i < candidates.length - 1 ? '1px solid #f0f0f0' : 'none',
                background: '#fff', fontSize: 13, color: '#444', cursor: 'pointer',
              }}>{c.display_name}</button>
            ))}
          </div>
        )}

        {/* 「全国の地図を見る」は意図的に置かない：痕跡は町の縮尺でこそ証になる。まず一つの町を選んでもらう */}
        <p style={{ textAlign: 'center', marginTop: 20, fontSize: 11, color: '#ccc' }}>
          痕跡は、町の縮尺でこそ生きた証になる。まず一つの町を選んでください。
        </p>

        <div style={{ display: 'flex', justifyContent: 'center', gap: 10, marginTop: 20, fontSize: 11 }}>
          <a href="/login" style={{ color: '#38ADA9', textDecoration: 'none', fontWeight: 700 }}>ログイン / 新規登録</a>
        </div>

        <div style={{ display: 'flex', justifyContent: 'center', gap: 14, marginTop: 12 }}>
          <a href="/school" style={{ fontSize: 11, color: '#bbb', textDecoration: 'none' }}>学校でのご利用</a>
          <a href="/terms" style={{ fontSize: 11, color: '#bbb', textDecoration: 'none' }}>利用規約</a>
          <a href="/privacy" style={{ fontSize: 11, color: '#bbb', textDecoration: 'none' }}>プライバシーポリシー</a>
        </div>
      </div>
    </div>
  );
}
