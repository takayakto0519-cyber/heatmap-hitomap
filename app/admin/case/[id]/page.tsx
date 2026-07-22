'use client';

// 📊 案件専用ダッシュボード — 商談以降（提案〜フォロー）の案件を徹底的に伴走するための基盤。
// 商流ボード（FlowBoard）は一覧・ステージ管理に強いが、1案件の「相手の全情報＋やり取り履歴＋
// 伴走ログ」を1画面に集約する場所が無かった。ここではそれを既存データの集約として提供し、
// 今後の機能追加（議事録貼り付け・次回訪問リマインドなど）の土台にする。
import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

interface BusinessCase {
  id: string; org_name: string; client_type: string; stage: string;
  evidence: string | null; proposal_link: string | null; next_action: string | null; lead_ref: string | null;
  municipality_profile_id: string | null;
  amount: number | null; probability: number | null; expected_close_date: string | null;
  won_at: string | null; last_contact_at: string | null;
}
interface MunicipalityProfile {
  id: string; region_name: string; fit_assessment: string | null; evidence_summary: string | null;
  email_sent_at: string | null; email_reply: string | null; reply_handled_at: string | null; origin_note: string | null;
}
interface ClientLead {
  id: string; org_name: string; memo: string | null;
  email_sent_at: string | null; email_reply: string | null; reply_handled_at: string | null; origin_note: string | null;
}
interface FundingOpp {
  id: string; title: string; deadline: string | null; url: string | null; status: string;
  municipality_profile_id: string | null;
}
interface CaseEvent {
  id: string; case_id: string; event_type: string; title: string; body: string | null; occurred_at: string;
}

const EVENT_TYPE_META: Record<string, { label: string; icon: string }> = {
  meeting: { label: '打ち合わせ', icon: '🗣' },
  call: { label: '電話', icon: '📞' },
  email: { label: 'メール', icon: '✉️' },
  note: { label: 'メモ', icon: '📝' },
  milestone: { label: 'マイルストーン', icon: '🏁' },
};
const EVENT_TYPES = Object.keys(EVENT_TYPE_META);

const cardStyle: React.CSSProperties = { background: '#fff', borderRadius: 16, border: '1px solid #eee', padding: 18, marginBottom: 16 };
const labelStyle: React.CSSProperties = { fontSize: 11.5, fontWeight: 700, color: '#777', margin: '8px 0 4px', display: 'block' };
const inputStyle: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box', padding: '8px 10px', borderRadius: 8,
  border: '1.5px solid #ddd', fontSize: 13, fontFamily: 'inherit',
};
const btnStyle: React.CSSProperties = { padding: '8px 16px', borderRadius: 8, border: 'none', background: '#38ADA9', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer' };

export default function CaseDashboardPage() {
  const params = useParams();
  const caseId = params?.id as string;

  const [password, setPassword] = useState('');
  const [unlocked, setUnlocked] = useState(false);
  const [unlockError, setUnlockError] = useState('');
  const [unlocking, setUnlocking] = useState(false);

  const [item, setItem] = useState<BusinessCase | null>(null);
  const [profile, setProfile] = useState<MunicipalityProfile | null>(null);
  const [lead, setLead] = useState<ClientLead | null>(null);
  const [opps, setOpps] = useState<FundingOpp[]>([]);
  const [events, setEvents] = useState<CaseEvent[]>([]);
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
      const [casesRes, eventsRes] = await Promise.all([
        fetch('/api/admin/business-cases', { headers: authHeaders(pw) }).then(r => r.json()),
        fetch(`/api/admin/case-events?case_id=${caseId}`, { headers: authHeaders(pw) }).then(r => r.json()),
      ]);
      if (!casesRes.ok) throw new Error(casesRes.error ?? '取得に失敗しました');
      const found = (casesRes.cases ?? []).find((c: BusinessCase) => c.id === caseId) ?? null;
      setItem(found);
      if (eventsRes.ok) {
        setEvents(eventsRes.events ?? []);
        setNeedsMigration(Boolean(eventsRes.needsMigration));
      }
      if (found?.municipality_profile_id) {
        const pRes = await fetch('/api/admin/municipality-profiles', { headers: authHeaders(pw) }).then(r => r.json());
        if (pRes.ok) setProfile((pRes.profiles ?? []).find((p: MunicipalityProfile) => p.id === found.municipality_profile_id) ?? null);
        const oRes = await fetch('/api/admin/funding-opportunities', { headers: authHeaders(pw) }).then(r => r.json());
        if (oRes.ok) setOpps((oRes.opportunities ?? []).filter((o: FundingOpp) => o.municipality_profile_id === found.municipality_profile_id));
      } else if (found?.lead_ref) {
        const lRes = await fetch('/api/admin/client-leads', { headers: authHeaders(pw) }).then(r => r.json());
        if (lRes.ok) setLead((lRes.leads ?? []).find((l: ClientLead) => l.id === found.lead_ref) ?? null);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : '通信エラー');
    } finally {
      setLoading(false);
    }
  }, [caseId]);

  useEffect(() => {
    const saved = sessionStorage.getItem('admin_dashboard_password') ?? sessionStorage.getItem('hm-admin-pw');
    if (saved) tryUnlock(saved);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function tryUnlock(pw: string) {
    setUnlocking(true);
    setUnlockError('');
    try {
      const res = await fetch('/api/admin/business-cases', { headers: authHeaders(pw) });
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

  async function patchCase(fields: Partial<BusinessCase>) {
    if (!item) return;
    setItem({ ...item, ...fields });
    await fetch(`/api/admin/business-cases/${item.id}`, { method: 'PATCH', headers: jsonHeaders(), body: JSON.stringify(fields) });
  }

  async function addEvent() {
    if (!eventForm.title.trim()) return;
    setSavingEvent(true);
    try {
      const res = await fetch('/api/admin/case-events', {
        method: 'POST', headers: jsonHeaders(),
        body: JSON.stringify({ case_id: caseId, ...eventForm }),
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
    await fetch(`/api/admin/case-events/${id}`, { method: 'DELETE', headers: authHeaders() });
    await load(password);
  }

  if (!unlocked) {
    return (
      <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fafafa', padding: 16 }}>
        <form onSubmit={e => { e.preventDefault(); tryUnlock(password); }}
          style={{ background: '#fff', padding: 24, borderRadius: 16, width: '100%', maxWidth: 320, boxShadow: '0 1px 8px rgba(0,0,0,0.06)' }}>
          <p style={{ fontWeight: 800, margin: '0 0 12px' }}>📊 案件専用ダッシュボード</p>
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
  if (!item) return <p style={{ padding: 24, color: '#E74C3C' }}>{error || 'この案件が見つかりませんでした。'}</p>;

  const counterpartOrigin = profile?.origin_note ?? lead?.origin_note ?? null;
  const counterpartName = profile?.region_name ?? lead?.org_name ?? item.org_name;
  const replyText = profile?.email_reply ?? lead?.email_reply ?? null;
  const sentAt = profile?.email_sent_at ?? lead?.email_sent_at ?? null;
  const replyHandledAt = profile?.reply_handled_at ?? lead?.reply_handled_at ?? null;

  return (
    <div style={{ maxWidth: 820, margin: '0 auto', padding: '24px 16px 80px', fontFamily: 'inherit' }}>
      <p style={{ fontSize: 12, color: '#999', margin: '0 0 4px' }}>案件専用ダッシュボード（商談以降の伴走支援基盤）</p>
      <h1 style={{ margin: '0 0 6px', fontSize: 22, fontWeight: 900 }}>📊 {item.org_name}</h1>

      {/* ---- ヘッダー：案件の状態を1画面で編集 ---- */}
      <div style={cardStyle}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ padding: '4px 12px', borderRadius: 20, background: '#8E44AD18', color: '#8E44AD', fontWeight: 800, fontSize: 12 }}>{item.stage}</span>
          {item.amount != null && <span style={{ fontSize: 13, fontWeight: 700, color: '#4A69BD' }}>{item.amount.toLocaleString()}円</span>}
          {item.expected_close_date && <span style={{ fontSize: 12, color: '#999' }}>受注見込み：{item.expected_close_date}</span>}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 10 }}>
          <div>
            <label style={labelStyle}>受注確度（%）</label>
            <input type="number" min={0} max={100} defaultValue={item.probability ?? 50} style={inputStyle}
              onBlur={e => { const v = e.target.value ? Number(e.target.value) : 50; if (v !== item.probability) patchCase({ probability: v }); }} />
          </div>
          <div>
            <label style={labelStyle}>受注見込み日</label>
            <input type="date" defaultValue={item.expected_close_date ?? ''} style={inputStyle}
              onBlur={e => { if (e.target.value !== (item.expected_close_date ?? '')) patchCase({ expected_close_date: e.target.value || null }); }} />
          </div>
        </div>
        <label style={labelStyle}>次の一手（毎日カレンダーに自動反映されます）</label>
        <textarea defaultValue={item.next_action ?? ''} rows={2} style={{ ...inputStyle, resize: 'vertical', borderColor: item.next_action ? '#ddd' : '#E55039' }}
          placeholder="⚠ 次の一手が未設定です"
          onBlur={e => { if (e.target.value !== (item.next_action ?? '')) patchCase({ next_action: e.target.value }); }} />
        {!item.next_action && <p style={{ margin: '4px 0 0', fontSize: 11, color: '#E55039' }}>次の一手が空のままだと伴走が止まって見えます。埋めておいてください。</p>}
      </div>

      {/* ---- 相手の全情報 ---- */}
      <div style={cardStyle}>
        <p style={{ margin: '0 0 8px', fontWeight: 800, fontSize: 14 }}>🧭 相手の全情報：{counterpartName}</p>
        {counterpartOrigin && (
          <p style={{ margin: '0 0 8px', fontSize: 12, color: '#4A69BD', background: '#EEF1FB', padding: '6px 10px', borderRadius: 8 }}>
            💡 この営業先の由来：{counterpartOrigin}
          </p>
        )}
        {(profile?.fit_assessment || profile?.evidence_summary || lead?.memo) && (
          <p style={{ margin: '0 0 8px', fontSize: 12.5, color: '#555', whiteSpace: 'pre-wrap' }}>
            {profile?.fit_assessment || profile?.evidence_summary || lead?.memo}
          </p>
        )}
        {opps.length > 0 && (
          <div style={{ marginTop: 6 }}>
            <p style={{ margin: '0 0 4px', fontSize: 11.5, fontWeight: 700, color: '#B7791F' }}>🏛 紐づく公募</p>
            {opps.map(o => (
              <p key={o.id} style={{ margin: '2px 0', fontSize: 12, color: '#B7791F' }}>
                {o.title}{o.deadline && ` ・ 締切${o.deadline}`}{o.url && <a href={o.url} target="_blank" rel="noopener noreferrer" style={{ marginLeft: 6, color: '#38ADA9' }}>↗</a>}
              </p>
            ))}
          </div>
        )}
        {!profile && !lead && <p style={{ margin: 0, fontSize: 12, color: '#aaa' }}>台帳との紐付けがありません（手動で作成された案件です）。</p>}
      </div>

      {/* ---- やり取り履歴 ---- */}
      <div style={cardStyle}>
        <p style={{ margin: '0 0 8px', fontWeight: 800, fontSize: 14 }}>✉️ やり取り履歴</p>
        {sentAt ? (
          <p style={{ margin: '0 0 6px', fontSize: 12, color: '#27AE60' }}>✓ メール送信済み（{new Date(sentAt).toLocaleDateString('ja-JP')}）</p>
        ) : (
          <p style={{ margin: '0 0 6px', fontSize: 12, color: '#aaa' }}>送信記録なし</p>
        )}
        {replyText && (
          <div style={{ background: '#fafafa', borderRadius: 8, padding: '8px 10px', marginTop: 4 }}>
            <p style={{ margin: 0, fontSize: 11, color: '#999' }}>届いた返信{replyHandledAt ? '（対応済み）' : ''}</p>
            <p style={{ margin: '4px 0 0', fontSize: 12.5, color: '#555', whiteSpace: 'pre-wrap' }}>{replyText}</p>
          </div>
        )}
      </div>

      {/* ---- 伴走ログ（case_events） ---- */}
      <div style={cardStyle}>
        <p style={{ margin: '0 0 8px', fontWeight: 800, fontSize: 14 }}>📓 伴走ログ</p>
        {needsMigration && (
          <p style={{ margin: '0 0 10px', fontSize: 12, color: '#B7791F', background: '#FFF8E8', padding: 8, borderRadius: 8 }}>
            ⚠ 伴走ログのテーブルが未作成です。<code>supabase/migrations/20260723_add_rfp_and_origin_links.sql</code> をSQL Editorで実行してください。
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
        <input style={inputStyle} placeholder="タイトル（例：初回打ち合わせ）" value={eventForm.title}
          onChange={e => setEventForm(f => ({ ...f, title: e.target.value }))} />
        <textarea style={{ ...inputStyle, marginTop: 8, resize: 'vertical' }} rows={3} placeholder="内容・議事録メモなど"
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
