'use client';

// 印刷用の「痕跡ギャラリー」ページ。
// 商店街・地域イベントの一角に、実物の写真＋QRコードを並べて掲示することを想定した物理展示用フォーマット。
// 竹中工務店の「サイバー都市ビューワー」（都市模型へのプロジェクションマッピング）に対する、
// ヒトマップならではの安価な代替案：抽象的な色分けではなく、実物の写真と本人の言葉で情感に訴える。
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { QRCodeSVG } from 'qrcode.react';
import type { Trace, ListTracesResponse } from '@/lib/types';
import { getEmotion } from '@/lib/emotions';

export default function RegionPrintGalleryPage() {
  const { name } = useParams<{ name: string }>();
  const regionName = decodeURIComponent(name);
  const [traces, setTraces] = useState<Trace[]>([]);
  const [loading, setLoading] = useState(true);
  const [origin, setOrigin] = useState('');

  useEffect(() => {
    setOrigin(window.location.origin);
    fetch(`/api/traces?region=${encodeURIComponent(regionName)}`)
      .then((r) => r.json() as Promise<ListTracesResponse>)
      .then((d) => { if (d.ok) setTraces(d.traces.filter((t) => t.photo_url)); })
      .finally(() => setLoading(false));
  }, [regionName]);

  return (
    <div style={{ background: '#fff', minHeight: '100vh', padding: '24px' }}>
      {/* 画面上のみ表示（印刷時は隠す） */}
      <div className="print-hide" style={{ marginBottom: 20 }}>
        <a href={`/region/${encodeURIComponent(regionName)}`} style={{ fontSize: 12, color: '#999', textDecoration: 'none' }}>
          ← {regionName}のページへ戻る
        </a>
        <h1 style={{ fontSize: 20, margin: '8px 0 4px' }}>🖨 痕跡ギャラリー：{regionName}</h1>
        <p style={{ fontSize: 13, color: '#777', margin: '0 0 12px' }}>
          写真付きの記録を、掲示・展示用にQRコード付きで並べたページです。ブラウザの印刷機能でそのまま出力できます。
        </p>
        <button
          onClick={() => window.print()}
          style={{
            padding: '10px 20px', background: '#FF6B9D', color: '#fff', border: 'none',
            borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: 'pointer',
          }}
        >
          🖨 印刷する
        </button>
      </div>

      {loading ? (
        <p style={{ color: '#aaa' }}>読み込み中…</p>
      ) : traces.length === 0 ? (
        <p style={{ color: '#aaa' }}>写真付きの記録がまだありません。</p>
      ) : (
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 20,
        }}>
          {traces.map((t) => {
            const emotion = getEmotion(t.emotion_key);
            const url = `${origin}/t/${t.id}`;
            return (
              <div key={t.id} style={{
                border: '1px solid #eee', borderRadius: 12, overflow: 'hidden',
                breakInside: 'avoid', pageBreakInside: 'avoid',
              }}>
                <img src={t.photo_url!} alt={t.title} style={{ width: '100%', height: 180, objectFit: 'cover', display: 'block' }} />
                <div style={{ padding: 12, display: 'flex', gap: 10, alignItems: 'center' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#222', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {emotion ? `${emotion.emoji} ` : ''}{t.title}
                    </p>
                    {t.why && (
                      <p style={{
                        margin: '4px 0 0', fontSize: 11, color: '#777', lineHeight: 1.5,
                        display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
                      }}>{t.why}</p>
                    )}
                  </div>
                  {origin && (
                    <div style={{ flexShrink: 0, textAlign: 'center' }}>
                      <QRCodeSVG value={url} size={64} />
                      <p style={{ margin: '2px 0 0', fontSize: 8, color: '#bbb' }}>詳細を見る</p>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <style>{`
        @media print {
          .print-hide { display: none !important; }
          @page { margin: 12mm; }
        }
      `}</style>
    </div>
  );
}
