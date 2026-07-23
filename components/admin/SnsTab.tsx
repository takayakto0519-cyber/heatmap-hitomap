'use client';

// 運営ダッシュボードのSNS投稿タブ。Instagram等への自動投稿が使えない場合に、
// キャプション・画像をすぐコピペして手動投稿できるようにする置き場所。
import { useCallback, useEffect, useState } from 'react';
import DeliverableCard, { type Deliverable } from '@/components/admin/DeliverableCard';

interface SnsDraft {
  id: string;
  platform: string;
  title: string;
  caption: string;
  image_url: string | null;
  status: 'draft' | 'posted';
  created_at: string;
  posted_at: string | null;
}

const EMPTY_FORM = { title: '', caption: '', image_url: '' };

export default function SnsTab({ authHeaders }: { authHeaders: () => HeadersInit }) {
  const [drafts, setDrafts] = useState<SnsDraft[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  // AIが自動で作ったSNS投稿案（agents/autopilot.py が entity_type='sns' で積む）の確認待ち。
  const [proposals, setProposals] = useState<Deliverable[]>([]);

  function jsonHeaders(): HeadersInit {
    return { ...authHeaders(), 'Content-Type': 'application/json' };
  }

  const loadProposals = useCallback(() => {
    fetch('/api/admin/ai-deliverables?entity_type=sns', { headers: authHeaders() })
      .then(r => r.json())
      .then(d => { if (d.ok) setProposals((d.deliverables ?? []).filter((x: Deliverable) => x.status === 'proposed' || x.status === 'revise')); })
      .catch(() => {});
  }, [authHeaders]);
  useEffect(() => { loadProposals(); }, [loadProposals]);
  async function patchProposal(id: string, fields: Record<string, unknown>) {
    await fetch(`/api/admin/ai-deliverables/${id}`, { method: 'PATCH', headers: jsonHeaders(), body: JSON.stringify(fields) });
    loadProposals();
    load();
  }

  async function load() {
    setLoading(true);
    const res = await fetch('/api/admin/sns-drafts', { headers: authHeaders() });
    const data = await res.json();
    if (data.ok) setDrafts(data.drafts ?? []);
    else setMessage(data.error ?? '読み込みに失敗しました');
    setLoading(false);
  }

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  async function createDraft() {
    if (!form.title.trim()) { setMessage('タイトルを入力してください'); return; }
    setSaving(true);
    setMessage('');
    try {
      const res = await fetch('/api/admin/sns-drafts', {
        method: 'POST',
        headers: jsonHeaders(),
        body: JSON.stringify({ title: form.title, caption: form.caption, image_url: form.image_url || null }),
      });
      const data = await res.json();
      if (data.ok) {
        setForm(EMPTY_FORM);
        setShowForm(false);
        await load();
      } else {
        setMessage(data.error ?? '保存に失敗しました');
      }
    } finally {
      setSaving(false);
    }
  }

  async function setStatus(id: string, status: 'draft' | 'posted') {
    await fetch(`/api/admin/sns-drafts/${id}`, {
      method: 'PATCH', headers: jsonHeaders(), body: JSON.stringify({ status }),
    });
    await load();
  }

  async function remove(id: string) {
    if (!window.confirm('このドラフトを削除します。よろしいですか？')) return;
    await fetch(`/api/admin/sns-drafts/${id}`, { method: 'DELETE', headers: authHeaders() });
    await load();
  }

  async function copyCaption(draft: SnsDraft) {
    await navigator.clipboard.writeText(draft.caption);
    setCopiedId(draft.id);
    setTimeout(() => setCopiedId((v) => (v === draft.id ? null : v)), 2000);
  }

  async function uploadImage(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    setMessage('');
    try {
      const { uploadTracePhoto } = await import('@/lib/supabase/upload');
      const url = await uploadTracePhoto(files[0]);
      setForm((f) => ({ ...f, image_url: url }));
    } catch (e) {
      setMessage(e instanceof Error ? e.message : '画像のアップロードに失敗しました');
    } finally {
      setUploading(false);
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: 8,
    border: '1.5px solid #ddd', fontSize: 14, fontFamily: 'inherit',
  };
  const labelStyle: React.CSSProperties = { fontSize: 12, fontWeight: 700, color: '#555', margin: '14px 0 6px', display: 'block' };

  const draftDrafts = drafts.filter((d) => d.status === 'draft');
  const postedDrafts = drafts.filter((d) => d.status === 'posted');

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <h1 style={{ fontSize: 20, fontWeight: 800, margin: 0 }}>SNS投稿</h1>
        <button onClick={() => setShowForm((v) => !v)} style={{
          padding: '8px 16px', borderRadius: 8, border: 'none', background: '#38ADA9',
          color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer',
        }}>
          {showForm ? 'キャンセル' : '+ 新規ドラフト'}
        </button>
      </div>
      <p style={{ fontSize: 13, color: '#777', margin: '0 0 16px' }}>
        自動投稿（Zapier）が使えないときに、キャプションと画像をここからすぐコピペして手動投稿する。
      </p>
      {message && <p style={{ fontSize: 13, color: '#E74C3C', margin: '0 0 12px' }}>{message}</p>}

      {/* AIオートパイロット（agents/autopilot.py）が数日おきに自動生成するSNS投稿案の確認待ち。
          承認すると上の「未投稿」一覧（sns_drafts）にそのまま追加される。 */}
      {proposals.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <h2 style={{ fontSize: 14, fontWeight: 700, color: '#555', margin: '0 0 10px' }}>🤖 AI提案（確認待ち {proposals.length}件）</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {proposals.map(p => (
              <DeliverableCard
                key={p.id}
                deliverable={p}
                onApprove={() => patchProposal(p.id, { status: 'approved' })}
                onRevise={(feedback, rebuild) => patchProposal(p.id, { status: 'revise', feedback, rebuild })}
                onArchive={() => patchProposal(p.id, { status: 'archived' })}
              />
            ))}
          </div>
        </div>
      )}

      {showForm && (
        <div style={{ background: '#fff', borderRadius: 12, padding: 18, marginBottom: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
          <label style={labelStyle}>タイトル（管理用のラベル）</label>
          <input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} style={inputStyle} placeholder="例：煩悩オークション紹介" />
          <label style={labelStyle}>キャプション</label>
          <textarea value={form.caption} onChange={(e) => setForm((f) => ({ ...f, caption: e.target.value }))} rows={8} style={{ ...inputStyle, resize: 'vertical' }} />
          <label style={labelStyle}>画像（任意）</label>
          <input type="file" accept="image/*" disabled={uploading} onChange={(e) => uploadImage(e.target.files)} />
          {uploading && <p style={{ fontSize: 12, color: '#999', margin: '6px 0 0' }}>アップロード中…</p>}
          {form.image_url && (
            <img src={form.image_url} alt="" style={{ width: 120, height: 120, objectFit: 'cover', borderRadius: 8, display: 'block', marginTop: 10 }} />
          )}
          <label style={{ ...labelStyle, fontWeight: 400, color: '#999' }}>または画像URLを直接貼り付け</label>
          <input value={form.image_url} onChange={(e) => setForm((f) => ({ ...f, image_url: e.target.value }))} style={inputStyle} placeholder="https://..." />
          <button onClick={createDraft} disabled={saving} style={{
            marginTop: 14, padding: '10px 20px', borderRadius: 8, border: 'none', background: '#38ADA9',
            color: '#fff', fontWeight: 700, fontSize: 13, cursor: saving ? 'default' : 'pointer',
          }}>
            {saving ? '保存中…' : '保存する'}
          </button>
        </div>
      )}

      {loading ? (
        <p style={{ fontSize: 13, color: '#999' }}>読み込み中…</p>
      ) : drafts.length === 0 ? (
        <p style={{ fontSize: 13, color: '#999' }}>まだドラフトはありません</p>
      ) : (
        <>
          <h2 style={{ fontSize: 14, fontWeight: 700, color: '#555', margin: '0 0 10px' }}>未投稿（{draftDrafts.length}）</h2>
          {draftDrafts.map((d) => (
            <div key={d.id} style={{ background: '#fff', borderRadius: 12, padding: 16, marginBottom: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', display: 'flex', gap: 14 }}>
              {d.image_url && (
                <img src={d.image_url} alt="" style={{ width: 100, height: 100, objectFit: 'cover', borderRadius: 8, flexShrink: 0 }} />
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 14, fontWeight: 700, margin: '0 0 6px' }}>{d.title}</p>
                <pre style={{
                  fontSize: 12, color: '#444', whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                  background: '#f7f7f5', borderRadius: 8, padding: '10px 12px', margin: '0 0 10px',
                  maxHeight: 160, overflowY: 'auto', fontFamily: 'inherit',
                }}>{d.caption}</pre>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button onClick={() => copyCaption(d)} style={{
                    fontSize: 12, fontWeight: 700, padding: '6px 14px', borderRadius: 999, border: 'none',
                    background: copiedId === d.id ? '#27AE60' : '#38ADA9', color: '#fff', cursor: 'pointer',
                  }}>
                    {copiedId === d.id ? 'コピーしました ✓' : 'キャプションをコピー'}
                  </button>
                  {d.image_url && (
                    <a href={d.image_url} target="_blank" rel="noopener noreferrer" style={{
                      fontSize: 12, fontWeight: 700, padding: '6px 14px', borderRadius: 999,
                      border: '1px solid #38ADA9', color: '#38ADA9', textDecoration: 'none',
                    }}>画像を開く ↗</a>
                  )}
                  <button onClick={() => setStatus(d.id, 'posted')} style={{
                    fontSize: 12, fontWeight: 700, padding: '6px 14px', borderRadius: 999,
                    border: '1px solid #999', background: 'transparent', color: '#666', cursor: 'pointer',
                  }}>投稿済みにする</button>
                  <button onClick={() => remove(d.id)} style={{
                    fontSize: 12, fontWeight: 700, padding: '6px 14px', borderRadius: 999,
                    border: '1px solid #E74C3C', background: 'transparent', color: '#E74C3C', cursor: 'pointer',
                  }}>削除</button>
                </div>
              </div>
            </div>
          ))}

          {postedDrafts.length > 0 && (
            <>
              <h2 style={{ fontSize: 14, fontWeight: 700, color: '#999', margin: '20px 0 10px' }}>投稿済み（{postedDrafts.length}）</h2>
              {postedDrafts.map((d) => (
                <div key={d.id} style={{ background: '#fafafa', borderRadius: 12, padding: '12px 16px', marginBottom: 8, opacity: 0.7, display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, flex: 1 }}>{d.title}</span>
                  <span style={{ fontSize: 11, color: '#999' }}>{d.posted_at ? new Date(d.posted_at).toLocaleDateString('ja-JP') : ''}</span>
                  <button onClick={() => setStatus(d.id, 'draft')} style={{
                    fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 999,
                    border: '1px solid #999', background: 'transparent', color: '#666', cursor: 'pointer',
                  }}>下書きに戻す</button>
                </div>
              ))}
            </>
          )}
        </>
      )}
    </div>
  );
}
