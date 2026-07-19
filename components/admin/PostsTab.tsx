'use client';

// 運営ダッシュボードに統合された実績ブログタブ。認証は親のauthHeadersを共有する。
import { useEffect, useState } from 'react';
import LivePreview from './LivePreview';
import { POST_CATEGORIES, POST_TYPES, categoryLabel, postTypeLabel, formatEventDateRange, type SitePost, type Testimonial } from '@/lib/sitePosts';

interface Draft {
  id?: string;
  title: string;
  category: string;
  post_type: string;
  related_slug: string;
  event_date: string;
  event_date_end: string;
  body: string;
  cover_url: string;
  photo_urls: string[];
  testimonials: Testimonial[];
  is_published: boolean;
}

const EMPTY_DRAFT: Draft = {
  title: '', category: 'event', post_type: 'achievement', related_slug: '', event_date: '', event_date_end: '', body: '',
  cover_url: '', photo_urls: [], testimonials: [], is_published: false,
};

export default function PostsTab({ authHeaders }: { authHeaders: () => HeadersInit }) {
  const [posts, setPosts] = useState<SitePost[]>([]);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [previewVersion, setPreviewVersion] = useState(0);
  const [listFilter, setListFilter] = useState<'all' | 'achievement' | 'blog'>('all');

  function jsonHeaders(): HeadersInit {
    return { ...authHeaders(), 'Content-Type': 'application/json' };
  }

  async function load() {
    setLoading(true);
    const res = await fetch('/api/admin/posts', { headers: authHeaders() });
    const data = await res.json();
    if (data.ok) setPosts(data.posts ?? []);
    else setMessage(data.error ?? '読み込みに失敗しました');
    setLoading(false);
  }

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  async function uploadImages(files: FileList | null, target: 'cover' | 'photos') {
    if (!files || files.length === 0 || !draft) return;
    setUploading(true);
    setMessage('');
    try {
      const { uploadTracePhoto } = await import('@/lib/supabase/upload');
      const urls: string[] = [];
      for (const file of Array.from(files)) {
        urls.push(await uploadTracePhoto(file));
      }
      if (target === 'cover') setDraft(d => d && { ...d, cover_url: urls[0] ?? d.cover_url });
      else setDraft(d => d && { ...d, photo_urls: [...d.photo_urls, ...urls] });
    } catch (e) {
      setMessage(e instanceof Error ? e.message : '画像のアップロードに失敗しました');
    } finally {
      setUploading(false);
    }
  }

  async function save() {
    if (!draft) return;
    if (!draft.title.trim()) { setMessage('タイトルを入力してください'); return; }
    setSaving(true);
    setMessage('');
    try {
      const payload = {
        title: draft.title.trim(),
        category: draft.category,
        post_type: draft.post_type,
        related_slug: draft.post_type === 'achievement' ? (draft.related_slug || null) : null,
        event_date: draft.event_date || null,
        event_date_end: draft.event_date && draft.event_date_end ? draft.event_date_end : null,
        body: draft.body,
        cover_url: draft.cover_url || null,
        photo_urls: draft.photo_urls,
        testimonials: draft.testimonials.filter(t => t.name.trim() || t.comment.trim()),
        is_published: draft.is_published,
      };
      const res = draft.id
        ? await fetch(`/api/admin/posts/${draft.id}`, { method: 'PATCH', headers: jsonHeaders(), body: JSON.stringify(payload) })
        : await fetch('/api/admin/posts', { method: 'POST', headers: jsonHeaders(), body: JSON.stringify(payload) });
      const data = await res.json();
      if (data.ok) {
        setDraft(null);
        setMessage('保存しました');
        setPreviewVersion(v => v + 1);
        await load();
      } else {
        setMessage(data.error ?? '保存に失敗しました');
      }
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    if (!window.confirm('この記事を削除します。よろしいですか？')) return;
    const res = await fetch(`/api/admin/posts/${id}`, { method: 'DELETE', headers: authHeaders() });
    const data = await res.json();
    if (data.ok) { setMessage('削除しました'); setPreviewVersion(v => v + 1); await load(); }
    else setMessage(data.error ?? '削除に失敗しました');
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: 8,
    border: '1.5px solid #ddd', fontSize: 14, fontFamily: 'inherit',
  };
  const labelStyle: React.CSSProperties = { fontSize: 12, fontWeight: 700, color: '#555', margin: '18px 0 6px', display: 'block' };

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <LivePreview path={listFilter === 'blog' ? '/blog' : '/works'} version={previewVersion} />
      </div>
      {message && <p style={{ fontSize: 13, color: '#566246', fontWeight: 700 }}>{message}</p>}

      {!draft && (
        <>
          <button onClick={() => setDraft({ ...EMPTY_DRAFT, post_type: listFilter === 'blog' ? 'blog' : 'achievement' })} style={{
            margin: '0 0 16px', padding: '12px 24px', borderRadius: 8, border: 'none',
            background: '#566246', color: '#fff', fontWeight: 700, cursor: 'pointer', fontSize: 14,
          }}>＋ 新しい記事を書く</button>

          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            {(['all', 'achievement', 'blog'] as const).map(f => (
              <button key={f} onClick={() => setListFilter(f)} style={{
                padding: '6px 14px', borderRadius: 20, border: `1.5px solid ${listFilter === f ? '#566246' : '#ddd'}`,
                background: listFilter === f ? '#566246' : '#fff', color: listFilter === f ? '#fff' : '#555',
                fontWeight: 700, fontSize: 12.5, cursor: 'pointer',
              }}>
                {f === 'all' ? 'すべて' : f === 'achievement' ? '実績' : 'ブログ'}
              </button>
            ))}
          </div>

          {loading ? (
            <p style={{ fontSize: 13, color: '#999' }}>読み込み中…</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {posts.filter(p => listFilter === 'all' || p.post_type === listFilter).length === 0 && (
                <p style={{ fontSize: 13, color: '#999' }}>まだ記事がありません。</p>
              )}
              {posts.filter(p => listFilter === 'all' || p.post_type === listFilter).map(p => (
                <div key={p.id} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap',
                  border: '1px solid #e5e0d0', borderRadius: 10, padding: '14px 16px', background: '#fff',
                }}>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#23231F' }}>
                      {p.title}
                      {!p.is_published && <span style={{ marginLeft: 8, fontSize: 11, color: '#9C6B23', background: '#F5EDDD', padding: '2px 8px', borderRadius: 10 }}>下書き</span>}
                    </p>
                    <p style={{ margin: '4px 0 0', fontSize: 11, color: '#999' }}>
                      <span style={{ color: p.post_type === 'blog' ? '#2F8C88' : '#566246', fontWeight: 700 }}>{postTypeLabel(p.post_type)}</span>
                      {' ・ '}{categoryLabel(p.category)}
                      {p.event_date && ` ・ ${formatEventDateRange(p.event_date, p.event_date_end)}`}
                      {` ・ 感想${p.testimonials.length}件 ・ 写真${p.photo_urls.length}枚`}
                      {p.related_slug && ' ・ 関連ブログあり'}
                    </p>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => setDraft({
                      id: p.id, title: p.title, category: p.category,
                      post_type: p.post_type, related_slug: p.related_slug ?? '',
                      event_date: p.event_date ?? '', event_date_end: p.event_date_end ?? '', body: p.body,
                      cover_url: p.cover_url ?? '', photo_urls: p.photo_urls,
                      testimonials: p.testimonials, is_published: p.is_published,
                    })} style={{ padding: '7px 14px', borderRadius: 8, border: '1px solid #ddd', background: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 700, color: '#566246' }}>編集</button>
                    <button onClick={() => remove(p.id)} style={{ padding: '7px 14px', borderRadius: 8, border: '1px solid #ddd', background: '#fff', cursor: 'pointer', fontSize: 12, color: '#B23A2E' }}>削除</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {draft && (
        <div style={{ marginTop: 20 }}>
          <label style={labelStyle}>タイトル（例：〇〇市まちあるきイベントを実施しました）</label>
          <input value={draft.title} onChange={e => setDraft({ ...draft, title: e.target.value })} style={inputStyle} />

          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 200px' }}>
              <label style={labelStyle}>区分（実績かブログか）</label>
              <select value={draft.post_type} onChange={e => setDraft({ ...draft, post_type: e.target.value })} style={inputStyle}>
                {POST_TYPES.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
              </select>
            </div>
            <div style={{ flex: '1 1 200px' }}>
              <label style={labelStyle}>種別</label>
              <select value={draft.category} onChange={e => setDraft({ ...draft, category: e.target.value })} style={inputStyle}>
                {POST_CATEGORIES.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
              </select>
            </div>
            <div style={{ flex: '1 1 200px' }}>
              <label style={labelStyle}>実施日（開始日）</label>
              <input type="date" value={draft.event_date} onChange={e => setDraft({ ...draft, event_date: e.target.value })} style={inputStyle} />
            </div>
            <div style={{ flex: '1 1 200px' }}>
              <label style={labelStyle}>終了日（複数日程の場合のみ）</label>
              <input type="date" value={draft.event_date_end} min={draft.event_date || undefined} disabled={!draft.event_date}
                onChange={e => setDraft({ ...draft, event_date_end: e.target.value })} style={inputStyle} />
            </div>
          </div>

          {draft.post_type === 'achievement' && (
            <>
              <label style={labelStyle}>参考ブログ（この実績の背景を深掘りした記事があれば選ぶ）</label>
              <select value={draft.related_slug} onChange={e => setDraft({ ...draft, related_slug: e.target.value })} style={inputStyle}>
                <option value="">なし</option>
                {posts.filter(p => p.post_type === 'blog').map(p => (
                  <option key={p.slug} value={p.slug}>{p.title}</option>
                ))}
              </select>
            </>
          )}

          <label style={labelStyle}>本文（空行で段落が分かれます）</label>
          <textarea rows={10} value={draft.body} onChange={e => setDraft({ ...draft, body: e.target.value })}
            style={{ ...inputStyle, lineHeight: 1.8, resize: 'vertical' }}
            placeholder={'どんなイベントだったか、何が起きたかを、そのまま書いてください。\n\n段落を分けるときは空行を入れます。'} />

          <label style={labelStyle}>カバー写真</label>
          {draft.cover_url && (
            <div style={{ marginBottom: 8 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={draft.cover_url} alt="" style={{ width: 220, height: 140, objectFit: 'cover', borderRadius: 8, display: 'block' }} />
              <button onClick={() => setDraft({ ...draft, cover_url: '' })} style={{ marginTop: 4, fontSize: 11, color: '#B23A2E', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>カバーを外す</button>
            </div>
          )}
          <input type="file" accept="image/*" disabled={uploading} onChange={e => uploadImages(e.target.files, 'cover')} />

          <label style={labelStyle}>本文中の写真（複数可）</label>
          {draft.photo_urls.length > 0 && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
              {draft.photo_urls.map(url => (
                <div key={url} style={{ position: 'relative' }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt="" style={{ width: 110, height: 80, objectFit: 'cover', borderRadius: 8, display: 'block' }} />
                  <button onClick={() => setDraft({ ...draft, photo_urls: draft.photo_urls.filter(u => u !== url) })} style={{
                    position: 'absolute', top: -6, right: -6, width: 20, height: 20, borderRadius: '50%',
                    border: 'none', background: '#B23A2E', color: '#fff', fontSize: 11, cursor: 'pointer', lineHeight: 1,
                  }}>✕</button>
                </div>
              ))}
            </div>
          )}
          <input type="file" accept="image/*" multiple disabled={uploading} onChange={e => uploadImages(e.target.files, 'photos')} />
          {uploading && <p style={{ fontSize: 12, color: '#999' }}>アップロード中…</p>}

          <label style={labelStyle}>参加者の感想</label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {draft.testimonials.map((t, i) => (
              <div key={i} style={{ border: '1px solid #e5e0d0', borderRadius: 10, padding: 12, background: '#fff' }}>
                <input
                  value={t.name}
                  onChange={e => setDraft({ ...draft, testimonials: draft.testimonials.map((x, j) => j === i ? { ...x, name: e.target.value } : x) })}
                  placeholder="どなたの声か（例：参加学生（大学3年））"
                  style={{ ...inputStyle, marginBottom: 8, fontSize: 13 }}
                />
                <textarea
                  rows={3}
                  value={t.comment}
                  onChange={e => setDraft({ ...draft, testimonials: draft.testimonials.map((x, j) => j === i ? { ...x, comment: e.target.value } : x) })}
                  placeholder="感想をそのまま書き写す"
                  style={{ ...inputStyle, fontSize: 13, lineHeight: 1.7, resize: 'vertical' }}
                />
                <button onClick={() => setDraft({ ...draft, testimonials: draft.testimonials.filter((_, j) => j !== i) })}
                  style={{ marginTop: 6, fontSize: 11, color: '#B23A2E', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>この感想を削除</button>
              </div>
            ))}
            <button onClick={() => setDraft({ ...draft, testimonials: [...draft.testimonials, { name: '', comment: '' }] })}
              style={{ alignSelf: 'flex-start', padding: '8px 16px', borderRadius: 8, border: '1.5px solid #566246', background: '#fff', color: '#566246', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
              ＋ 感想を追加
            </button>
          </div>

          <label style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
            <input type="checkbox" checked={draft.is_published} onChange={e => setDraft({ ...draft, is_published: e.target.checked })} />
            公開する（チェックを外すと下書きとして保存）
          </label>

          <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
            <button onClick={save} disabled={saving || uploading} style={{
              flex: 1, padding: '13px 0', borderRadius: 8, border: 'none',
              background: '#23231F', color: '#fff', fontWeight: 700, fontSize: 14,
              cursor: saving ? 'wait' : 'pointer',
            }}>{saving ? '保存中…' : draft.id ? '更新する' : '保存する'}</button>
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
