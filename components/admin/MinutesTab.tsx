'use client';

// 議事録：打ち合わせ・商談の記録を日記のように書き溜める。page.tsx monolith分割で切り出し。
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Card, MigrationNotice, inputStyle } from '@/components/admin/adminShared';

interface MeetingMinute {
  id: string;
  entry_date: string;
  title: string | null;
  participants: string | null;
  body: string;
  created_at: string;
  updated_at: string;
}

interface MeetingMinutesSummary {
  id: string;
  summary: string;
  covers_through: string | null;
  updated_at: string | null;
}

function MinutesSummaryCard({ authHeaders }: { authHeaders: () => HeadersInit }) {
  const [summary, setSummary] = useState<MeetingMinutesSummary | null>(null);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    fetch('/api/admin/meeting-minutes/summary', { headers: authHeaders() })
      .then(r => r.json())
      .then(d => {
        if (d.ok) { setSummary(d.summary); setDraft(d.summary?.summary ?? ''); }
        else setError(d.error ?? '取得に失敗しました');
      })
      .catch(() => setError('通信エラー'))
      .finally(() => setLoading(false));
  }, [authHeaders]);

  useEffect(() => { load(); }, [load]);

  async function save() {
    if (!summary || draft === summary.summary) return;
    setSaving(true);
    try {
      const res = await fetch('/api/admin/meeting-minutes/summary', {
        method: 'PUT', headers: authHeaders(),
        body: JSON.stringify({ summary: draft, covers_through: summary.covers_through }),
      });
      const data = await res.json();
      if (data.ok) setSummary(data.summary); else setError(data.error ?? '更新に失敗しました');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return null;

  return (
    <Card style={{ marginBottom: 14, background: '#F5FBFA', border: '1px solid #38ADA9' }}>
      <p style={{ margin: '0 0 6px', fontWeight: 800, fontSize: 13, color: '#2E7D74' }}>
        🗂 議事録まとめ（直近3日＋過去分の統合）
      </p>
      <p style={{ margin: '0 0 8px', fontSize: 11, color: '#888' }}>
        このチャットで「議事録まとめて」と会長が指示した時にClaude Codeが更新します（AI APIの自動呼び出しはしません）。
        {summary?.covers_through && ` 対象期間：〜${summary.covers_through}`}
        {summary?.updated_at && ` ／最終更新：${new Date(summary.updated_at).toLocaleString('ja-JP')}`}
      </p>
      {error && <p style={{ color: '#E74C3C', fontSize: 12 }}>{error}</p>}
      <textarea
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={save}
        placeholder="まだまとめがありません。チャットで「議事録をまとめて」と伝えてください。"
        rows={6}
        style={{ ...inputStyle, width: '100%', boxSizing: 'border-box', resize: 'vertical', fontFamily: 'inherit', background: '#fff' }}
      />
      {saving && <p style={{ margin: '4px 0 0', fontSize: 10, color: '#aaa' }}>保存中…</p>}
    </Card>
  );
}

export default function MinutesTab({ authHeaders }: { authHeaders: () => HeadersInit }) {
  const [entries, setEntries] = useState<MeetingMinute[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [newDate, setNewDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [newTitle, setNewTitle] = useState('');
  const [newParticipants, setNewParticipants] = useState('');
  const [newBody, setNewBody] = useState('');
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<Record<string, { title: string; participants: string; body: string }>>({});
  const [migrationFile, setMigrationFile] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    fetch('/api/admin/meeting-minutes', { headers: authHeaders() })
      .then(r => r.json())
      .then(d => {
        if (d.ok) {
          setEntries(d.minutes);
          setMigrationFile(d.needsMigration ? d.migrationFile : null);
          const map: Record<string, { title: string; participants: string; body: string }> = {};
          for (const e of d.minutes as MeetingMinute[]) map[e.id] = { title: e.title ?? '', participants: e.participants ?? '', body: e.body ?? '' };
          setEditing(map);
        } else setError(d.error ?? '取得に失敗しました');
      })
      .catch(() => setError('通信エラー'))
      .finally(() => setLoading(false));
  }, [authHeaders]);

  useEffect(() => { load(); }, [load]);

  async function createEntry() {
    if (!newDate) return;
    setSaving(true);
    try {
      const res = await fetch('/api/admin/meeting-minutes', {
        method: 'POST', headers: authHeaders(),
        body: JSON.stringify({ entry_date: newDate, title: newTitle, participants: newParticipants, body: newBody }),
      });
      const data = await res.json();
      if (data.ok) {
        setNewTitle(''); setNewParticipants(''); setNewBody(''); setShowCreate(false); load();
      } else setError(data.error ?? '作成に失敗しました');
    } finally {
      setSaving(false);
    }
  }

  async function updateEntry(id: string, fields: Record<string, unknown>) {
    const res = await fetch(`/api/admin/meeting-minutes/${id}`, {
      method: 'PATCH', headers: authHeaders(), body: JSON.stringify(fields),
    });
    const data = await res.json();
    if (data.ok) load(); else setError(data.error ?? '更新に失敗しました');
  }

  async function deleteEntry(id: string) {
    if (!confirm('この議事録を削除しますか？')) return;
    const res = await fetch(`/api/admin/meeting-minutes/${id}`, { method: 'DELETE', headers: authHeaders() });
    const data = await res.json();
    if (data.ok) load(); else setError(data.error ?? '削除に失敗しました');
  }

  // 同じ日付の議事録を1つの日付見出しの下にまとめる（entriesは既にentry_date DESCで取得済みのため順序はそのまま保たれる）
  const groupedByDate = useMemo(() => {
    const map = new Map<string, MeetingMinute[]>();
    for (const e of entries) {
      const list = map.get(e.entry_date) ?? [];
      list.push(e);
      map.set(e.entry_date, list);
    }
    return Array.from(map.entries());
  }, [entries]);

  if (loading) return <p style={{ color: '#999' }}>読み込み中…</p>;

  return (
    <div>
      <p style={{ fontSize: 12, color: '#999', margin: '0 0 12px' }}>
        打ち合わせ・商談の内容を、日記のように日付順で書き溜めていく場所です。
      </p>

      <MinutesSummaryCard authHeaders={authHeaders} />

      {error && <p style={{ color: '#E74C3C', fontSize: 13 }}>{error}</p>}
      {migrationFile && <MigrationNotice title="議事録のテーブルがまだ作成されていません" migrationFile={migrationFile} />}

      {showCreate ? (
        <Card style={{ marginBottom: 14 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <input type="date" value={newDate} onChange={e => setNewDate(e.target.value)} style={inputStyle} />
            <input placeholder="タイトル（例：◯◯市との打ち合わせ）" value={newTitle}
              onChange={e => setNewTitle(e.target.value)} style={inputStyle} />
            <input placeholder="参加者（例：加藤、◯◯様）" value={newParticipants}
              onChange={e => setNewParticipants(e.target.value)} style={inputStyle} />
            <textarea placeholder="内容・決定事項・宿題など自由に書く" value={newBody}
              onChange={e => setNewBody(e.target.value)} rows={6}
              style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }} />
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={createEntry} disabled={saving || !newDate} style={{
                flex: 1, padding: '9px 0', borderRadius: 8, border: 'none',
                background: '#38ADA9', color: '#fff', fontWeight: 700, cursor: 'pointer',
              }}>{saving ? '記録中…' : '記録する'}</button>
              <button onClick={() => setShowCreate(false)} style={{
                flex: 1, padding: '9px 0', borderRadius: 8, border: '1px solid #ddd',
                background: '#fff', color: '#888', cursor: 'pointer',
              }}>キャンセル</button>
            </div>
          </div>
        </Card>
      ) : (
        <button onClick={() => setShowCreate(true)} style={{
          display: 'block', width: '100%', padding: '10px 0', borderRadius: 10, border: '1.5px dashed #38ADA9',
          background: '#fff', color: '#38ADA9', fontWeight: 700, fontSize: 13, cursor: 'pointer', marginBottom: 14,
        }}>＋ 新しい議事録を書く</button>
      )}

      {entries.length === 0 && <p style={{ color: '#aaa' }}>まだ議事録がありません。</p>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        {groupedByDate.map(([date, group]) => (
          <div key={date}>
            <p style={{ margin: '0 0 8px', fontWeight: 800, fontSize: 14, color: '#38ADA9' }}>
              {new Date(date + 'T00:00:00').toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' })}
              <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 700, color: '#aaa' }}>{group.length}件</span>
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {group.map(e => {
                const edit = editing[e.id] ?? { title: '', participants: '', body: '' };
                return (
                  <Card key={e.id}>
                    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                      <button onClick={() => deleteEntry(e.id)} style={{
                        padding: '4px 8px', borderRadius: 8, border: 'none', background: 'none', color: '#ccc', fontSize: 12, cursor: 'pointer',
                      }}>削除</button>
                    </div>

                    <input
                      value={edit.title}
                      onChange={ev => setEditing(prev => ({ ...prev, [e.id]: { ...edit, title: ev.target.value } }))}
                      onBlur={() => { if (edit.title !== (e.title ?? '')) updateEntry(e.id, { title: edit.title || null }); }}
                      placeholder="タイトル"
                      style={{ ...inputStyle, width: '100%', boxSizing: 'border-box', fontWeight: 700, margin: '0 0 6px' }}
                    />
                    <input
                      value={edit.participants}
                      onChange={ev => setEditing(prev => ({ ...prev, [e.id]: { ...edit, participants: ev.target.value } }))}
                      onBlur={() => { if (edit.participants !== (e.participants ?? '')) updateEntry(e.id, { participants: edit.participants || null }); }}
                      placeholder="参加者"
                      style={{ ...inputStyle, width: '100%', boxSizing: 'border-box', fontSize: 12, color: '#888', marginBottom: 6 }}
                    />
                    <textarea
                      value={edit.body}
                      onChange={ev => setEditing(prev => ({ ...prev, [e.id]: { ...edit, body: ev.target.value } }))}
                      onBlur={() => { if (edit.body !== (e.body ?? '')) updateEntry(e.id, { body: edit.body }); }}
                      placeholder="内容・決定事項・宿題など自由に書く"
                      rows={6}
                      style={{ ...inputStyle, width: '100%', boxSizing: 'border-box', resize: 'vertical', fontFamily: 'inherit' }}
                    />
                    <p style={{ margin: '4px 0 0', fontSize: 10, color: '#ccc' }}>
                      最終更新: {new Date(e.updated_at).toLocaleString('ja-JP')}（欄外をタップすると自動保存されます）
                    </p>
                  </Card>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
