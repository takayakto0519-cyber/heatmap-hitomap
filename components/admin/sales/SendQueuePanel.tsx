'use client';

// 📤 送信キュー — 下書き・宛先確定まで終わった営業メールを、会長が1クリックで送るための画面。
// BookingRequestsPanel.tsxと同じ「AIが準備・会長が1クリックで確定」パターンを踏襲する。
// 送信自体は必ずこの画面のボタン経由（サーバー側APIが確度lowや宛先未確定を拒否する二重ガード）。
// 学校・法人・便り（client_leads）／自治体（municipality_profiles）の2ソースを横断して1つのキューにする
// （返信あり導線・統合フォローキューと同じ思想）。2026-07-23：sales_email_targetsはclient_leadsへ統合した。
import { useCallback, useEffect, useRef, useState } from 'react';

type Source = 'lead' | 'municipality';
type Confidence = 'high' | 'medium' | 'low' | null;
type FactCheckStatus = 'verified' | 'unverified' | 'flagged' | null;

interface QueueItem {
  source: Source;
  id: string;
  name: string;
  email: string | null;
  confidence: Confidence;
  sourceUrl: string | null;
  factCheckStatus: FactCheckStatus;
  factCheckNote: string | null;
  draft: string;
  sendPath: string;
  patchPath: string;
  assignedTo: string | null;
}
interface TeamMember { id: string; name: string; is_lead: boolean; is_active: boolean }

const CONFIDENCE_BADGE: Record<'high' | 'medium' | 'low', { label: string; color: string }> = {
  high: { label: '🟢 確度高', color: '#27AE60' },
  medium: { label: '🟡 要確認', color: '#E5A139' },
  low: { label: '🔴 フォームのみ', color: '#E74C3C' },
};

const FACT_CHECK_BADGE: Record<'verified' | 'flagged', { label: string; color: string }> = {
  verified: { label: '✓ 事実確認済み', color: '#27AE60' },
  flagged: { label: '⚠ 要修正フラグ', color: '#E74C3C' },
};

const cardStyle: React.CSSProperties = { background: '#fff', borderRadius: 12, padding: 16, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' };

function subjectOf(draft: string): string {
  const line = draft.split('\n').find((l) => /^件名[：:]/.test(l.trim()));
  return line ? line.trim().replace(/^件名[：:]\s*/, '') : '（件名未設定）';
}

export default function SendQueuePanel({ authHeaders, onOpenMunicipality }: {
  authHeaders: () => HeadersInit;
  // 自治体の一次情報（調べた内容・情報源の全文）は「🔁 関係人口・自治体」のプロフィールカードの方が
  // 詳しい。ここの「出典」リンク1本だけでは判断しづらいという声を受け、そちらへ直接ジャンプする。
  onOpenMunicipality?: (id: string) => void;
}) {
  const [items, setItems] = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [sentIds, setSentIds] = useState<Set<string>>(new Set());
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  // 「表示」フィルタ：''=全員 / '__unassigned'=未割当 / それ以外=team_members.name
  const [viewFilter, setViewFilter] = useState('');
  // 一括割り当て・一括事実確認用のチェック選択（`${source}-${id}`のSet）
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [bulkAssignee, setBulkAssignee] = useState('');
  const [assigning, setAssigning] = useState(false);
  const [bulkVerifying, setBulkVerifying] = useState(false);
  // shift+クリックで「ここからここまで」範囲選択するための直前チェック位置
  const lastCheckedIndexRef = useRef<number | null>(null);

  useEffect(() => {
    fetch('/api/admin/team-members', { headers: authHeaders() })
      .then((r) => r.json())
      .then((d) => { if (d.ok) setTeamMembers((d.members as TeamMember[]).filter((m) => m.is_active)); })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [leadsRes, muniRes] = await Promise.all([
        fetch('/api/admin/client-leads', { headers: authHeaders() }).then((r) => r.json()),
        fetch('/api/admin/municipality-profiles', { headers: authHeaders() }).then((r) => r.json()).catch(() => ({ ok: false })),
      ]);

      const queue: QueueItem[] = [];
      if (leadsRes.ok) {
        for (const l of leadsRes.leads ?? []) {
          if (l.email_draft?.trim() && !l.sent && !l.email_sent_at) {
            queue.push({
              source: 'lead', id: l.id, name: l.org_name, email: l.email,
              confidence: l.contact_email_confidence ?? null, sourceUrl: l.contact_email_source_url ?? null,
              factCheckStatus: l.fact_check_status ?? 'unverified', factCheckNote: l.fact_check_note ?? null,
              draft: l.email_draft, sendPath: `/api/admin/client-leads/${l.id}/send`,
              patchPath: `/api/admin/client-leads/${l.id}`, assignedTo: l.assigned_to ?? null,
            });
          }
        }
      }
      if (muniRes.ok) {
        for (const p of muniRes.profiles ?? []) {
          if (p.email_draft?.trim() && !p.email_sent_at) {
            queue.push({
              source: 'municipality', id: p.id, name: p.region_name, email: p.contact_email,
              confidence: p.contact_email_confidence ?? null, sourceUrl: p.contact_email_source_url ?? null,
              factCheckStatus: p.fact_check_status ?? 'unverified', factCheckNote: p.fact_check_note ?? null,
              draft: p.email_draft, sendPath: `/api/admin/municipality-profiles/${p.id}/send`,
              patchPath: `/api/admin/municipality-profiles/${p.id}`, assignedTo: p.assigned_to ?? null,
            });
          }
        }
      }
      setItems(queue);
    } catch {
      setError('通信エラー');
    } finally {
      setLoading(false);
    }
  }, [authHeaders]);

  useEffect(() => { load(); }, [load]);

  async function toggleFactCheck(item: QueueItem, status: 'verified' | 'unverified') {
    setBusyId(item.id);
    setError('');
    try {
      const res = await fetch(item.patchPath, {
        method: 'PATCH',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ fact_check_status: status, fact_checked_at: new Date().toISOString() }),
      });
      const data = await res.json();
      if (data.ok) {
        setItems((prev) => prev.map((i) => (i.id === item.id && i.source === item.source ? { ...i, factCheckStatus: status } : i)));
      } else {
        setError(data.error ?? '更新に失敗しました');
      }
    } catch {
      setError('通信エラー');
    } finally {
      setBusyId(null);
    }
  }

  async function saveEmail(item: QueueItem, rawValue: string) {
    const trimmed = rawValue.trim();
    if (trimmed === (item.email ?? '')) return;
    setBusyId(item.id);
    setError('');
    try {
      const field = item.source === 'municipality' ? 'contact_email' : 'email';
      const body: Record<string, unknown> = { [field]: trimmed || null };
      // 会長が手入力した宛先＝目視確認済みとみなし、確度を「高」に引き上げる（フォームのみ🔴のまま残さない）。
      if (trimmed) body.contact_email_confidence = 'high';
      const res = await fetch(item.patchPath, {
        method: 'PATCH',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.ok) {
        setItems((prev) => prev.map((i) => (i.id === item.id && i.source === item.source
          ? { ...i, email: trimmed || null, confidence: trimmed ? 'high' : i.confidence } : i)));
      } else {
        setError(data.error ?? '宛先の更新に失敗しました');
      }
    } catch {
      setError('通信エラー');
    } finally {
      setBusyId(null);
    }
  }

  async function send(item: QueueItem) {
    if (!window.confirm(`${item.name} 様（${item.email}）へ、このメールを送信します。取り消せません。よろしいですか？`)) return;
    setBusyId(item.id);
    setError('');
    try {
      const res = await fetch(item.sendPath, { method: 'POST', headers: authHeaders() });
      const data = await res.json();
      if (data.ok) {
        setSentIds((prev) => new Set(prev).add(item.id));
        // ローカルで消すだけでなく必ずサーバーから再取得する。他の人が既に送っていた場合や、
        // 別タブでの状況変化を取りこぼさないため（二重送信対策の一部）。
        await load();
      } else {
        setError(data.error ?? '送信に失敗しました');
      }
    } catch {
      setError('通信エラー');
    } finally {
      setBusyId(null);
    }
  }

  function toggleChecked(key: string, index: number, rangeKeys: string[], shiftKey: boolean) {
    // setCheckedのupdaterはReactが後で（コミット時に）実行するため、その中でrefを読むと
    // 下の行で先に書き換えたindexを読んでしまい、範囲が1点に潰れるバグになる。
    // 更新前の値を先にローカル変数へ退避してから使う。
    const previousIndex = lastCheckedIndexRef.current;
    lastCheckedIndexRef.current = index;
    setChecked((prev) => {
      const next = new Set(prev);
      if (shiftKey && previousIndex !== null) {
        // 「ここからここまで」一気にチェック：直前にクリックした行から今回の行までを全部選択する。
        const [from, to] = [previousIndex, index].sort((a, b) => a - b);
        for (let i = from; i <= to; i++) next.add(rangeKeys[i]);
      } else if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }

  async function bulkVerify() {
    if (checked.size === 0) return;
    setBulkVerifying(true);
    setError('');
    try {
      const targets = items.filter((i) => checked.has(`${i.source}-${i.id}`));
      const results = await Promise.all(targets.map((i) =>
        fetch(i.patchPath, {
          method: 'PATCH',
          headers: { ...authHeaders(), 'Content-Type': 'application/json' },
          body: JSON.stringify({ fact_check_status: 'verified', fact_checked_at: new Date().toISOString() }),
        }).then((r) => r.json()).catch(() => ({ ok: false }))
      ));
      const failed = results.filter((r) => !r.ok).length;
      if (failed > 0) setError(`${failed}件の事実確認済み反映に失敗しました`);
      setChecked(new Set());
      await load();
    } finally {
      setBulkVerifying(false);
    }
  }

  async function bulkAssign() {
    if (checked.size === 0) return;
    setAssigning(true);
    setError('');
    try {
      const targets = items.filter((i) => checked.has(`${i.source}-${i.id}`));
      const results = await Promise.all(targets.map((i) =>
        fetch(i.patchPath, {
          method: 'PATCH',
          headers: { ...authHeaders(), 'Content-Type': 'application/json' },
          body: JSON.stringify({ assigned_to: bulkAssignee || null }),
        }).then((r) => r.json()).catch(() => ({ ok: false }))
      ));
      const failed = results.filter((r) => !r.ok).length;
      if (failed > 0) setError(`${failed}件の割り当てに失敗しました`);
      setChecked(new Set());
      await load();
    } finally {
      setAssigning(false);
    }
  }

  if (loading) return <p style={{ fontSize: 13, color: '#999' }}>読み込み中…</p>;

  return (
    <div style={cardStyle}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <p style={{ margin: 0, fontWeight: 800, fontSize: 14 }}>📤 送信キュー</p>
        {items.length > 0 && (
          <span style={{ fontSize: 10, fontWeight: 700, color: '#8E44AD', background: '#F3E9FA', padding: '2px 8px', borderRadius: 20 }}>{items.length}件</span>
        )}
      </div>
      <p style={{ margin: '0 0 12px', fontSize: 11, color: '#999' }}>
        下書き・宛先確定まで終わった営業メールです。送信ボタンを押した時だけ実際に送られます（AIが自動で送ることはありません）。
        確度が🔴の宛先、または事実確認が済んでいない下書きは誤送信・誤情報を防ぐため送信できません。
        宛先はAIが見つけた「出典」リンクから一次情報を確認し、正しければ「事実確認済みにする」を押してください。
        宛先が未確定・誤りの場合はメールアドレス欄に直接入力すれば、その場で確度「高」として上書きされます（会長が確認・入力した宛先という扱いです）。
        チェック欄はshiftを押しながらクリックすると、直前にチェックした行から今回の行までを一気に選択できます。
      </p>
      {error && <p style={{ color: '#E74C3C', fontSize: 12, margin: '0 0 10px' }}>{error}</p>}
      {sentIds.size > 0 && (
        <p style={{ fontSize: 12, color: '#27AE60', fontWeight: 700, margin: '0 0 10px' }}>✓ {sentIds.size}件送信しました</p>
      )}

      {teamMembers.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10, marginBottom: 4, padding: '8px 10px', background: '#F8F6FB', borderRadius: 8 }}>
          <label style={{ fontSize: 11.5, color: '#666' }}>
            表示：{' '}
            <select value={viewFilter} onChange={(e) => setViewFilter(e.target.value)} style={{ fontSize: 12, padding: '3px 6px', borderRadius: 6, border: '1px solid #ddd' }}>
              <option value="">全員</option>
              <option value="__unassigned">未割当のみ</option>
              {teamMembers.map((m) => <option key={m.id} value={m.name}>{m.name}の担当分のみ</option>)}
            </select>
          </label>
        </div>
      )}
      {checked.size > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10, marginBottom: 10, padding: '8px 10px', background: '#F8F6FB', borderRadius: 8 }}>
          <span style={{ fontSize: 11.5, color: '#8E44AD', fontWeight: 700 }}>{checked.size}件を選択中 →</span>
          <button onClick={bulkVerify} disabled={bulkVerifying} style={{
            padding: '4px 12px', borderRadius: 8, border: '1px solid #27AE60', background: '#fff', color: '#27AE60',
            fontWeight: 700, fontSize: 11.5, cursor: bulkVerifying ? 'wait' : 'pointer',
          }}>{bulkVerifying ? '反映中…' : 'まとめて事実確認済みにする'}</button>
          {teamMembers.length > 0 && (
            <>
              <select value={bulkAssignee} onChange={(e) => setBulkAssignee(e.target.value)} style={{ fontSize: 12, padding: '3px 6px', borderRadius: 6, border: '1px solid #ddd' }}>
                <option value="">未割当にする</option>
                {teamMembers.map((m) => <option key={m.id} value={m.name}>{m.name}</option>)}
              </select>
              <button onClick={bulkAssign} disabled={assigning} style={{
                padding: '4px 12px', borderRadius: 8, border: 'none', background: '#8E44AD', color: '#fff',
                fontWeight: 700, fontSize: 11.5, cursor: assigning ? 'wait' : 'pointer',
              }}>{assigning ? '割り当て中…' : 'この範囲を割り当てる'}</button>
            </>
          )}
          <button onClick={() => setChecked(new Set())} style={{
            padding: '4px 10px', borderRadius: 8, border: '1px solid #ddd', background: '#fff', color: '#999', fontSize: 11.5, cursor: 'pointer',
          }}>選択解除</button>
        </div>
      )}

      {(() => {
        const visibleItems = viewFilter === '' ? items
          : viewFilter === '__unassigned' ? items.filter((i) => !i.assignedTo)
          : items.filter((i) => i.assignedTo === viewFilter);

        if (visibleItems.length === 0) {
          return <p style={{ fontSize: 12, color: '#999', margin: 0 }}>{items.length === 0 ? '送信待ちの下書きはありません。' : 'このフィルタに該当する下書きはありません。'}</p>;
        }
        const rangeKeys = visibleItems.map((i) => `${i.source}-${i.id}`);
        return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {visibleItems.map((item, idx) => {
            const badge = item.confidence ? CONFIDENCE_BADGE[item.confidence] : null;
            const factBadge = item.factCheckStatus === 'verified' || item.factCheckStatus === 'flagged'
              ? FACT_CHECK_BADGE[item.factCheckStatus] : null;
            const canSend = Boolean(item.email) && (item.confidence === 'high' || item.confidence === 'medium') && item.factCheckStatus === 'verified';
            const expanded = expandedId === item.id;
            const itemKey = `${item.source}-${item.id}`;
            const isChecked = checked.has(itemKey);
            return (
              <div key={itemKey} style={{ padding: '10px 12px', borderRadius: 10, background: '#F4F6F5' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                  <input
                    type="checkbox" checked={isChecked}
                    onClick={(e) => toggleChecked(itemKey, idx, rangeKeys, e.shiftKey)}
                    onChange={() => {}}
                    title="shiftを押しながらクリックで範囲選択"
                    style={{ marginTop: 3, flexShrink: 0 }}
                  />
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#222' }}>{item.name}</p>
                    <p style={{ margin: '2px 0 0', fontSize: 11.5, color: '#666' }}>{subjectOf(item.draft)}</p>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 4, flexWrap: 'wrap' }}>
                      <input
                        key={`email-${item.source}-${item.id}-${item.email ?? ''}`}
                        defaultValue={item.email ?? ''}
                        placeholder="宛先を確認して入力"
                        onBlur={(e) => saveEmail(item, e.target.value)}
                        style={{
                          fontSize: 11.5, color: '#555', minWidth: 190, padding: '2px 6px', borderRadius: 6,
                          border: item.email ? '1px solid transparent' : '1px solid #E5A139',
                          background: item.email ? 'transparent' : '#FFFBEF',
                        }}
                      />
                      {badge && <span style={{ fontSize: 10.5, fontWeight: 700, color: badge.color }}>{badge.label}</span>}
                      {factBadge ? (
                        <span style={{ fontSize: 10.5, fontWeight: 700, color: factBadge.color }}>{factBadge.label}</span>
                      ) : (
                        <span style={{ fontSize: 10.5, fontWeight: 700, color: '#999' }}>○ 事実確認: 未実施</span>
                      )}
                      {item.assignedTo ? (
                        <span style={{ fontSize: 10.5, fontWeight: 700, color: '#8E44AD', background: '#F3E9FA', padding: '1px 7px', borderRadius: 20 }}>👤 {item.assignedTo}</span>
                      ) : teamMembers.length > 0 && (
                        <span style={{ fontSize: 10.5, fontWeight: 700, color: '#bbb' }}>未割当</span>
                      )}
                      {item.sourceUrl && (
                        <a href={item.sourceUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: 10.5, color: '#38ADA9' }}>出典 ↗</a>
                      )}
                      {item.source === 'municipality' && onOpenMunicipality && (
                        <button onClick={() => onOpenMunicipality(item.id)} style={{
                          fontSize: 10.5, color: '#8E44AD', background: 'none', border: 'none', padding: 0, cursor: 'pointer', textDecoration: 'underline',
                        }}>📋 調べた内容を台帳で見る</button>
                      )}
                    </div>
                    {item.factCheckNote && (
                      <p style={{ margin: '4px 0 0', fontSize: 11, color: '#E5A139' }}>{item.factCheckNote}</p>
                    )}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0 }}>
                    <button onClick={() => setExpandedId(expanded ? null : item.id)} style={{
                      padding: '4px 10px', borderRadius: 8, border: '1px solid #ddd', background: '#fff', color: '#666', fontSize: 11, cursor: 'pointer',
                    }}>{expanded ? '閉じる' : '本文を見る'}</button>
                    {item.factCheckStatus === 'verified' ? (
                      <button onClick={() => toggleFactCheck(item, 'unverified')} disabled={busyId === item.id} style={{
                        padding: '4px 10px', borderRadius: 8, border: '1px solid #ddd', background: '#fff', color: '#999', fontSize: 11, cursor: 'pointer',
                      }}>未確認に戻す</button>
                    ) : (
                      <button onClick={() => toggleFactCheck(item, 'verified')} disabled={busyId === item.id} style={{
                        padding: '4px 10px', borderRadius: 8, border: '1px solid #27AE60', background: '#fff', color: '#27AE60', fontWeight: 700, fontSize: 11, cursor: 'pointer',
                      }}>事実確認済みにする</button>
                    )}
                    <button onClick={() => send(item)} disabled={!canSend || busyId === item.id} style={{
                      padding: '6px 14px', borderRadius: 8, border: 'none',
                      background: canSend ? '#38ADA9' : '#ccc', color: '#fff', fontWeight: 700, fontSize: 12,
                      cursor: canSend && busyId !== item.id ? 'pointer' : 'not-allowed',
                    }}>{busyId === item.id ? '送信中…' : '送信'}</button>
                  </div>
                </div>
                {expanded && (
                  <pre style={{
                    marginTop: 10, padding: 10, background: '#fff', borderRadius: 8, fontSize: 12, lineHeight: 1.8,
                    whiteSpace: 'pre-wrap', fontFamily: 'inherit', color: '#333',
                  }}>{item.draft}</pre>
                )}
              </div>
            );
          })}
        </div>
        );
      })()}
    </div>
  );
}
