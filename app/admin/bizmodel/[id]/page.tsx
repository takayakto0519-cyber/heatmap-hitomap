'use client';

// 📊 事業ライン専用ダッシュボード — 単発の思いつきで終わらせず「今後動かしていく事業」として
// 伴走支援できるようにするための基盤。ビジネスモデル案（biz_model_ideas）1件を軸に、
// フェーズ進行・営業先（自治体台帳のうちこの事業から生まれたもの）・伴走ログを1画面に集約する。
import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import MilestoneTrack from '@/components/admin/MilestoneTrack';
import OutreachStatus from '@/components/admin/OutreachStatus';
import DeliverableCard, { type Deliverable } from '@/components/admin/DeliverableCard';
import { deriveMilestone, isReadyToSend, type OutreachTarget } from '@/lib/tracks/govOutreach';
import { inputStyle as sharedInputStyle } from '@/components/admin/adminShared';

interface BizModelIdea {
  id: string; title: string; memo: string | null; status: string; report_md: string | null; phase: number;
}
// OutreachTarget を継承しているので、deriveMilestone() にそのまま渡せる。
// 未適用のマイグレーションのカラム（hearing_at 等）は undefined のまま届くが、
// deriveMilestone は空文字と同じ扱いをするので画面は壊れない。
interface MunicipalityProfile extends OutreachTarget {
  id: string; region_name: string; opportunity_level: string; is_priority_pick: boolean;
}
interface BizModelEvent {
  id: string; biz_model_idea_id: string; event_type: string; title: string; body: string | null; occurred_at: string;
}

const PHASES = ['フェーズ0：ショーケース確立', 'フェーズ1：MVP', 'フェーズ2：展開', 'フェーズ3：スケール'];
const EVENT_TYPE_META: Record<string, { label: string; icon: string }> = {
  meeting: { label: '打ち合わせ', icon: '🗣' },
  decision: { label: '決定事項', icon: '✅' },
  milestone: { label: 'マイルストーン', icon: '🏁' },
  note: { label: 'メモ', icon: '📝' },
};
const EVENT_TYPES = Object.keys(EVENT_TYPE_META);

// adminShared.Card と同じ見た目（radius12・boxShadow）に揃える。ここは <Card> を使わず定数のままにしているのは
// 呼び出し側が既に <div style={cardStyle}> の形で複数箇所にあり、tag差し替えより値の統一を優先したため。
const cardStyle: React.CSSProperties = { background: '#fff', borderRadius: 12, padding: 16, marginBottom: 16, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' };
const labelStyle: React.CSSProperties = { fontSize: 11.5, fontWeight: 700, color: '#777', margin: '8px 0 4px', display: 'block' };
const inputStyle: React.CSSProperties = { ...sharedInputStyle, width: '100%', boxSizing: 'border-box' };
const btnStyle: React.CSSProperties = { padding: '8px 16px', borderRadius: 8, border: 'none', background: '#38ADA9', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer' };

export default function BizModelDashboardPage() {
  const params = useParams();
  const ideaId = params?.id as string;

  const [password, setPassword] = useState('');
  const [unlocked, setUnlocked] = useState(false);
  const [unlockError, setUnlockError] = useState('');
  const [unlocking, setUnlocking] = useState(false);

  const [idea, setIdea] = useState<BizModelIdea | null>(null);
  const [targets, setTargets] = useState<MunicipalityProfile[]>([]);
  const [events, setEvents] = useState<BizModelEvent[]>([]);
  const [deliverables, setDeliverables] = useState<Deliverable[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [needsMigration, setNeedsMigration] = useState(false);
  const [needsDeliverableMigration, setNeedsDeliverableMigration] = useState(false);
  // fact_check_watch.py（出典の機械的突合）→ proposal_queue_watch.py が転記した「要目視確認」フラグ。
  // agent-status APIはローカルでは agents/work/*.json、本番ではSupabaseの同期スナップショットを読むので両方で表示できる。
  const [factCheckFlagIds, setFactCheckFlagIds] = useState<Set<string>>(new Set());

  const [eventForm, setEventForm] = useState({ event_type: 'note', title: '', body: '' });
  const [savingEvent, setSavingEvent] = useState(false);

  function authHeaders(pw = password): HeadersInit {
    return { 'x-admin-password': pw };
  }
  function jsonHeaders(pw = password): HeadersInit {
    return { ...authHeaders(pw), 'Content-Type': 'application/json' };
  }

  const load = useCallback(async (pw: string) => {
    setLoading(true);
    try {
      const [ideasRes, profilesRes, eventsRes, delivRes, agentStatusRes] = await Promise.all([
        fetch('/api/admin/biz-model-ideas', { headers: authHeaders(pw) }).then(r => r.json()),
        fetch('/api/admin/municipality-profiles', { headers: authHeaders(pw) }).then(r => r.json()),
        fetch(`/api/admin/biz-model-events?biz_model_idea_id=${ideaId}`, { headers: authHeaders(pw) }).then(r => r.json()),
        fetch('/api/admin/ai-deliverables?entity_type=municipality_profile', { headers: authHeaders(pw) }).then(r => r.json()),
        fetch('/api/admin/agent-status', { headers: authHeaders(pw) }).then(r => r.json()).catch(() => null),
      ]);
      if (!ideasRes.ok) throw new Error(ideasRes.error ?? '取得に失敗しました');
      const found = (ideasRes.ideas ?? []).find((i: BizModelIdea) => i.id === ideaId) ?? null;
      setIdea(found);
      if (profilesRes.ok) {
        setTargets((profilesRes.profiles ?? []).filter((p: MunicipalityProfile & { linked_biz_model_idea_id?: string }) => p.linked_biz_model_idea_id === ideaId));
      }
      if (eventsRes.ok) {
        setEvents(eventsRes.events ?? []);
        setNeedsMigration(Boolean(eventsRes.needsMigration));
      }
      if (delivRes.ok) {
        setDeliverables(delivRes.deliverables ?? []);
        setNeedsDeliverableMigration(Boolean(delivRes.needsMigration));
      }
      const pqw = agentStatusRes?.agents?.find((a: { id: string }) => a.id === 'proposal_queue_watch');
      const flags = (pqw?.result?.fact_check_flags ?? []) as Array<{ id: string }>;
      setFactCheckFlagIds(new Set(flags.map(f => f.id)));
    } catch (e) {
      setError(e instanceof Error ? e.message : '通信エラー');
    } finally {
      setLoading(false);
    }
  }, [ideaId]);

  useEffect(() => {
    const saved = sessionStorage.getItem('admin_dashboard_password') ?? sessionStorage.getItem('hm-admin-pw');
    if (saved) tryUnlock(saved);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function tryUnlock(pw: string) {
    setUnlocking(true);
    setUnlockError('');
    try {
      const res = await fetch('/api/admin/biz-model-ideas', { headers: authHeaders(pw) });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error ?? 'パスワードが違います');
      setPassword(pw);
      setUnlocked(true);
      sessionStorage.setItem('admin_dashboard_password', pw);
      await load(pw);
    } catch (e) {
      setUnlockError(e instanceof Error ? e.message : '認証に失敗しました');
    } finally {
      setUnlocking(false);
    }
  }

  async function patchIdea(fields: Partial<BizModelIdea>) {
    if (!idea) return;
    setIdea({ ...idea, ...fields });
    await fetch(`/api/admin/biz-model-ideas/${idea.id}`, { method: 'PATCH', headers: jsonHeaders(), body: JSON.stringify(fields) });
  }

  // 営業先1行の更新。この画面は承認ビューなので、会長が押すのは「送った」「フォローした」
  // 「返信きた」といった記録操作だけ。詳細な編集は「🔁関係人口・自治体」タブ側で行う。
  async function patchTarget(id: string, fields: Record<string, unknown>) {
    setTargets(ts => ts.map(t => (t.id === id ? { ...t, ...fields } : t)));
    await fetch(`/api/admin/municipality-profiles/${id}`, {
      method: 'PATCH', headers: jsonHeaders(), body: JSON.stringify(fields),
    });
  }

  // AI成果物（ai_deliverables）の3ボタン。承認はサーバー側で実体テーブルへの反映まで行う。
  async function approveDeliverable(d: Deliverable) {
    const res = await fetch(`/api/admin/ai-deliverables/${d.id}`, {
      method: 'PATCH', headers: jsonHeaders(), body: JSON.stringify({ status: 'approved' }),
    });
    const data = await res.json();
    if (!data.ok) { setError(data.error ?? '承認に失敗しました'); return; }
    await load(password);
  }
  async function reviseDeliverable(d: Deliverable, feedback: string, rebuild: boolean) {
    const res = await fetch(`/api/admin/ai-deliverables/${d.id}`, {
      method: 'PATCH', headers: jsonHeaders(), body: JSON.stringify({ status: 'revise', feedback, rebuild }),
    });
    const data = await res.json();
    if (!data.ok) { setError(data.error ?? '差し戻しに失敗しました'); return; }
    await load(password);
  }
  async function archiveDeliverable(d: Deliverable) {
    await fetch(`/api/admin/ai-deliverables/${d.id}`, {
      method: 'PATCH', headers: jsonHeaders(), body: JSON.stringify({ status: 'archived' }),
    });
    await load(password);
  }
  async function patchDeliverableContent(id: string, title: string, body: string) {
    const res = await fetch(`/api/admin/ai-deliverables/${id}`, {
      method: 'PATCH', headers: jsonHeaders(), body: JSON.stringify({ title, body }),
    });
    const data = await res.json();
    if (!data.ok) { setError(data.error ?? '保存に失敗しました'); return; }
    await load(password);
  }

  async function addEvent() {
    if (!eventForm.title.trim()) return;
    setSavingEvent(true);
    try {
      const res = await fetch('/api/admin/biz-model-events', {
        method: 'POST', headers: jsonHeaders(),
        body: JSON.stringify({ biz_model_idea_id: ideaId, ...eventForm }),
      });
      const data = await res.json();
      if (!data.ok) { setError(data.error ?? '記録に失敗しました'); return; }
      setEventForm({ event_type: 'note', title: '', body: '' });
      await load(password);
    } finally {
      setSavingEvent(false);
    }
  }
  async function removeEvent(id: string) {
    await fetch(`/api/admin/biz-model-events/${id}`, { method: 'DELETE', headers: authHeaders() });
    await load(password);
  }

  if (!unlocked) {
    return (
      <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fafafa', padding: 16 }}>
        <form onSubmit={e => { e.preventDefault(); tryUnlock(password); }}
          style={{ background: '#fff', padding: 24, borderRadius: 16, width: '100%', maxWidth: 320, boxShadow: '0 1px 8px rgba(0,0,0,0.06)' }}>
          <p style={{ fontWeight: 800, margin: '0 0 12px' }}>📊 事業ライン専用ダッシュボード</p>
          <input type="password" placeholder="管理パスワード" value={password}
            onChange={e => setPassword(e.target.value)}
            style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1.5px solid #ddd', boxSizing: 'border-box', marginBottom: 10 }} />
          {unlockError && <p style={{ color: '#E74C3C', fontSize: 12, margin: '0 0 10px' }}>{unlockError}</p>}
          <button type="submit" disabled={unlocking} style={{
            width: '100%', padding: '10px 0', borderRadius: 8, border: 'none',
            background: '#38ADA9', color: '#fff', fontWeight: 700, cursor: 'pointer',
          }}>{unlocking ? '確認中…' : '開く'}</button>
        </form>
      </div>
    );
  }

  if (loading) return <p style={{ padding: 24, color: '#999' }}>読み込み中…</p>;
  if (!idea) return <p style={{ padding: 24, color: '#E74C3C' }}>{error || 'この事業案が見つかりませんでした。'}</p>;

  // 会長の手番（今すぐ送れる）とAIの手番の件数。オートパイロットが拾う対象と同じ判定を使う。
  const readyToSend = targets.filter(isReadyToSend);
  const aiTurnCount = targets.filter(t => deriveMilestone(t).owner === 'ai').length;
  const regionNameById = new Map(targets.map(t => [t.id, t.region_name]));
  // 会長がまだ見ていないもの（提案中）を先頭に、差し戻し済み（作り直し待ち）はAIの作業待ちなので後ろに回す。
  const pendingDeliverables = deliverables
    .filter(d => d.status === 'proposed' || d.status === 'revise')
    .sort((a, b) => (a.status === b.status ? 0 : a.status === 'proposed' ? -1 : 1));

  return (
    <div style={{ maxWidth: 860, margin: '0 auto', padding: '24px 16px 80px', fontFamily: 'inherit' }}>
      <p style={{ fontSize: 12, color: '#999', margin: '0 0 4px' }}>事業ライン専用ダッシュボード（伴走支援基盤）</p>
      <h1 style={{ margin: '0 0 6px', fontSize: 22, fontWeight: 900 }}>📊 {idea.title}</h1>
      {idea.memo && <p style={{ margin: '0 0 16px', fontSize: 13, color: '#666' }}>{idea.memo}</p>}

      {/* ---- フェーズ進行 ---- */}
      <div style={cardStyle}>
        <p style={{ margin: '0 0 10px', fontWeight: 800, fontSize: 14 }}>🚦 実行フェーズ</p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {PHASES.map((label, i) => (
            <button key={i} onClick={() => patchIdea({ phase: i })} style={{
              padding: '8px 14px', borderRadius: 999, fontSize: 12.5, cursor: 'pointer',
              border: idea.phase === i ? 'none' : '1px solid #ccc',
              background: idea.phase === i ? '#38ADA9' : i < idea.phase ? '#38ADA918' : '#fff',
              color: idea.phase === i ? '#fff' : i < idea.phase ? '#38ADA9' : '#666',
              fontWeight: idea.phase === i ? 700 : 400,
            }}>{i < idea.phase && '✓ '}{label}</button>
          ))}
        </div>
      </div>

      {/* ---- AI提案（会長が今日チェックするもの） ---- */}
      <div style={cardStyle}>
        <p style={{ margin: '0 0 8px', fontWeight: 800, fontSize: 14 }}>
          🤖 AI提案（{pendingDeliverables.filter(d => d.status === 'proposed').length}件・確認待ち）
        </p>
        {needsDeliverableMigration && (
          <p style={{ margin: '0 0 10px', fontSize: 12, color: '#B7791F', background: '#FFF8E8', padding: 8, borderRadius: 8 }}>
            ⚠ AI成果物のテーブルが未作成です。<code>supabase/migrations/20260816_add_ai_deliverables.sql</code> をSQL Editorで実行してください。
          </p>
        )}
        {pendingDeliverables.length === 0 ? (
          <p style={{ margin: 0, fontSize: 12, color: '#aaa' }}>いま確認待ちのAI提案はありません。</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {pendingDeliverables.map(d => (
              <DeliverableCard
                key={d.id}
                deliverable={d}
                subjectName={d.entity_id ? regionNameById.get(d.entity_id) : undefined}
                onApprove={() => approveDeliverable(d)}
                onRevise={(feedback, rebuild) => reviseDeliverable(d, feedback, rebuild)}
                onArchive={() => archiveDeliverable(d)}
                onSaveEdit={(title, body) => patchDeliverableContent(d.id, title, body)}
              />
            ))}
          </div>
        )}
      </div>

      {/* ---- 営業先（この事業から生まれたリード） ---- */}
      <div style={cardStyle}>
        <p style={{ margin: '0 0 8px', fontWeight: 800, fontSize: 14 }}>🎯 営業先（{targets.length}件）</p>

        {/* 会長が今日やることを最上部に集約する。ここが空なら営業先について会長の手番はない。 */}
        {targets.length > 0 && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
            <span style={{
              fontSize: 11.5, fontWeight: 700, padding: '4px 10px', borderRadius: 12,
              background: readyToSend.length ? '#27AE6018' : '#f2f2f2',
              color: readyToSend.length ? '#27AE60' : '#aaa',
            }}>
              ✉️ 今すぐ送信可能 {readyToSend.length}件
              {readyToSend.length > 0 && `（${readyToSend.map(t => t.region_name).join('・')}）`}
            </span>
            <span style={{
              fontSize: 11.5, fontWeight: 700, padding: '4px 10px', borderRadius: 12,
              background: '#38ADA918', color: '#38ADA9',
            }}>🤖 AIの手番 {aiTurnCount}件</span>
          </div>
        )}

        {targets.length === 0 ? (
          <p style={{ margin: 0, fontSize: 12, color: '#aaa' }}>まだこの事業に紐づく営業先がありません。自治体台帳側でlinked_biz_model_idea_idを設定してください。</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {targets.map(t => {
              const ms = deriveMilestone(t);
              return (
                <div key={t.id} style={{ padding: '10px 12px', borderRadius: 8, background: '#F4F6F5' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <div>
                      <b style={{ fontSize: 13 }}>{t.is_priority_pick && '★ '}{t.region_name}</b>
                      <span style={{ marginLeft: 8, fontSize: 11, color: '#999' }}>提案余地{t.opportunity_level}</span>
                      {isReadyToSend(t) && (
                        <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 700, color: '#27AE60' }}>事実確認済み・未送信</span>
                      )}
                      {factCheckFlagIds.has(t.id) && (
                        <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 700, color: '#E74C3C' }}>⚠ 出典に要確認あり</span>
                      )}
                    </div>
                    {/* 送信後ライフサイクルの表示・記録は既存の共通部品に任せる（二重に作らない） */}
                    <OutreachStatus
                      state={{ email_sent_at: t.email_sent_at ?? null, email_reply: t.email_reply ?? null, followed_up_at: t.followed_up_at ?? null }}
                      onMarkSent={t.email_draft ? () => patchTarget(t.id, { email_sent_at: new Date().toISOString() }) : undefined}
                      onMarkFollowedUp={() => patchTarget(t.id, { followed_up_at: new Date().toISOString() })}
                      onMarkReplied={() => patchTarget(t.id, { email_reply: '（返信あり・内容は自治体タブで記録）' })}
                    />
                  </div>
                  <div style={{ marginTop: 7 }}>
                    <MilestoneTrack state={ms} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
        <p style={{ margin: '8px 0 0', fontSize: 11, color: '#aaa' }}>詳細な編集・メール確認は「🔁関係人口・自治体」タブから行ってください。</p>
      </div>

      {/* ---- 事業計画（report_md） ---- */}
      {idea.report_md && (
        <div style={cardStyle}>
          <p style={{ margin: '0 0 8px', fontWeight: 800, fontSize: 14 }}>📋 事業計画</p>
          <pre style={{ margin: 0, fontSize: 12.5, lineHeight: 1.8, whiteSpace: 'pre-wrap', fontFamily: 'inherit', color: '#333', maxHeight: 480, overflowY: 'auto' }}>{idea.report_md}</pre>
        </div>
      )}

      {/* ---- 伴走ログ ---- */}
      <div style={cardStyle}>
        <p style={{ margin: '0 0 8px', fontWeight: 800, fontSize: 14 }}>📓 伴走ログ</p>
        {needsMigration && (
          <p style={{ margin: '0 0 10px', fontSize: 12, color: '#B7791F', background: '#FFF8E8', padding: 8, borderRadius: 8 }}>
            ⚠ 伴走ログのテーブルが未作成です。<code>supabase/migrations/20260723b_add_biz_model_dashboard.sql</code> をSQL Editorで実行してください。
          </p>
        )}

        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
          {EVENT_TYPES.map(t => (
            <button key={t} onClick={() => setEventForm(f => ({ ...f, event_type: t }))} style={{
              padding: '4px 11px', borderRadius: 14, fontSize: 11.5, cursor: 'pointer',
              border: eventForm.event_type === t ? 'none' : '1px solid #ddd',
              background: eventForm.event_type === t ? '#38ADA9' : '#fff',
              color: eventForm.event_type === t ? '#fff' : '#666', fontWeight: eventForm.event_type === t ? 700 : 400,
            }}>{EVENT_TYPE_META[t].icon} {EVENT_TYPE_META[t].label}</button>
          ))}
        </div>
        <input style={inputStyle} placeholder="タイトル（例：飛騨市に決定）" value={eventForm.title}
          onChange={e => setEventForm(f => ({ ...f, title: e.target.value }))} />
        <textarea style={{ ...inputStyle, marginTop: 8, resize: 'vertical' }} rows={3} placeholder="内容・理由など"
          value={eventForm.body} onChange={e => setEventForm(f => ({ ...f, body: e.target.value }))} />
        <div style={{ marginTop: 8 }}>
          <button style={btnStyle} disabled={savingEvent || !eventForm.title.trim()} onClick={addEvent}>{savingEvent ? '保存中…' : '記録する'}</button>
        </div>

        <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {events.length === 0 ? (
            <p style={{ margin: 0, fontSize: 12, color: '#aaa' }}>まだ記録がありません。</p>
          ) : events.map(ev => (
            <div key={ev.id} style={{ borderLeft: '3px solid #38ADA9', paddingLeft: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                <b style={{ fontSize: 12.5 }}>{EVENT_TYPE_META[ev.event_type]?.icon ?? '📝'} {ev.title}</b>
                <span style={{ fontSize: 10.5, color: '#aaa' }}>{new Date(ev.occurred_at).toLocaleString('ja-JP')}</span>
              </div>
              {ev.body && <p style={{ margin: '4px 0 0', fontSize: 12, color: '#666', whiteSpace: 'pre-wrap' }}>{ev.body}</p>}
              <button onClick={() => removeEvent(ev.id)} style={{ marginTop: 4, fontSize: 10.5, color: '#ccc', background: 'none', border: 'none', cursor: 'pointer' }}>削除</button>
            </div>
          ))}
        </div>
      </div>

      {error && <p style={{ color: '#E74C3C', fontSize: 13 }}>{error}</p>}
    </div>
  );
}
