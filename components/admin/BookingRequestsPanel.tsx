'use client';

// 日程調整ページ（/schedule、公開・汎用）から届いた予約リクエストの確定/却下/キャンセル。
// 訪問者は候補を3件以上出しており、会長はその中から1つを選んで「確定する」を押す
// （急な予定変更があっても、確定前なら別の候補に切り替えられる）。
// 確定した瞬間だけ実際にGoogleカレンダーへ書き込まれる。
// 却下・キャンセル時は申込者へメールで通知する（gmail.sendスコープ、app/api経由）。
import { useCallback, useEffect, useState } from 'react';

interface CandidateSlot { start: string; end: string }
interface BookingRequest {
  id: string; name: string; email: string; company: string | null; purpose: string | null;
  duration_minutes: number;
  requested_start: string | null; requested_end: string | null; // 確定するまではNULL
  candidate_slots: CandidateSlot[];
  status: 'pending' | 'confirmed' | 'declined' | 'cancelled'; calendar_event_id: string | null;
  created_at: string; responded_at: string | null;
}
interface TeamMember { id: string; name: string; is_lead: boolean; is_active: boolean }

const cardStyle: React.CSSProperties = { background: '#fff', borderRadius: 12, padding: 16, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' };

const STATUS_LABEL: Record<string, string> = {
  confirmed: '✓ 確定済み', declined: '却下済み', cancelled: 'キャンセル済み',
};
const STATUS_COLOR: Record<string, string> = {
  confirmed: '#27AE60', declined: '#999', cancelled: '#E67E22',
};

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo', month: 'numeric', day: 'numeric', weekday: 'short', hour: '2-digit', minute: '2-digit' });
}

export default function BookingRequestsPanel({ authHeaders }: { authHeaders: () => HeadersInit }) {
  const [requests, setRequests] = useState<BookingRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [showResolved, setShowResolved] = useState(false);
  // 確定した直後だけ、その回のGoogleカレンダーイベントへのリンクを見せる（id→link）
  const [confirmedLinks, setConfirmedLinks] = useState<Record<string, string>>({});
  // 未対応リクエストごとに、会長が候補の中から選んでいる1件（id→候補のstart）。
  // 以前はここに「最も早い候補」を自動選択していたが、選び直さずそのまま確定すると
  // 意図と違う時間で確定してしまう事故につながっていたため、必ず手動で選ばせる（自動選択なし）。
  const [chosenByRequest, setChosenByRequest] = useState<Record<string, string>>({});
  // 未対応リクエストごとに、確定時にカレンダーへ付ける担当者名（id→team_membersのname）
  const [assigneeByRequest, setAssigneeByRequest] = useState<Record<string, string>>({});
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/admin/booking-requests', { headers: authHeaders() });
      const data = await res.json();
      if (data.ok) {
        const list: BookingRequest[] = data.requests ?? [];
        setRequests(list);
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

  useEffect(() => {
    fetch('/api/admin/team-members', { headers: authHeaders() })
      .then(r => r.json())
      .then(d => { if (d.ok) setTeamMembers((d.members as TeamMember[]).filter(m => m.is_active)); })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function respond(id: string, action: 'confirm' | 'decline' | 'cancel') {
    if (action === 'cancel' && !window.confirm('確定済みの予定をキャンセルします。Googleカレンダーから削除され、申込者にキャンセルメールが送られます。よろしいですか？')) {
      return;
    }
    setBusyId(id);
    setError('');
    try {
      const body: { action: string; chosen_start?: string; assignee?: string } = { action };
      if (action === 'confirm') {
        body.chosen_start = chosenByRequest[id];
        if (assigneeByRequest[id]) body.assignee = assigneeByRequest[id];
      }
      const res = await fetch(`/api/admin/booking-requests/${id}`, {
        method: 'PATCH',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.ok) {
        if (action === 'confirm' && data.calendarEventLink) {
          setConfirmedLinks(prev => ({ ...prev, [id]: data.calendarEventLink }));
        }
        await load();
      } else {
        setError(data.error ?? '処理に失敗しました');
      }
    } catch {
      setError('通信エラー');
    } finally {
      setBusyId(null);
    }
  }

  const pending = requests.filter((r) => r.status === 'pending');
  const resolved = requests.filter((r) => r.status !== 'pending');

  if (loading) return <p style={{ fontSize: 13, color: '#999' }}>読み込み中…</p>;

  return (
    <div style={cardStyle}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <p style={{ margin: 0, fontWeight: 800, fontSize: 14 }}>📅 日程調整リクエスト</p>
        {pending.length > 0 && (
          <span style={{ fontSize: 10, fontWeight: 700, color: '#E67E22', background: '#FFF3DC', padding: '2px 8px', borderRadius: 20 }}>{pending.length}件</span>
        )}
      </div>
      <p style={{ margin: '0 0 12px', fontSize: 11, color: '#999' }}>
        <a href="/schedule" target="_blank" rel="noopener noreferrer" style={{ color: '#38ADA9' }}>/schedule ↗</a> から届いた予約希望です。候補（3件以上）の中から1つを選んで「確定する」を押した時だけGoogleカレンダーに書き込まれます（会議室はGoogle Meet固定リンクを自動付与）。却下・キャンセル時は申込者にメールで通知します。
      </p>
      {error && <p style={{ color: '#E74C3C', fontSize: 12, margin: '0 0 10px' }}>{error}</p>}

      {pending.length === 0 ? (
        <p style={{ fontSize: 12, color: '#999', margin: 0 }}>未対応のリクエストはありません。</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {pending.map((r) => {
            const sortedCandidates = [...(r.candidate_slots ?? [])].sort((a, b) => a.start.localeCompare(b.start));
            const chosen = chosenByRequest[r.id];
            return (
              <div key={r.id} style={{ padding: '10px 12px', borderRadius: 10, background: '#F4F6F5' }}>
                <p style={{ margin: '0 0 6px', fontSize: 12, color: '#555' }}>
                  {r.name}様（{r.email}）{r.company ? ` ・ ${r.company}` : ''} ・ {r.duration_minutes}分
                </p>
                {r.purpose && <p style={{ margin: '0 0 6px', fontSize: 12, color: '#888' }}>{r.purpose}</p>}
                <p style={{ margin: '0 0 4px', fontSize: 11, fontWeight: 700, color: '#999' }}>候補（{sortedCandidates.length}件）から確定する日時を選ぶ：</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 8 }}>
                  {sortedCandidates.map((c) => {
                    const isChosen = chosen === c.start;
                    return (
                      <label key={c.start} style={{
                        display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', borderRadius: 8, cursor: 'pointer',
                        background: isChosen ? '#DFF3F1' : '#fff', border: isChosen ? '1.5px solid #38ADA9' : '1px solid #e5e5e5',
                      }}>
                        <input type="radio" name={`chosen-${r.id}`} checked={isChosen}
                          onChange={() => setChosenByRequest((prev) => ({ ...prev, [r.id]: c.start }))} />
                        <span style={{ fontSize: 13, fontWeight: isChosen ? 700 : 500, color: '#222' }}>{formatDateTime(c.start)}〜</span>
                      </label>
                    );
                  })}
                </div>
                {teamMembers.length > 0 && (
                  <div style={{ marginBottom: 8 }}>
                    <label style={{ fontSize: 11, fontWeight: 700, color: '#999' }}>
                      担当者（カレンダーの予定タイトルに付きます）：{' '}
                      <select value={assigneeByRequest[r.id] ?? ''} onChange={(e) => setAssigneeByRequest((prev) => ({ ...prev, [r.id]: e.target.value }))}
                        style={{ fontSize: 12, padding: '3px 6px', borderRadius: 6, border: '1px solid #ddd' }}>
                        <option value="">未指定</option>
                        {teamMembers.map((m) => (
                          <option key={m.id} value={m.name}>{m.name}{m.is_lead ? '（代表）' : ''}</option>
                        ))}
                      </select>
                    </label>
                  </div>
                )}
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => respond(r.id, 'confirm')} disabled={busyId === r.id || !chosen} style={{
                    padding: '6px 14px', borderRadius: 8, border: 'none', background: '#38ADA9', color: '#fff',
                    fontWeight: 700, fontSize: 12, cursor: busyId === r.id ? 'wait' : 'pointer', opacity: chosen ? 1 : 0.5,
                  }}>{busyId === r.id ? '処理中…' : 'この日時で確定する'}</button>
                  <button onClick={() => respond(r.id, 'decline')} disabled={busyId === r.id} style={{
                    padding: '6px 14px', borderRadius: 8, border: '1px solid #ddd', background: '#fff', color: '#888',
                    fontWeight: 700, fontSize: 12, cursor: busyId === r.id ? 'wait' : 'pointer',
                  }}>却下</button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {resolved.length > 0 && (
        <div style={{ marginTop: 14 }}>
          <button onClick={() => setShowResolved((v) => !v)} style={{
            background: 'none', border: 'none', color: '#999', fontSize: 11, fontWeight: 700, cursor: 'pointer', padding: 0,
          }}>{showResolved ? '▴ 対応済みを隠す' : `▾ 対応済み（${resolved.length}件）を見る`}</button>
          {showResolved && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
              {resolved.map((r) => (
                <div key={r.id} style={{ padding: '8px 12px', borderRadius: 8, background: '#fafafa', opacity: r.status === 'confirmed' ? 1 : 0.75 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 12, color: '#666' }}>{r.requested_start ? formatDateTime(r.requested_start) : '（候補未確定）'} ・ {r.name}様</span>
                    <span style={{ fontSize: 11, fontWeight: 700, color: STATUS_COLOR[r.status] ?? '#999' }}>
                      {STATUS_LABEL[r.status] ?? r.status}
                    </span>
                  </div>
                  {r.status === 'confirmed' && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 6, flexWrap: 'wrap' }}>
                      {confirmedLinks[r.id] && (
                        <a href={confirmedLinks[r.id]} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, color: '#38ADA9' }}>
                          📅 Googleカレンダーで見る ↗
                        </a>
                      )}
                      <button onClick={() => respond(r.id, 'cancel')} disabled={busyId === r.id} style={{
                        fontSize: 11, fontWeight: 700, color: '#E67E22', background: 'none', border: '1px solid #E67E22',
                        borderRadius: 999, padding: '2px 10px', cursor: busyId === r.id ? 'wait' : 'pointer',
                      }}>{busyId === r.id ? '処理中…' : 'キャンセルする'}</button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
