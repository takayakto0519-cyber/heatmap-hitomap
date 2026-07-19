'use client';

// 関係人口ダッシュボード：agents/relation_population.py（番人63）と同じ考え方を
// サイト本体からライブに見る画面。データは /api/admin/relation-population（lib/relationPopulation.ts）。
// 複数の実験回に関わった人＝関係人口の芽、また来たいと答えた人＝関係の温度。
// 個人を特定できる値は一切表示せず、少人数（5人未満）の地域は非表示にする。
import { useEffect, useState } from 'react';

interface RelationStats {
  totalContributors: number;
  repeatContributors: number;
  repeatRate: number;
  wantRevisitPeople: number;
  wantRevisitRate: number;
}

interface OverallResult {
  ok: boolean;
  generatedAt?: string;
  overall?: RelationStats;
  topRegions?: ({ region: string; suppressed: true } | ({ region: string; suppressed: false } & RelationStats))[];
  error?: string;
}

interface RegionResult {
  ok: boolean;
  region: string;
  suppressed: boolean;
  stats?: RelationStats;
  error?: string;
}

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ background: '#fff', borderRadius: 12, padding: 16, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', ...style }}>
      {children}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  padding: '9px 12px', borderRadius: 8, border: '1.5px solid #ddd',
  fontSize: 13, outline: 'none', fontFamily: 'inherit', flex: 1,
};

function StatTile({ label, value, hint, color }: { label: string; value: string; hint: string; color: string }) {
  return (
    <div style={{ flex: 1, minWidth: 120, textAlign: 'center', padding: '12px 8px', borderRadius: 10, background: '#fafafa' }}>
      <div style={{ fontSize: 22, fontWeight: 800, color }}>{value}</div>
      <div style={{ fontSize: 12, fontWeight: 700, color: '#666', marginTop: 2 }}>{label}</div>
      <div style={{ fontSize: 10.5, color: '#aaa', marginTop: 4, lineHeight: 1.5 }}>{hint}</div>
    </div>
  );
}

function StatsRow({ stats }: { stats: RelationStats }) {
  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
      <StatTile label="関わった人" value={`${stats.totalContributors}人`} hint="ニックネーム単位の延べ人数" color="#38ADA9" />
      <StatTile label="関係人口の芽" value={`${stats.repeatContributors}人（${stats.repeatRate}%）`} hint="複数の実験回に関わった人" color="#4A69BD" />
      <StatTile label="また来たい" value={`${stats.wantRevisitPeople}人（${stats.wantRevisitRate}%）`} hint="関係の温度" color="#E5A139" />
    </div>
  );
}

export default function RelationPopulationTab({ authHeaders }: { authHeaders: () => HeadersInit }) {
  const [overall, setOverall] = useState<OverallResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [regionInput, setRegionInput] = useState('');
  const [regionResult, setRegionResult] = useState<RegionResult | null>(null);
  const [regionLoading, setRegionLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetch('/api/admin/relation-population', { headers: authHeaders() })
      .then(r => r.json())
      .then(d => { if (d.ok) setOverall(d); else setError(d.error ?? '取得に失敗しました'); })
      .catch(() => setError('通信エラー'))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function lookupRegion(region: string) {
    if (!region.trim()) return;
    setRegionLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/admin/relation-population?region=${encodeURIComponent(region.trim())}`, { headers: authHeaders() });
      const d = await res.json();
      setRegionResult(d);
      if (!d.ok && d.error) setError(d.error);
    } catch {
      setError('通信エラー');
    } finally {
      setRegionLoading(false);
    }
  }

  return (
    <div>
      <Card>
        <p style={{ margin: '0 0 4px', fontWeight: 800, fontSize: 15 }}>🔁 関係人口ダッシュボード</p>
        <p style={{ margin: 0, fontSize: 12, color: '#888', lineHeight: 1.7 }}>
          複数の実験回（イベント・地域）に関わった人＝「関係人口の芽」を数えます。<br />
          自治体向け提案書・レポートの一次データとして使えます。個人を特定できる値は表示しません。
          総数が5人未満の地域は非表示にします。
        </p>
      </Card>

      {error && <p style={{ margin: '12px 0 0', fontSize: 13, color: '#E74C3C' }}>{error}</p>}

      <p style={{ margin: '20px 0 8px', fontWeight: 800, fontSize: 14 }}>📊 全体</p>
      <Card>
        {loading ? (
          <p style={{ margin: 0, fontSize: 13, color: '#999' }}>集計中…</p>
        ) : overall?.overall ? (
          <StatsRow stats={overall.overall} />
        ) : (
          <p style={{ margin: 0, fontSize: 13, color: '#aaa' }}>データがありません。</p>
        )}
      </Card>

      <p style={{ margin: '24px 0 8px', fontWeight: 800, fontSize: 14 }}>🏘 地域ランキング（上位10）</p>
      <Card>
        {loading ? (
          <p style={{ margin: 0, fontSize: 13, color: '#999' }}>集計中…</p>
        ) : !overall?.topRegions || overall.topRegions.length === 0 ? (
          <p style={{ margin: 0, fontSize: 13, color: '#aaa' }}>地域が記録された投稿がまだありません。</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {overall.topRegions.map(r => (
              <div key={r.region} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '8px 10px', borderRadius: 8, background: '#fafafa',
              }}>
                <span style={{ fontSize: 13, fontWeight: 700 }}>{r.region}</span>
                {r.suppressed ? (
                  <span style={{ fontSize: 11.5, color: '#B7791F' }}>少人数のため非表示</span>
                ) : (
                  <span style={{ fontSize: 12, color: '#666' }}>
                    {r.totalContributors}人 ・ 関係人口の芽 {r.repeatContributors}人（{r.repeatRate}%）
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>

      <p style={{ margin: '24px 0 8px', fontWeight: 800, fontSize: 14 }}>🔍 地域を指定して詳細を見る</p>
      <Card>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            placeholder="例：佐野市（栃木県）"
            value={regionInput}
            onChange={e => setRegionInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && lookupRegion(regionInput)}
            style={inputStyle}
          />
          <button
            onClick={() => lookupRegion(regionInput)}
            disabled={regionLoading || !regionInput.trim()}
            style={{ padding: '9px 16px', borderRadius: 8, border: 'none', background: '#38ADA9', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}
          >{regionLoading ? '集計中…' : '集計する'}</button>
        </div>
        <p style={{ margin: '6px 0 0', fontSize: 11, color: '#aaa' }}>投稿時に保存された自治体名と完全一致で検索します。</p>

        {regionResult && regionResult.suppressed && (
          <p style={{ marginTop: 14, fontSize: 12.5, color: '#B7791F', background: '#FFF8E8', padding: 10, borderRadius: 8 }}>
            「{regionResult.region}」は関わった人数が5人未満のため、個人特定を避けて非表示にしています。
          </p>
        )}
        {regionResult && regionResult.ok && !regionResult.suppressed && regionResult.stats && (
          <div key={regionResult.region}>
            <StatsRow stats={regionResult.stats} />
          </div>
        )}
        {regionResult && !regionResult.ok && (
          <p style={{ marginTop: 14, fontSize: 12.5, color: '#E74C3C' }}>{regionResult.error}</p>
        )}
      </Card>
    </div>
  );
}
