'use client';

// 運営ダッシュボードに統合されたサイトCMSタブ。認証は親（/admin/dashboard）が持つ
// authHeaders を使い、このコンポーネント自身はパスワードを持たない。
import { useEffect, useState } from 'react';
import LivePreview from './LivePreview';
import { BLOCK_TYPES, SITE_PAGES, pagePath, blockTypeLabel, type SiteBlock, type BlockType, type BlockCardItem, type BlockQuoteItem } from '@/lib/siteBlocks';

interface Draft {
  id?: string;
  block_type: BlockType;
  eyebrow: string;
  heading: string;
  body: string;
  image_url: string;
  cta_label: string;
  cta_href: string;
  items: (BlockCardItem | BlockQuoteItem)[];
  is_visible: boolean;
}

function emptyDraft(type: BlockType): Draft {
  return {
    block_type: type, eyebrow: '', heading: '', body: '', image_url: '',
    cta_label: '', cta_href: '',
    items: type === 'cards' ? [{ title: '', body: '' }] : type === 'quote' ? [{ name: '', comment: '' }] : [],
    is_visible: true,
  };
}

export default function BlocksTab({ authHeaders }: { authHeaders: () => HeadersInit }) {
  const [page, setPage] = useState('home');
  const [blocks, setBlocks] = useState<SiteBlock[]>([]);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [newType, setNewType] = useState<BlockType>('text');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [previewVersion, setPreviewVersion] = useState(0);

  function jsonHeaders(): HeadersInit {
    return { ...authHeaders(), 'Content-Type': 'application/json' };
  }

  async function load(p = page) {
    setLoading(true);
    const res = await fetch(`/api/admin/blocks?page=${p}`, { headers: authHeaders() });
    const data = await res.json();
    if (data.ok) setBlocks(data.blocks ?? []);
    else setMessage(data.error ?? '読み込みに失敗しました');
    setLoading(false);
  }

  useEffect(() => {
    load(page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  async function seedPage() {
    setMessage('');
    const res = await fetch('/api/admin/blocks/seed-home', { method: 'POST', headers: jsonHeaders(), body: JSON.stringify({ page }) });
    const data = await res.json();
    if (data.ok) { setMessage(`初期セクションを${data.inserted}件投入しました`); setPreviewVersion(v => v + 1); await load(); }
    else setMessage(data.error ?? '投入に失敗しました');
  }

  async function move(id: string, dir: -1 | 1) {
    const idx = blocks.findIndex(b => b.id === id);
    const swapWith = idx + dir;
    if (idx < 0 || swapWith < 0 || swapWith >= blocks.length) return;
    const next = [...blocks];
    [next[idx], next[swapWith]] = [next[swapWith], next[idx]];
    setBlocks(next);
    await fetch('/api/admin/blocks/reorder', {
      method: 'POST', headers: jsonHeaders(), body: JSON.stringify({ order: next.map(b => b.id) }),
    });
    setPreviewVersion(v => v + 1);
  }

  async function toggleVisible(b: SiteBlock) {
    const res = await fetch(`/api/admin/blocks/${b.id}`, {
      method: 'PATCH', headers: jsonHeaders(), body: JSON.stringify({ is_visible: !b.is_visible }),
    });
    const data = await res.json();
    if (data.ok) { setBlocks(prev => prev.map(x => x.id === b.id ? data.block : x)); setPreviewVersion(v => v + 1); }
  }

  async function remove(id: string) {
    if (!window.confirm('このセクションを削除します。よろしいですか？')) return;
    const res = await fetch(`/api/admin/blocks/${id}`, { method: 'DELETE', headers: authHeaders() });
    const data = await res.json();
    if (data.ok) { setMessage('削除しました'); setPreviewVersion(v => v + 1); await load(); }
    else setMessage(data.error ?? '削除に失敗しました');
  }

  function editDraft(b: SiteBlock) {
    setDraft({
      id: b.id, block_type: b.block_type, eyebrow: b.eyebrow ?? '', heading: b.heading ?? '',
      body: b.body ?? '', image_url: b.image_url ?? '', cta_label: b.cta_label ?? '', cta_href: b.cta_href ?? '',
      items: b.items ?? [], is_visible: b.is_visible,
    });
  }

  async function uploadImage(files: FileList | null, onto: 'image_url' | number) {
    if (!files || files.length === 0 || !draft) return;
    setUploading(true);
    setMessage('');
    try {
      const { uploadTracePhoto } = await import('@/lib/supabase/upload');
      const url = await uploadTracePhoto(files[0]);
      if (onto === 'image_url') setDraft({ ...draft, image_url: url });
      else setDraft({ ...draft, items: draft.items.map((it, i) => i === onto ? { ...it, image_url: url } as BlockCardItem : it) });
    } catch (e) {
      setMessage(e instanceof Error ? e.message : '画像のアップロードに失敗しました');
    } finally {
      setUploading(false);
    }
  }

  async function save() {
    if (!draft) return;
    setSaving(true);
    setMessage('');
    try {
      const payload = {
        page,
        block_type: draft.block_type,
        eyebrow: draft.eyebrow.trim() || null,
        heading: draft.heading.trim() || null,
        body: draft.body.trim() || null,
        image_url: draft.image_url.trim() || null,
        cta_label: draft.cta_label.trim() || null,
        cta_href: draft.cta_href.trim() || null,
        items: draft.items,
        is_visible: draft.is_visible,
      };
      const res = draft.id
        ? await fetch(`/api/admin/blocks/${draft.id}`, { method: 'PATCH', headers: jsonHeaders(), body: JSON.stringify(payload) })
        : await fetch('/api/admin/blocks', { method: 'POST', headers: jsonHeaders(), body: JSON.stringify(payload) });
      const data = await res.json();
      if (data.ok) { setDraft(null); setMessage('保存しました'); setPreviewVersion(v => v + 1); await load(); }
      else setMessage(data.error ?? '保存に失敗しました');
    } finally {
      setSaving(false);
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: 8,
    border: '1.5px solid #ddd', fontSize: 14, fontFamily: 'inherit',
  };
  const labelStyle: React.CSSProperties = { fontSize: 12, fontWeight: 700, color: '#555', margin: '18px 0 6px', display: 'block' };

  return (
    <div>
      <div style={{ margin: '0 0 16px', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <label style={{ fontSize: 12, color: '#666' }}>対象ページ：</label>
        <select value={page} onChange={e => setPage(e.target.value)} style={{ ...inputStyle, width: 'auto' }}>
          {SITE_PAGES.map(p => <option key={p.key} value={p.key}>{p.label}</option>)}
        </select>
        <a href={pagePath(page)} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: '#566246' }}>サイトを見る →</a>
        {blocks.length === 0 && !loading && (
          <button onClick={seedPage} style={{
            padding: '9px 16px', borderRadius: 8, border: '1.5px solid #566246',
            background: '#fff', color: '#566246', fontWeight: 700, fontSize: 12, cursor: 'pointer',
          }}>初期セクションを読み込む</button>
        )}
      </div>
      <p style={{ fontSize: 11, color: '#999', margin: '0 0 16px' }}>
        {page === 'home'
          ? 'トップページはHero（一番上）・感情タグ一覧・直近の投稿フィードが固定表示のため、ここには出ません。'
          : 'このページの見出し文言はここで編集できます。'}
      </p>

      <div style={{ marginBottom: 20 }}>
        <LivePreview path={pagePath(page)} version={previewVersion} />
      </div>

      {message && <p style={{ fontSize: 13, color: '#566246', fontWeight: 700 }}>{message}</p>}

      {!draft && (
        <>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', margin: '12px 0 20px' }}>
            <select value={newType} onChange={e => setNewType(e.target.value as BlockType)} style={{ ...inputStyle, width: 'auto' }}>
              {BLOCK_TYPES.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
            </select>
            <button onClick={() => setDraft(emptyDraft(newType))} style={{
              padding: '10px 20px', borderRadius: 8, border: 'none',
              background: '#566246', color: '#fff', fontWeight: 700, cursor: 'pointer', fontSize: 13,
            }}>＋ セクションを追加</button>
          </div>

          {loading ? (
            <p style={{ fontSize: 13, color: '#999' }}>読み込み中…</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {blocks.length === 0 && <p style={{ fontSize: 13, color: '#999' }}>まだセクションがありません。上のボタンから追加するか、初期セクションを読み込んでください。</p>}
              {blocks.map((b, i) => (
                <div key={b.id} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap',
                  border: '1px solid #e5e0d0', borderRadius: 10, padding: '12px 16px',
                  background: b.is_visible ? '#fff' : '#f5f3ee', opacity: b.is_visible ? 1 : 0.6,
                }}>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <p style={{ margin: 0, fontSize: 11, color: '#999' }}>{blockTypeLabel(b.block_type)}{!b.is_visible && '（非表示）'}</p>
                    <p style={{ margin: '2px 0 0', fontSize: 14, fontWeight: 700, color: '#23231F' }}>
                      {b.heading || b.eyebrow || (b.items?.[0] as BlockCardItem)?.title || '（無題）'}
                    </p>
                  </div>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <button onClick={() => move(b.id, -1)} disabled={i === 0} title="上へ" style={{ border: '1px solid #ddd', background: '#fff', borderRadius: 6, width: 28, height: 28, cursor: i === 0 ? 'default' : 'pointer', opacity: i === 0 ? 0.3 : 1 }}>↑</button>
                    <button onClick={() => move(b.id, 1)} disabled={i === blocks.length - 1} title="下へ" style={{ border: '1px solid #ddd', background: '#fff', borderRadius: 6, width: 28, height: 28, cursor: i === blocks.length - 1 ? 'default' : 'pointer', opacity: i === blocks.length - 1 ? 0.3 : 1 }}>↓</button>
                    <button onClick={() => toggleVisible(b)} style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #ddd', background: '#fff', cursor: 'pointer', fontSize: 11 }}>{b.is_visible ? '非表示にする' : '表示する'}</button>
                    <button onClick={() => editDraft(b)} style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid #ddd', background: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 700, color: '#566246' }}>編集</button>
                    <button onClick={() => remove(b.id)} style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid #ddd', background: '#fff', cursor: 'pointer', fontSize: 12, color: '#B23A2E' }}>削除</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {draft && (
        <div style={{ marginTop: 20 }}>
          <p style={{ fontSize: 12, color: '#999' }}>種類：{blockTypeLabel(draft.block_type)}</p>

          {(draft.block_type === 'heading' || draft.block_type === 'text' || draft.block_type === 'cards') && (
            <>
              <label style={labelStyle}>小ラベル（任意・上に小さく出る文言）</label>
              <input value={draft.eyebrow} onChange={e => setDraft({ ...draft, eyebrow: e.target.value })} style={inputStyle} />
            </>
          )}

          {(draft.block_type === 'heading' || draft.block_type === 'text' || draft.block_type === 'cards' || draft.block_type === 'cta') && (
            <>
              <label style={labelStyle}>見出し</label>
              <input value={draft.heading} onChange={e => setDraft({ ...draft, heading: e.target.value })} style={inputStyle} />
            </>
          )}

          {(draft.block_type === 'text' || draft.block_type === 'image' || draft.block_type === 'cta') && (
            <>
              <label style={labelStyle}>{draft.block_type === 'image' ? 'キャプション（任意）' : '本文'}</label>
              <textarea rows={draft.block_type === 'image' ? 2 : 5} value={draft.body} onChange={e => setDraft({ ...draft, body: e.target.value })} style={{ ...inputStyle, lineHeight: 1.8, resize: 'vertical' }} />
            </>
          )}

          {draft.block_type === 'image' && (
            <>
              <label style={labelStyle}>画像</label>
              {draft.image_url && (
                <div style={{ marginBottom: 8 }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={draft.image_url} alt="" style={{ width: 240, height: 150, objectFit: 'cover', borderRadius: 8, display: 'block' }} />
                </div>
              )}
              <input type="file" accept="image/*" disabled={uploading} onChange={e => uploadImage(e.target.files, 'image_url')} />
            </>
          )}

          {draft.block_type === 'cta' && (
            <>
              <label style={labelStyle}>ボタン文言</label>
              <input value={draft.cta_label} onChange={e => setDraft({ ...draft, cta_label: e.target.value })} style={inputStyle} placeholder="例：地図をひらく" />
              <label style={labelStyle}>ボタンのリンク先</label>
              <input value={draft.cta_href} onChange={e => setDraft({ ...draft, cta_href: e.target.value })} style={inputStyle} placeholder="/start" />
            </>
          )}

          {draft.block_type === 'cards' && (
            <>
              <label style={labelStyle}>カード</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {(draft.items as BlockCardItem[]).map((item, i) => (
                  <div key={i} style={{ border: '1px solid #e5e0d0', borderRadius: 10, padding: 12, background: '#fff' }}>
                    <input value={item.title} onChange={e => setDraft({ ...draft, items: (draft.items as BlockCardItem[]).map((x, j) => j === i ? { ...x, title: e.target.value } : x) })} placeholder="タイトル" style={{ ...inputStyle, marginBottom: 8, fontSize: 13 }} />
                    <textarea rows={2} value={item.body} onChange={e => setDraft({ ...draft, items: (draft.items as BlockCardItem[]).map((x, j) => j === i ? { ...x, body: e.target.value } : x) })} placeholder="説明文" style={{ ...inputStyle, marginBottom: 8, fontSize: 13, lineHeight: 1.7, resize: 'vertical' }} />
                    <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                      <input value={item.href ?? ''} onChange={e => setDraft({ ...draft, items: (draft.items as BlockCardItem[]).map((x, j) => j === i ? { ...x, href: e.target.value } : x) })} placeholder="リンク先（任意・例：/start）" style={{ ...inputStyle, fontSize: 12, flex: 1 }} />
                      <input value={item.badge ?? ''} onChange={e => setDraft({ ...draft, items: (draft.items as BlockCardItem[]).map((x, j) => j === i ? { ...x, badge: e.target.value } : x) })} placeholder="バッジ（任意・例：稼働中）" style={{ ...inputStyle, fontSize: 12, flex: 1 }} />
                    </div>
                    {item.image_url && (
                      <div style={{ marginBottom: 8 }}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={item.image_url} alt="" style={{ width: 140, height: 90, objectFit: 'cover', borderRadius: 8, display: 'block' }} />
                      </div>
                    )}
                    <input type="file" accept="image/*" disabled={uploading} onChange={e => uploadImage(e.target.files, i)} />
                    <button onClick={() => setDraft({ ...draft, items: (draft.items as BlockCardItem[]).filter((_, j) => j !== i) })} style={{ display: 'block', marginTop: 8, fontSize: 11, color: '#B23A2E', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>このカードを削除</button>
                  </div>
                ))}
                <button onClick={() => setDraft({ ...draft, items: [...draft.items, { title: '', body: '' } as BlockCardItem] })} style={{ alignSelf: 'flex-start', padding: '8px 16px', borderRadius: 8, border: '1.5px solid #566246', background: '#fff', color: '#566246', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>＋ カードを追加</button>
              </div>
            </>
          )}

          {draft.block_type === 'quote' && (
            <>
              <label style={labelStyle}>小ラベル（任意）</label>
              <input value={draft.eyebrow} onChange={e => setDraft({ ...draft, eyebrow: e.target.value })} style={inputStyle} placeholder="例：参加者の声" />
              <label style={labelStyle}>声・感想</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {(draft.items as BlockQuoteItem[]).map((item, i) => (
                  <div key={i} style={{ border: '1px solid #e5e0d0', borderRadius: 10, padding: 12, background: '#fff' }}>
                    <input value={item.name} onChange={e => setDraft({ ...draft, items: (draft.items as BlockQuoteItem[]).map((x, j) => j === i ? { ...x, name: e.target.value } : x) })} placeholder="どなたの声か" style={{ ...inputStyle, marginBottom: 8, fontSize: 13 }} />
                    <textarea rows={3} value={item.comment} onChange={e => setDraft({ ...draft, items: (draft.items as BlockQuoteItem[]).map((x, j) => j === i ? { ...x, comment: e.target.value } : x) })} placeholder="感想" style={{ ...inputStyle, fontSize: 13, lineHeight: 1.7, resize: 'vertical' }} />
                    <button onClick={() => setDraft({ ...draft, items: (draft.items as BlockQuoteItem[]).filter((_, j) => j !== i) })} style={{ display: 'block', marginTop: 8, fontSize: 11, color: '#B23A2E', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>この声を削除</button>
                  </div>
                ))}
                <button onClick={() => setDraft({ ...draft, items: [...draft.items, { name: '', comment: '' } as BlockQuoteItem] })} style={{ alignSelf: 'flex-start', padding: '8px 16px', borderRadius: 8, border: '1.5px solid #566246', background: '#fff', color: '#566246', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>＋ 声を追加</button>
              </div>
            </>
          )}

          <label style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
            <input type="checkbox" checked={draft.is_visible} onChange={e => setDraft({ ...draft, is_visible: e.target.checked })} />
            公開する
          </label>

          <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
            <button onClick={save} disabled={saving || uploading} style={{
              flex: 1, padding: '13px 0', borderRadius: 8, border: 'none',
              background: '#23231F', color: '#fff', fontWeight: 700, fontSize: 14,
              cursor: saving ? 'wait' : 'pointer',
            }}>{saving ? '保存中…' : draft.id ? '更新する' : '追加する'}</button>
            <button onClick={() => { setDraft(null); setMessage(''); }} style={{
              flex: 1, padding: '13px 0', borderRadius: 8, border: '1px solid #ddd',
              background: '#fff', color: '#888', cursor: 'pointer', fontSize: 14,
            }}>一覧に戻る</button>
          </div>
        </div>
      )}
    </div>
  );
}
