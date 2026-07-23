'use client';

// 👥 運営メンバー名簿の管理。To-Doの担当・カレンダーの予定担当者として選べる実名リスト。
// メンバーが増減してもここから追加・編集・削除するだけでよく、コードを直す必要はない。
// profile_notes：「どんな人か」を書き溜める自由記述欄。今後この記述をもとにした
// 振り分け提案（AIスキル）の材料にする想定のため、あえて項目を分けず自由記述のままにしている。
import { useCallback, useEffect, useState } from 'react';
import { Card, MigrationNotice, inputStyle } from '@/components/admin/adminShared';

export interface TeamMember {
  id: string;
  name: string;
  role: string | null;
  is_lead: boolean;
  is_active: boolean;
  sort_order: number;
  profile_notes: string | null;
}

const textareaStyle: React.CSSProperties = {
  ...inputStyle, width: '100%', minHeight: 72, resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.6,
};

export default function TeamMembersSection({ authHeaders }: { authHeaders: () => HeadersInit }) {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [migrationFile, setMigrationFile] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newRole, setNewRole] = useState('');
  const [newNotes, setNewNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftNotes, setDraftNotes] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    fetch('/api/admin/team-members', { headers: authHeaders() })
      .then(r => r.json())
      .then(d => {
        if (d.ok) {
          setMembers(d.members);
          setMigrationFile(d.needsMigration ? d.migrationFile : null);
        } else setError(d.error ?? '取得に失敗しました');
      })
      .catch(() => setError('通信エラー'))
      .finally(() => setLoading(false));
  }, [authHeaders]);

  useEffect(() => { load(); }, [load]);

  async function createMember() {
    if (!newName.trim()) return;
    setSaving(true);
    try {
      const res = await fetch('/api/admin/team-members', {
        method: 'POST', headers: authHeaders(),
        body: JSON.stringify({
          name: newName.trim(), role: newRole.trim() || undefined,
          profile_notes: newNotes.trim() || undefined, is_lead: members.length === 0,
        }),
      });
      const data = await res.json();
      if (data.ok) { setNewName(''); setNewRole(''); setNewNotes(''); setShowCreate(false); load(); }
      else setError(data.error ?? '追加に失敗しました');
    } finally {
      setSaving(false);
    }
  }

  async function update(id: string, fields: Record<string, unknown>) {
    const res = await fetch(`/api/admin/team-members/${id}`, {
      method: 'PATCH', headers: authHeaders(), body: JSON.stringify(fields),
    });
    const data = await res.json();
    if (data.ok) load(); else setError(data.error ?? '更新に失敗しました');
  }

  async function remove(id: string) {
    if (!confirm('このメンバーを削除しますか？（過去のTo-Do・予定の記録は残ります）')) return;
    const res = await fetch(`/api/admin/team-members/${id}`, { method: 'DELETE', headers: authHeaders() });
    const data = await res.json();
    if (data.ok) load(); else setError(data.error ?? '削除に失敗しました');
  }

  function startEdit(m: TeamMember) {
    setEditingId(m.id);
    setDraftNotes(m.profile_notes ?? '');
    setExpandedId(m.id);
  }

  async function saveNotes(id: string) {
    await update(id, { profile_notes: draftNotes.trim() || null });
    setEditingId(null);
  }

  if (loading) return <p style={{ color: '#999', fontSize: 12 }}>読み込み中…</p>;

  return (
    <div>
      {error && <p style={{ color: '#E74C3C', fontSize: 13 }}>{error}</p>}
      {migrationFile && <MigrationNotice title="運営メンバーのテーブルがまだ作成されていません" migrationFile={migrationFile} />}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 10 }}>
        {members.length === 0 && <p style={{ fontSize: 12, color: '#aaa' }}>まだメンバーが登録されていません。</p>}
        {members.map(m => {
          const isExpanded = expandedId === m.id;
          const isEditing = editingId === m.id;
          return (
            <Card key={m.id} style={{ padding: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, cursor: 'pointer' }}
                  onClick={() => setExpandedId(isExpanded ? null : m.id)}>
                  <span style={{
                    width: 26, height: 26, borderRadius: '50%', background: m.is_lead ? '#38ADA9' : '#ccc', color: '#fff',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, flexShrink: 0,
                  }}>{m.name.slice(0, 1)}</span>
                  <div style={{ minWidth: 0 }}>
                    <span style={{ fontSize: 13.5, fontWeight: 700 }}>{m.name}</span>
                    {m.role && <span style={{ fontSize: 11, color: '#999', marginLeft: 6 }}>{m.role}</span>}
                    {m.is_lead && <span style={{ fontSize: 10, fontWeight: 700, color: '#38ADA9', marginLeft: 6 }}>代表</span>}
                    {!m.is_active && <span style={{ fontSize: 10, fontWeight: 700, color: '#bbb', marginLeft: 6 }}>非アクティブ</span>}
                    {!m.profile_notes && <span style={{ fontSize: 10, color: '#ccc', marginLeft: 6 }}>詳細未入力</span>}
                  </div>
                  <span style={{ fontSize: 10, color: '#bbb', marginLeft: 4 }}>{isExpanded ? '▲' : '▼'}</span>
                </div>
                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                  <button onClick={() => update(m.id, { is_lead: !m.is_lead })} style={{
                    fontSize: 10.5, padding: '3px 8px', borderRadius: 12, cursor: 'pointer',
                    border: `1px solid ${m.is_lead ? '#38ADA9' : '#ddd'}`, background: '#fff', color: m.is_lead ? '#38ADA9' : '#999',
                  }}>代表</button>
                  <button onClick={() => update(m.id, { is_active: !m.is_active })} style={{
                    fontSize: 10.5, padding: '3px 8px', borderRadius: 12, cursor: 'pointer',
                    border: '1px solid #ddd', background: '#fff', color: '#999',
                  }}>{m.is_active ? '非アクティブにする' : 'アクティブに戻す'}</button>
                  <button onClick={() => remove(m.id)} style={{
                    fontSize: 10.5, padding: '3px 8px', border: 'none', background: 'none', color: '#ccc', cursor: 'pointer',
                  }}>削除</button>
                </div>
              </div>

              {isExpanded && (
                <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid #eee' }}>
                  <p style={{ fontSize: 10.5, fontWeight: 700, color: '#999', margin: '0 0 6px' }}>どんな人か（フリースペース）</p>
                  {isEditing ? (
                    <>
                      <textarea style={textareaStyle} value={draftNotes} onChange={e => setDraftNotes(e.target.value)}
                        placeholder="得意分野・性格・経歴・任せられそうな仕事など、自由に書いてください" />
                      <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                        <button onClick={() => saveNotes(m.id)} style={{
                          padding: '5px 14px', borderRadius: 8, border: 'none', background: '#38ADA9', color: '#fff',
                          fontSize: 11.5, fontWeight: 700, cursor: 'pointer',
                        }}>保存</button>
                        <button onClick={() => setEditingId(null)} style={{
                          padding: '5px 14px', borderRadius: 8, border: '1px solid #ddd', background: '#fff', color: '#888',
                          fontSize: 11.5, cursor: 'pointer',
                        }}>キャンセル</button>
                      </div>
                    </>
                  ) : (
                    <>
                      <p style={{ fontSize: 12.5, color: m.profile_notes ? '#444' : '#bbb', whiteSpace: 'pre-wrap', lineHeight: 1.7, margin: '0 0 6px' }}>
                        {m.profile_notes || 'まだ書かれていません。'}
                      </p>
                      <button onClick={() => startEdit(m)} style={{
                        padding: '4px 12px', borderRadius: 8, border: '1px solid #38ADA9', background: '#fff', color: '#38ADA9',
                        fontSize: 11, fontWeight: 700, cursor: 'pointer',
                      }}>{m.profile_notes ? '編集する' : '書く'}</button>
                    </>
                  )}
                </div>
              )}
            </Card>
          );
        })}
      </div>

      {showCreate ? (
        <Card style={{ padding: 12 }}>
          <input style={{ ...inputStyle, width: '100%', marginBottom: 6 }} value={newName}
            onChange={e => setNewName(e.target.value)} placeholder="名前（例：たかや）" />
          <input style={{ ...inputStyle, width: '100%', marginBottom: 6 }} value={newRole}
            onChange={e => setNewRole(e.target.value)} placeholder="役割（任意・例：代表 / インターン）" />
          <textarea style={{ ...textareaStyle, marginBottom: 8 }} value={newNotes}
            onChange={e => setNewNotes(e.target.value)}
            placeholder="どんな人か（任意・得意分野・性格・経歴・任せられそうな仕事など自由に）" />
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={createMember} disabled={saving || !newName.trim()} style={{
              flex: 1, padding: '8px 0', borderRadius: 8, border: 'none',
              background: '#38ADA9', color: '#fff', fontWeight: 700, fontSize: 12.5, cursor: 'pointer',
            }}>{saving ? '追加中…' : '追加する'}</button>
            <button onClick={() => setShowCreate(false)} style={{
              flex: 1, padding: '8px 0', borderRadius: 8, border: '1px solid #ddd',
              background: '#fff', color: '#888', fontSize: 12.5, cursor: 'pointer',
            }}>キャンセル</button>
          </div>
        </Card>
      ) : (
        <button onClick={() => setShowCreate(true)} style={{
          display: 'block', width: '100%', padding: '8px 0', borderRadius: 10, border: '1.5px dashed #38ADA9',
          background: '#fff', color: '#38ADA9', fontWeight: 700, fontSize: 12.5, cursor: 'pointer',
        }}>＋ メンバーを追加</button>
      )}
    </div>
  );
}
