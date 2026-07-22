'use client';

// 📁 経営資料ボード：CLAUDE.md憲法の組織フォルダ（01_経営幹部_Executive〜06_実行待機_Approval）に
// Markdownファイルとして埋もれさせていた戦略メモ・提案書・対外メール下書きを、運営ダッシュボード上で
// 一覧・ステータス管理するための受信トレイ。既存の strategy_proposals テーブルをそのまま流用し
// （マイグレーション追加不要）、category にフォルダ名そのものを入れて区別する。
// 登録・更新は会長がチャットで依頼した時にClaude Codeが書き込むほか、この画面から会長が直接追加もできる。
// ローカルの06_実行待機_Approval等のフォルダには重複保存しない（このボードが正の置き場所）。
import { useCallback, useEffect, useState } from 'react';
import { Card, MigrationNotice, inputStyle } from '@/components/admin/adminShared';

interface OrgDoc {
  id: string;
  category: string;
  source_skill: string | null;
  title: string;
  body: string;
  status: string;
  created_at: string;
  updated_at: string;
}

const FOLDERS: { key: string; label: string; icon: string }[] = [
  { key: '01_経営幹部_Executive', label: '経営幹部', icon: '👑' },
  { key: '02_秘書_Secretary', label: '秘書', icon: '🗂️' },
  { key: '03_マーケティング_Marketing', label: 'マーケティング', icon: '📣' },
  { key: '04_人事クライアント管理_HR_Client', label: '人事・クライアント管理', icon: '🤝' },
  { key: '05_広報コンテンツ_PR_Content', label: '広報コンテンツ', icon: '🦊' },
  { key: '06_実行待機_Approval', label: '実行待機（要承認）', icon: '✅' },
];

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  draft: { label: '📝 下書き', color: '#999' },
  reviewing: { label: '🔍 検討中', color: '#F6B93B' },
  approved: { label: '✅ 承認済み', color: '#38ADA9' },
  sent: { label: '📤 提出・送信済み', color: '#4A69BD' },
  archived: { label: '📦 保管', color: '#ccc' },
};

export default function OrgDocsTab({ authHeaders }: { authHeaders: () => HeadersInit }) {
  const [docs, setDocs] = useState<OrgDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [migrationFile, setMigrationFile] = useState<string | null>(null);
  const [folderFilter, setFolderFilter] = useState<string>(FOLDERS[FOLDERS.length - 1].key);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ category: folderFilter, title: '', body: '' });
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    fetch('/api/admin/strategy-proposals', { headers: authHeaders() })
      .then(r => r.json())
      .then(d => {
        if (d.ok) {
          const folderKeys = new Set(FOLDERS.map(f => f.key));
          setDocs((d.proposals as OrgDoc[]).filter(p => folderKeys.has(p.category)));
          setMigrationFile(d.needsMigration ? d.migrationFile : null);
        }
        else setError(d.error ?? '取得に失敗しました');
      })
      .catch(() => setError('通信エラー'))
      .finally(() => setLoading(false));
  }, [authHeaders]);

  useEffect(() => { load(); }, [load]);

  async function createDoc() {
    if (!form.title.trim()) return;
    setSaving(true);
    try {
      const res = await fetch('/api/admin/strategy-proposals', {
        method: 'POST', headers: authHeaders(),
        body: JSON.stringify({ category: form.category, title: form.title.trim(), body: form.body, status: 'draft' }),
      });
      const data = await res.json();
      if (!data.ok) { setError(data.error ?? '作成に失敗しました'); return; }
      setForm({ category: folderFilter, title: '', body: '' });
      setShowForm(false);
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function updateDoc(id: string, fields: Record<string, unknown>) {
    const res = await fetch(`/api/admin/strategy-proposals/${id}`, {
      method: 'PATCH', headers: authHeaders(), body: JSON.stringify(fields),
    });
    const data = await res.json();
    if (data.ok) load(); else setError(data.error ?? '更新に失敗しました');
  }

  async function deleteDoc(id: string) {
    if (!confirm('この資料を削除しますか？')) return;
    const res = await fetch(`/api/admin/strategy-proposals/${id}`, { method: 'DELETE', headers: authHeaders() });
    const data = await res.json();
    if (data.ok) load(); else setError(data.error ?? '削除に失敗しました');
  }

  if (loading) return <p style={{ color: '#999' }}>読み込み中…</p>;

  const visibleDocs = docs.filter(d => d.category === folderFilter);

  return (
    <div>
      <p style={{ fontSize: 12, color: '#999', margin: '0 0 12px' }}>
        戦略メモ・提案書・対外メール下書きをフォルダ（01〜06）ごとに一覧します。ローカルの同名フォルダには
        重複保存しません——ここが正の置き場所です。
      </p>
      {error && <p style={{ color: '#E74C3C', fontSize: 13 }}>{error}</p>}
      {migrationFile && <MigrationNotice title="経営資料ボードのテーブルがまだ作成されていません" migrationFile={migrationFile} />}

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', margin: '0 0 14px' }}>
        {FOLDERS.map(f => {
          const count = docs.filter(d => d.category === f.key).length;
          const active = folderFilter === f.key;
          return (
            <button key={f.key} onClick={() => setFolderFilter(f.key)} style={{
              padding: '7px 14px', borderRadius: 16, border: 'none', cursor: 'pointer', fontSize: 12.5, fontWeight: 700,
              background: active ? '#38ADA9' : '#fff', color: active ? '#fff' : '#666',
              boxShadow: active ? 'none' : '0 1px 3px rgba(0,0,0,0.08)',
            }}>{f.icon} {f.label}（{count}）</button>
          );
        })}
      </div>

      {showForm ? (
        <Card style={{ marginBottom: 14 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} style={inputStyle}>
              {FOLDERS.map(f => <option key={f.key} value={f.key}>{f.icon} {f.label}</option>)}
            </select>
            <input placeholder="タイトル（例：戦略メモ_〇〇_20260722）" value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))} style={inputStyle} />
            <textarea placeholder="本文（Markdown可）" value={form.body} rows={10}
              onChange={e => setForm(f => ({ ...f, body: e.target.value }))}
              style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }} />
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={createDoc} disabled={saving || !form.title.trim()} style={{
                flex: 1, padding: '9px 0', borderRadius: 8, border: 'none',
                background: '#38ADA9', color: '#fff', fontWeight: 700, cursor: 'pointer',
              }}>{saving ? '保存中…' : '保存する'}</button>
              <button onClick={() => setShowForm(false)} style={{
                flex: 1, padding: '9px 0', borderRadius: 8, border: '1px solid #ddd',
                background: '#fff', color: '#888', cursor: 'pointer',
              }}>キャンセル</button>
            </div>
          </div>
        </Card>
      ) : (
        <button onClick={() => { setForm(f => ({ ...f, category: folderFilter })); setShowForm(true); }} style={{
          display: 'block', width: '100%', padding: '10px 0', borderRadius: 10, border: '1.5px dashed #38ADA9',
          background: '#fff', color: '#38ADA9', fontWeight: 700, fontSize: 13, cursor: 'pointer', marginBottom: 14,
        }}>＋ 新しい資料を書く</button>
      )}

      {visibleDocs.length === 0 && <p style={{ color: '#aaa' }}>このフォルダにはまだ資料がありません。</p>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {visibleDocs.map(d => {
          const statusInfo = STATUS_LABELS[d.status] ?? STATUS_LABELS.draft;
          const isOpen = !!expanded[d.id];
          return (
            <Card key={d.id}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                <p style={{ margin: 0, fontWeight: 800, fontSize: 15 }}>{d.title}</p>
                <button onClick={() => deleteDoc(d.id)} style={{
                  padding: '4px 8px', borderRadius: 8, border: 'none', background: 'none', color: '#ccc', fontSize: 12, cursor: 'pointer',
                }}>削除</button>
              </div>

              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', margin: '8px 0' }}>
                {Object.entries(STATUS_LABELS).map(([key, info]) => (
                  <button key={key} onClick={() => updateDoc(d.id, { status: key })} style={{
                    padding: '4px 10px', borderRadius: 16, fontSize: 11, cursor: 'pointer',
                    border: `1.5px solid ${d.status === key ? info.color : '#ddd'}`,
                    background: d.status === key ? info.color + '18' : '#fff',
                    color: d.status === key ? info.color : '#999', fontWeight: d.status === key ? 700 : 400,
                  }}>{info.label}</button>
                ))}
              </div>

              <button onClick={() => setExpanded(prev => ({ ...prev, [d.id]: !prev[d.id] }))} style={{
                fontSize: 12, color: '#38ADA9', background: 'none', border: 'none', cursor: 'pointer', padding: 0,
              }}>{isOpen ? '▲ 本文を閉じる' : '▼ 本文を開く'}</button>

              {isOpen && (
                <pre style={{
                  ...inputStyle, width: '100%', boxSizing: 'border-box', whiteSpace: 'pre-wrap',
                  fontFamily: 'inherit', margin: '8px 0 0', maxHeight: 500, overflowY: 'auto',
                }}>{d.body}</pre>
              )}

              <p style={{ margin: '8px 0 0', fontSize: 10, color: '#ccc' }}>
                登録: {new Date(d.created_at).toLocaleString('ja-JP')}
                {d.updated_at !== d.created_at && `／更新: ${new Date(d.updated_at).toLocaleString('ja-JP')}`}
              </p>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
