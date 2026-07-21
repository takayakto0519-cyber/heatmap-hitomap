'use client';

// 事業案（biz_model_ideas）1件を、セクションごとに読みやすく表示・編集するための共通コンポーネント。
// 非エンジニアでも迷わないように「読む」がデフォルトで、セクション単位で「編集する」を押すと
// そのセクションだけテキストエリアに変わる。生のMarkdownをまとめて触る必要がないようにする。
import { useState } from 'react';
import { MarkdownLite, splitTopLevelSections } from '@/lib/markdownLite';

export interface BizIdea {
  id: string;
  title: string;
  memo: string | null;
  report_md: string | null;
  status: string;
  updated_at: string;
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  idea: { label: '💡 アイデア', color: '#8E44AD' },
  validating: { label: '🔍 検証中', color: '#F6B93B' },
  building: { label: '🛠 肉付け中', color: '#4A69BD' },
  live: { label: '✅ 提出準備OK', color: '#38ADA9' },
  shelved: { label: '📦 保留', color: '#aaa' },
};

export function IdeaReportEditor({
  idea, onSave, saving, hideTitle,
}: {
  idea: BizIdea;
  onSave: (fields: { status?: string; memo?: string; report_md?: string }) => void;
  saving: boolean;
  hideTitle?: boolean; // 呼び出し元（折りたたみカードのヘッダー等）が既にタイトルを表示している場合、二重表示を避けるために渡す
}) {
  const [memoDraft, setMemoDraft] = useState(idea.memo ?? '');
  const [editingSection, setEditingSection] = useState<number | null>(null);
  const [sectionDraft, setSectionDraft] = useState('');
  const [addingSection, setAddingSection] = useState(false);
  const [newSectionText, setNewSectionText] = useState('# 新しいセクション\n\n');

  const sections = splitTopLevelSections(idea.report_md ?? '');

  function startEdit(index: number, raw: string) {
    setEditingSection(index);
    setSectionDraft(raw);
  }

  function saveSection(index: number) {
    const next = sections.map((s, i) => (i === index ? { ...s, raw: sectionDraft } : s));
    const rebuilt = next.map(s => s.raw).join('\n\n---\n\n');
    onSave({ report_md: rebuilt });
    setEditingSection(null);
  }

  function saveNewSection() {
    const rebuilt = [...sections.map(s => s.raw), newSectionText].join('\n\n---\n\n');
    onSave({ report_md: rebuilt });
    setAddingSection(false);
    setNewSectionText('# 新しいセクション\n\n');
  }

  const statusInfo = STATUS_LABELS[idea.status] ?? STATUS_LABELS.idea;

  return (
    <div>
      {!hideTitle && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, marginBottom: 10 }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 900 }}>{idea.title}</h2>
          <span style={{ fontSize: 10, color: '#bbb', whiteSpace: 'nowrap' }}>最終更新 {new Date(idea.updated_at).toLocaleString('ja-JP')}</span>
        </div>
      )}

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
        {Object.entries(STATUS_LABELS).map(([key, info]) => (
          <button key={key} onClick={() => onSave({ status: key })} disabled={saving} style={{
            padding: '4px 10px', borderRadius: 16, fontSize: 11.5, cursor: 'pointer',
            border: `1.5px solid ${idea.status === key ? info.color : '#ddd'}`,
            background: idea.status === key ? info.color + '18' : '#fff',
            color: idea.status === key ? info.color : '#999', fontWeight: idea.status === key ? 700 : 400,
          }}>{info.label}</button>
        ))}
      </div>

      <div style={{ background: '#faf9f6', borderRadius: 10, padding: 10, marginBottom: 16 }}>
        <label style={{ fontSize: 11, color: '#999', fontWeight: 700 }}>ひとことメモ（会長・運営メンバー向けの短い注記）</label>
        <textarea
          value={memoDraft}
          onChange={e => setMemoDraft(e.target.value)}
          onBlur={() => { if (memoDraft !== (idea.memo ?? '')) onSave({ memo: memoDraft }); }}
          rows={2}
          placeholder="例：主軸はこの案に確定。次は自治体アポ取り。"
          style={{ width: '100%', boxSizing: 'border-box', padding: 8, borderRadius: 8, border: '1.5px solid #eee', fontFamily: 'inherit', fontSize: 13, marginTop: 4, resize: 'vertical' }}
        />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {sections.map((section, index) => {
          const isEditing = editingSection === index;
          const label = section.heading || '概要';
          // バッジに見出しをすでに出しているので、本文側では見出し行（"# 〜"）を省いて
          // 同じ文字列が二重に表示され縦に間延びするのを防ぐ。
          const bodyWithoutHeading = section.heading
            ? section.raw.replace(/^#\s+.+(\r?\n)?/, '')
            : section.raw;
          return (
            <div key={index} style={{ border: '1px solid #eee', borderRadius: 10, padding: '8px 12px', background: '#fff' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: bodyWithoutHeading.trim() || isEditing ? 4 : 0 }}>
                <span style={{ fontSize: 11, fontWeight: 800, color: '#B9770E', background: '#FDEBD0', padding: '2px 10px', borderRadius: 20 }}>{label}</span>
                {!isEditing ? (
                  <button onClick={() => startEdit(index, section.raw)} style={{
                    border: 'none', background: 'none', color: '#38ADA9', fontSize: 12, fontWeight: 700, cursor: 'pointer',
                  }}>✏️ 編集する</button>
                ) : (
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => setEditingSection(null)} style={{ border: 'none', background: 'none', color: '#999', fontSize: 12, cursor: 'pointer' }}>キャンセル</button>
                    <button onClick={() => saveSection(index)} disabled={saving} style={{
                      border: 'none', borderRadius: 8, background: '#38ADA9', color: '#fff', fontWeight: 700, fontSize: 12, padding: '5px 14px', cursor: 'pointer',
                    }}>{saving ? '保存中…' : '保存'}</button>
                  </div>
                )}
              </div>

              {isEditing ? (
                <textarea
                  value={sectionDraft}
                  onChange={e => setSectionDraft(e.target.value)}
                  rows={Math.min(30, Math.max(6, sectionDraft.split('\n').length + 2))}
                  style={{ width: '100%', boxSizing: 'border-box', padding: 10, borderRadius: 8, border: '1.5px solid #ddd', fontFamily: 'monospace', fontSize: 12.5, lineHeight: 1.6 }}
                />
              ) : bodyWithoutHeading.trim() ? (
                <div style={{ fontSize: 13, color: '#333', lineHeight: 1.55 }}>
                  <MarkdownLite text={bodyWithoutHeading} />
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      <div style={{ marginTop: 10 }}>
        {addingSection ? (
          <div style={{ border: '1.5px dashed #38ADA9', borderRadius: 12, padding: 14 }}>
            <textarea value={newSectionText} onChange={e => setNewSectionText(e.target.value)} rows={8}
              style={{ width: '100%', boxSizing: 'border-box', padding: 10, borderRadius: 8, border: '1.5px solid #ddd', fontFamily: 'monospace', fontSize: 12.5 }} />
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <button onClick={saveNewSection} disabled={saving} style={{ border: 'none', borderRadius: 8, background: '#38ADA9', color: '#fff', fontWeight: 700, fontSize: 12, padding: '6px 16px', cursor: 'pointer' }}>追加を保存</button>
              <button onClick={() => setAddingSection(false)} style={{ border: 'none', background: 'none', color: '#999', fontSize: 12, cursor: 'pointer' }}>キャンセル</button>
            </div>
          </div>
        ) : (
          <button onClick={() => setAddingSection(true)} style={{
            width: '100%', padding: '10px 0', borderRadius: 10, border: '1.5px dashed #ccc',
            background: '#fff', color: '#999', fontWeight: 700, fontSize: 13, cursor: 'pointer',
          }}>＋ 新しいセクションを追加</button>
        )}
      </div>
    </div>
  );
}
