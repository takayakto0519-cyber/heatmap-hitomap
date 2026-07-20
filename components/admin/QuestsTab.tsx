'use client';

// クエスト：クエストの作成・管理。page.tsx monolith分割で切り出し。
import { useCallback, useEffect, useState } from 'react';
import { EMOTIONS } from '@/lib/emotions';
import { Card, inputStyle } from '@/components/admin/adminShared';

interface Quest {
  id: string;
  emoji: string;
  title: string;
  hint: string;
  quest_type: string;
  target_emotion_key: string | null;
  is_active: boolean;
  created_at: string;
}

interface QuestForm {
  emoji: string;
  title: string;
  hint: string;
  quest_type: 'search' | 'emotion';
  target_emotion_key: string;
}

const emptyQuestForm: QuestForm = { emoji: '', title: '', hint: '', quest_type: 'search', target_emotion_key: EMOTIONS[0]?.key ?? '' };

export default function QuestsTab({ authHeaders }: { authHeaders: () => HeadersInit }) {
  const [quests, setQuests] = useState<Quest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState<QuestForm>(emptyQuestForm);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    fetch('/api/admin/quests', { headers: authHeaders() })
      .then(r => r.json())
      .then(d => { if (d.ok) setQuests(d.quests); else setError(d.error ?? '取得に失敗しました'); })
      .catch(() => setError('通信エラー'))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { load(); }, [load]);

  async function createQuest() {
    if (!form.emoji.trim() || !form.title.trim() || !form.hint.trim()) {
      setError('絵文字・タイトル・ヒントは必須です');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/admin/quests', {
        method: 'POST', headers: authHeaders(),
        body: JSON.stringify({
          emoji: form.emoji.trim(), title: form.title.trim(), hint: form.hint.trim(),
          quest_type: form.quest_type,
          target_emotion_key: form.quest_type === 'emotion' ? form.target_emotion_key : null,
        }),
      });
      const data = await res.json();
      if (data.ok) { setShowCreate(false); setForm(emptyQuestForm); load(); }
      else setError(data.error ?? '作成に失敗しました');
    } finally {
      setSaving(false);
    }
  }

  async function activateQuest(id: string) {
    const res = await fetch(`/api/admin/quests/${id}`, {
      method: 'PATCH', headers: authHeaders(), body: JSON.stringify({ is_active: true }),
    });
    const data = await res.json();
    if (data.ok) load(); else setError(data.error ?? '更新に失敗しました');
  }

  async function deactivateQuest(id: string) {
    const res = await fetch(`/api/admin/quests/${id}`, {
      method: 'PATCH', headers: authHeaders(), body: JSON.stringify({ is_active: false }),
    });
    const data = await res.json();
    if (data.ok) load(); else setError(data.error ?? '更新に失敗しました');
  }

  async function deleteQuest(id: string) {
    const res = await fetch(`/api/admin/quests/${id}`, { method: 'DELETE', headers: authHeaders() });
    const data = await res.json();
    if (data.ok) load(); else setError(data.error ?? '削除に失敗しました');
  }

  if (loading) return <p style={{ color: '#999' }}>読み込み中…</p>;

  const activeQuest = quests.find(q => q.is_active);

  return (
    <div>
      {error && <p style={{ color: '#E74C3C', fontSize: 13 }}>{error}</p>}
      <p style={{ fontSize: 12, color: '#999', margin: '0 0 12px' }}>
        投稿画面のお題バナーに表示する内容です。「今すぐ表示」を1件だけ選べます。何も選ばれていない間は、曜日ローテーションの既定お題が自動で表示されます。
      </p>

      {activeQuest ? (
        <Card style={{ background: '#FBF6FF', border: '1px solid #F3EAFB', marginBottom: 16 }}>
          <p style={{ margin: '0 0 4px', fontSize: 11, color: '#8E44AD', fontWeight: 700 }}>✨ 現在表示中</p>
          <p style={{ margin: 0, fontWeight: 800, fontSize: 15 }}>{activeQuest.emoji} {activeQuest.title}</p>
          <p style={{ margin: '4px 0 0', fontSize: 12, color: '#888' }}>{activeQuest.hint}</p>
        </Card>
      ) : (
        <p style={{ fontSize: 12, color: '#bbb', marginBottom: 16 }}>現在は既定のローテーションお題が表示されています。</p>
      )}

      {showCreate ? (
        <Card style={{ marginBottom: 16 }}>
          <p style={{ margin: '0 0 10px', fontWeight: 800, fontSize: 14, color: '#8E44AD' }}>＋ 新しいお題を作成</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontSize: 11, color: '#666', fontWeight: 700 }}>種類</label>
            <div style={{ display: 'flex', gap: 6 }}>
              <button onClick={() => setForm(f => ({ ...f, quest_type: 'search' }))} style={{
                flex: 1, padding: '7px 0', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 700,
                border: form.quest_type === 'search' ? '1.5px solid #8E44AD' : '1.5px solid #ddd',
                background: form.quest_type === 'search' ? '#8E44AD' : '#fff',
                color: form.quest_type === 'search' ? '#fff' : '#888',
              }}>🔍 探すお題</button>
              <button onClick={() => setForm(f => ({ ...f, quest_type: 'emotion' }))} style={{
                flex: 1, padding: '7px 0', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 700,
                border: form.quest_type === 'emotion' ? '1.5px solid #FF6B9D' : '1.5px solid #ddd',
                background: form.quest_type === 'emotion' ? '#FF6B9D' : '#fff',
                color: form.quest_type === 'emotion' ? '#fff' : '#888',
              }}>💗 感情収集お題</button>
            </div>
            {form.quest_type === 'emotion' && (
              <>
                <label style={{ fontSize: 11, color: '#666', fontWeight: 700 }}>集めたい感情</label>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {EMOTIONS.map(e => (
                    <button key={e.key} onClick={() => setForm(f => ({ ...f, target_emotion_key: e.key }))} style={{
                      padding: '6px 12px', borderRadius: 20, cursor: 'pointer', fontSize: 12, fontWeight: 700,
                      border: form.target_emotion_key === e.key ? `1.5px solid ${e.color}` : '1.5px solid #ddd',
                      background: form.target_emotion_key === e.key ? e.color + '22' : '#fff',
                      color: form.target_emotion_key === e.key ? e.color : '#888',
                    }}>{e.emoji} {e.label}</button>
                  ))}
                </div>
              </>
            )}
            <label style={{ fontSize: 11, color: '#666', fontWeight: 700 }}>絵文字</label>
            <input placeholder="例：🌸" value={form.emoji}
              onChange={e => setForm(f => ({ ...f, emoji: e.target.value }))} style={{ ...inputStyle, width: 80 }} />
            <label style={{ fontSize: 11, color: '#666', fontWeight: 700 }}>タイトル</label>
            <input
              placeholder={form.quest_type === 'emotion' ? '例：あたたかさを集めています' : '例：直された跡を探そう'}
              value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} style={inputStyle} />
            <label style={{ fontSize: 11, color: '#666', fontWeight: 700 }}>ヒント文</label>
            <textarea placeholder="投稿のきっかけになる一言" value={form.hint} rows={2}
              onChange={e => setForm(f => ({ ...f, hint: e.target.value }))} style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }} />
            <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
              <button onClick={createQuest} disabled={saving} style={{
                flex: 1, padding: '9px 0', borderRadius: 8, border: 'none',
                background: '#8E44AD', color: '#fff', fontWeight: 700, cursor: saving ? 'wait' : 'pointer', fontSize: 13,
              }}>{saving ? '作成中…' : '作成する'}</button>
              <button onClick={() => { setShowCreate(false); setForm(emptyQuestForm); }} style={{
                flex: 1, padding: '9px 0', borderRadius: 8, border: '1px solid #ddd',
                background: '#fff', color: '#888', cursor: 'pointer', fontSize: 13,
              }}>キャンセル</button>
            </div>
          </div>
        </Card>
      ) : (
        <button onClick={() => setShowCreate(true)} style={{
          display: 'block', width: '100%', padding: '10px 0', borderRadius: 10, border: '1.5px dashed #8E44AD',
          background: '#fff', color: '#8E44AD', fontWeight: 700, fontSize: 13, cursor: 'pointer', marginBottom: 16,
        }}>＋ 新しいお題を作成</button>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {quests.length === 0 && <p style={{ color: '#aaa' }}>まだお題がありません。</p>}
        {quests.map(q => (
          <Card key={q.id} style={q.is_active ? { border: '1.5px solid #8E44AD' } : undefined}>
            <p style={{ margin: '0 0 4px', fontWeight: 700, fontSize: 14 }}>
              {q.emoji} {q.title}
              {q.quest_type === 'emotion' && <span style={{ marginLeft: 6, fontSize: 11, color: '#FF6B9D', fontWeight: 700 }}>💗感情収集</span>}
            </p>
            <p style={{ margin: '0 0 8px', fontSize: 12, color: '#888' }}>{q.hint}</p>
            <div style={{ display: 'flex', gap: 8 }}>
              {q.is_active ? (
                <button onClick={() => deactivateQuest(q.id)} style={{
                  flex: 1, padding: '7px 0', borderRadius: 8, border: '1px solid #ddd',
                  background: '#fff', color: '#888', cursor: 'pointer', fontSize: 12,
                }}>表示を止める</button>
              ) : (
                <button onClick={() => activateQuest(q.id)} style={{
                  flex: 1, padding: '7px 0', borderRadius: 8, border: 'none',
                  background: '#8E44AD', color: '#fff', fontWeight: 700, cursor: 'pointer', fontSize: 12,
                }}>今すぐ表示する</button>
              )}
              <button onClick={() => deleteQuest(q.id)} style={{
                padding: '7px 14px', borderRadius: 8, border: '1px solid #ddd',
                background: '#fff', color: '#E74C3C', cursor: 'pointer', fontSize: 12,
              }}>削除</button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

