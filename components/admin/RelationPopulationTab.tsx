'use client';

// 関係人口ダッシュボード：agents/relation_population.py（番人63）と同じ考え方を
// サイト本体からライブに見る画面。データは /api/admin/relation-population（lib/relationPopulation.ts）。
// 複数の実験回に関わった人＝関係人口の芽、また来たいと答えた人＝関係の温度。
// 個人を特定できる値は一切表示せず、少人数（5人未満）の地域は非表示にする。
import { useEffect, useMemo, useState } from 'react';
import { computeFollowUp } from '@/lib/followUp';

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
  contact_email: string | null;
  email_draft: string | null;
  email_sent_at: string | null;
  email_sent_content: string | null;
  email_reply: string | null;
  followed_up_at: string | null;
  is_priority_pick: boolean;
  updated_at: string;
}

const ENGAGEMENT_STAGES = [
  { key: 'observing', label: '観察' },
  { key: 'lead', label: 'リード' },
  { key: 'proposed', label: '提案中' },
  { key: 'contracted', label: '契約済み' },
];
const OPPORTUNITY_LEVELS = ['高', '中', '低'];
const OPPORTUNITY_RANK: Record<string, number> = { 高: 0, 中: 1, 低: 2 };
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

// URLらしき行だけを別タブで開けるリンクにする（複数行・複数URL対応）
function LinkList({ text }: { text: string }) {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  if (lines.length === 0) return null;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      {lines.map((line, i) => {
        const isUrl = /^https?:\/\//.test(line);
        return isUrl ? (
          <a key={i} href={line} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11.5, color: '#38ADA9', wordBreak: 'break-all' }}>
            🔗 {line}
          </a>
        ) : (
          <span key={i} style={{ fontSize: 11.5, color: '#888' }}>{line}</span>
        );
      })}
    </div>
  );
}

type SortKey = 'rank_desc' | 'rank_asc' | 'name';

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
  const [sortKey, setSortKey] = useState<SortKey>('rank_desc');
  const [nameFilter, setNameFilter] = useState('');
  const [levelFilter, setLevelFilter] = useState<'all' | '高' | '中' | '低'>('all');

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
  async function markSent(id: string) {
    await patchProfile(id, { email_sent_at: new Date().toISOString() });
  }
  async function unmarkSent(id: string) {
    await patchProfile(id, { email_sent_at: null });
  }
  async function markFollowedUp(id: string) {
    await patchProfile(id, { followed_up_at: new Date().toISOString() });
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

  const unsent = useMemo(() => profiles.filter(p => !p.email_sent_at), [profiles]);
  const FOLLOWUP_RANK: Record<string, number> = { overdue: 0, due_soon: 1, ok: 2, replied: 3 };
  const sent = useMemo(
    () => profiles.filter(p => p.email_sent_at).sort((a, b) => {
      const fa = computeFollowUp(a); const fb = computeFollowUp(b);
      const ra = FOLLOWUP_RANK[fa?.status ?? ''] ?? 9; const rb = FOLLOWUP_RANK[fb?.status ?? ''] ?? 9;
      if (ra !== rb) return ra - rb;
      return (fb?.daysSince ?? 0) - (fa?.daysSince ?? 0);
    }),
    [profiles]
  );
  const [viewMode, setViewMode] = useState<'unsent' | 'sent'>('unsent');
  const baseList = viewMode === 'unsent' ? unsent : sent;

  const priorityPicks = useMemo(
    () => (viewMode === 'unsent' ? unsent.filter(p => p.is_priority_pick).sort((a, b) => a.region_name.localeCompare(b.region_name, 'ja')) : []),
    [unsent, viewMode]
  );

  const visibleProfiles = useMemo(() => {
    let list = viewMode === 'unsent' ? baseList.filter(p => !p.is_priority_pick) : baseList;
    if (levelFilter !== 'all') list = list.filter(p => p.opportunity_level === levelFilter);
    if (nameFilter.trim()) {
      const q = nameFilter.trim();
      list = list.filter(p => p.region_name.includes(q));
    }
    const sorted = [...list];
    if (sortKey === 'name') {
      sorted.sort((a, b) => a.region_name.localeCompare(b.region_name, 'ja'));
    } else {
      const dir = sortKey === 'rank_desc' ? 1 : -1;
      sorted.sort((a, b) => dir * ((OPPORTUNITY_RANK[a.opportunity_level] ?? 9) - (OPPORTUNITY_RANK[b.opportunity_level] ?? 9)));
    }
    return sorted;
  }, [baseList, viewMode, sortKey, nameFilter, levelFilter]);

  const levelCounts = {
    高: baseList.filter(p => p.opportunity_level === '高').length,
    中: baseList.filter(p => p.opportunity_level === '中').length,
    低: baseList.filter(p => p.opportunity_level === '低').length,
  };

  function ProfileCard({ p, highlight }: { p: MunicipalityProfile; highlight?: boolean }) {
    return (
      <div style={{
        padding: 14, borderRadius: 10,
        border: highlight ? '2px solid #E5A139' : '1px solid #eee',
        background: highlight ? '#FFFBF2' : '#fff',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
          <b style={{ fontSize: 14 }}>
            {highlight && '🌟 '}{p.region_name}
          </b>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span onClick={() => patchProfile(p.id, { is_priority_pick: !p.is_priority_pick })} style={{
              fontSize: 11, cursor: 'pointer', color: p.is_priority_pick ? '#E5A139' : '#ccc', fontWeight: 700,
            }} title="営業価値の高い最優先自治体としてピン留め">{p.is_priority_pick ? '★ 最優先' : '☆ ピン留め'}</span>
            <button onClick={() => removeProfile(p.id)} style={{ fontSize: 11, color: '#E74C3C', background: 'none', border: 'none', cursor: 'pointer' }}>削除</button>
          </div>
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

        <label style={labelStyle}>関係人口創出・新規実証の受け入れ実績</label>
        <textarea defaultValue={p.relation_population_initiative ?? ''} rows={2} style={{ ...inputStyle, width: '100%', boxSizing: 'border-box', resize: 'vertical' }}
          placeholder="具体的な施策名・内容（なければ「確認できず」等）"
          onBlur={e => { if (e.target.value !== (p.relation_population_initiative ?? '')) patchProfile(p.id, { relation_population_initiative: e.target.value || null }); }} />

        <label style={labelStyle}>ヒトマップとの親和性・提案余地の理由</label>
        <textarea defaultValue={p.fit_assessment ?? ''} rows={2} style={{ ...inputStyle, width: '100%', boxSizing: 'border-box', resize: 'vertical' }}
          onBlur={e => { if (e.target.value !== (p.fit_assessment ?? '')) patchProfile(p.id, { fit_assessment: e.target.value || null }); }} />

        <label style={labelStyle}>次の一手・メモ</label>
        <textarea defaultValue={p.opportunity_notes ?? ''} rows={2} style={{ ...inputStyle, width: '100%', boxSizing: 'border-box', resize: 'vertical' }}
          onBlur={e => { if (e.target.value !== (p.opportunity_notes ?? '')) patchProfile(p.id, { opportunity_notes: e.target.value || null }); }} />

        <label style={labelStyle}>情報源（クリックで開けます）</label>
        {p.source_links ? (
          <div style={{ padding: '8px 10px', background: '#fafafa', borderRadius: 8, marginBottom: 6 }}>
            <LinkList text={p.source_links} />
          </div>
        ) : null}
        <textarea defaultValue={p.source_links ?? ''} rows={2} style={{ ...inputStyle, width: '100%', boxSizing: 'border-box', resize: 'vertical' }}
          placeholder="URLを1行に1つ貼り付け"
          onBlur={e => { if (e.target.value !== (p.source_links ?? '')) patchProfile(p.id, { source_links: e.target.value || null }); }} />

        <div style={{ marginTop: 10, padding: 10, borderRadius: 8, background: '#F4FAF9', border: '1px solid #DDF0EE' }}>
          <p style={{ margin: '0 0 6px', fontSize: 12, fontWeight: 800, color: '#2A8580' }}>📮 営業メール</p>
          <label style={labelStyle}>宛先メールアドレス</label>
          <input defaultValue={p.contact_email ?? ''} style={{ ...inputStyle, width: '100%', boxSizing: 'border-box' }}
            placeholder="判明していれば入力"
            onBlur={e => { if (e.target.value !== (p.contact_email ?? '')) patchProfile(p.id, { contact_email: e.target.value || null }); }} />
          <label style={labelStyle}>メール文案（下書き・編集可）</label>
          <textarea defaultValue={p.email_draft ?? ''} rows={6} style={{ ...inputStyle, width: '100%', boxSizing: 'border-box', resize: 'vertical', fontFamily: 'inherit' }}
            onBlur={e => { if (e.target.value !== (p.email_draft ?? '')) patchProfile(p.id, { email_draft: e.target.value || null }); }} />
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', margin: '8px 0 4px', flexWrap: 'wrap' }}>
            {p.email_sent_at ? (
              <>
                <span style={{ fontSize: 11.5, color: '#27AE60', fontWeight: 700 }}>✓ 送信済み（{new Date(p.email_sent_at).toLocaleDateString('ja-JP')}）</span>
                {(() => {
                  const fu = computeFollowUp(p);
                  return fu ? (
                    <span style={{ fontSize: 11, fontWeight: 700, color: fu.color, padding: '2px 9px', borderRadius: 10, background: fu.color + '18' }}>
                      {fu.label}
                    </span>
                  ) : null;
                })()}
                {p.followed_up_at && (
                  <span style={{ fontSize: 10.5, color: '#999' }}>最終フォロー：{new Date(p.followed_up_at).toLocaleDateString('ja-JP')}</span>
                )}
                <button onClick={() => markFollowedUp(p.id)} style={{ fontSize: 11, background: 'none', border: '1px solid #38ADA9', color: '#38ADA9', borderRadius: 999, padding: '3px 10px', cursor: 'pointer' }}>フォロー済みにする</button>
                <button onClick={() => unmarkSent(p.id)} style={{ fontSize: 11, background: 'none', border: '1px solid #ccc', borderRadius: 999, padding: '3px 10px', cursor: 'pointer' }}>取り消す</button>
              </>
            ) : (
              <button onClick={() => markSent(p.id)} style={{ fontSize: 11.5, fontWeight: 700, background: '#38ADA9', color: '#fff', border: 'none', borderRadius: 999, padding: '5px 12px', cursor: 'pointer' }}>
                送信済みにする
              </button>
            )}
          </div>
          {p.email_sent_content && (
            <>
              <label style={labelStyle}>Gmailで実際に送信した本文（gmail_watch番人が自動取得・読み取り専用）</label>
              <div style={{ padding: '8px 10px', background: '#fafafa', borderRadius: 8, fontSize: 12, color: '#555', whiteSpace: 'pre-wrap', maxHeight: 200, overflowY: 'auto' }}>
                {p.email_sent_content}
              </div>
            </>
          )}
          <label style={labelStyle}>届いた返信（貼り付けて保存）</label>
          <textarea defaultValue={p.email_reply ?? ''} rows={3} style={{ ...inputStyle, width: '100%', boxSizing: 'border-box', resize: 'vertical' }}
            placeholder="返信メールの本文を貼り付けておくと、ここに残ります"
            onBlur={e => { if (e.target.value !== (p.email_reply ?? '')) patchProfile(p.id, { email_reply: e.target.value || null }); }} />
        </div>
      </div>
    );
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

      <p style={{ margin: '24px 0 8px', fontWeight: 800, fontSize: 14 }}>🏛 自治体プロファイル（関係人口創出・スタートアップ受け入れの取り組みと提案余地）</p>
      <Card>
        <div style={{ fontSize: 12, color: '#888', lineHeight: 1.8, marginBottom: 12 }}>
          <p style={{ margin: '0 0 6px' }}>
            営業対象・実証先の自治体を、①どんなデータを調べたか（証拠パック）、②関係人口創出やスタートアップ受け入れの取り組みが実際にあるか、③ヒトマップの体験型サービスとの相性、④営業として攻める価値（提案余地：高・中・低）の4点でまとめています。
          </p>
          <p style={{ margin: '0 0 6px' }}>
            データソースは2種類です。（A）自治体の総合戦略・提案準備状況から個別に深掘りしたもの（既存の営業リード12件）と、（B）総務省「関係人口創出・拡大事業」モデル事業（2018〜2020年度・全国約93自治体）＋内閣府「スタートアップエコシステム拠点都市」等の公的認定リスト（約14自治体）から一次評価したものです。後者は要約情報からのルールベース判定のため、提案前に個別の裏取りをおすすめします。
          </p>
          <p style={{ margin: 0 }}>
            メール文案は下書きの自動生成です。送信前に必ず内容をご確認ください。送信・返信の記録はここに手動で残す運用です（自動送信は一切行いません）。
          </p>
        </div>

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
        ) : (
          <>
            {priorityPicks.length > 0 && (
              <>
                <p style={{ margin: '4px 0 8px', fontWeight: 800, fontSize: 13, color: '#B7791F' }}>🌟 営業価値の高い最優先自治体（{priorityPicks.length}）</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
                  {priorityPicks.map(p => <ProfileCard key={p.id} p={p} highlight />)}
                </div>
              </>
            )}

            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', margin: '4px 0 12px' }}>
              <input value={nameFilter} onChange={e => setNameFilter(e.target.value)} placeholder="自治体名で絞り込み"
                style={{ ...inputStyle, maxWidth: 220 }} />
              <div style={{ display: 'flex', gap: 4 }}>
                <span onClick={() => setViewMode('unsent')} style={pillStyle(viewMode === 'unsent', '#38ADA9')}>
                  未送信（{unsent.length}）
                </span>
                <span onClick={() => setViewMode('sent')} style={pillStyle(viewMode === 'sent', '#999')}>
                  📤 送信済み（{sent.length}）
                </span>
              </div>
              <div style={{ display: 'flex', gap: 4 }}>
                {(['all', '高', '中', '低'] as const).map(lv => (
                  <span key={lv} onClick={() => setLevelFilter(lv)}
                    style={pillStyle(levelFilter === lv, lv === 'all' ? '#38ADA9' : OPPORTUNITY_COLORS[lv])}>
                    {lv === 'all' ? `すべて（${baseList.length}）` : `${lv}（${levelCounts[lv]}）`}
                  </span>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 4, marginLeft: 'auto' }}>
                <span style={{ fontSize: 10.5, color: '#999', alignSelf: 'center' }}>並び順</span>
                <span onClick={() => setSortKey('rank_desc')} style={pillStyle(sortKey === 'rank_desc')}>提案余地 高→低</span>
                <span onClick={() => setSortKey('rank_asc')} style={pillStyle(sortKey === 'rank_asc')}>提案余地 低→高</span>
                <span onClick={() => setSortKey('name')} style={pillStyle(sortKey === 'name')}>自治体名</span>
              </div>
            </div>

            {visibleProfiles.length === 0 ? (
              <p style={{ margin: 0, fontSize: 13, color: '#aaa' }}>
                {viewMode === 'sent' ? '送信済みの自治体プロファイルがありません。' : '該当する自治体プロファイルがありません。'}
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {visibleProfiles.map(p => <ProfileCard key={p.id} p={p} />)}
              </div>
            )}
          </>
        )}
      </Card>
    </div>
  );
}
