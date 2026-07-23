'use client';

// 📊 事業ライン専用ダッシュボード — 単発の思いつきで終わらせず「今後動かしていく事業」として
// 伴走支援できるようにするための基盤。ビジネスモデル案（biz_model_ideas）1件を軸に、
// フェーズ進行・営業先（自治体台帳のうちこの事業から生まれたもの）・伴走ログを1画面に集約する。
import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

interface BizModelIdea {
  id: string; title: string; memo: string | null; status: string; report_md: string | null; phase: number;
}
interface MunicipalityProfile {
  id: string; region_name: string; opportunity_level: string; is_priority_pick: boolean;
  email_draft: string | null; email_sent_at: string | null; fact_check_status: string | null;
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

const cardStyle: React.CSSProperties = { background: '#fff', borderRadius: 16, border: '1px solid #eee', padding: 18, marginBottom: 16 };
const labelStyle: React.CSSProperties = { fontSize: 11.5, fontWeight: 700, color: '#777', margin: '8px 0 4px', display: 'block' };
const inputStyle: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box', padding: '8px 10px', borderRadius: 8,
  border: '1.5px solid #ddd', fontSize: 13, fontFamily: 'inherit',
};
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [needsMigration, setNeedsMigration] = useState(false);

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
      const [ideasRes, profilesRes, eventsRes] = await Promise.all([
        fetch('/api/admin/biz-model-ideas', { headers: authHeaders(pw) }).then(r => r.json()),
        fetch('/api/admin/municipality-profiles', { headers: authHeaders(pw) }).then(r => r.json()),
        fetch(`/api/admin/biz-model-events?biz_model_idea_id=${ideaId}`, { headers: authHeaders(pw) }).then(r => r.json()),
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

      {/* ---- 営業先（この事業から生まれたリード） ---- */}
      <div style={cardStyle}>
        <p style={{ margin: '0 0 8px', fontWeight: 800, fontSize: 14 }}>🎯 営業先（{targets.length}件）</p>
        {targets.length === 0 ? (
          <p style={{ margin: 0, fontSize: 12, color: '#aaa' }}>まだこの事業に紐づく営業先がありません。自治体台帳側でlinked_biz_model_idea_idを設定してください。</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {targets.map(t => (
              <div key={t.id} style={{ padding: '8px 12px', borderRadius: 8, background: '#F4F6F5', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <div>
                  <b style={{ fontSize: 13 }}>{t.is_priority_pick && '★ '}{t.region_name}</b>
                  <span style={{ marginLeft: 8, fontSize: 11, color: '#999' }}>提案余地{t.opportunity_level}</span>
                </div>
                <div style={{ display: 'flex', gap: 6, fontSize: 11 }}>
                  {t.email_draft ? (
                    <span style={{ color: t.email_sent_at ? '#27AE60' : '#B7791F', fontWeight: 700 }}>
                      {t.email_sent_at ? '✓ 送信済み' : `下書きあり（${t.fact_check_status === 'verified' ? '事実確認済み' : '未確認'}）`}
                    </span>
                  ) : (
                    <span style={{ color: '#ccc' }}>下書きなし</span>
                  )}
                </div>
              </div>
            ))}
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
