import { notFound } from 'next/navigation';
import { corpColor, corpFont } from '@/components/corp/tokens';
import { computeRegionAggregate } from '@/lib/regionAggregate';
import { computeAttachmentFunnel } from '@/lib/attachment';
import type { DashboardAccess } from '@/lib/types';

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
  const [aggregate, funnel] = await Promise.all([
    computeRegionAggregate(supabaseServer, typedAccess.region),
    computeAttachmentFunnel(supabaseServer, typedAccess.region),
  ]);
  return { access: typedAccess, aggregate, funnel };
}

export default async function CustomerDashboardPage({ params }: { params: { token: string } }) {
  const data = await loadDashboard(params.token);
  if (!data) notFound();

  const { access, aggregate, funnel } = data;
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
                      <div style={{ width: `${width}%`, height: '100%', background: corpColor.moss, opacity: 1 - i * 0.25 }} />
                    </div>
                    <p style={{ margin: '4px 0 0', fontSize: 11, color: corpColor.inkSoft }}>{hint}</p>
                  </div>
                );
              })}
            </div>
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
