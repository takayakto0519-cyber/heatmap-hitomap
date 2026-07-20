'use client';

// 学校・法人：問い合わせ・契約状況の管理（縁のデータベース）。page.tsx monolith分割で切り出し。
import { useCallback, useEffect, useState } from 'react';
import { scoreLead } from '@/lib/leadTemperature';
import { Card, inputStyle } from '@/components/admin/adminShared';

export interface ClientLead {
  id: string;
  client_type: 'school' | 'business';
  org_name: string;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  status: string;
  memo: string | null;
  created_at: string;
  updated_at: string;
}

export const LEAD_STATUS_LABELS: Record<string, { label: string; color: string }> = {
  lead: { label: '候補', color: '#999' },
  contacted: { label: '接触済み', color: '#4A90E2' },
  negotiating: { label: '商談中', color: '#E5A139' },
  contracted: { label: '契約中', color: '#27AE60' },
  lost: { label: '見送り', color: '#E55039' },
};

export default function ClientLeadsTab({ authHeaders }: { authHeaders: () => HeadersInit }) {
  const [filter, setFilter] = useState<'all' | 'school' | 'business'>('all');
  const [hotSort, setHotSort] = useState(false);
  const [leads, setLeads] = useState<ClientLead[]>([]);
  const [includeDemo, setIncludeDemo] = useState(false);
  const [demoHiddenCount, setDemoHiddenCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ client_type: 'business', org_name: '', contact_name: '', email: '', phone: '' });
  const [saving, setSaving] = useState(false);
  const [editingMemo, setEditingMemo] = useState<Record<string, string>>({});
  const [enrichOpen, setEnrichOpen] = useState<Record<string, boolean>>({});
  const [enrichSource, setEnrichSource] = useState<Record<string, string>>({});
  const [enrichLoading, setEnrichLoading] = useState<Record<string, boolean>>({});
  const [enrichDraft, setEnrichDraft] = useState<Record<string, string>>({});
  const [enrichError, setEnrichError] = useState<Record<string, string>>({});
  const [proposalLoading, setProposalLoading] = useState<Record<string, boolean>>({});
  const [proposalDraft, setProposalDraft] = useState<Record<string, string>>({});
  const [proposalError, setProposalError] = useState<Record<string, string>>({});

  // 自治体・法人向け集計ダッシュボードの専用URL発行（地図範囲でも絞り込める）
  const [dashOpen, setDashOpen] = useState<Record<string, boolean>>({});
  const [dashForm, setDashForm] = useState<Record<string, {
    region: string; label: string; useBbox: boolean;
    minLat: string; maxLat: string; minLng: string; maxLng: string;
    municipalityQuery: string; boundaryGeoJson: unknown | null;
  }>>({});
  const [dashLoading, setDashLoading] = useState<Record<string, boolean>>({});
  const [dashResult, setDashResult] = useState<Record<string, string>>({});
  const [dashError, setDashError] = useState<Record<string, string>>({});

  // 市区町村を「目次」のように検索して選べるようにする（緯度経度の手入力に代わる体験）。
  // 一覧はscripts/fetch-municipality-boundaries.mjsが生成した軽量インデックス（ジオメトリなし）。
  const [municipalities, setMunicipalities] = useState<{ code: string; name: string; pref: string }[]>([]);
  useEffect(() => {
    fetch('/data/municipalities-index.json').then(r => r.json()).then(setMunicipalities).catch(() => {});
  }, []);

  function dashFormFor(id: string) {
    return dashForm[id] ?? { region: '', label: '', useBbox: false, minLat: '', maxLat: '', minLng: '', maxLng: '', municipalityQuery: '', boundaryGeoJson: null };
  }

  const [municipalityLoading, setMunicipalityLoading] = useState<Record<string, boolean>>({});

  async function selectMunicipality(leadId: string, code: string, name: string) {
    setMunicipalityLoading(prev => ({ ...prev, [leadId]: true }));
    try {
      const res = await fetch(`/api/admin/geo/municipality-boundary?code=${code}`, { headers: authHeaders() });
      const data = await res.json();
      if (!data.ok) { setDashError(prev => ({ ...prev, [leadId]: data.error ?? '境界データの取得に失敗しました' })); return; }
      setDashForm(prev => ({
        ...prev,
        [leadId]: {
          ...dashFormFor(leadId),
          region: name,
          municipalityQuery: name,
          useBbox: true,
          minLat: String(data.bbox.minLat), maxLat: String(data.bbox.maxLat),
          minLng: String(data.bbox.minLng), maxLng: String(data.bbox.maxLng),
          boundaryGeoJson: data.geojson,
        },
      }));
    } catch {
      setDashError(prev => ({ ...prev, [leadId]: '通信エラー' }));
    } finally {
      setMunicipalityLoading(prev => ({ ...prev, [leadId]: false }));
    }
  }

  async function issueDashboardToken(id: string) {
    const f = dashFormFor(id);
    if (!f.region.trim()) { setDashError(prev => ({ ...prev, [id]: '対象の地域名（regionに保存されている表記）を入力してください' })); return; }
    setDashLoading(prev => ({ ...prev, [id]: true }));
    setDashError(prev => ({ ...prev, [id]: '' }));
    try {
      const body: Record<string, unknown> = { region: f.region.trim(), label: f.label.trim() || undefined };
      if (f.useBbox) {
        const nums = { bbox_min_lat: Number(f.minLat), bbox_max_lat: Number(f.maxLat), bbox_min_lng: Number(f.minLng), bbox_max_lng: Number(f.maxLng) };
        if (Object.values(nums).some((n) => !Number.isFinite(n))) {
          setDashError(prev => ({ ...prev, [id]: '地図範囲は数値で入力してください' }));
          setDashLoading(prev => ({ ...prev, [id]: false }));
          return;
        }
        Object.assign(body, nums);
      }
      if (f.boundaryGeoJson) body.boundary_geojson = f.boundaryGeoJson;
      const res = await fetch(`/api/admin/client-leads/${id}/dashboard-token`, {
        method: 'POST', headers: authHeaders(), body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.ok) setDashResult(prev => ({ ...prev, [id]: data.url }));
      else setDashError(prev => ({ ...prev, [id]: data.error ?? '発行に失敗しました' }));
    } catch {
      setDashError(prev => ({ ...prev, [id]: '通信エラー' }));
    } finally {
      setDashLoading(prev => ({ ...prev, [id]: false }));
    }
  }

  const load = useCallback(() => {
    setLoading(true);
    fetch(`/api/admin/client-leads${includeDemo ? '?includeDemo=true' : ''}`, { headers: authHeaders() })
      .then(r => r.json())
      .then(d => {
        if (d.ok) {
          setLeads(d.leads);
          setDemoHiddenCount(d.demoHiddenCount ?? 0);
          setEditingMemo(Object.fromEntries((d.leads as ClientLead[]).map(l => [l.id, l.memo ?? ''])));
        } else setError(d.error ?? '取得に失敗しました');
      })
      .catch(() => setError('通信エラー'))
      .finally(() => setLoading(false));
  }, [authHeaders, includeDemo]);

  useEffect(() => { load(); }, [load]);

  async function createLead(e: React.FormEvent) {
    e.preventDefault();
    if (!form.org_name.trim()) return;
    setSaving(true);
    try {
      const res = await fetch('/api/admin/client-leads', {
        method: 'POST', headers: authHeaders(), body: JSON.stringify(form),
      });
      const data = await res.json();
      if (data.ok) {
        setForm({ client_type: 'business', org_name: '', contact_name: '', email: '', phone: '' });
        setShowCreate(false);
        load();
      } else setError(data.error ?? '作成に失敗しました');
    } finally {
      setSaving(false);
    }
  }

  async function updateLead(id: string, patch: Record<string, unknown>) {
    const res = await fetch(`/api/admin/client-leads/${id}`, {
      method: 'PATCH', headers: authHeaders(), body: JSON.stringify(patch),
    });
    const data = await res.json();
    if (data.ok) load(); else setError(data.error ?? '更新に失敗しました');
  }

  async function removeLead(id: string) {
    if (!confirm('この案件を削除しますか？')) return;
    const res = await fetch(`/api/admin/client-leads/${id}`, { method: 'DELETE', headers: authHeaders() });
    const data = await res.json();
    if (data.ok) load(); else setError(data.error ?? '削除に失敗しました');
  }

  // AIで証拠パックの下書きを生成する（ここでは保存しない。会長が確認してから「反映」で初めてmemoに入る）
  async function runEnrich(id: string) {
    const sourceText = (enrichSource[id] ?? '').trim();
    if (!sourceText) return;
    setEnrichLoading(prev => ({ ...prev, [id]: true }));
    setEnrichError(prev => ({ ...prev, [id]: '' }));
    try {
      const res = await fetch(`/api/admin/client-leads/${id}/enrich`, {
        method: 'POST', headers: authHeaders(), body: JSON.stringify({ source_text: sourceText }),
      });
      const data = await res.json();
      if (data.ok) setEnrichDraft(prev => ({ ...prev, [id]: data.draft }));
      else setEnrichError(prev => ({ ...prev, [id]: data.error ?? '生成に失敗しました' }));
    } catch {
      setEnrichError(prev => ({ ...prev, [id]: '通信エラー' }));
    } finally {
      setEnrichLoading(prev => ({ ...prev, [id]: false }));
    }
  }

  // 生成された下書きを、既存メモの下に追記する形でmemoに反映する（会長が明示的に押した時だけ保存される）
  function applyEnrichDraft(id: string, existingMemo: string | null) {
    const draft = enrichDraft[id];
    if (!draft) return;
    const merged = existingMemo?.trim() ? `${existingMemo.trim()}\n\n---\n${draft}` : draft;
    setEditingMemo(prev => ({ ...prev, [id]: merged }));
    updateLead(id, { memo: merged });
    setEnrichDraft(prev => { const next = { ...prev }; delete next[id]; return next; });
    setEnrichOpen(prev => ({ ...prev, [id]: false }));
  }

  // 提案書ドラフトを生成する（証拠パック=memoが元になる）。保存はせず、ダウンロードして会長が06_実行待機_Approvalに置く運用
  async function runDraftProposal(id: string) {
    setProposalLoading(prev => ({ ...prev, [id]: true }));
    setProposalError(prev => ({ ...prev, [id]: '' }));
    try {
      const res = await fetch(`/api/admin/client-leads/${id}/draft-proposal`, {
        method: 'POST', headers: authHeaders(), body: JSON.stringify({}),
      });
      const data = await res.json();
      if (data.ok) setProposalDraft(prev => ({ ...prev, [id]: data.draft }));
      else setProposalError(prev => ({ ...prev, [id]: data.error ?? '生成に失敗しました' }));
    } catch {
      setProposalError(prev => ({ ...prev, [id]: '通信エラー' }));
    } finally {
      setProposalLoading(prev => ({ ...prev, [id]: false }));
    }
  }

  function downloadProposal(id: string, orgName: string) {
    const draft = proposalDraft[id];
    if (!draft) return;
    const blob = new Blob([draft], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    a.href = url;
    a.download = `提案書ドラフト_${orgName}_${stamp}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const visibleLeads = leads
    .filter(l => filter === 'all' || l.client_type === filter)
    .sort((a, b) => (hotSort ? scoreLead(b).score - scoreLead(a).score : 0));
  const counts = {
    all: leads.length,
    school: leads.filter(l => l.client_type === 'school').length,
    business: leads.filter(l => l.client_type === 'business').length,
    hot: leads.filter(l => scoreLead(l).score >= 45).length,
  };

  return (
    <div>
      <p style={{ margin: '0 0 12px', fontSize: 12, color: '#999' }}>
        学校・法人からの問い合わせや契約状況をまとめる「縁のデータベース」です。<a href="/company/school" target="_blank" rel="noopener noreferrer" style={{ color: '#38ADA9' }}>学校向けページ ↗</a>
        {' '}・<a href="/company/business" target="_blank" rel="noopener noreferrer" style={{ color: '#38ADA9' }}> 法人向けページ ↗</a>
      </p>

      {(includeDemo || demoHiddenCount > 0) && (
        <label style={{
          display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 10, padding: '5px 12px',
          borderRadius: 16, fontSize: 11, fontWeight: 700, cursor: 'pointer',
          background: includeDemo ? '#E5A13918' : '#f4f4f4', color: includeDemo ? '#B7791F' : '#999',
        }}>
          <input type="checkbox" checked={includeDemo} onChange={e => setIncludeDemo(e.target.checked)} />
          🎭 商談デモ用データ{includeDemo ? 'を表示中' : `（${demoHiddenCount}件）を隠しています`}
        </label>
      )}

      <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
        {([['all', `すべて（${counts.all}）`], ['school', `🏫 学校（${counts.school}）`], ['business', `🏢 法人（${counts.business}）`]] as [typeof filter, string][]).map(([id, label]) => (
          <button key={id} onClick={() => setFilter(id)} style={{
            padding: '7px 14px', borderRadius: 16, border: 'none', cursor: 'pointer',
            background: filter === id ? '#38ADA9' : '#fff',
            color: filter === id ? '#fff' : '#666', fontWeight: 700, fontSize: 12,
            boxShadow: filter === id ? 'none' : '0 1px 3px rgba(0,0,0,0.08)',
          }}>{label}</button>
        ))}
        <button onClick={() => setHotSort(v => !v)} title="証拠パック(メモ)のキーワード・連絡先有無・進行状況からルールベースで当たる順を推定します" style={{
          padding: '7px 14px', borderRadius: 16, border: 'none', cursor: 'pointer',
          background: hotSort ? '#E5A139' : '#fff',
          color: hotSort ? '#fff' : '#666', fontWeight: 700, fontSize: 12,
          boxShadow: hotSort ? 'none' : '0 1px 3px rgba(0,0,0,0.08)',
        }}>🔥 熱い順（{counts.hot}件）</button>
      </div>

      {showCreate ? (
        <Card style={{ marginBottom: 14 }}>
          <form onSubmit={createLead} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <select value={form.client_type} onChange={e => setForm(f => ({ ...f, client_type: e.target.value }))} style={inputStyle}>
              <option value="business">🏢 法人</option>
              <option value="school">🏫 学校</option>
            </select>
            <input placeholder="団体名 *" value={form.org_name} onChange={e => setForm(f => ({ ...f, org_name: e.target.value }))} style={inputStyle} required />
            <input placeholder="担当者名" value={form.contact_name} onChange={e => setForm(f => ({ ...f, contact_name: e.target.value }))} style={inputStyle} />
            <input placeholder="メールアドレス" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} style={inputStyle} />
            <input placeholder="電話番号" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} style={inputStyle} />
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="submit" disabled={saving} style={{
                flex: 1, padding: '9px 0', borderRadius: 8, border: 'none',
                background: '#38ADA9', color: '#fff', fontWeight: 700, cursor: 'pointer',
              }}>{saving ? '作成中…' : '追加する'}</button>
              <button type="button" onClick={() => setShowCreate(false)} style={{
                flex: 1, padding: '9px 0', borderRadius: 8, border: '1px solid #ddd',
                background: '#fff', color: '#888', cursor: 'pointer',
              }}>キャンセル</button>
            </div>
          </form>
        </Card>
      ) : (
        <button onClick={() => setShowCreate(true)} style={{
          display: 'block', width: '100%', padding: '10px 0', borderRadius: 10, border: '1.5px dashed #38ADA9',
          background: '#fff', color: '#38ADA9', fontWeight: 700, fontSize: 13, cursor: 'pointer', marginBottom: 14,
        }}>＋ 学校・法人の案件を追加</button>
      )}

      {error && <p style={{ color: '#E74C3C', fontSize: 13 }}>{error}</p>}
      {loading ? <p style={{ color: '#999' }}>読み込み中…</p> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {visibleLeads.length === 0 && <p style={{ color: '#aaa' }}>まだ案件がありません。</p>}
          {visibleLeads.map(l => {
            const statusInfo = LEAD_STATUS_LABELS[l.status] ?? LEAD_STATUS_LABELS.lead;
            const temperature = scoreLead(l);
            return (
              <Card key={l.id}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                  <div>
                    <p style={{ margin: '0 0 4px', fontWeight: 800, fontSize: 15 }}>
                      {l.client_type === 'school' ? '🏫' : '🏢'} {l.org_name}
                      <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 700, color: statusInfo.color }}>{statusInfo.label}</span>
                      <span title={temperature.reasons.join('・') || '加点要素なし'} style={{ marginLeft: 8, fontSize: 11, fontWeight: 700, color: '#B7791F' }}>
                        {temperature.temp}（{temperature.score}点）
                      </span>
                    </p>
                    <p style={{ margin: 0, fontSize: 12, color: '#999' }}>
                      {l.contact_name && `👤 ${l.contact_name}`}
                      {l.email && ` ・ ✉ ${l.email}`}
                      {l.phone && ` ・ 📞 ${l.phone}`}
                      {!l.contact_name && !l.email && !l.phone && '連絡先未登録'}
                    </p>
                  </div>
                  <button onClick={() => removeLead(l.id)} style={{
                    padding: '4px 8px', borderRadius: 8, border: 'none', background: 'none', color: '#ccc', fontSize: 12, cursor: 'pointer',
                  }}>削除</button>
                </div>

                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', margin: '8px 0' }}>
                  {Object.entries(LEAD_STATUS_LABELS).map(([key, info]) => (
                    <button key={key} onClick={() => updateLead(l.id, { status: key })} style={{
                      padding: '4px 10px', borderRadius: 16, fontSize: 11, cursor: 'pointer',
                      border: `1.5px solid ${l.status === key ? info.color : '#ddd'}`,
                      background: l.status === key ? info.color + '18' : '#fff',
                      color: l.status === key ? info.color : '#999', fontWeight: l.status === key ? 700 : 400,
                    }}>{info.label}</button>
                  ))}
                </div>

                <textarea
                  value={editingMemo[l.id] ?? ''}
                  onChange={e => setEditingMemo(prev => ({ ...prev, [l.id]: e.target.value }))}
                  onBlur={() => { if ((editingMemo[l.id] ?? '') !== (l.memo ?? '')) updateLead(l.id, { memo: editingMemo[l.id] || null }); }}
                  placeholder="商談メモ・要望・次のアクションなど自由に"
                  rows={3}
                  style={{ ...inputStyle, width: '100%', boxSizing: 'border-box', resize: 'vertical', fontFamily: 'inherit' }}
                />
                <p style={{ margin: '4px 0 0', fontSize: 10, color: '#ccc' }}>
                  最終更新: {new Date(l.updated_at).toLocaleString('ja-JP')}（欄外をタップすると自動保存されます）
                </p>

                <button type="button" onClick={() => setEnrichOpen(prev => ({ ...prev, [l.id]: !prev[l.id] }))} style={{
                  marginTop: 8, padding: '6px 12px', borderRadius: 16, fontSize: 11, fontWeight: 700, cursor: 'pointer',
                  border: '1.5px solid #8E44AD', background: enrichOpen[l.id] ? '#8E44AD' : '#FBF6FF',
                  color: enrichOpen[l.id] ? '#fff' : '#8E44AD',
                }}>🔎 AIで証拠パックを強化</button>

                {enrichOpen[l.id] && (
                  <div style={{ marginTop: 8, padding: 10, borderRadius: 10, background: '#FBF6FF', border: '1px solid #F3EAFB' }}>
                    <p style={{ margin: '0 0 6px', fontSize: 11, color: '#8E44AD' }}>
                      ニュース記事・IR情報・自治体の総合戦略資料など、参考になる文章を貼り付けてください（URLではなく本文を貼ると精度が上がります）。生成されるだけで、まだ保存はされません。
                    </p>
                    <textarea
                      value={enrichSource[l.id] ?? ''}
                      onChange={e => setEnrichSource(prev => ({ ...prev, [l.id]: e.target.value }))}
                      placeholder="参考情報を貼り付け"
                      rows={4}
                      style={{ ...inputStyle, width: '100%', boxSizing: 'border-box', resize: 'vertical', fontFamily: 'inherit', marginBottom: 6 }}
                    />
                    <button type="button" onClick={() => runEnrich(l.id)} disabled={enrichLoading[l.id] || !(enrichSource[l.id] ?? '').trim()} style={{
                      padding: '7px 14px', borderRadius: 8, border: 'none', fontSize: 12, fontWeight: 700,
                      background: enrichLoading[l.id] ? '#ddd' : '#8E44AD', color: '#fff',
                      cursor: enrichLoading[l.id] ? 'wait' : 'pointer',
                    }}>{enrichLoading[l.id] ? '生成中…' : '生成する（Claude Haiku使用）'}</button>

                    {enrichError[l.id] && <p style={{ margin: '6px 0 0', fontSize: 11, color: '#E55039' }}>{enrichError[l.id]}</p>}

                    {enrichDraft[l.id] && (
                      <div style={{ marginTop: 8 }}>
                        <p style={{ margin: '0 0 4px', fontSize: 11, fontWeight: 700, color: '#8E44AD' }}>生成された下書き（確認してから反映してください）</p>
                        <p style={{ margin: '0 0 6px', fontSize: 13, color: '#333', background: '#fff', padding: 8, borderRadius: 8, whiteSpace: 'pre-wrap' }}>
                          {enrichDraft[l.id]}
                        </p>
                        <button type="button" onClick={() => applyEnrichDraft(l.id, l.memo)} style={{
                          padding: '6px 12px', borderRadius: 8, border: 'none', fontSize: 12, fontWeight: 700,
                          background: '#38ADA9', color: '#fff', cursor: 'pointer',
                        }}>この内容を証拠パックに反映する</button>
                      </div>
                    )}
                  </div>
                )}

                <button type="button" onClick={() => runDraftProposal(l.id)} disabled={proposalLoading[l.id] || !l.memo?.trim()} title={!l.memo?.trim() ? '先に証拠パック（メモ）を作ってください' : undefined} style={{
                  marginTop: 8, marginLeft: 8, padding: '6px 12px', borderRadius: 16, fontSize: 11, fontWeight: 700,
                  border: '1.5px solid #38ADA9', background: proposalLoading[l.id] ? '#ddd' : '#E8F8F7',
                  color: proposalLoading[l.id] ? '#888' : '#38ADA9',
                  cursor: (proposalLoading[l.id] || !l.memo?.trim()) ? 'default' : 'pointer',
                  opacity: !l.memo?.trim() ? 0.5 : 1,
                }}>{proposalLoading[l.id] ? '生成中…' : '📄 提案書ドラフトを生成（Claude Sonnet使用）'}</button>

                {proposalError[l.id] && <p style={{ margin: '6px 0 0', fontSize: 11, color: '#E55039' }}>{proposalError[l.id]}</p>}

                {proposalDraft[l.id] && (
                  <div style={{ marginTop: 8, padding: 10, borderRadius: 10, background: '#E8F8F7', border: '1px solid #D5F0EE' }}>
                    <p style={{ margin: '0 0 6px', fontSize: 11, fontWeight: 700, color: '#38ADA9' }}>
                      生成された提案書ドラフト（会長が確認・編集してから使ってください。外部送信前は必ず06_実行待機_Approvalで保管）
                    </p>
                    <pre style={{
                      margin: '0 0 6px', fontSize: 12, color: '#333', background: '#fff', padding: 10, borderRadius: 8,
                      whiteSpace: 'pre-wrap', maxHeight: 320, overflowY: 'auto', fontFamily: 'inherit',
                    }}>{proposalDraft[l.id]}</pre>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button type="button" onClick={() => downloadProposal(l.id, l.org_name)} style={{
                        padding: '6px 12px', borderRadius: 8, border: 'none', fontSize: 12, fontWeight: 700,
                        background: '#38ADA9', color: '#fff', cursor: 'pointer',
                      }}>⬇ ダウンロード（.md）</button>
                      <button type="button" onClick={() => setProposalDraft(prev => { const next = { ...prev }; delete next[l.id]; return next; })} style={{
                        padding: '6px 12px', borderRadius: 8, border: '1px solid #ddd', fontSize: 12,
                        background: '#fff', color: '#888', cursor: 'pointer',
                      }}>閉じる</button>
                    </div>
                  </div>
                )}

                <button type="button" onClick={() => setDashOpen(prev => ({ ...prev, [l.id]: !prev[l.id] }))} style={{
                  marginTop: 8, marginLeft: 8, padding: '6px 12px', borderRadius: 16, fontSize: 11, fontWeight: 700, cursor: 'pointer',
                  border: '1.5px solid #4A69BD', background: dashOpen[l.id] ? '#4A69BD' : '#EEF1FB',
                  color: dashOpen[l.id] ? '#fff' : '#4A69BD',
                }}>🗺 集計ダッシュボードURLを発行</button>

                {dashOpen[l.id] && (
                  <div style={{ marginTop: 8, padding: 10, borderRadius: 10, background: '#EEF1FB', border: '1px solid #DCE3F5' }}>
                    <p style={{ margin: '0 0 8px', fontSize: 11, color: '#4A69BD', lineHeight: 1.7 }}>
                      Supabaseアカウント不要のトークン付きURLを発行します。既定では地域名（regionカラムと完全一致）で集計しますが、
                      地図範囲（緯度経度）を指定するとそちらを優先し、region表記のばらつきに左右されず対象エリアを絞り込めます。
                    </p>

                    {/* 市区町村を検索して選ぶと、地図範囲(bbox)と境界ポリゴンが自動で入る */}
                    <input
                      placeholder="🔍 市区町村名で検索（例：佐野市）"
                      value={dashFormFor(l.id).municipalityQuery}
                      onChange={e => setDashForm(prev => ({ ...prev, [l.id]: { ...dashFormFor(l.id), municipalityQuery: e.target.value } }))}
                      style={{ ...inputStyle, width: '100%', boxSizing: 'border-box', marginBottom: 4 }}
                    />
                    {dashFormFor(l.id).municipalityQuery.trim().length > 0 && !dashFormFor(l.id).boundaryGeoJson && (
                      <div style={{ maxHeight: 160, overflowY: 'auto', border: '1px solid #DCE3F5', borderRadius: 8, marginBottom: 6, background: '#fff' }}>
                        {municipalities
                          .filter(m => m.name.includes(dashFormFor(l.id).municipalityQuery.trim()))
                          .slice(0, 20)
                          .map(m => (
                            <button
                              key={m.code} type="button"
                              onClick={() => selectMunicipality(l.id, m.code, m.name)}
                              disabled={municipalityLoading[l.id]}
                              style={{
                                display: 'block', width: '100%', textAlign: 'left', padding: '6px 10px',
                                border: 'none', borderBottom: '1px solid #f0f0f0', background: 'none',
                                fontSize: 12, color: '#333', cursor: 'pointer',
                              }}
                            >{m.pref} {m.name}</button>
                          ))}
                        {municipalities.filter(m => m.name.includes(dashFormFor(l.id).municipalityQuery.trim())).length === 0 && (
                          <p style={{ margin: 0, padding: '6px 10px', fontSize: 11, color: '#999' }}>該当する市区町村がありません</p>
                        )}
                      </div>
                    )}
                    {Boolean(dashFormFor(l.id).boundaryGeoJson) && (
                      <p style={{ margin: '0 0 6px', fontSize: 11, color: '#27AE60', display: 'flex', alignItems: 'center', gap: 6 }}>
                        ✓ {dashFormFor(l.id).region} の境界データを設定しました（地図はこの範囲でマスクされます）
                        <button type="button" onClick={() => setDashForm(prev => ({ ...prev, [l.id]: { ...dashFormFor(l.id), boundaryGeoJson: null, municipalityQuery: '' } }))} style={{
                          border: 'none', background: 'none', color: '#999', fontSize: 11, cursor: 'pointer', textDecoration: 'underline',
                        }}>解除</button>
                      </p>
                    )}
                    {municipalityLoading[l.id] && <p style={{ margin: '0 0 6px', fontSize: 11, color: '#999' }}>境界データを取得中…</p>}

                    <input
                      placeholder="対象の地域名 *（例：大阪府浪速区）"
                      value={dashFormFor(l.id).region}
                      onChange={e => setDashForm(prev => ({ ...prev, [l.id]: { ...dashFormFor(l.id), region: e.target.value } }))}
                      style={{ ...inputStyle, width: '100%', boxSizing: 'border-box', marginBottom: 6 }}
                    />
                    <input
                      placeholder="表示名（任意・例：〇〇市役所様）"
                      value={dashFormFor(l.id).label}
                      onChange={e => setDashForm(prev => ({ ...prev, [l.id]: { ...dashFormFor(l.id), label: e.target.value } }))}
                      style={{ ...inputStyle, width: '100%', boxSizing: 'border-box', marginBottom: 6 }}
                    />
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#4A69BD', marginBottom: 6, cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={dashFormFor(l.id).useBbox}
                        onChange={e => setDashForm(prev => ({ ...prev, [l.id]: { ...dashFormFor(l.id), useBbox: e.target.checked } }))}
                      />
                      地図範囲（緯度経度）で絞り込む
                    </label>
                    {dashFormFor(l.id).useBbox && (
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 6 }}>
                        {([
                          ['maxLat', '北端の緯度'], ['minLat', '南端の緯度'],
                          ['minLng', '西端の経度'], ['maxLng', '東端の経度'],
                        ] as const).map(([key, label]) => (
                          <input
                            key={key}
                            placeholder={label}
                            inputMode="decimal"
                            value={dashFormFor(l.id)[key]}
                            onChange={e => setDashForm(prev => ({ ...prev, [l.id]: { ...dashFormFor(l.id), [key]: e.target.value } }))}
                            style={{ ...inputStyle, boxSizing: 'border-box' }}
                          />
                        ))}
                      </div>
                    )}
                    <button type="button" onClick={() => issueDashboardToken(l.id)} disabled={dashLoading[l.id]} style={{
                      padding: '7px 14px', borderRadius: 8, border: 'none', fontSize: 12, fontWeight: 700,
                      background: dashLoading[l.id] ? '#ddd' : '#4A69BD', color: '#fff',
                      cursor: dashLoading[l.id] ? 'wait' : 'pointer',
                    }}>{dashLoading[l.id] ? '発行中…' : 'URLを発行する'}</button>

                    {dashError[l.id] && <p style={{ margin: '6px 0 0', fontSize: 11, color: '#E55039' }}>{dashError[l.id]}</p>}

                    {dashResult[l.id] && (
                      <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <code style={{ fontSize: 11, background: '#fff', padding: '6px 8px', borderRadius: 6, wordBreak: 'break-all' }}>{dashResult[l.id]}</code>
                        <button type="button" onClick={() => navigator.clipboard.writeText(dashResult[l.id])} style={{
                          padding: '5px 10px', borderRadius: 8, border: '1px solid #4A69BD', fontSize: 11, fontWeight: 700,
                          background: '#fff', color: '#4A69BD', cursor: 'pointer',
                        }}>コピー</button>
                      </div>
                    )}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
