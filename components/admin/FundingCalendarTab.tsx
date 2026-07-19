'use client';

// 🏆 コンテスト・助成金カレンダー — 自治体のスタートアップ支援・補助金・
// ビジネスモデルコンテスト・資金調達/ピッチイベントのエントリー締切を横断管理する。
// biz_model_ideas（応募案の中身）とは別レイヤー：ここは「そもそも何に応募できるか」を
// 発見・追跡する台帳。応募を決めたら biz_model_ideas 側に contest キーで案を書く運用。
import { useCallback, useEffect, useMemo, useState } from 'react';

type OppType = 'municipal_support' | 'subsidy' | 'contest' | 'funding_event';
type OppStatus = 'watching' | 'preparing' | 'submitted' | 'won' | 'rejected' | 'passed';

interface Opportunity {
  id: string;
  title: string;
  organizer: string | null;
  opp_type: OppType;
  region: string | null;
  deadline: string | null;
  deadline_note: string | null;
  announcement_date: string | null;
  prize_amount: string | null;
  url: string | null;
  status: OppStatus;
  memo: string | null;
  source: string | null;
  created_at: string;
  updated_at: string;
}

const OPP_TYPE_META: Record<OppType, { label: string; icon: string; color: string }> = {
  municipal_support: { label: '自治体支援', icon: '🏛', color: '#4A69BD' },
  subsidy: { label: '補助金・助成金', icon: '💴', color: '#27AE60' },
  contest: { label: 'ビジコン', icon: '🏆', color: '#8E44AD' },
  funding_event: { label: '資金調達・ピッチ', icon: '🚀', color: '#E5A139' },
};
const OPP_TYPES = Object.keys(OPP_TYPE_META) as OppType[];

const STATUS_META: Record<OppStatus, { label: string; color: string }> = {
  watching: { label: '様子見', color: '#999' },
  preparing: { label: '準備中', color: '#4A90E2' },
  submitted: { label: '提出済み', color: '#E5A139' },
  won: { label: '採択・受賞', color: '#27AE60' },
  rejected: { label: '落選', color: '#E55039' },
  passed: { label: '見送り', color: '#ccc' },
};
const STATUS_LIST = Object.keys(STATUS_META) as OppStatus[];

const cardStyle: React.CSSProperties = { background: '#fff', borderRadius: 12, padding: 16, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' };
const sectionTitleStyle: React.CSSProperties = { fontSize: 14, fontWeight: 800, color: '#444', margin: '22px 0 10px' };
const inputStyle: React.CSSProperties = {
  padding: '8px 11px', borderRadius: 8, border: '1.5px solid #ddd',
  fontSize: 13, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box',
};
const labelStyle: React.CSSProperties = { fontSize: 11, fontWeight: 700, color: '#777', margin: '8px 0 3px', display: 'block' };
const btnStyle: React.CSSProperties = { padding: '8px 16px', borderRadius: 8, border: 'none', background: '#38ADA9', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer' };

function daysUntil(dateStr: string): number {
  return Math.ceil((new Date(dateStr + 'T00:00:00').getTime() - Date.now()) / 86400000);
}
function urgencyOf(days: number): { label: string; color: string; bg: string } {
  if (days < 0) return { label: '締切超過', color: '#999', bg: '#f4f4f4' };
  if (days === 0) return { label: '本日締切', color: '#fff', bg: '#E55039' };
  if (days <= 3) return { label: `残り${days}日`, color: '#fff', bg: '#E55039' };
  if (days <= 14) return { label: `残り${days}日`, color: '#B7791F', bg: '#FFF3DC' };
  if (days <= 30) return { label: `残り${days}日`, color: '#4A69BD', bg: '#EEF1FB' };
  return { label: `残り${days}日`, color: '#27AE60', bg: '#EAF7EE' };
}

const emptyForm = {
  title: '', organizer: '', opp_type: 'contest' as OppType, region: '',
  deadline: '', deadline_note: '', announcement_date: '', prize_amount: '', url: '', memo: '', source: '',
};

export default function FundingCalendarTab({ authHeaders }: { authHeaders: () => HeadersInit }) {
  const [items, setItems] = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [needsMigration, setNeedsMigration] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const [typeFilter, setTypeFilter] = useState<OppType | 'all'>('all');
  const [showClosed, setShowClosed] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/admin/funding-opportunities', { headers: authHeaders() });
      const data = await res.json();
      if (data.ok) {
        setItems(data.opportunities ?? []);
        setNeedsMigration(Boolean(data.needsMigration));
      } else {
        setError(data.error ?? '取得に失敗しました');
      }
    } catch {
      setError('通信エラー');
    } finally {
      setLoading(false);
    }
  }, [authHeaders]);

  useEffect(() => { load(); }, [load]);

  function jsonHeaders(): HeadersInit {
    return { ...authHeaders(), 'Content-Type': 'application/json' };
  }

  async function create() {
    if (!form.title.trim()) { setError('タイトルを入力してください'); return; }
    setSaving(true);
    try {
      const res = await fetch('/api/admin/funding-opportunities', {
        method: 'POST', headers: jsonHeaders(),
        body: JSON.stringify({
          ...form,
          deadline: form.deadline || null,
          announcement_date: form.announcement_date || null,
        }),
      });
      const data = await res.json();
      if (data.ok) { setForm(emptyForm); setShowForm(false); await load(); }
      else setError(data.error ?? '保存に失敗しました');
    } finally {
      setSaving(false);
    }
  }

  async function patch(id: string, fields: Partial<Opportunity>) {
    await fetch(`/api/admin/funding-opportunities/${id}`, { method: 'PATCH', headers: jsonHeaders(), body: JSON.stringify(fields) });
    await load();
  }
  async function remove(id: string) {
    if (!window.confirm('この案件を削除しますか？')) return;
    await fetch(`/api/admin/funding-opportunities/${id}`, { method: 'DELETE', headers: authHeaders() });
    await load();
  }

  // ---------- 分類・集計 ----------
  const withDeadline = items.filter(i => i.deadline);
  const withoutDeadline = items.filter(i => !i.deadline);
  const activeStatuses = new Set<OppStatus>(['watching', 'preparing', 'submitted']);

  const upcoming = withDeadline
    .filter(i => activeStatuses.has(i.status) && daysUntil(i.deadline!) >= 0)
    .filter(i => typeFilter === 'all' || i.opp_type === typeFilter)
    .sort((a, b) => new Date(a.deadline!).getTime() - new Date(b.deadline!).getTime());

  const closedOrDone = items
    .filter(i => !activeStatuses.has(i.status) || (i.deadline && daysUntil(i.deadline) < 0))
    .filter(i => typeFilter === 'all' || i.opp_type === typeFilter);

  const noDeadline = withoutDeadline.filter(i => activeStatuses.has(i.status) && (typeFilter === 'all' || i.opp_type === typeFilter));

  const urgentCount = upcoming.filter(i => daysUntil(i.deadline!) <= 14).length;
  const typeCounts = useMemo(() => {
    const counts: Record<OppType, number> = { municipal_support: 0, subsidy: 0, contest: 0, funding_event: 0 };
    for (const i of items) if (activeStatuses.has(i.status)) counts[i.opp_type]++;
    return counts;
  }, [items]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) return <p style={{ fontSize: 13, color: '#999' }}>締切台帳を読み込み中…</p>;

  return (
    <div>
      <p style={{ fontSize: 12, color: '#999', margin: '0 0 12px' }}>
        自治体のスタートアップ支援・補助金・ビジネスモデルコンテスト・資金調達/ピッチイベントの締切を一覧管理します。
        「応募する」と決めたら、具体的な案の中身は「ビジネスモデル案」タブへ（contestキーで紐付け）。
      </p>
      {error && <p style={{ color: '#E74C3C', fontSize: 13 }}>{error}</p>}
      {needsMigration && (
        <div style={{ ...cardStyle, marginBottom: 12, borderLeft: '4px solid #E5A139' }}>
          <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#B7791F' }}>⚠ 締切台帳のテーブルがまだ作成されていません</p>
          <p style={{ margin: '4px 0 0', fontSize: 12, color: '#777', lineHeight: 1.7 }}>
            <code style={{ background: '#f4f4f4', padding: '1px 5px', borderRadius: 4 }}>supabase/migrations/20260720_add_funding_opportunities.sql</code> を
            SupabaseのSQL Editorで一度実行してください。
          </p>
        </div>
      )}

      {/* KPI */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 10, marginBottom: 4 }}>
        <div style={{ ...cardStyle, padding: '12px 14px', borderTop: '3px solid #E55039' }}>
          <p style={{ margin: 0, fontSize: 11, color: '#999', fontWeight: 700 }}>締切間近（14日以内）</p>
          <p style={{ margin: '4px 0 0', fontSize: 20, fontWeight: 800, color: '#333' }}>{urgentCount}件</p>
        </div>
        {OPP_TYPES.map(t => (
          <div key={t} style={{ ...cardStyle, padding: '12px 14px', borderTop: `3px solid ${OPP_TYPE_META[t].color}` }}>
            <p style={{ margin: 0, fontSize: 11, color: '#999', fontWeight: 700 }}>{OPP_TYPE_META[t].icon} {OPP_TYPE_META[t].label}</p>
            <p style={{ margin: '4px 0 0', fontSize: 20, fontWeight: 800, color: '#333' }}>{typeCounts[t]}件</p>
          </div>
        ))}
      </div>

      {/* フィルタ・追加 */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', margin: '16px 0 14px' }}>
        <button onClick={() => setTypeFilter('all')} style={{
          padding: '6px 13px', borderRadius: 16, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700,
          background: typeFilter === 'all' ? '#38ADA9' : '#fff', color: typeFilter === 'all' ? '#fff' : '#666',
          boxShadow: typeFilter === 'all' ? 'none' : '0 1px 3px rgba(0,0,0,0.08)',
        }}>すべて（{items.length}）</button>
        {OPP_TYPES.map(t => (
          <button key={t} onClick={() => setTypeFilter(t)} style={{
            padding: '6px 13px', borderRadius: 16, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700,
            background: typeFilter === t ? OPP_TYPE_META[t].color : '#fff', color: typeFilter === t ? '#fff' : '#666',
            boxShadow: typeFilter === t ? 'none' : '0 1px 3px rgba(0,0,0,0.08)',
          }}>{OPP_TYPE_META[t].icon} {OPP_TYPE_META[t].label}</button>
        ))}
        <button onClick={() => setShowForm(v => !v)} style={{ ...btnStyle, marginLeft: 'auto' }}>{showForm ? 'キャンセル' : '＋ 案件を追加'}</button>
      </div>

      {showForm && (
        <div style={{ ...cardStyle, marginBottom: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
            <div>
              <label style={labelStyle}>タイトル *</label>
              <input style={inputStyle} value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="例：〇〇市スタートアップ支援事業" />
            </div>
            <div>
              <label style={labelStyle}>主催者</label>
              <input style={inputStyle} value={form.organizer} onChange={e => setForm(f => ({ ...f, organizer: e.target.value }))} placeholder="例：〇〇市 産業振興課" />
            </div>
            <div>
              <label style={labelStyle}>種別</label>
              <select style={inputStyle} value={form.opp_type} onChange={e => setForm(f => ({ ...f, opp_type: e.target.value as OppType }))}>
                {OPP_TYPES.map(t => <option key={t} value={t}>{OPP_TYPE_META[t].icon} {OPP_TYPE_META[t].label}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>対象地域（空欄＝全国）</label>
              <input style={inputStyle} value={form.region} onChange={e => setForm(f => ({ ...f, region: e.target.value }))} placeholder="例：神奈川県横浜市" />
            </div>
            <div>
              <label style={labelStyle}>エントリー締切</label>
              <input type="date" style={inputStyle} value={form.deadline} onChange={e => setForm(f => ({ ...f, deadline: e.target.value }))} />
            </div>
            <div>
              <label style={labelStyle}>締切が不明な場合の補足</label>
              <input style={inputStyle} value={form.deadline_note} onChange={e => setForm(f => ({ ...f, deadline_note: e.target.value }))} placeholder="例：随時受付・要確認" />
            </div>
            <div>
              <label style={labelStyle}>結果発表予定日</label>
              <input type="date" style={inputStyle} value={form.announcement_date} onChange={e => setForm(f => ({ ...f, announcement_date: e.target.value }))} />
            </div>
            <div>
              <label style={labelStyle}>賞金・助成額・調達額</label>
              <input style={inputStyle} value={form.prize_amount} onChange={e => setForm(f => ({ ...f, prize_amount: e.target.value }))} placeholder="例：最大100万円" />
            </div>
            <div>
              <label style={labelStyle}>参照URL</label>
              <input style={inputStyle} value={form.url} onChange={e => setForm(f => ({ ...f, url: e.target.value }))} placeholder="https://..." />
            </div>
            <div>
              <label style={labelStyle}>見つけた経路</label>
              <input style={inputStyle} value={form.source} onChange={e => setForm(f => ({ ...f, source: e.target.value }))} placeholder="例：Web検索・紹介" />
            </div>
          </div>
          <label style={labelStyle}>メモ</label>
          <textarea style={{ ...inputStyle, width: '100%', resize: 'vertical' }} rows={2} value={form.memo} onChange={e => setForm(f => ({ ...f, memo: e.target.value }))} placeholder="応募要件・注意点など" />
          <div style={{ marginTop: 12 }}>
            <button onClick={create} disabled={saving} style={btnStyle}>{saving ? '保存中…' : '保存する'}</button>
          </div>
        </div>
      )}

      {/* 締切が近い順の一覧 */}
      <h2 style={sectionTitleStyle}>📅 締切が近い順（{upcoming.length}件）</h2>
      {upcoming.length === 0 ? (
        <div style={cardStyle}><p style={{ margin: 0, fontSize: 13, color: '#999' }}>該当する案件がありません。</p></div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {upcoming.map(o => (
            <OppCard key={o.id} o={o} onPatch={patch} onRemove={remove} />
          ))}
        </div>
      )}

      {noDeadline.length > 0 && (
        <>
          <h2 style={sectionTitleStyle}>❓ 締切不明・随時受付（{noDeadline.length}件）</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {noDeadline.map(o => <OppCard key={o.id} o={o} onPatch={patch} onRemove={remove} />)}
          </div>
        </>
      )}

      {/* 締切超過・対応済み */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '22px 0 10px' }}>
        <h2 style={{ ...sectionTitleStyle, margin: 0 }}>🗂 締切超過・対応済み（{closedOrDone.length}件）</h2>
        <button onClick={() => setShowClosed(v => !v)} style={{
          padding: '4px 10px', borderRadius: 14, border: '1px solid #ccc', background: '#fff',
          color: '#888', fontSize: 11, fontWeight: 700, cursor: 'pointer',
        }}>{showClosed ? '折りたたむ' : '表示する'}</button>
      </div>
      {showClosed && (
        closedOrDone.length === 0 ? (
          <div style={cardStyle}><p style={{ margin: 0, fontSize: 13, color: '#999' }}>ありません。</p></div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {closedOrDone.map(o => <OppCard key={o.id} o={o} onPatch={patch} onRemove={remove} muted />)}
          </div>
        )
      )}
    </div>
  );
}

function OppCard({ o, onPatch, onRemove, muted }: {
  o: Opportunity;
  onPatch: (id: string, fields: Partial<Opportunity>) => void;
  onRemove: (id: string) => void;
  muted?: boolean;
}) {
  const typeMeta = OPP_TYPE_META[o.opp_type];
  const statusMeta = STATUS_META[o.status];
  const urgency = o.deadline ? urgencyOf(daysUntil(o.deadline)) : null;

  return (
    <div style={{ ...cardStyle, opacity: muted ? 0.65 : 1 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 200 }}>
          <p style={{ margin: 0, fontSize: 14, fontWeight: 800, color: '#333' }}>
            {typeMeta.icon} {o.title}
            {o.url && (
              <a href={o.url} target="_blank" rel="noopener noreferrer" style={{ marginLeft: 6, fontSize: 11, color: '#38ADA9' }}>↗</a>
            )}
          </p>
          <p style={{ margin: '3px 0 0', fontSize: 11, color: '#999' }}>
            {o.organizer && `${o.organizer}`}{o.region && ` ・ 📍${o.region}`}{!o.region && ' ・ 📍全国'}
            {o.prize_amount && ` ・ 💴${o.prize_amount}`}
          </p>
        </div>
        {urgency && (
          <span style={{ padding: '3px 10px', borderRadius: 12, fontSize: 11, fontWeight: 800, background: urgency.bg, color: urgency.color, flexShrink: 0 }}>
            {urgency.label}
          </span>
        )}
        <button onClick={() => onRemove(o.id)} style={{ border: 'none', background: 'none', color: '#ccc', fontSize: 12, cursor: 'pointer', flexShrink: 0 }}>削除</button>
      </div>

      <p style={{ margin: '6px 0 0', fontSize: 11, color: '#777' }}>
        {o.deadline ? `締切：${o.deadline}` : o.deadline_note ? `締切：${o.deadline_note}` : '締切：未設定'}
        {o.announcement_date && ` ・ 発表予定：${o.announcement_date}`}
      </p>

      {o.memo && <p style={{ margin: '6px 0 0', fontSize: 12, color: '#555', whiteSpace: 'pre-wrap' }}>{o.memo}</p>}

      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: 10 }}>
        {STATUS_LIST.map(s => (
          <button key={s} onClick={() => onPatch(o.id, { status: s })} style={{
            padding: '3px 9px', borderRadius: 14, fontSize: 10, cursor: 'pointer',
            border: `1.5px solid ${o.status === s ? STATUS_META[s].color : '#ddd'}`,
            background: o.status === s ? STATUS_META[s].color + '18' : '#fff',
            color: o.status === s ? STATUS_META[s].color : '#999', fontWeight: o.status === s ? 700 : 400,
          }}>{STATUS_META[s].label}</button>
        ))}
        <span style={{ marginLeft: 'auto', fontSize: 10, color: '#ccc' }}>
          {o.source && `見つけた経路：${o.source}`}
        </span>
      </div>
    </div>
  );
}
