'use client';

// 営業専用ダッシュボード：学校・法人の案件（縁のデータベース）だけを扱う。
// /admin/dashboard は投稿管理・通報など運営全般が同居していて営業用途には情報過多なため、
// AIによる証拠パック強化・提案書ドラフト生成を含む「学校・法人」タブだけを切り出した専用ページ。
import { useEffect, useState, useCallback } from 'react';

const inputStyle: React.CSSProperties = {
  padding: '9px 12px', borderRadius: 8, border: '1.5px solid #ddd',
  fontSize: 13, outline: 'none', fontFamily: 'inherit',
};

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ background: '#fff', borderRadius: 12, padding: 16, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', ...style }}>
      {children}
    </div>
  );
}

interface ClientLead {
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

const LEAD_STATUS_LABELS: Record<string, { label: string; color: string }> = {
  lead: { label: '候補', color: '#999' },
  contacted: { label: '接触済み', color: '#4A90E2' },
  negotiating: { label: '商談中', color: '#E5A139' },
  contracted: { label: '契約中', color: '#27AE60' },
  lost: { label: '見送り', color: '#E55039' },
};

export default function SalesDashboardPage() {
  const [password, setPassword] = useState('');
  const [unlocked, setUnlocked] = useState(false);
  const [unlockError, setUnlockError] = useState('');
  const [unlocking, setUnlocking] = useState(false);

  const authHeaders = useCallback((): HeadersInit => {
    return { 'Content-Type': 'application/json', 'x-admin-password': password };
  }, [password]);

  async function tryUnlock(pw: string) {
    setUnlocking(true);
    setUnlockError('');
    try {
      const res = await fetch('/api/admin/client-leads', { headers: { 'x-admin-password': pw } });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error ?? 'パスワードが違います');
      setUnlocked(true);
    } catch (e) {
      setUnlockError(e instanceof Error ? e.message : '認証に失敗しました');
    } finally {
      setUnlocking(false);
    }
  }

  if (!unlocked) {
    return (
      <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fafafa', padding: 16, boxSizing: 'border-box' }}>
        <form
          onSubmit={e => { e.preventDefault(); tryUnlock(password); }}
          style={{ background: '#fff', padding: 24, borderRadius: 16, width: '100%', maxWidth: 320, boxSizing: 'border-box', boxShadow: '0 1px 8px rgba(0,0,0,0.06)' }}
        >
          <h1 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>🎓 営業ダッシュボード（パスワード）</h1>
          <input
            type="password" value={password} onChange={e => setPassword(e.target.value)}
            placeholder="パスワード" style={{ ...inputStyle, width: '100%', boxSizing: 'border-box', marginBottom: 10 }}
          />
          {unlockError && <p style={{ color: '#E74C3C', fontSize: 12, margin: '0 0 8px' }}>{unlockError}</p>}
          <button type="submit" disabled={unlocking} style={{
            width: '100%', padding: 10, borderRadius: 8, border: 'none',
            background: '#38ADA9', color: '#fff', fontWeight: 700, cursor: 'pointer',
          }}>{unlocking ? '確認中…' : '入る'}</button>
        </form>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100dvh', background: '#f4f6f5' }}>
      <div style={{
        position: 'sticky', top: 0, zIndex: 10, background: 'rgba(244,246,245,0.92)', backdropFilter: 'blur(6px)',
        padding: '14px 20px', borderBottom: '1px solid #e5e8e7', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
      }}>
        <h1 style={{ fontSize: 17, fontWeight: 800, margin: 0 }}>🎓 営業ダッシュボード</h1>
        <span style={{ fontSize: 12, color: '#999' }}>学校・法人の案件・証拠パック・提案書ドラフト</span>
        <a href="/admin/dashboard" style={{ marginLeft: 'auto', fontSize: 12, color: '#38ADA9', textDecoration: 'none' }}>
          🛠 運営ダッシュボード全体を見る ↗
        </a>
      </div>
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '20px 20px 60px' }}>
        <ClientLeadsSection authHeaders={authHeaders} />
      </div>
    </div>
  );
}

// ── 学校・法人の案件（縁のデータベース） ──────
function ClientLeadsSection({ authHeaders }: { authHeaders: () => HeadersInit }) {
  const [filter, setFilter] = useState<'all' | 'school' | 'business'>('all');
  const [leads, setLeads] = useState<ClientLead[]>([]);
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

  const load = useCallback(() => {
    setLoading(true);
    fetch('/api/admin/client-leads', { headers: authHeaders() })
      .then(r => r.json())
      .then(d => {
        if (d.ok) {
          setLeads(d.leads);
          setEditingMemo(Object.fromEntries((d.leads as ClientLead[]).map(l => [l.id, l.memo ?? ''])));
        } else setError(d.error ?? '取得に失敗しました');
      })
      .catch(() => setError('通信エラー'))
      .finally(() => setLoading(false));
  }, [authHeaders]);

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

  const visibleLeads = leads.filter(l => filter === 'all' || l.client_type === filter);
  const counts = {
    all: leads.length,
    school: leads.filter(l => l.client_type === 'school').length,
    business: leads.filter(l => l.client_type === 'business').length,
  };
  const statusCounts = Object.keys(LEAD_STATUS_LABELS).map(key => ({
    key, count: leads.filter(l => l.status === key).length,
  }));

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 10, marginBottom: 16 }}>
        {statusCounts.map(({ key, count }) => (
          <Card key={key} style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: LEAD_STATUS_LABELS[key].color }}>{count}</div>
            <div style={{ fontSize: 11, color: '#999', marginTop: 2 }}>{LEAD_STATUS_LABELS[key].label}</div>
          </Card>
        ))}
      </div>

      <p style={{ margin: '0 0 12px', fontSize: 12, color: '#999' }}>
        学校・法人からの問い合わせや契約状況をまとめる「縁のデータベース」です。<a href="/school" target="_blank" rel="noopener noreferrer" style={{ color: '#38ADA9' }}>学校向けページ ↗</a>
        {' '}・<a href="/business" target="_blank" rel="noopener noreferrer" style={{ color: '#38ADA9' }}> 法人向けページ ↗</a>
      </p>

      <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
        {([['all', `すべて（${counts.all}）`], ['school', `🏫 学校（${counts.school}）`], ['business', `🏢 法人（${counts.business}）`]] as [typeof filter, string][]).map(([id, label]) => (
          <button key={id} onClick={() => setFilter(id)} style={{
            padding: '7px 14px', borderRadius: 16, border: 'none', cursor: 'pointer',
            background: filter === id ? '#38ADA9' : '#fff',
            color: filter === id ? '#fff' : '#666', fontWeight: 700, fontSize: 12,
            boxShadow: filter === id ? 'none' : '0 1px 3px rgba(0,0,0,0.08)',
          }}>{label}</button>
        ))}
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
            return (
              <Card key={l.id}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                  <div>
                    <p style={{ margin: '0 0 4px', fontWeight: 800, fontSize: 15 }}>
                      {l.client_type === 'school' ? '🏫' : '🏢'} {l.org_name}
                      <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 700, color: statusInfo.color }}>{statusInfo.label}</span>
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
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
