'use client';

import { useEffect, useState } from 'react';
import { corpColor, corpFont, corpRadius, corpShadow } from './tokens';
import Reveal from './Reveal';
import ParallaxItem from './ParallaxItem';
import { getEmotion } from '@/lib/emotions';
import type { Trace } from '@/lib/types';
import type { SitePost } from '@/lib/sitePosts';
import type { HomePhotoItem } from '@/lib/siteSettings';

// YAMAPトップの「活動日記（コミュニティの実記録）」枠を踏襲。
// 数字の実績を捏造する代わりに、実際に投稿された直近の痕跡そのものを社会的証明として見せる。
// 取得に失敗した場合・0件の場合はセクションごと消す（空の飾り枠を残さない）。
//
// 【20260724 フォトグリッド化】
// 横スクロールの均一カードから、SANU等の参考サイトに倣った非対称フォトグリッドへ。
// 「痕跡が積み重なる」実感は、テキストカードの羅列より写真そのものの物量で伝わる。
// 写真の無い投稿はグリッドに混ぜず除外する（テキストのみの空セルは物量感を薄める）。
//
// 【20260725 実績記事にも対応】
// curatedItems（運営ダッシュボード「サイト設定」→トップページの写真）は、投稿の痕跡写真だけでなく
// 実績ブログ(site_posts)のカバー写真も選べる。表示側は両方を同じ「写真タイル」として扱う。
const GRID_LIMIT = 8;

interface PhotoTile {
  key: string;
  href: string;
  photoUrl: string;
  title: string;
  meta: string;                 // 場所・日付など、大きい写真の下だけに出す補足
  emotionLabel?: string;
  emotionColor?: string;
}

function traceToTile(t: Trace): PhotoTile | null {
  if (!t.photo_url) return null;
  const keys = t.emotion_keys ?? (t.emotion_key ? [t.emotion_key] : []);
  const emotion = getEmotion(keys[0]);
  return {
    key: `trace-${t.id}`,
    href: `/t/${t.id}`,
    photoUrl: t.photo_url,
    title: t.title,
    meta: [t.region, new Date(t.created_at).toLocaleDateString('ja-JP')].filter(Boolean).join(' · '),
    emotionLabel: emotion?.label,
    emotionColor: emotion?.color,
  };
}

function postToTile(p: SitePost): PhotoTile | null {
  const photo = p.cover_url ?? p.photo_urls?.[0];
  if (!photo) return null;
  return {
    key: `post-${p.id}`,
    href: `/company/works/${p.slug}`,
    photoUrl: photo,
    title: p.title,
    meta: p.event_date ? new Date(p.event_date).toLocaleDateString('ja-JP') : '',
    emotionLabel: '実績',
    emotionColor: corpColor.trust,
  };
}

export default function RecentTraces({ curatedItems = [] }: { curatedItems?: HomePhotoItem[] }) {
  const [tiles, setTiles] = useState<PhotoTile[]>([]);

  useEffect(() => {
    if (curatedItems.length === 0) {
      // 自動選定：直近の投稿から写真つきのものを新しい順に採用
      fetch(`/api/traces?limit=${GRID_LIMIT * 2}`)
        .then(r => r.json())
        .then(d => {
          if (!d.ok) return;
          const list = ((d.traces ?? []) as Trace[]).map(traceToTile).filter((x): x is PhotoTile => x !== null);
          setTiles(list.slice(0, GRID_LIMIT));
        })
        .catch(() => {});
      return;
    }

    // 運営が選んだ並び順（trace/postが混在しうる）を保ったまま、種類ごとにまとめて取得する
    const items = curatedItems.slice(0, GRID_LIMIT);
    const traceIds = items.filter(i => i.type === 'trace').map(i => i.id);
    const postIds = items.filter(i => i.type === 'post').map(i => i.id);

    Promise.all([
      traceIds.length > 0 ? fetch(`/api/traces?ids=${traceIds.join(',')}`).then(r => r.json()) : Promise.resolve({ ok: true, traces: [] }),
      postIds.length > 0 ? fetch(`/api/posts?ids=${postIds.join(',')}`).then(r => r.json()) : Promise.resolve({ ok: true, posts: [] }),
    ]).then(([traceRes, postRes]) => {
      const traceMap = new Map(((traceRes.ok ? traceRes.traces : []) as Trace[]).map(t => [t.id, t]));
      const postMap = new Map(((postRes.ok ? postRes.posts : []) as SitePost[]).map(p => [p.id, p]));
      const ordered = items
        .map(item => item.type === 'post' ? postMap.get(item.id) && postToTile(postMap.get(item.id)!) : traceMap.get(item.id) && traceToTile(traceMap.get(item.id)!))
        .filter((x): x is PhotoTile => x !== null && x !== undefined);
      setTiles(ordered);
    }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [curatedItems.map(i => `${i.type}:${i.id}`).join(',')]);

  if (tiles.length === 0) return null;

  return (
    <section style={{ background: corpColor.ground, padding: '72px 0', borderTop: `1px solid ${corpColor.line}` }}>
      <div style={{ maxWidth: 960, margin: '0 auto', padding: '0 24px' }}>
        <Reveal>
          <p
            style={{
              margin: '0 0 8px',
              fontSize: 12,
              letterSpacing: '0.2em',
              color: corpColor.moss,
              fontFamily: corpFont.body,
              fontWeight: 700,
            }}
          >
            いま、積み重なっている痕跡
          </p>
        </Reveal>
        <Reveal delay={80}>
          <h2
            style={{
              margin: '0 0 32px',
              fontFamily: corpFont.body,
              fontSize: 'clamp(20px, 2.8vw, 26px)',
              fontWeight: 700,
              color: corpColor.ink,
            }}
          >
            誰かが今日も、まちを歩いて記録しています。
          </h2>
        </Reveal>
      </div>

      {/* 最初の1枚を大きく、残りを密に詰める非対称グリッド。
          grid-auto-flow: dense で、写真の枚数が増減しても自動的に隙間なく敷き詰まる。 */}
      <div
        style={{
          maxWidth: 960,
          margin: '0 auto',
          padding: '0 24px',
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gridAutoRows: 150,
          gridAutoFlow: 'dense',
          gap: 12,
        }}
      >
        {tiles.map((tile, i) => {
          const big = i === 0;
          return (
            <Reveal
              key={tile.key}
              delay={i * 70}
              y={16}
              style={{ gridColumn: big ? 'span 2' : undefined, gridRow: big ? 'span 2' : undefined, height: '100%' }}
            >
              {/* 大きいタイルほど動くと違和感が出るため控えめに、残りは奇数/偶数でわずかに速度差をつける */}
              <ParallaxItem speed={big ? 0.025 : i % 2 === 0 ? 0.05 : 0.07} max={big ? 6 : 10}>
              <a
                href={tile.href}
                className="hm-lift hm-tilt hm-photo-zoom"
                style={{
                  display: 'block',
                  position: 'relative',
                  height: '100%',
                  borderRadius: corpRadius.md,
                  boxShadow: corpShadow.card,
                  overflow: 'hidden',
                  textDecoration: 'none',
                  background: corpColor.white,
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={tile.photoUrl}
                  alt=""
                  loading="lazy"
                  style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                />
                {/* 下端の暗いグラデーション（写真の上に文字を重ねても常に読めるように） */}
                <div
                  aria-hidden="true"
                  style={{
                    position: 'absolute',
                    inset: 0,
                    background: 'linear-gradient(180deg, transparent 55%, rgba(20,22,17,.78) 100%)',
                  }}
                />
                <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: big ? '18px 20px' : '10px 12px', display: 'flex', flexDirection: 'column', gap: 5 }}>
                  {tile.emotionLabel && (
                    <span
                      style={{
                        alignSelf: 'flex-start',
                        fontSize: 10.5,
                        fontWeight: 700,
                        color: '#fff',
                        background: (tile.emotionColor ?? corpColor.moss) + 'CC',
                        padding: '2px 9px',
                        borderRadius: 999,
                        fontFamily: corpFont.body,
                      }}
                    >
                      {tile.emotionLabel}
                    </span>
                  )}
                  <p
                    style={{
                      margin: 0,
                      fontSize: big ? 16 : 12.5,
                      fontWeight: 700,
                      color: '#fff',
                      fontFamily: corpFont.body,
                      lineHeight: 1.4,
                      display: '-webkit-box',
                      WebkitLineClamp: big ? 2 : 1,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                      textShadow: '0 1px 6px rgba(0,0,0,.35)',
                    }}
                  >
                    {tile.title}
                  </p>
                  {big && tile.meta && (
                    <p style={{ margin: 0, fontSize: 11.5, color: 'rgba(255,255,255,.82)', fontFamily: corpFont.body }}>
                      {tile.meta}
                    </p>
                  )}
                </div>
              </a>
              </ParallaxItem>
            </Reveal>
          );
        })}
      </div>

      <div style={{ maxWidth: 960, margin: '24px auto 0', padding: '0 24px' }}>
        <a
          href="/map"
          className="hm-ul"
          style={{
            fontSize: 13,
            color: corpColor.moss,
            fontWeight: 700,
            fontFamily: corpFont.body,
            paddingBottom: 2,
          }}
        >
          すべての痕跡を地図で見る →
        </a>
      </div>
    </section>
  );
}
