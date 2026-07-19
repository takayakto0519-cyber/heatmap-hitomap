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

interface MunicipalityProfile {
  id: string;
  region_name: string;
  engagement_stage: string;
  evidence_summary: string | null;
  relation_population_initiative: string | null;
  fit_assessment: string | null;
  opportunity_level: string;
  opportunity_notes: string | null;
  source_links: string | null;
  updated_at: string;
}

const ENGAGEMENT_STAGES = [
  { key: 'observing', label: '観察' },
  { key: 'lead', label: 'リード' },
  { key: 'proposed', label: '提案中' },
  { key: 'contracted', label: '契約済み' },
];
const OPPORTUNITY_LEVELS = ['高', '中', '低'];
const OPPORTUNITY_COLORS: Record<string, string> = { 高: '#27AE60', 中: '#E5A139', 低: '#999' };

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
const labelStyle: React.CSSProperties = { fontSize: 12, fontWeight: 700, color: '#555', margin: '10px 0 4px', display: 'block' };
const pillStyle = (active: boolean, color = '#38ADA9'): React.CSSProperties => ({
  padding: '5px 12px', borderRadius: 999, fontSize: 11.5, fontWeight: 700, cursor: 'pointer',
  border: active ? 'none' : '1px solid #ccc', background: active ? color : 'transparent', color: active ? '#fff' : '#666',
});

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

  const [profiles, setProfiles] = useState<MunicipalityProfile[]>([]);
  const [profilesLoading, setProfilesLoading] = useState(true);
  const [showProfileForm, setShowProfileForm] = useState(false);
  const [profileForm, setProfileForm] = useState({ region_name: '', engagement_stage: 'lead', opportunity_level: '中' });

  function jsonHeaders(): HeadersInit {
    return { ...authHeaders(), 'Content-Type': 'application/json' };
  }

  async function loadProfiles() {
    setProfilesLoading(true);
    const res = await fetch('/api/admin/municipality-profiles', { headers: authHeaders() });
    const data = await res.json();
    if (data.ok) setProfiles(data.profiles ?? []);
    setProfilesLoading(false);
  }

  useEffect(() => {
    setLoading(true);
    fetch('/api/admin/relation-population', { headers: authHeaders() })
      .then(r => r.json())
      .then(d => { if (d.ok) setOverall(d); else setError(d.error ?? '取得に失敗しました'); })
      .catch(() => setError('通信エラー'))
      .finally(() => setLoading(false));
    loadProfiles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function createProfile() {
    if (!profileForm.region_name.trim()) return;
    await fetch('/api/admin/municipality-profiles', { method: 'POST', headers: jsonHeaders(), body: JSON.stringify(profileForm) });
    setProfileForm({ region_name: '', engagement_stage: 'lead', opportunity_level: '中' });
    setShowProfileForm(false);
    await loadProfiles();
  }
  async function patchProfile(id: string, fields: Partial<MunicipalityProfile>) {
    await fetch(`/api/admin/municipality-profiles/${id}`, { method: 'PATCH', headers: jsonHeaders(), body: JSON.stringify(fields) });
    await loadProfiles();
  }
  async function removeProfile(id: string) {
    if (!window.confirm('削除しますか？')) return;
    await fetch(`/api/admin/municipality-profiles/${id}`, { method: 'DELETE', headers: authHeaders() });
    await loadProfiles();
  }

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

      <p style={{ margin: '24px 0 8px', fontWeight: 800, fontSize: 14 }}>🏛 自治体プロファイル（関係人口創出の取り組み・提案余地）</p>
      <Card>
        <p style={{ margin: '0 0 10px', fontSize: 12, color: '#888', lineHeight: 1.6 }}>
          営業対象・実証先の自治体ごとに、調べた内容と関係人口創出の取り組みの有無、ヒトマップとの親和性、提案余地をまとめておく場所です。
        </p>
        <button onClick={() => setShowProfileForm(v => !v)} style={{
          padding: '8px 16px', borderRadius: 8, border: 'none', background: '#38ADA9', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer', marginBottom: 12,
        }}>{showProfileForm ? 'キャンセル' : '+ 自治体を追加'}</button>

        {showProfileForm && (
          <div style={{ padding: 12, borderRadius: 10, background: '#fafafa', marginBottom: 14 }}>
            <label style={labelStyle}>自治体名</label>
            <input style={{ ...inputStyle, width: '100%', boxSizing: 'border-box' }} value={profileForm.region_name}
              onChange={e => setProfileForm(f => ({ ...f, region_name: e.target.value }))} placeholder="例：佐野市（栃木県）" />
            <div style={{ marginTop: 10 }}><button onClick={createProfile} style={{
              padding: '8px 16px', borderRadius: 8, border: 'none', background: '#38ADA9', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer',
            }}>保存する</button></div>
          </div>
        )}

        {profilesLoading ? (
          <p style={{ margin: 0, fontSize: 13, color: '#999' }}>読み込み中…</p>
        ) : profiles.length === 0 ? (
          <p style={{ margin: 0, fontSize: 13, color: '#aaa' }}>まだ自治体プロファイルがありません。</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {profiles.map(p => (
              <div key={p.id} style={{ padding: 12, borderRadius: 10, border: '1px solid #eee' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <b style={{ fontSize: 14 }}>{p.region_name}</b>
                  <button onClick={() => removeProfile(p.id)} style={{ fontSize: 11, color: '#E74C3C', background: 'none', border: 'none', cursor: 'pointer' }}>削除</button>
                </div>
                <div style={{ display: 'flex', gap: 12, margin: '8px 0', flexWrap: 'wrap' }}>
                  <div>
                    <span style={{ fontSize: 10.5, color: '#999', marginRight: 6 }}>関わり方</span>
                    {ENGAGEMENT_STAGES.map(s => (
                      <span key={s.key} onClick={() => patchProfile(p.id, { engagement_stage: s.key })}
                        style={{ ...pillStyle(p.engagement_stage === s.key), marginRight: 4 }}>{s.label}</span>
                    ))}
                  </div>
                  <div>
                    <span style={{ fontSize: 10.5, color: '#999', marginRight: 6 }}>提案余地</span>
                    {OPPORTUNITY_LEVELS.map(o => (
                      <span key={o} onClick={() => patchProfile(p.id, { opportunity_level: o })}
                        style={{ ...pillStyle(p.opportunity_level === o, OPPORTUNITY_COLORS[o]), marginRight: 4 }}>{o}</span>
                    ))}
                  </div>
                </div>
                <label style={labelStyle}>調べた内容（証拠パック）</label>
                <textarea defaultValue={p.evidence_summary ?? ''} rows={2} style={{ ...inputStyle, width: '100%', boxSizing: 'border-box', resize: 'vertical' }}
                  onBlur={e => { if (e.target.value !== (p.evidence_summary ?? '')) patchProfile(p.id, { evidence_summary: e.target.value || null }); }} />
                <label style={labelStyle}>関係人口創出の取り組み</label>
                <textarea defaultValue={p.relation_population_initiative ?? ''} rows={2} style={{ ...inputStyle, width: '100%', boxSizing: 'border-box', resize: 'vertical' }}
                  placeholder="具体的な施策名・内容（なければ「確認できず」等）"
                  onBlur={e => { if (e.target.value !== (p.relation_population_initiative ?? '')) patchProfile(p.id, { relation_population_initiative: e.target.value || null }); }} />
                <label style={labelStyle}>ヒトマップとの親和性・提案余地の理由</label>
                <textarea defaultValue={p.fit_assessment ?? ''} rows={2} style={{ ...inputStyle, width: '100%', boxSizing: 'border-box', resize: 'vertical' }}
                  onBlur={e => { if (e.target.value !== (p.fit_assessment ?? '')) patchProfile(p.id, { fit_assessment: e.target.value || null }); }} />
                <label style={labelStyle}>次の一手・メモ</label>
                <textarea defaultValue={p.opportunity_notes ?? ''} rows={2} style={{ ...inputStyle, width: '100%', boxSizing: 'border-box', resize: 'vertical' }}
                  onBlur={e => { if (e.target.value !== (p.opportunity_notes ?? '')) patchProfile(p.id, { opportunity_notes: e.target.value || null }); }} />
                <label style={labelStyle}>情報源（URL等）</label>
                <textarea defaultValue={p.source_links ?? ''} rows={2} style={{ ...inputStyle, width: '100%', boxSizing: 'border-box', resize: 'vertical' }}
                  onBlur={e => { if (e.target.value !== (p.source_links ?? '')) patchProfile(p.id, { source_links: e.target.value || null }); }} />
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
