'use client';

import { useState } from 'react';
import Onboarding from '@/components/Onboarding';
import { Container, BackLink } from '@/components/ui/Container';
import Button from '@/components/ui/Button';
import Divider from '@/components/ui/Divider';
import Card from '@/components/ui/Card';
import { PinIcon } from '@/components/icons';
import { appColor, appFont } from '@/lib/appTokens';

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
    <Container maxWidth={400}>
      <Onboarding />
      <BackLink href="/" label="ヒトマップとは" />
      <h1 style={{ fontFamily: appFont.mincho, fontSize: 26, fontWeight: 700, margin: '0 0 4px', textAlign: 'center', color: appColor.ink }}>
        ヒトマップ
      </h1>
      <p style={{ fontSize: 13, color: appColor.inkFaint, textAlign: 'center', margin: '0 0 28px' }}>
        歩く町を選んでください。<br />そこに残された痕跡から歩きはじめます。
      </p>

      <div style={{ marginBottom: 16 }}>
        <Button variant="primary" size="lg" fullWidth disabled={locating} onClick={useCurrentLocation}>
          <PinIcon size={16} />
          {locating ? '現在地を確認中…' : '現在地の町からはじめる'}
        </Button>
      </div>

      <Divider label="または" />

      <div style={{ display: 'flex', gap: 8 }}>
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') search(); }}
          placeholder="町の名前で探す（例：渋谷区、別府市…）"
          style={{
            flex: 1, padding: '11px 14px', borderRadius: 10,
            border: `1.5px solid ${appColor.line}`, fontSize: 14, outline: 'none',
            fontFamily: appFont.body, color: appColor.ink,
          }}
        />
        <Button variant="secondary" disabled={searching} onClick={search}>
          {searching ? '検索中…' : '検索'}
        </Button>
      </div>

      {error && <p style={{ color: appColor.danger, fontSize: 12, margin: '8px 0 0' }}>{error}</p>}

      {candidates.length > 0 && (
        <div style={{ marginTop: 10 }}>
          <Card padding={0}>
            {candidates.map((c, i) => (
              <button key={i} onClick={() => goToRegion(regionNameFromAddress(c))} style={{
                display: 'block', width: '100%', textAlign: 'left', padding: '11px 14px',
                border: 'none', borderBottom: i < candidates.length - 1 ? `1px solid ${appColor.lineSoft}` : 'none',
                background: 'none', fontSize: 13, color: appColor.inkSoft, cursor: 'pointer',
              }}>{c.display_name}</button>
            ))}
          </Card>
        </div>
      )}

      {/* 「全国の地図を見る」は意図的に置かない：痕跡は町の縮尺でこそ証になる。まず一つの町を選んでもらう */}
      <p style={{ textAlign: 'center', marginTop: 20, fontSize: 11, color: appColor.inkGhost }}>
        痕跡は、町の縮尺でこそ生きた証になる。まず一つの町を選んでください。
      </p>

      <div style={{ display: 'flex', justifyContent: 'center', gap: 10, marginTop: 20, fontSize: 11 }}>
        <a href="/login" style={{ color: appColor.teal, textDecoration: 'none', fontWeight: 700 }}>ログイン / 新規登録</a>
      </div>

      <div style={{ display: 'flex', justifyContent: 'center', gap: 14, marginTop: 12 }}>
        <a href="/company/school" style={{ fontSize: 11, color: appColor.inkGhost, textDecoration: 'none' }}>学校でのご利用</a>
        <a href="/terms" style={{ fontSize: 11, color: appColor.inkGhost, textDecoration: 'none' }}>利用規約</a>
        <a href="/privacy" style={{ fontSize: 11, color: appColor.inkGhost, textDecoration: 'none' }}>プライバシーポリシー</a>
      </div>
    </Container>
  );
}
