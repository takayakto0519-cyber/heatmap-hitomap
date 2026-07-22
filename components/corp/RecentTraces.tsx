'use client';

import { useEffect, useState } from 'react';
import { corpColor, corpFont, corpRadius, corpShadow } from './tokens';
import { getEmotion } from '@/lib/emotions';
import type { Trace } from '@/lib/types';

// YAMAPトップの「活動日記（コミュニティの実記録）」枠を踏襲。
// 数字の実績を捏造する代わりに、実際に投稿された直近の痕跡そのものを社会的証明として見せる。
// 取得に失敗した場合・0件の場合はセクションごと消す（空の飾り枠を残さない）。

export default function RecentTraces() {
  const [traces, setTraces] = useState<Trace[]>([]);

  useEffect(() => {
    fetch('/api/traces?limit=6')
      .then(r => r.json())
      .then(d => { if (d.ok) setTraces((d.traces ?? []).slice(0, 6)); })
      .catch(() => {});
  }, []);

  if (traces.length === 0) return null;

  return (
    <section style={{ background: corpColor.ground, padding: '72px 0', borderTop: `1px solid ${corpColor.line}` }}>
      <div style={{ maxWidth: 960, margin: '0 auto', padding: '0 24px' }}>
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
      </div>

      <div
        style={{
          maxWidth: 960,
          margin: '0 auto',
          padding: '0 24px',
          display: 'flex',
          gap: 16,
          overflowX: 'auto',
          scrollbarWidth: 'thin',
        }}
      >
        {traces.map(t => {
          const keys = t.emotion_keys ?? (t.emotion_key ? [t.emotion_key] : []);
          const emotion = getEmotion(keys[0]);
          return (
            <a
              key={t.id}
              href={`/t/${t.id}`}
              className="hm-lift hm-tilt"
              style={{
                flex: '0 0 220px',
                background: corpColor.white,
                border: `1px solid ${corpColor.lineSoft}`,
                borderRadius: corpRadius.md,
                boxShadow: corpShadow.card,
                overflow: 'hidden',
                textDecoration: 'none',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              {t.photo_url && (
                <div className="hm-photo-zoom" style={{ height: 168 }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={t.photo_url}
                    alt=""
                    loading="lazy"
                    style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                  />
                </div>
              )}
              <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
                <p
                  style={{
                    margin: 0,
                    fontSize: 13.5,
                    fontWeight: 700,
                    color: corpColor.ink,
                    fontFamily: corpFont.body,
                    lineHeight: 1.5,
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                  }}
                >
                  {t.title}
                </p>
                <p style={{ margin: 0, fontSize: 11, color: corpColor.inkSoft, fontFamily: corpFont.body }}>
                  {[t.region, new Date(t.created_at).toLocaleDateString('ja-JP')].filter(Boolean).join(' · ')}
                </p>
                {emotion && (
                  <span
                    style={{
                      alignSelf: 'flex-start',
                      marginTop: 'auto',
                      fontSize: 11,
                      fontWeight: 700,
                      color: emotion.color,
                      background: emotion.color + '1A',
                      padding: '2px 9px',
                      borderRadius: 999,
                      fontFamily: corpFont.body,
                    }}
                  >
                    {emotion.label}
                  </span>
                )}
              </div>
            </a>
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
