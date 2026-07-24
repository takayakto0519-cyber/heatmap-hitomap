'use client';

// トップページ「いま、積み重なっている痕跡」フォトグリッドに出す写真を、運営が選んで並べ替えるための編集UI。
// 先頭に選んだ1枚がグリッドで大きく表示される（components/corp/RecentTraces.tsxの仕様と対応）。
// 空のままなら自動選定（直近の投稿から写真つきを新しい順）に戻る。
// 20260725: 投稿の痕跡写真だけでなく、実績ブログ(site_posts / post_type=achievement)のカバー写真も選べるようにした。
import { useEffect, useState } from 'react';
import type { Trace } from '@/lib/types';
import type { SitePost } from '@/lib/sitePosts';
import type { HomePhotoItem } from '@/lib/siteSettings';

const MAX_PICKS = 8;

const thumbStyle: React.CSSProperties = {
  width: 56, height: 56, borderRadius: 8, objectFit: 'cover', flexShrink: 0, background: '#eee',
};

type PickedDisplay = { item: HomePhotoItem; photoUrl: string; title: string; sub: string };
type SearchResult = { id: string; photoUrl: string; title: string };

export default function HomePhotoGridSection({
  value,
  onChange,
  authHeaders,
}: {
  value: HomePhotoItem[];
  onChange: (items: HomePhotoItem[]) => void;
  authHeaders: () => HeadersInit;
}) {
  const [picked, setPicked] = useState<PickedDisplay[]>([]);
  const [source, setSource] = useState<'trace' | 'post'>('trace');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);

  // 選択済みIDのサムネイル・タイトルを引く（valueが変わるたびに、順序はvalueに従う。trace/postが混在しうる）
  useEffect(() => {
    if (value.length === 0) { setPicked([]); return; }
    const traceIds = value.filter(v => v.type === 'trace').map(v => v.id);
    const postIds = value.filter(v => v.type === 'post').map(v => v.id);
    Promise.all([
      traceIds.length > 0
        ? fetch(`/api/admin/traces?ids=${traceIds.join(',')}`, { headers: authHeaders() }).then(r => r.json())
        : Promise.resolve({ ok: true, traces: [] }),
      postIds.length > 0
        ? fetch('/api/admin/posts', { headers: authHeaders() }).then(r => r.json())
        : Promise.resolve({ ok: true, posts: [] }),
    ]).then(([traceRes, postRes]) => {
      const traceMap = new Map(((traceRes.ok ? traceRes.traces : []) as Trace[]).map(t => [t.id, t]));
      const postMap = new Map(((postRes.ok ? postRes.posts : []) as SitePost[]).map(p => [p.id, p]));
      const list = value.map((item): PickedDisplay | null => {
        if (item.type === 'trace') {
          const t = traceMap.get(item.id);
          if (!t) return null;
          return { item, photoUrl: t.photo_url ?? '', title: t.title, sub: t.region ?? '' };
        }
        const p = postMap.get(item.id);
        if (!p) return null;
        return { item, photoUrl: p.cover_url ?? p.photo_urls?.[0] ?? '', title: p.title, sub: '実績記事' };
      }).filter((x): x is PickedDisplay => x !== null);
      setPicked(list);
    }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value.map(v => `${v.type}:${v.id}`).join(',')]);

  async function runSearch() {
    setSearching(true);
    try {
      if (source === 'trace') {
        const res = await fetch(`/api/admin/traces?status=public&q=${encodeURIComponent(query)}&limit=24`, { headers: authHeaders() });
        const data = await res.json();
        if (data.ok) {
          setResults(
            (data.traces as Trace[])
              .filter(t => t.photo_url)
              .map(t => ({ id: t.id, photoUrl: t.photo_url!, title: t.title }))
          );
        }
      } else {
        // 実績記事一覧はAPI側にsearch機能が無いため、全件取得してタイトルで絞り込む
        const res = await fetch('/api/admin/posts', { headers: authHeaders() });
        const data = await res.json();
        if (data.ok) {
          const q = query.trim();
          setResults(
            (data.posts as SitePost[])
              .filter(p => p.post_type === 'achievement' && p.is_published && (p.cover_url || p.photo_urls?.length > 0))
              .filter(p => !q || p.title.includes(q))
              .slice(0, 24)
              .map(p => ({ id: p.id, photoUrl: p.cover_url ?? p.photo_urls[0], title: p.title }))
          );
        }
      }
    } finally {
      setSearching(false);
    }
  }

  function add(id: string) {
    if (value.some(v => v.id === id && v.type === source) || value.length >= MAX_PICKS) return;
    onChange([...value, { type: source, id }]);
  }
  function remove(item: HomePhotoItem) {
    onChange(value.filter(v => !(v.id === item.id && v.type === item.type)));
  }
  function move(item: HomePhotoItem, dir: -1 | 1) {
    const i = value.findIndex(v => v.id === item.id && v.type === item.type);
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
        投稿の痕跡写真だけでなく、実績記事のカバー写真も選べます。
      </p>

      {picked.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 }}>
          {picked.map((p, i) => (
            <div key={`${p.item.type}-${p.item.id}`} style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#fafafa', borderRadius: 8, padding: 6 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.photoUrl} alt="" style={thumbStyle} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: 12.5, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {i === 0 ? '🔶 大きい写真：' : ''}{p.item.type === 'post' ? '🏆 ' : ''}{p.title}
                </p>
                <p style={{ margin: 0, fontSize: 10.5, color: '#999' }}>{p.sub}</p>
              </div>
              <button type="button" onClick={() => move(p.item, -1)} disabled={i === 0}
                style={{ border: 'none', background: 'none', cursor: i === 0 ? 'default' : 'pointer', opacity: i === 0 ? 0.3 : 1, fontSize: 14 }}>↑</button>
              <button type="button" onClick={() => move(p.item, 1)} disabled={i === picked.length - 1}
                style={{ border: 'none', background: 'none', cursor: i === picked.length - 1 ? 'default' : 'pointer', opacity: i === picked.length - 1 ? 0.3 : 1, fontSize: 14 }}>↓</button>
              <button type="button" onClick={() => remove(p.item)}
                style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#E74C3C', fontSize: 13, fontWeight: 700 }}>✕</button>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
        {(['trace', 'post'] as const).map(s => (
          <button key={s} type="button" onClick={() => { setSource(s); setResults([]); }} style={{
            padding: '6px 14px', borderRadius: 999, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700,
            background: source === s ? '#38ADA9' : '#eee', color: source === s ? '#fff' : '#666',
          }}>{s === 'trace' ? '📍 投稿（痕跡）' : '🏆 実績記事'}</button>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') runSearch(); }}
          placeholder={source === 'trace' ? 'タイトルで検索（例：伊香保、川、公園）' : 'タイトルで検索（空欄で全件）'}
          style={{ flex: 1, padding: '9px 12px', borderRadius: 8, border: '1.5px solid #ddd', fontSize: 13 }}
        />
        <button type="button" onClick={runSearch} disabled={searching} style={{
          padding: '9px 16px', borderRadius: 8, border: 'none', background: '#38ADA9', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer',
        }}>{searching ? '検索中…' : '検索'}</button>
      </div>

      {results.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {results.map(r => {
            const already = value.some(v => v.id === r.id && v.type === source);
            return (
              <button
                key={r.id}
                type="button"
                onClick={() => add(r.id)}
                disabled={already || value.length >= MAX_PICKS}
                title={r.title}
                style={{
                  position: 'relative', width: 64, height: 64, padding: 0, border: already ? '2px solid #38ADA9' : '1px solid #ddd',
                  borderRadius: 8, overflow: 'hidden', cursor: already ? 'default' : 'pointer', background: '#eee',
                  opacity: !already && value.length >= MAX_PICKS ? 0.4 : 1,
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={r.photoUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
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
