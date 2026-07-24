'use client';

// 📈 アクセス状況 — Vercel Web Analytics（app/layout.tsxで自動計測）を運営ダッシュボードから
// 直接見られるようにする。Vercelのダッシュボードに行かなくても、日々のトラフィックの傾向・
// どのページが読まれているか・どこから来ているかを1画面で把握できる。
// データ取得は /api/admin/web-analytics（サーバー側でVERCEL_ANALYTICS_TOKENを使って中継）。
import { useCallback, useEffect, useState } from 'react';

const TEAL = '#38ADA9';

interface DailyPoint { timestamp: string; pageviews: number; visitors: number }
interface DimRow { pageviews: number; visitors: number; [key: string]: unknown }
interface HourBucket { hour: number; pageviews: number; visitors: number }
interface AnalyticsData {
  since: string; until: string; days: number;
  totals: { pageviews: number; visitors: number };
  daily: DailyPoint[];
  pages: DimRow[];
  referrers: DimRow[];
  devices: DimRow[];
  countries: DimRow[];
  os: DimRow[];
  hourly: HourBucket[];
  hourlyRangeDays: number;
  referrerPages: DimRow[];
}

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ background: '#fff', borderRadius: 12, padding: 16, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', ...style }}>
      {children}
    </div>
  );
}

function StatTile({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div style={{ flex: 1, minWidth: 130, textAlign: 'center', padding: '12px 8px', borderRadius: 10, background: '#fafafa' }}>
      <div style={{ fontSize: 24, fontWeight: 800, color: TEAL }}>{value}</div>
      <div style={{ fontSize: 12, fontWeight: 700, color: '#666', marginTop: 2 }}>{label}</div>
      <div style={{ fontSize: 10.5, color: '#aaa', marginTop: 4, lineHeight: 1.5 }}>{hint}</div>
    </div>
  );
}

// 素朴な折れ線（縦軸1本・比較する系列は無いので凡例不要）。ホバーで日付と値を出す。
function TrendChart({ points }: { points: DailyPoint[] }) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  if (points.length === 0) return <p style={{ margin: 0, fontSize: 12, color: '#aaa' }}>データがありません。</p>;

  const W = 680, H = 160, PAD = 24;
  const max = Math.max(1, ...points.map(p => p.pageviews));
  const xAt = (i: number) => PAD + (i / Math.max(1, points.length - 1)) * (W - PAD * 2);
  const yAt = (v: number) => H - PAD - (v / max) * (H - PAD * 2);
  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${xAt(i)} ${yAt(p.pageviews)}`).join(' ');
  const areaPath = `${path} L ${xAt(points.length - 1)} ${H - PAD} L ${xAt(0)} ${H - PAD} Z`;
  const hovered = hoverIdx !== null ? points[hoverIdx] : null;

  return (
    <div style={{ position: 'relative' }}>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }}
        onMouseLeave={() => setHoverIdx(null)}
        onMouseMove={e => {
          const rect = (e.target as SVGElement).closest('svg')!.getBoundingClientRect();
          const relX = ((e.clientX - rect.left) / rect.width) * W;
          const idx = Math.round(((relX - PAD) / (W - PAD * 2)) * (points.length - 1));
          setHoverIdx(Math.max(0, Math.min(points.length - 1, idx)));
        }}>
        <line x1={PAD} y1={H - PAD} x2={W - PAD} y2={H - PAD} stroke="#eee" strokeWidth={1} />
        <path d={areaPath} fill={`${TEAL}18`} stroke="none" />
        <path d={path} fill="none" stroke={TEAL} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        {hoverIdx !== null && (
          <>
            <line x1={xAt(hoverIdx)} y1={PAD} x2={xAt(hoverIdx)} y2={H - PAD} stroke="#ccc" strokeWidth={1} />
            <circle cx={xAt(hoverIdx)} cy={yAt(points[hoverIdx].pageviews)} r={4} fill={TEAL} stroke="#fff" strokeWidth={2} />
          </>
        )}
      </svg>
      {hovered && (
        <div style={{
          position: 'absolute', top: 4, left: 4, fontSize: 11, background: '#fff', border: '1px solid #eee',
          borderRadius: 8, padding: '4px 10px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
        }}>
          <b>{new Date(hovered.timestamp).toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' })}</b>
          <span style={{ marginLeft: 8, color: TEAL, fontWeight: 700 }}>{hovered.pageviews}PV</span>
          <span style={{ marginLeft: 6, color: '#999' }}>／{hovered.visitors}人</span>
        </div>
      )}
    </div>
  );
}

// route/referrerHostname/deviceType/country、どれもキー名が違うだけの同じ形なので汎用化する。
function RankedBars({ rows, dimKey, formatLabel, emptyLabel }: {
  rows: DimRow[]; dimKey: string; formatLabel?: (v: unknown) => string; emptyLabel: string;
}) {
  if (rows.length === 0) return <p style={{ margin: 0, fontSize: 12, color: '#aaa' }}>{emptyLabel}</p>;
  const max = Math.max(1, ...rows.map(r => r.pageviews));
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {rows.map((r, i) => {
        const raw = r[dimKey];
        const label = formatLabel ? formatLabel(raw) : (raw == null || raw === '' ? '（不明）' : String(raw));
        const pct = Math.round((r.pageviews / max) * 100);
        return (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 12, width: 150, flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
            <div style={{ flex: 1, height: 8, borderRadius: 4, background: '#f0f0f0', overflow: 'hidden' }}>
              <div style={{ width: `${pct}%`, height: '100%', background: TEAL, borderRadius: 4 }} />
            </div>
            <span style={{ fontSize: 11, color: '#999', width: 70, textAlign: 'right', flexShrink: 0 }}>{r.pageviews}PV・{r.visitors}人</span>
          </div>
        );
      })}
    </div>
  );
}

// 24時間・JST基準の棒グラフ。ピーク3時間帯をアンバーで強調する。
function HourlyChart({ buckets }: { buckets: HourBucket[] }) {
  const [hoverHour, setHoverHour] = useState<number | null>(null);
  if (buckets.length === 0 || buckets.every(b => b.pageviews === 0)) {
    return <p style={{ margin: 0, fontSize: 12, color: '#aaa' }}>データがありません。</p>;
  }
  const max = Math.max(1, ...buckets.map(b => b.pageviews));
  const top3 = [...buckets].sort((a, b) => b.pageviews - a.pageviews).slice(0, 3).map(b => b.hour);
  const hovered = hoverHour !== null ? buckets[hoverHour] : null;

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 130 }}>
        {buckets.map(b => {
          const isTop = top3.includes(b.hour);
          const h = Math.max(2, Math.round((b.pageviews / max) * 115));
          return (
            <div key={b.hour}
              onMouseEnter={() => setHoverHour(b.hour)}
              onMouseLeave={() => setHoverHour(null)}
              style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', height: '100%', cursor: 'default' }}>
              <div style={{ width: '100%', height: h, borderRadius: '3px 3px 0 0', background: isTop ? '#E5A139' : `${TEAL}${hoverHour === b.hour ? 'ff' : 'b3'}` }} />
            </div>
          );
        })}
      </div>
      <div style={{ display: 'flex', gap: 3, marginTop: 4 }}>
        {buckets.map(b => (
          <div key={b.hour} style={{ flex: 1, textAlign: 'center', fontSize: 9, color: top3.includes(b.hour) ? '#B7791F' : '#bbb', fontWeight: top3.includes(b.hour) ? 700 : 400 }}>
            {b.hour % 3 === 0 ? b.hour : ''}
          </div>
        ))}
      </div>
      <p style={{ margin: '8px 0 0', fontSize: 11, color: '#999' }}>
        {hovered
          ? <><b style={{ color: '#333' }}>{hovered.hour}時台</b> — {hovered.pageviews}PV・{hovered.visitors}人</>
          : <>ピーク：<b style={{ color: '#B7791F' }}>{top3.sort((a, c) => a - c).map(h => `${h}時`).join('・')}</b>台</>}
      </p>
    </div>
  );
}

// 流入元ホスト × 最初に見たページ のクロス集計。他サイトの参考リンク元を推測するための表。
function CrosstabTable({ rows }: { rows: DimRow[] }) {
  if (rows.length === 0) return <p style={{ margin: 0, fontSize: 12, color: '#aaa' }}>データがありません。</p>;
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead>
          <tr style={{ borderBottom: '1px solid #eee' }}>
            <th style={{ textAlign: 'left', padding: '4px 8px', color: '#999', fontWeight: 700 }}>流入元</th>
            <th style={{ textAlign: 'left', padding: '4px 8px', color: '#999', fontWeight: 700 }}>最初に見たページ</th>
            <th style={{ textAlign: 'right', padding: '4px 8px', color: '#999', fontWeight: 700 }}>PV</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} style={{ borderBottom: '1px solid #f5f5f5' }}>
              <td style={{ padding: '5px 8px', whiteSpace: 'nowrap' }}>{r.referrerHostname ? String(r.referrerHostname) : '直接アクセス・不明'}</td>
              <td style={{ padding: '5px 8px', color: '#666', fontFamily: 'monospace', fontSize: 11 }}>{r.requestPath ? String(r.requestPath) : '（不明）'}</td>
              <td style={{ padding: '5px 8px', textAlign: 'right', color: '#999' }}>{r.pageviews}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const DEVICE_LABEL: Record<string, string> = { desktop: '💻 PC', mobile: '📱 スマホ', tablet: '📲 タブレット' };

export default function WebAnalyticsTab({ authHeaders }: { authHeaders: () => HeadersInit }) {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [needsToken, setNeedsToken] = useState(false);
  const [days, setDays] = useState(31);

  const load = useCallback(async (range: number) => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/admin/web-analytics?days=${range}`, { headers: authHeaders() });
      const d = await res.json();
      if (d.ok) { setData(d); setNeedsToken(false); }
      else { setError(d.error ?? '取得に失敗しました'); setNeedsToken(Boolean(d.needsToken)); }
    } catch {
      setError('通信エラー');
    } finally {
      setLoading(false);
    }
  }, [authHeaders]);

  useEffect(() => { load(days); }, [load, days]);

  const avgPerDay = data && data.days > 0 ? Math.round(data.totals.pageviews / data.days) : 0;

  return (
    <div>
      <Card>
        <p style={{ margin: '0 0 4px', fontWeight: 800, fontSize: 15 }}>📈 アクセス状況</p>
        <p style={{ margin: 0, fontSize: 12, color: '#888', lineHeight: 1.7 }}>
          hitomap.com への訪問者・ページビューをVercel Analyticsから直接見られます。Vercelのダッシュボードを開かなくてもここで確認できます。
        </p>
      </Card>

      {needsToken && (
        <Card style={{ marginTop: 12, border: '1px solid #FBD98D', background: '#FFF8E8' }}>
          <p style={{ margin: 0, fontSize: 13, color: '#B7791F', lineHeight: 1.8 }}>
            ⚠ {error}
          </p>
        </Card>
      )}
      {error && !needsToken && <p style={{ margin: '12px 0 0', fontSize: 13, color: '#E74C3C' }}>{error}</p>}

      {!needsToken && (
        <>
          <div style={{ display: 'flex', gap: 6, margin: '16px 0 8px' }}>
            {/* Vercel Hobbyプランは直近31日までしか見られないため、それより長い範囲は選べない */}
            {[7, 14, 31].map(d => (
              <button key={d} onClick={() => setDays(d)} style={{
                padding: '5px 14px', borderRadius: 14, border: 'none', cursor: 'pointer',
                background: days === d ? TEAL : '#fff', color: days === d ? '#fff' : '#666',
                fontWeight: 700, fontSize: 12, boxShadow: days === d ? 'none' : '0 1px 3px rgba(0,0,0,0.08)',
              }}>直近{d}日</button>
            ))}
          </div>

          <Card>
            {loading ? (
              <p style={{ margin: 0, fontSize: 13, color: '#999' }}>集計中…</p>
            ) : data ? (
              <>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
                  <StatTile label="訪問者数" value={String(data.totals.visitors)} hint={`直近${data.days}日の合計`} />
                  <StatTile label="ページビュー" value={String(data.totals.pageviews)} hint={`直近${data.days}日の合計`} />
                  <StatTile label="1日あたり平均PV" value={String(avgPerDay)} hint="多い/少ないの目安に" />
                </div>
                <TrendChart points={data.daily} />
              </>
            ) : null}
          </Card>

          {data && !loading && (
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 16 }}>
              <div style={{ flex: 1, minWidth: 280 }}>
                <p style={{ margin: '0 0 8px', fontWeight: 800, fontSize: 14 }}>📄 よく見られているページ</p>
                <Card>
                  <RankedBars rows={data.pages} dimKey="requestPath" emptyLabel="データがありません。" />
                </Card>
              </div>
              <div style={{ flex: 1, minWidth: 280 }}>
                <p style={{ margin: '0 0 8px', fontWeight: 800, fontSize: 14 }}>🔗 流入元</p>
                <Card>
                  <RankedBars rows={data.referrers} dimKey="referrerHostname"
                    formatLabel={v => (v ? String(v) : '直接アクセス・不明')} emptyLabel="データがありません。" />
                </Card>
              </div>
              <div style={{ flex: 1, minWidth: 280 }}>
                <p style={{ margin: '0 0 8px', fontWeight: 800, fontSize: 14 }}>📱 デバイス</p>
                <Card>
                  <RankedBars rows={data.devices} dimKey="deviceType"
                    formatLabel={v => DEVICE_LABEL[String(v)] ?? String(v)} emptyLabel="データがありません。" />
                </Card>
              </div>
              <div style={{ flex: 1, minWidth: 280 }}>
                <p style={{ margin: '0 0 8px', fontWeight: 800, fontSize: 14 }}>🌏 訪問者の国・地域</p>
                <Card>
                  <RankedBars rows={data.countries} dimKey="country" emptyLabel="データがありません。" />
                </Card>
              </div>
              <div style={{ flex: 1, minWidth: 280 }}>
                <p style={{ margin: '0 0 8px', fontWeight: 800, fontSize: 14 }}>🖥 OS</p>
                <Card>
                  <RankedBars rows={data.os} dimKey="osName" emptyLabel="データがありません。" />
                </Card>
              </div>
            </div>
          )}

          {data && !loading && (
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 16 }}>
              <div style={{ flex: 1, minWidth: 340 }}>
                <p style={{ margin: '0 0 8px', fontWeight: 800, fontSize: 14 }}>🕒 時間帯別の閲覧傾向（JST）</p>
                <Card>
                  <p style={{ margin: '0 0 10px', fontSize: 11, color: '#aaa' }}>直近{data.hourlyRangeDays}日分の集計</p>
                  <HourlyChart buckets={data.hourly} />
                </Card>
              </div>
              <div style={{ flex: 1, minWidth: 340 }}>
                <p style={{ margin: '0 0 8px', fontWeight: 800, fontSize: 14 }}>🔎 流入元 × 最初に見たページ</p>
                <Card>
                  <p style={{ margin: '0 0 10px', fontSize: 11, color: '#aaa' }}>他サイト運営者が参考にしている可能性のあるページの手がかりに</p>
                  <CrosstabTable rows={data.referrerPages} />
                </Card>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
