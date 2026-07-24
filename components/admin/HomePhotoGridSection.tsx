'use client';

// トップページ「いま、積み重なっている痕跡」フォトグリッドに出す写真を、運営が選んで並べ替えるための編集UI。
// 先頭に選んだ1枚がグリッドで大きく表示される（components/corp/RecentTraces.tsxの仕様と対応）。
// 空のままなら自動選定（直近の投稿から写真つきを新しい順）に戻る。
import { useEffect, useState } from 'react';
import type { Trace } from '@/lib/types';

const MAX_PICKS = 8;

const thumbStyle: React.CSSProperties = {
  width: 56, height: 56, borderRadius: 8, objectFit: 'cover', flexShrink: 0, background: '#eee',
};

export default function HomePhotoGridSection({
  value,
  onChange,
  authHeaders,
}: {
  value: string[];
  onChange: (ids: string[]) => void;
  authHeaders: () => HeadersInit;
}) {
  const [picked, setPicked] = useState<Trace[]>([]);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Trace[]>([]);
  const [searching, setSearching] = useState(false);

  // 選択済みIDのサムネイル・タイトルを引く（valueが変わるたびに、順序はvalueに従う）
  useEffect(() => {
    if (value.length === 0) { setPicked([]); return; }
    fetch(`/api/admin/traces?ids=${value.join(',')}`, { headers: authHeaders() })
      .then(r => r.json())
      .then(d => {
        if (!d.ok) return;
        const byId = new Map((d.traces as Trace[]).map(t => [t.id, t]));
        setPicked(value.map(id => byId.get(id)).filter((t): t is Trace => Boolean(t)));
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value.join(',')]);

  async function runSearch() {
    setSearching(true);
    try {
      const res = await fetch(`/api/admin/traces?status=public&q=${encodeURIComponent(query)}&limit=24`, { headers: authHeaders() });
      const data = await res.json();
      if (data.ok) setResults((data.traces as Trace[]).filter(t => t.photo_url));
    } finally {
      setSearching(false);
    }
  }

  function add(id: string) {
    if (value.includes(id) || value.length >= MAX_PICKS) return;
    onChange([...value, id]);
  }
  function remove(id: string) {
    onChange(value.filter(v => v !== id));
  }
  function move(id: string, dir: -1 | 1) {
    const i = value.indexOf(id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= value.length) return;
    const next = [...value];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  }

  return (
    <div>
      <p style={{ fontSize: 11.5, color: '#999', margin: '0 0 10px' }}>
        選ぶと先頭の1枚が大きく表示されます（最大{MAX_PICKS}枚）。空のままなら、直近の投稿から自動で選ばれます。
      </p>

      {picked.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 }}>
          {picked.map((t, i) => (
            <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#fafafa', borderRadius: 8, padding: 6 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={t.photo_url ?? ''} alt="" style={thumbStyle} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: 12.5, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {i === 0 ? '🔶 大きい写真：' : ''}{t.title}
                </p>
                <p style={{ margin: 0, fontSize: 10.5, color: '#999' }}>{t.region ?? ''}</p>
              </div>
              <button type="button" onClick={() => move(t.id, -1)} disabled={i === 0}
                style={{ border: 'none', background: 'none', cursor: i === 0 ? 'default' : 'pointer', opacity: i === 0 ? 0.3 : 1, fontSize: 14 }}>↑</button>
              <button type="button" onClick={() => move(t.id, 1)} disabled={i === picked.length - 1}
                style={{ border: 'none', background: 'none', cursor: i === picked.length - 1 ? 'default' : 'pointer', opacity: i === picked.length - 1 ? 0.3 : 1, fontSize: 14 }}>↓</button>
              <button type="button" onClick={() => remove(t.id)}
                style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#E74C3C', fontSize: 13, fontWeight: 700 }}>✕</button>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') runSearch(); }}
          placeholder="タイトルで検索（例：伊香保、川、公園）"
          style={{ flex: 1, padding: '9px 12px', borderRadius: 8, border: '1.5px solid #ddd', fontSize: 13 }}
        />
        <button type="button" onClick={runSearch} disabled={searching} style={{
          padding: '9px 16px', borderRadius: 8, border: 'none', background: '#38ADA9', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer',
        }}>{searching ? '検索中…' : '検索'}</button>
      </div>

      {results.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {results.map(t => {
            const already = value.includes(t.id);
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => add(t.id)}
                disabled={already || value.length >= MAX_PICKS}
                title={t.title}
                style={{
                  position: 'relative', width: 64, height: 64, padding: 0, border: already ? '2px solid #38ADA9' : '1px solid #ddd',
                  borderRadius: 8, overflow: 'hidden', cursor: already ? 'default' : 'pointer', background: '#eee',
                  opacity: !already && value.length >= MAX_PICKS ? 0.4 : 1,
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={t.photo_url ?? ''} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                {already && (
                  <span style={{ position: 'absolute', inset: 0, background: 'rgba(56,173,169,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800 }}>✓</span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
