'use client';

// ビジネスモデル案：新しい事業案を書き溜め、検証状況を追う。page.tsx monolith分割で切り出し。
import { useCallback, useEffect, useState } from 'react';
import { Card, MigrationNotice, inputStyle } from '@/components/admin/adminShared';
import { IdeaReportEditor } from '@/components/admin/IdeaReportEditor';

// 案件ごとに折りたたみ、開いた案件だけ詳細（メモ・ロードマップ）を表示することで
// 縦スクロール量を大きく減らす。ヘッダー行はタイトル・ステータス・件数目安のみ。
function CollapsibleIdeaCard({
  idea, open, onToggle, children, accentBorder,
}: {
  idea: { title: string; status: string; report_md: string | null };
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  accentBorder?: string;
}) {
  const statusInfo = BIZMODEL_STATUS_LABELS[idea.status] ?? BIZMODEL_STATUS_LABELS.idea;
  const hasRoadmap = !!(idea.report_md && idea.report_md.trim());
  return (
    <div style={{ background: '#fff', border: `1.5px solid ${accentBorder ?? '#eee'}`, borderRadius: 14, overflow: 'hidden' }}>
      <button onClick={onToggle} style={{
        width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8,
        padding: '12px 16px', border: 'none', background: 'none', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit',
      }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
          <span style={{ fontSize: 13, color: '#bbb', flexShrink: 0 }}>{open ? '▼' : '▶'}</span>
          <span style={{ fontWeight: 800, fontSize: 14.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{idea.title}</span>
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          {hasRoadmap && <span style={{ fontSize: 10, color: '#38ADA9', fontWeight: 700 }}>🗺 ロードマップあり</span>}
          <span style={{ fontSize: 11, fontWeight: 700, color: statusInfo.color, whiteSpace: 'nowrap' }}>{statusInfo.label}</span>
        </span>
      </button>
      {open && <div style={{ padding: '0 16px 16px' }}>{children}</div>}
    </div>
  );
}

interface BizModelIdea {
  id: string;
  title: string;
  memo: string | null;
  status: string;
  contest: string | null;
  idea_no: number | null;
  report_md: string | null;
  created_at: string;
  updated_at: string;
}

const CONTEST_LABELS: Record<string, string> = {
  makichalle2026: '🍵 まきチャレ2026（牧之原市チャレンジビジネスコンテスト）',
};
const IDEA_NO_MARKS = ['①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧', '⑨'];

const BIZMODEL_STATUS_LABELS: Record<string, { label: string; color: string }> = {
  idea: { label: '💡 アイデア', color: '#8E44AD' },
  validating: { label: '🔍 検証中', color: '#F6B93B' },
  building: { label: '🛠 構築中', color: '#4A69BD' },
  live: { label: '🚀 稼働中', color: '#38ADA9' },
  shelved: { label: '📦 保留', color: '#aaa' },
};

export default function BizModelIdeasTab({ authHeaders }: { authHeaders: () => HeadersInit }) {
  const [ideas, setIdeas] = useState<BizModelIdea[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [saving, setSaving] = useState(false);
  const [editingMemo, setEditingMemo] = useState<Record<string, string>>({});
  const [editingReport, setEditingReport] = useState<Record<string, string>>({});
  const [openIds, setOpenIds] = useState<Record<string, boolean>>({});
  const [migrationFile, setMigrationFile] = useState<string | null>(null);

  function toggleOpen(id: string) {
    setOpenIds(prev => ({ ...prev, [id]: !prev[id] }));
  }

  const load = useCallback(() => {
    setLoading(true);
    fetch('/api/admin/biz-model-ideas', { headers: authHeaders() })
      .then(r => r.json())
      .then(d => {
        if (d.ok) {
          setIdeas(d.ideas);
          setMigrationFile(d.needsMigration ? d.migrationFile : null);
          const memoMap: Record<string, string> = {};
          const reportMap: Record<string, string> = {};
          for (const i of d.ideas as BizModelIdea[]) {
            memoMap[i.id] = i.memo ?? '';
            reportMap[i.id] = i.report_md ?? '';
          }
          setEditingMemo(memoMap);
          setEditingReport(reportMap);
        } else setError(d.error ?? '取得に失敗しました');
      })
      .catch(() => setError('通信エラー'))
      .finally(() => setLoading(false));
  }, [authHeaders]);

  useEffect(() => { load(); }, [load]);

  async function createIdea() {
    if (!newTitle.trim()) return;
    setSaving(true);
    try {
      const res = await fetch('/api/admin/biz-model-ideas', {
        method: 'POST', headers: authHeaders(),
        body: JSON.stringify({ title: newTitle.trim() }),
      });
      const data = await res.json();
      if (data.ok) { setNewTitle(''); setShowCreate(false); load(); }
      else setError(data.error ?? '作成に失敗しました');
    } finally {
      setSaving(false);
    }
  }

  async function updateIdea(id: string, fields: Record<string, unknown>) {
    const res = await fetch(`/api/admin/biz-model-ideas/${id}`, {
      method: 'PATCH', headers: authHeaders(), body: JSON.stringify(fields),
    });
    const data = await res.json();
    if (data.ok) load(); else setError(data.error ?? '更新に失敗しました');
  }

  async function deleteIdea(id: string) {
    if (!confirm('このビジネスモデル案を削除しますか？')) return;
    const res = await fetch(`/api/admin/biz-model-ideas/${id}`, { method: 'DELETE', headers: authHeaders() });
    const data = await res.json();
    if (data.ok) load(); else setError(data.error ?? '削除に失敗しました');
  }

  if (loading) return <p style={{ color: '#999' }}>読み込み中…</p>;

  return (
    <div>
      <p style={{ fontSize: 12, color: '#999', margin: '0 0 12px' }}>
        次の商品・事業の種になりそうな案をここに書き溜め、検証状況を追っていくための一覧です。
      </p>
      {error && <p style={{ color: '#E74C3C', fontSize: 13 }}>{error}</p>}
      {migrationFile && <MigrationNotice title="ビジネスモデル案のテーブルがまだ作成されていません" migrationFile={migrationFile} />}

      {showCreate ? (
        <Card style={{ marginBottom: 14 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <input placeholder="事業案の名前（例：導入キットの外販パッケージ化）" value={newTitle}
              onChange={e => setNewTitle(e.target.value)} style={inputStyle} />
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={createIdea} disabled={saving || !newTitle.trim()} style={{
                flex: 1, padding: '9px 0', borderRadius: 8, border: 'none',
                background: '#38ADA9', color: '#fff', fontWeight: 700, cursor: 'pointer',
              }}>{saving ? '作成中…' : '追加する'}</button>
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
        }}>＋ 新しいビジネスモデル案を追加</button>
      )}

      {(() => {
        const contestGroups = new Map<string, BizModelIdea[]>();
        for (const i of ideas) {
          if (!i.contest) continue;
          if (!contestGroups.has(i.contest)) contestGroups.set(i.contest, []);
          contestGroups.get(i.contest)!.push(i);
        }
        for (const list of contestGroups.values()) list.sort((a, b) => (a.idea_no ?? 99) - (b.idea_no ?? 99));
        if (contestGroups.size === 0) return null;
        return Array.from(contestGroups.entries()).map(([contest, list]) => (
          <div key={contest} style={{ marginBottom: 24 }}>
            <p style={{ fontWeight: 800, fontSize: 14, margin: '0 0 10px' }}>
              {CONTEST_LABELS[contest] ?? `📌 ${contest}`}
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {list.map(i => (
                <CollapsibleIdeaCard key={i.id} idea={i} open={!!openIds[i.id]} onToggle={() => toggleOpen(i.id)} accentBorder="#FDEBD0">
                  <IdeaReportEditor
                    idea={i}
                    saving={saving}
                    hideTitle
                    onSave={fields => updateIdea(i.id, fields)}
                  />
                </CollapsibleIdeaCard>
              ))}
            </div>
          </div>
        ));
      })()}

      <p style={{ fontWeight: 800, fontSize: 14, margin: '4px 0 8px' }}>💡 その他の事業案</p>
      {ideas.filter(i => !i.contest).length === 0 && <p style={{ color: '#aaa' }}>まだ事業案がありません。</p>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {ideas.filter(i => !i.contest).map(i => (
          <CollapsibleIdeaCard key={i.id} idea={i} open={!!openIds[i.id]} onToggle={() => toggleOpen(i.id)}>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
              <button onClick={() => deleteIdea(i.id)} style={{
                padding: '4px 8px', borderRadius: 8, border: 'none', background: 'none', color: '#ccc', fontSize: 12, cursor: 'pointer',
              }}>削除</button>
            </div>
            {i.report_md && i.report_md.trim() ? (
              <IdeaReportEditor
                idea={i}
                saving={saving}
                hideTitle
                onSave={fields => updateIdea(i.id, fields)}
              />
            ) : (
              <>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', margin: '0 0 8px' }}>
                  {Object.entries(BIZMODEL_STATUS_LABELS).map(([key, info]) => (
                    <button key={key} onClick={() => updateIdea(i.id, { status: key })} style={{
                      padding: '4px 10px', borderRadius: 16, fontSize: 11, cursor: 'pointer',
                      border: `1.5px solid ${i.status === key ? info.color : '#ddd'}`,
                      background: i.status === key ? info.color + '18' : '#fff',
                      color: i.status === key ? info.color : '#999', fontWeight: i.status === key ? 700 : 400,
                    }}>{info.label}</button>
                  ))}
                </div>

                <textarea
                  value={editingMemo[i.id] ?? ''}
                  onChange={e => setEditingMemo(prev => ({ ...prev, [i.id]: e.target.value }))}
                  onBlur={() => { if ((editingMemo[i.id] ?? '') !== (i.memo ?? '')) updateIdea(i.id, { memo: editingMemo[i.id] || null }); }}
                  placeholder="事業案のメモ（誰向け・収益モデル・必要なもの・検証方法など自由に）"
                  rows={4}
                  style={{ ...inputStyle, width: '100%', boxSizing: 'border-box', resize: 'vertical', fontFamily: 'inherit' }}
                />
              </>
            )}
            <p style={{ margin: '8px 0 0', fontSize: 10, color: '#ccc' }}>
              最終更新: {new Date(i.updated_at).toLocaleString('ja-JP')}（欄外をタップすると自動保存されます）
            </p>
          </CollapsibleIdeaCard>
        ))}
      </div>
    </div>
  );
}

