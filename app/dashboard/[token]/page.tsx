import { notFound } from 'next/navigation';
import { corpColor, corpFont } from '@/components/corp/tokens';
import { computeRegionAggregate, computeRegionTrend } from '@/lib/regionAggregate';
import { computeAttachmentFunnel } from '@/lib/attachment';
import { getShiftColor } from '@/lib/emotions';
import DashboardTraceMap from '@/components/dashboard/DashboardTraceMap';
import type { DashboardAccess, MapBbox } from '@/lib/types';

function bboxOf(access: DashboardAccess): MapBbox | null {
  if (access.bbox_min_lat === null || access.bbox_max_lat === null || access.bbox_min_lng === null || access.bbox_max_lng === null) {
    return null;
  }
  return { minLat: access.bbox_min_lat, maxLat: access.bbox_max_lat, minLng: access.bbox_min_lng, maxLng: access.bbox_max_lng };
}

export const dynamic = 'force-dynamic'; // 常に最新の集計を返す（キャッシュしない）

const SUPABASE_READY = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL);

async function loadDashboard(token: string) {
  if (!SUPABASE_READY) return null;

  const { supabaseServer } = await import('@/lib/supabase/server');

  const { data: access } = await supabaseServer
    .from('dashboard_access')
    .select('*')
    .eq('token', token)
    .eq('is_active', true)
    .maybeSingle();

  if (!access) return null;
  const typedAccess = access as DashboardAccess;

  await supabaseServer
    .from('dashboard_access')
    .update({ last_accessed_at: new Date().toISOString() })
    .eq('id', typedAccess.id);

  // 感情の内訳（従来）に加えて、愛着ファネル（地・理・心）も併せて取得する。
  // どちらも件数・割合のみで個人を特定できる値は含まない。
  const bbox = bboxOf(typedAccess);
  const [aggregate, funnel, trend, { data: municipalityProfile }] = await Promise.all([
    computeRegionAggregate(supabaseServer, typedAccess.region, undefined, undefined, bbox),
    computeAttachmentFunnel(supabaseServer, typedAccess.region, bbox),
    computeRegionTrend(supabaseServer, typedAccess.region, undefined, bbox),
    // 人口統計は運営ダッシュボードで事前に取得・キャッシュ済みの値を読むだけ（ここではe-Statを叩かない）
    supabaseServer.from('municipality_profiles').select('population_stats').eq('region_name', typedAccess.region).maybeSingle(),
  ]);
  const populationStats = (municipalityProfile as { population_stats?: { dayNightRatio?: number; statsYear?: string } | null } | null)?.population_stats ?? null;
  return { access: typedAccess, aggregate, funnel, trend, bbox, populationStats };
}

export default async function CustomerDashboardPage({ params }: { params: { token: string } }) {
  const data = await loadDashboard(params.token);
  if (!data) notFound();

  const { access, aggregate, funnel, trend, bbox, populationStats } = data;
  const totalShown = aggregate.cells.reduce((sum, c) => sum + c.count, 0);
  const valence = aggregate.cells.reduce(
    (acc, c) => ({
      positive: acc.positive + c.valence.positive,
      negative: acc.negative + c.valence.negative,
      neutral: acc.neutral + c.valence.neutral,
    }),
    { positive: 0, negative: 0, neutral: 0 }
  );
  const valenceTotal = valence.positive + valence.negative + valence.neutral;
  const pct = (n: number) => (valenceTotal > 0 ? Math.round((n / valenceTotal) * 100) : 0);

  // 月次トレンド：非公開でないバケットのうち、最初と最後の好意的率の差分で「改善しているか」を色で示す
  const visibleTrendBuckets = trend.ok ? trend.buckets.filter(b => !b.suppressed && b.valence) : [];
  const positiveRate = (v: { positive: number; negative: number; neutral: number }) => {
    const t = v.positive + v.negative + v.neutral;
    return t > 0 ? v.positive / t : 0;
  };
  const trendDelta = visibleTrendBuckets.length >= 2
    ? positiveRate(visibleTrendBuckets[visibleTrendBuckets.length - 1].valence!) - positiveRate(visibleTrendBuckets[0].valence!)
    : 0;
  const trendColor = getShiftColor(trendDelta);

  return (
    <div style={{ minHeight: '100dvh', background: corpColor.ground, fontFamily: corpFont.body }}>
      <header style={{ padding: '18px 24px', borderBottom: `1px solid ${corpColor.line}`, display: 'flex', alignItems: 'center', gap: 10 }}>
        <img src="/logo.png" alt="ヒトマップ" style={{ height: 24, width: 'auto' }} />
        <span style={{ fontSize: 14, fontWeight: 700, color: corpColor.ink }}>ヒトマップ 集計ダッシュボード</span>
      </header>

      <main style={{ maxWidth: 720, margin: '0 auto', padding: '48px 24px 96px' }}>
        <p style={{ margin: '0 0 8px', fontSize: 12, letterSpacing: '0.2em', color: corpColor.moss, fontWeight: 700 }}>
          {access.label ?? access.region}
        </p>
        <h1 style={{ margin: '0 0 8px', fontFamily: corpFont.mincho, fontSize: 'clamp(22px, 3vw, 28px)', color: corpColor.ink, fontWeight: 600 }}>
          {access.region}の痕跡・感情データ
        </h1>
        <p style={{ margin: '0 0 40px', fontSize: 13, color: corpColor.inkSoft }}>
          生成日時：{new Date(aggregate.generatedAt).toLocaleString('ja-JP')}
          {bbox && '　・　指定された地図範囲で集計しています'}
        </p>

        <section style={{ background: corpColor.white, border: `1px solid ${corpColor.line}`, padding: '28px 26px', marginBottom: 24 }}>
          <p style={{ margin: '0 0 20px', fontSize: 14, fontWeight: 700, color: corpColor.ink }}>感情の内訳</p>
          {valenceTotal === 0 ? (
            <p style={{ margin: 0, fontSize: 13, color: corpColor.inkSoft, lineHeight: 1.9 }}>
              現時点では、公開のしきい値（同一エリア内{aggregate.threshold}件以上）を満たすデータがありません。
              記録が積み重なると、ここに集計結果が表示されます。
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[
                ['好意的', valence.positive],
                ['中立', valence.neutral],
                ['否定的', valence.negative],
              ].map(([label, n]) => (
                <div key={label as string} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ width: 56, fontSize: 12, color: corpColor.inkSoft, flexShrink: 0 }}>{label}</span>
                  <div style={{ flex: 1, height: 8, background: corpColor.groundDeep, position: 'relative' }}>
                    <div style={{ width: `${pct(n as number)}%`, height: '100%', background: corpColor.moss }} />
                  </div>
                  <span style={{ width: 40, fontSize: 12, color: corpColor.ink, textAlign: 'right', flexShrink: 0 }}>{pct(n as number)}%</span>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* 月次トレンド——「感情が改善しているか」を時系列で示す。しきい値未満の月は非表示 */}
        <section style={{ background: corpColor.white, border: `1px solid ${corpColor.line}`, padding: '28px 26px', marginBottom: 24 }}>
          <p style={{ margin: '0 0 6px', fontSize: 14, fontWeight: 700, color: corpColor.ink }}>感情の推移（月次）</p>
          <p style={{ margin: '0 0 20px', fontSize: 12, color: corpColor.inkSoft, lineHeight: 1.8 }}>
            月ごとの好意的な感情の割合です。件数が少ない月（{trend.threshold}件未満）は個人特定を避けるため表示していません。
          </p>
          {visibleTrendBuckets.length === 0 ? (
            <p style={{ margin: 0, fontSize: 13, color: corpColor.inkSoft, lineHeight: 1.9 }}>
              現時点では、月ごとの傾向を示すのに十分なデータがありません。記録が積み重なると、ここに表示されます。
            </p>
          ) : (
            <>
              {visibleTrendBuckets.length >= 2 && (
                <p style={{ margin: '0 0 16px', fontSize: 13, fontWeight: 700, color: trendColor }}>
                  {trendDelta > 0.05 ? '📈 好意的な感情の割合が上昇しています'
                    : trendDelta < -0.05 ? '📉 好意的な感情の割合が下降しています'
                    : '➡️ 好意的な感情の割合はおおむね横ばいです'}
                </p>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {visibleTrendBuckets.map((b, i) => {
                  const rate = Math.round(positiveRate(b.valence!) * 100);
                  const isLatest = i === visibleTrendBuckets.length - 1;
                  return (
                    <div key={b.month} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <span style={{ width: 56, fontSize: 12, color: corpColor.inkSoft, flexShrink: 0 }}>{b.month}</span>
                      <div style={{ flex: 1, height: 8, background: corpColor.groundDeep, position: 'relative' }}>
                        <div style={{ width: `${rate}%`, height: '100%', background: isLatest ? trendColor : corpColor.moss }} />
                      </div>
                      <span style={{ width: 70, fontSize: 12, color: corpColor.ink, textAlign: 'right', flexShrink: 0 }}>{rate}%（{b.count}件）</span>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </section>

        {/* 愛着ファネル（地・理・心）——関係人口の「質」を段階で示す。5人未満は抑制 */}
        <section style={{ background: corpColor.white, border: `1px solid ${corpColor.line}`, padding: '28px 26px', marginBottom: 24 }}>
          <p style={{ margin: '0 0 6px', fontSize: 14, fontWeight: 700, color: corpColor.ink }}>地域への愛着の段階</p>
          <p style={{ margin: '0 0 20px', fontSize: 12, color: corpColor.inkSoft, lineHeight: 1.8 }}>
            訪れた人が「記録する」→「人とつながる」→「再び足を運ぶ」へと進んだ人数です。
            訪問者数だけでは見えない、関係の深まりを示します。
          </p>
          {funnel.suppressed || !funnel.ok || !funnel.stages ? (
            <p style={{ margin: 0, fontSize: 13, color: corpColor.inkSoft, lineHeight: 1.9 }}>
              現時点では、公開のしきい値（記録した人が5人以上）を満たしていません。
              記録が積み重なると、ここに段階別の人数が表示されます。
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* 記録した→つながった→結ばれた の順にバーが伸びる（段階の絞り込みを動きで示す） */}
              <style>{`
                @keyframes funnel-bar-grow { from { width: 0; } }
              `}</style>
              {[
                ['記録した', funnel.stages.chi, 'この地域に記録を残した人'],
                ['つながった', funnel.stages.ri, 'そのうち、他の人と反応・コメントを交わした人'],
                ['結ばれた', funnel.stages.shin, 'そのうち、再訪・その後の記録・対面の約束に至った人'],
              ].map(([label, n, hint], i) => {
                const base = funnel.stages!.chi;
                const width = base > 0 ? Math.round(((n as number) / base) * 100) : 0;
                return (
                  <div key={label as string}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: corpColor.ink }}>{i + 1}. {label}</span>
                      <span style={{ fontSize: 12, color: corpColor.ink }}>{n}人{i > 0 ? `（${width}%）` : ''}</span>
                    </div>
                    <div style={{ height: 8, background: corpColor.groundDeep }}>
                      <div style={{
                        width: `${width}%`, height: '100%', background: corpColor.moss, opacity: 1 - i * 0.25,
                        animation: 'funnel-bar-grow 0.6s ease-out both', animationDelay: `${i * 0.2}s`,
                      }} />
                    </div>
                    <p style={{ margin: '4px 0 0', fontSize: 11, color: corpColor.inkSoft }}>{hint}</p>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* 境界データ（自治体の行政区域）が設定されている場合のみ、その自治体だけをマスクした地図を表示する */}
        {access.boundary_geojson && bbox && (
          <section style={{ background: corpColor.white, border: `1px solid ${corpColor.line}`, padding: '28px 26px', marginBottom: 24 }}>
            <p style={{ margin: '0 0 6px', fontSize: 14, fontWeight: 700, color: corpColor.ink }}>地図で見る</p>
            <p style={{ margin: '0 0 16px', fontSize: 12, color: corpColor.inkSoft, lineHeight: 1.8 }}>
              {access.region}の外側はマスクしています。個別の投稿の位置・写真・本文は表示されません（上記と同じ集計データのみ）。
              {populationStats?.dayNightRatio != null && '　地図全体の色は昼夜間人口比率（人口の流出入）を示しています。'}
            </p>
            <div style={{ height: 420 }}>
              <DashboardTraceMap aggregateCells={aggregate.cells} boundaryGeoJson={access.boundary_geojson} bbox={bbox} dayNightRatio={populationStats?.dayNightRatio ?? null} />
            </div>
            {populationStats?.dayNightRatio != null && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 10, fontSize: 11, color: corpColor.inkSoft }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <span style={{ width: 10, height: 10, borderRadius: 2, background: '#38ADA9', display: 'inline-block' }} />
                  昼間に人が流入する街
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <span style={{ width: 10, height: 10, borderRadius: 2, background: '#E5A139', display: 'inline-block' }} />
                  夜間人口の方が多い（流出）
                </span>
              </div>
            )}
          </section>
        )}

        {/* 自治体の人口統計と比べる——国勢調査等の公的統計を、上記の感情記録と並べて見せる（自治体単位・e-Stat経由・事前キャッシュ済み） */}
        <section style={{ background: corpColor.white, border: `1px solid ${corpColor.line}`, padding: '28px 26px', marginBottom: 24 }}>
          <p style={{ margin: '0 0 6px', fontSize: 14, fontWeight: 700, color: corpColor.ink }}>自治体の人口統計と比べる</p>
          <p style={{ margin: '0 0 20px', fontSize: 12, color: corpColor.inkSoft, lineHeight: 1.8 }}>
            国勢調査など公的統計と、上記の感情の記録を並べています。
          </p>
          {populationStats?.dayNightRatio != null ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 24, fontWeight: 700, color: corpColor.ink }}>{populationStats.dayNightRatio}%</span>
              <span style={{ fontSize: 12, color: corpColor.inkSoft }}>
                昼夜間人口比率{populationStats.statsYear ? `（${populationStats.statsYear}・国勢調査）` : '（国勢調査）'}
              </span>
            </div>
          ) : (
            <p style={{ margin: 0, fontSize: 13, color: corpColor.inkSoft, lineHeight: 1.9 }}>
              まだ取得されていません。
            </p>
          )}
        </section>

        <section style={{ background: corpColor.white, border: `1px solid ${corpColor.line}`, padding: '28px 26px' }}>
          <p style={{ margin: '0 0 20px', fontSize: 14, fontWeight: 700, color: corpColor.ink }}>エリア別の記録密度</p>
          <p style={{ margin: '0 0 20px', fontSize: 12, color: corpColor.inkSoft, lineHeight: 1.8 }}>
            個人が特定できないよう、同一エリア内に{aggregate.threshold}件未満しかない場所は表示していません
            （現在 {aggregate.suppressedCells} エリアを非表示中）。個別の投稿内容・写真・位置座標は含まれません。
          </p>
          {aggregate.cells.length === 0 ? (
            <p style={{ margin: 0, fontSize: 13, color: corpColor.inkSoft }}>表示できるエリアはまだありません。</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {aggregate.cells.map((cell, i) => (
                <div
                  key={`${cell.gridLat}-${cell.gridLng}`}
                  style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0', borderTop: i === 0 ? 'none' : `1px solid ${corpColor.line}` }}
                >
                  <span style={{ fontSize: 12, color: corpColor.inkSoft, width: 70, flexShrink: 0 }}>エリア {i + 1}</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: corpColor.ink }}>{cell.count}件</span>
                </div>
              ))}
            </div>
          )}
          <p style={{ margin: '20px 0 0', fontSize: 11, color: corpColor.inkSoft }}>
            対象：公開設定の記録のみ（{aggregate.totalPublicTraces}件） / グリッド解像度：約{Math.round(aggregate.gridSizeDeg * 111)}km四方
          </p>
        </section>
      </main>
    </div>
  );
}
