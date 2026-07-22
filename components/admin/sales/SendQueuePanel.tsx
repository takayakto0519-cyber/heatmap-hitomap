'use client';

// 📤 送信キュー — 下書き・宛先確定まで終わった営業メールを、会長が1クリックで送るための画面。
// BookingRequestsPanel.tsxと同じ「AIが準備・会長が1クリックで確定」パターンを踏襲する。
// 送信自体は必ずこの画面のボタン経由（サーバー側APIが確度lowや宛先未確定を拒否する二重ガード）。
// 学校・法人（client_leads）／便り（sales_email_targets）／自治体（municipality_profiles）の
// 3ソースを横断して1つのキューにする（返信あり導線・統合フォローキューと同じ思想）。
import { useCallback, useEffect, useState } from 'react';

type Source = 'lead' | 'email_target' | 'municipality';
type Confidence = 'high' | 'medium' | 'low' | null;

interface QueueItem {
  source: Source;
  id: string;
  name: string;
  email: string | null;
  confidence: Confidence;
  sourceUrl: string | null;
  draft: string;
  sendPath: string;
}

const CONFIDENCE_BADGE: Record<'high' | 'medium' | 'low', { label: string; color: string }> = {
  high: { label: '🟢 確度高', color: '#27AE60' },
  medium: { label: '🟡 要確認', color: '#E5A139' },
  low: { label: '🔴 フォームのみ', color: '#E74C3C' },
};

const cardStyle: React.CSSProperties = { background: '#fff', borderRadius: 12, padding: 16, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' };

function subjectOf(draft: string): string {
  const line = draft.split('\n').find((l) => /^件名[：:]/.test(l.trim()));
  return line ? line.trim().replace(/^件名[：:]\s*/, '') : '（件名未設定）';
}

export default function SendQueuePanel({ authHeaders }: { authHeaders: () => HeadersInit }) {
  const [items, setItems] = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [sentIds, setSentIds] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [leadsRes, emailsRes, muniRes] = await Promise.all([
        fetch('/api/admin/client-leads', { headers: authHeaders() }).then((r) => r.json()),
        fetch('/api/admin/sales-email-targets', { headers: authHeaders() }).then((r) => r.json()),
        fetch('/api/admin/municipality-profiles', { headers: authHeaders() }).then((r) => r.json()).catch(() => ({ ok: false })),
      ]);

      const queue: QueueItem[] = [];
      if (leadsRes.ok) {
        for (const l of leadsRes.leads ?? []) {
          if (l.email_draft?.trim() && !l.email_sent_at) {
            queue.push({
              source: 'lead', id: l.id, name: l.org_name, email: l.email,
              confidence: l.contact_email_confidence ?? null, sourceUrl: l.contact_email_source_url ?? null,
              draft: l.email_draft, sendPath: `/api/admin/client-leads/${l.id}/send`,
            });
          }
        }
      }
      if (emailsRes.ok) {
        for (const e of emailsRes.targets ?? []) {
          if (e.email_draft?.trim() && !e.sent && !e.email_sent_at) {
            queue.push({
              source: 'email_target', id: e.id, name: e.company, email: e.email,
              confidence: e.contact_email_confidence ?? null, sourceUrl: e.contact_email_source_url ?? null,
              draft: e.email_draft, sendPath: `/api/admin/sales-email-targets/${e.id}/send`,
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
              draft: p.email_draft, sendPath: `/api/admin/municipality-profiles/${p.id}/send`,
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

  async function send(item: QueueItem) {
    if (!window.confirm(`${item.name} 様（${item.email}）へ、このメールを送信します。取り消せません。よろしいですか？`)) return;
    setBusyId(item.id);
    setError('');
    try {
      const res = await fetch(item.sendPath, { method: 'POST', headers: authHeaders() });
      const data = await res.json();
      if (data.ok) {
        setSentIds((prev) => new Set(prev).add(item.id));
        setItems((prev) => prev.filter((i) => i.id !== item.id));
      } else {
        setError(data.error ?? '送信に失敗しました');
      }
    } catch {
      setError('通信エラー');
    } finally {
      setBusyId(null);
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
        確度が🔴の宛先は誤送信を防ぐため送信できません。まず宛先を確認して確度を上げてください。
      </p>
      {error && <p style={{ color: '#E74C3C', fontSize: 12, margin: '0 0 10px' }}>{error}</p>}
      {sentIds.size > 0 && (
        <p style={{ fontSize: 12, color: '#27AE60', fontWeight: 700, margin: '0 0 10px' }}>✓ {sentIds.size}件送信しました</p>
      )}

      {items.length === 0 ? (
        <p style={{ fontSize: 12, color: '#999', margin: 0 }}>送信待ちの下書きはありません。</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {items.map((item) => {
            const badge = item.confidence ? CONFIDENCE_BADGE[item.confidence] : null;
            const canSend = Boolean(item.email) && (item.confidence === 'high' || item.confidence === 'medium');
            const expanded = expandedId === item.id;
            return (
              <div key={`${item.source}-${item.id}`} style={{ padding: '10px 12px', borderRadius: 10, background: '#F4F6F5' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                  <div style={{ minWidth: 0 }}>
                    <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#222' }}>{item.name}</p>
                    <p style={{ margin: '2px 0 0', fontSize: 11.5, color: '#666' }}>{subjectOf(item.draft)}</p>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 4, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 11.5, color: '#555' }}>{item.email ?? '（宛先未確定）'}</span>
                      {badge && <span style={{ fontSize: 10.5, fontWeight: 700, color: badge.color }}>{badge.label}</span>}
                      {item.sourceUrl && (
                        <a href={item.sourceUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: 10.5, color: '#38ADA9' }}>出典 ↗</a>
                      )}
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0 }}>
                    <button onClick={() => setExpandedId(expanded ? null : item.id)} style={{
                      padding: '4px 10px', borderRadius: 8, border: '1px solid #ddd', background: '#fff', color: '#666', fontSize: 11, cursor: 'pointer',
                    }}>{expanded ? '閉じる' : '本文を見る'}</button>
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
      )}
    </div>
  );
}
