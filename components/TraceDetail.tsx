'use client';

import { useState, useEffect, useRef } from 'react';
import type { Trace } from '@/lib/types';
import { getEmotion } from '@/lib/emotions';
import { getCategory, CATEGORIES } from '@/lib/categories';
import { getTraceType } from '@/lib/traceTypes';
import { getArchiveType, getVoiceRelation } from '@/lib/archiveTypes';
import ReportModal from './ReportModal';
import AudioWaveform from './AudioWaveform';
import EmotionPicker from './form/EmotionPicker';
import IntensityPicker from './form/IntensityPicker';
import ResonanceTowns from './ResonanceTowns';

interface Props {
  trace: Trace;
  isOwn: boolean;
  onClose: () => void;
  onUpdate: (updated: Trace) => void;
  onDelete: (id: string) => void;
  onNavigateTo?: (trace: Trace) => void;
  initialEditing?: boolean;
}

const REACTIONS = [
  { key: 'empathy', emoji: '🔥', label: 'わかる', color: '#FF6B9D' },
  { key: 'want_to_visit', emoji: '🚶', label: '歩いてみたい', color: '#38ADA9' },
  { key: 'nostalgic', emoji: '🍂', label: '懐かしい', color: '#F6B93B' },
] as const;

const inputStyle: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box', padding: '10px 12px', fontSize: 14,
  border: '1.5px solid #e0e0e0', borderRadius: 8, fontFamily: 'inherit',
  resize: 'vertical' as const, outline: 'none', background: '#fafafa',
};

export default function TraceDetail({ trace: initial, isOwn, onClose, onUpdate, onDelete, onNavigateTo, initialEditing }: Props) {
  const [trace, setTrace] = useState(initial);
  const [editing, setEditing] = useState(Boolean(initialEditing && isOwn));
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteNickname, setDeleteNickname] = useState('');
  const [deleteError, setDeleteError] = useState('');

  const [editTitle, setEditTitle] = useState(trace.title);
  const [editWhy, setEditWhy] = useState(trace.why ?? '');
  const [editInterp, setEditInterp] = useState(trace.interpretation ?? '');
  const [editSelf, setEditSelf] = useState(trace.self_reflection ?? '');
  const [editRevisit, setEditRevisit] = useState(trace.want_revisit);
  const [editShare, setEditShare] = useState(trace.want_to_share);
  const [editTranscript, setEditTranscript] = useState(trace.audio_transcript ?? '');
  const [editEmotions, setEditEmotions] = useState<string[]>(
    trace.emotion_keys ?? (trace.emotion_key ? [trace.emotion_key] : [])
  );
  const [editIntensity, setEditIntensity] = useState(trace.intensity ?? 3);
  const [editCategory, setEditCategory] = useState(trace.category);
  const [editPhotoUrl, setEditPhotoUrl] = useState(trace.photo_url);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [photoError, setPhotoError] = useState('');
  const photoInputRef = useRef<HTMLInputElement>(null);
  const [editVideoUrl, setEditVideoUrl] = useState(trace.video_url);
  const [videoUploading, setVideoUploading] = useState(false);
  const [videoError, setVideoError] = useState('');
  const videoInputRef = useRef<HTMLInputElement>(null);
  const [authorUsername, setAuthorUsername] = useState<string | null>(null);
  const [authorAvatarUrl, setAuthorAvatarUrl] = useState<string | null>(null);

  const [versions, setVersions] = useState<{ id: string; edited_at: string; title: string | null; why: string | null }[]>([]);
  const [versionsOpen, setVersionsOpen] = useState(false);
  const [versionsLoaded, setVersionsLoaded] = useState(false);
  const [reactionCounts, setReactionCounts] = useState<Record<string, number>>({});
  const [myReactions, setMyReactions] = useState<string[]>([]);
  const [reactionLoading, setReactionLoading] = useState<string | null>(null);
  const [bookmarked, setBookmarked] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [bookmarkLoading, setBookmarkLoading] = useState(false);
  const [nearbyTraces, setNearbyTraces] = useState<Trace[]>([]);
  const [revisits, setRevisits] = useState<Trace[]>([]);
  const [parentTrace, setParentTrace] = useState<Trace | null>(null);

  useEffect(() => {
    if (!trace.user_id) { setAuthorUsername(null); setAuthorAvatarUrl(null); return; }
    (async () => {
      const { createAuthBrowserClient } = await import('@/lib/supabase/authClient');
      const supabase = createAuthBrowserClient();
      const { data } = await supabase.from('profiles').select('username, avatar_url').eq('id', trace.user_id!).maybeSingle();
      setAuthorUsername(data?.username ?? null);
      setAuthorAvatarUrl(data?.avatar_url ?? null);
    })();
  }, [trace.user_id]);

  useEffect(() => {
    (async () => {
      const res = await fetch(`/api/reactions?trace_ids=${trace.id}`).then((r) => r.json()).catch(() => null);
      if (res?.ok) {
        setReactionCounts(res.counts?.[trace.id] ?? {});
        setMyReactions(res.mine?.[trace.id] ?? []);
      }
    })();
    (async () => {
      const res = await fetch(`/api/bookmarks?trace_id=${trace.id}`).then((r) => r.json()).catch(() => null);
      if (res?.ok) setBookmarked(Boolean(res.bookmarked));
    })();
    (async () => {
      const res = await fetch(`/api/traces/${trace.id}/nearby`).then((r) => r.json()).catch(() => null);
      if (res?.ok) setNearbyTraces(res.traces ?? []);
    })();
    (async () => {
      const res = await fetch(`/api/traces?revisit_of=${trace.id}`).then((r) => r.json()).catch(() => null);
      if (res?.ok) setRevisits(res.traces ?? []);
    })();
  }, [trace.id]);

  // この痕跡自体が「その後」の記録である場合、元の痕跡を取得しておく
  useEffect(() => {
    if (!trace.revisit_of) { setParentTrace(null); return; }
    (async () => {
      const res = await fetch(`/api/traces/${trace.revisit_of}`).then((r) => r.json()).catch(() => null);
      if (res?.ok) setParentTrace(res.trace);
    })();
  }, [trace.revisit_of]);

  async function toggleVersions() {
    const opening = !versionsOpen;
    setVersionsOpen(opening);
    if (opening && !versionsLoaded) {
      const res = await fetch(`/api/traces/${trace.id}/versions`).then((r) => r.json()).catch(() => null);
      if (res?.ok) setVersions(res.versions ?? []);
      setVersionsLoaded(true);
    }
  }

  async function toggleReaction(type: string) {
    const has = myReactions.includes(type);
    setReactionLoading(type);
    try {
      const res = await fetch('/api/reactions', {
        method: has ? 'DELETE' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trace_id: trace.id, reaction_type: type }),
      });
      if (res.status === 401) { window.location.href = '/login'; return; }
      const data = await res.json();
      if (data.ok) {
        setMyReactions((prev) => has ? prev.filter((t) => t !== type) : [...prev, type]);
        setReactionCounts((prev) => ({ ...prev, [type]: (prev[type] ?? 0) + (has ? -1 : 1) }));
      }
    } finally {
      setReactionLoading(null);
    }
  }

  async function toggleBookmark() {
    setBookmarkLoading(true);
    try {
      const res = await fetch('/api/bookmarks', {
        method: bookmarked ? 'DELETE' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trace_id: trace.id }),
      });
      if (res.status === 401) { window.location.href = '/login'; return; }
      const data = await res.json();
      if (data.ok) setBookmarked(!bookmarked);
    } finally {
      setBookmarkLoading(false);
    }
  }

  const archiveType = getArchiveType(trace.archive_type);
  const emotionList = archiveType
    ? []
    : (trace.emotion_keys ?? (trace.emotion_key ? [trace.emotion_key] : []))
        .map(getEmotion)
        .filter((e): e is NonNullable<typeof e> => e !== null);
  const category = archiveType ? null : getCategory(trace.category);
  const traceType = archiveType ? null : getTraceType(trace.trace_type);
  const voiceRelation = getVoiceRelation(trace.voice_relation);
  const sourceIsUrl = !!trace.source_ref && /^https?:\/\//.test(trace.source_ref);

  async function handlePhotoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoError('');
    setPhotoUploading(true);
    try {
      const { uploadTracePhoto } = await import('@/lib/supabase/upload');
      const url = await uploadTracePhoto(file);
      setEditPhotoUrl(url);
    } catch (err) {
      setPhotoError(err instanceof Error ? err.message : '写真のアップロードに失敗しました');
    } finally {
      setPhotoUploading(false);
      if (photoInputRef.current) photoInputRef.current.value = '';
    }
  }

  const MAX_VIDEO_MB = 30;
  async function handleVideoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setVideoError('');
    if (file.size > MAX_VIDEO_MB * 1024 * 1024) {
      setVideoError(`動画は${MAX_VIDEO_MB}MBまでです。短く撮り直してください`);
      if (videoInputRef.current) videoInputRef.current.value = '';
      return;
    }
    setVideoUploading(true);
    try {
      const { uploadTraceVideo } = await import('@/lib/supabase/upload');
      const url = await uploadTraceVideo(file);
      setEditVideoUrl(url);
    } catch (err) {
      setVideoError(err instanceof Error ? err.message : '動画のアップロードに失敗しました');
    } finally {
      setVideoUploading(false);
      if (videoInputRef.current) videoInputRef.current.value = '';
    }
  }

  async function handleSave() {
    if (!editTitle.trim()) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/traces/${trace.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: editTitle.trim(),
          why: editWhy.trim() || null,
          interpretation: editInterp.trim() || null,
          self_reflection: editSelf.trim() || null,
          want_revisit: editRevisit,
          want_to_share: editShare,
          audio_transcript: editTranscript.trim() || null,
          emotion_key: editEmotions[0] ?? null,
          emotion_keys: editEmotions.length > 0 ? editEmotions : null,
          intensity: editIntensity,
          category: editCategory,
          photo_url: editPhotoUrl,
          photo_urls: editPhotoUrl ? [editPhotoUrl] : null,
          video_url: editVideoUrl,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setTrace(data.trace);
        onUpdate(data.trace);
        setEditing(false);
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    setDeleteError('');
    try {
      const res = await fetch(`/api/traces/${trace.id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nickname: deleteNickname }),
      });
      const data = await res.json();
      if (data.ok) {
        onDelete(trace.id);
      } else {
        setDeleteError(data.error ?? '削除に失敗しました');
      }
    } finally {
      setDeleting(false);
    }
  }

  function startEditing() {
    setEditTitle(trace.title);
    setEditWhy(trace.why ?? '');
    setEditInterp(trace.interpretation ?? '');
    setEditSelf(trace.self_reflection ?? '');
    setEditRevisit(trace.want_revisit);
    setEditShare(trace.want_to_share);
    setEditTranscript(trace.audio_transcript ?? '');
    setEditEmotions(trace.emotion_keys ?? (trace.emotion_key ? [trace.emotion_key] : []));
    setEditIntensity(trace.intensity ?? 3);
    setEditCategory(trace.category);
    setEditPhotoUrl(trace.photo_url);
    setPhotoError('');
    setEditVideoUrl(trace.video_url);
    setVideoError('');
    setEditing(true);
  }

  async function handleShare() {
    const text = `${emotionList.length > 0 ? emotionList.map(e => e.emoji).join('') + ' ' + emotionList.map(e => e.label).join('・') + '：' : ''}${trace.title}`;
    const shareUrl = `${window.location.origin}/t/${trace.id}`;
    if (navigator.share) {
      await navigator.share({ title: 'ヒトマップの痕跡', text, url: shareUrl }).catch(() => {});
    } else {
      await navigator.clipboard.writeText(`${text}\n${shareUrl}`);
      alert('クリップボードにコピーしました');
    }
  }

  return (
    <>
      {/* オーバーレイ */}
      <div onClick={onClose} style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000,
      }} />

      {/* ボトムシート */}
      <div style={{
        position: 'fixed', left: 0, right: 0, bottom: 0,
        maxHeight: '92dvh', background: '#fff',
        borderRadius: '20px 20px 0 0', zIndex: 1001,
        display: 'flex', flexDirection: 'column',
        boxShadow: '0 -4px 30px rgba(0,0,0,0.18)',
      }}>
        {/* ドラッグハンドル */}
        <div style={{ display: 'flex', justifyContent: 'center', padding: '10px 0 4px' }}>
          <div style={{ width: 36, height: 4, background: '#e0e0e0', borderRadius: 2 }} />
        </div>

        {/* ヘッダー */}
        <div style={{ display: 'flex', alignItems: 'center', padding: '0 14px 10px', gap: 8 }}>
          {editing ? (
            <>
              <button onClick={() => setEditing(false)} style={{
                background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, color: '#666', padding: 0,
              }}>← キャンセル</button>
              <div style={{ flex: 1 }} />
              <button onClick={handleSave} disabled={saving || !editTitle.trim()} style={{
                padding: '8px 18px', borderRadius: 20, border: 'none',
                background: saving || !editTitle.trim() ? '#ddd' : '#FF6B9D',
                color: '#fff', fontWeight: 700, fontSize: 14, cursor: saving ? 'wait' : 'pointer',
              }}>{saving ? '保存中…' : '保存する'}</button>
            </>
          ) : (
            <>
              <button onClick={onClose} style={{
                width: 32, height: 32, borderRadius: 16,
                background: '#f0f0f0', border: 'none', cursor: 'pointer', fontSize: 18,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>×</button>
              <div style={{ flex: 1 }} />
              {!isOwn && (
                <button onClick={() => setShowReportModal(true)} title="通報する" style={{
                  width: 32, height: 32, borderRadius: 16,
                  background: '#f0f0f0', border: 'none', cursor: 'pointer', fontSize: 15,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>⚠</button>
              )}
              <button onClick={handleShare} style={{
                width: 32, height: 32, borderRadius: 16,
                background: '#f0f0f0', border: 'none', cursor: 'pointer', fontSize: 16,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>🔗</button>
            </>
          )}
        </div>

        {showReportModal && (
          <ReportModal traceId={trace.id} onClose={() => setShowReportModal(false)} />
        )}

        {/* スクロール領域 */}
        <div style={{ flex: 1, overflowY: 'auto', paddingBottom: isOwn ? 80 : 24 }}>

          {/* 写真（複数枚は横スクロールで並べる） */}
          {trace.photo_url && !editing && (
            (trace.photo_urls && trace.photo_urls.length > 1) ? (
              <div style={{ display: 'flex', overflowX: 'auto', scrollSnapType: 'x mandatory' }}>
                {trace.photo_urls.map((url, i) => (
                  <img key={i} src={url} alt={`${trace.title} ${i + 1}`} loading="lazy"
                    style={{ width: '100%', maxHeight: 300, objectFit: 'cover', display: 'block', flexShrink: 0, scrollSnapAlign: 'start' }} />
                ))}
              </div>
            ) : (
              <img src={trace.photo_url} alt={trace.title} loading="lazy"
                style={{ width: '100%', maxHeight: 300, objectFit: 'cover', display: 'block' }} />
            )
          )}

          {/* 動画（表示モードのみ） */}
          {trace.video_url && !editing && (
            <video controls src={trace.video_url} style={{ width: '100%', maxHeight: 300, display: 'block', background: '#000' }} />
          )}

          {editing && (
            <div style={{ padding: '16px 16px 0' }}>
              <label style={{ fontSize: 12, color: '#aaa', display: 'block', marginBottom: 6 }}>📷 写真</label>
              {editPhotoUrl && (
                <img src={editPhotoUrl} alt="" style={{ width: '100%', maxHeight: 220, objectFit: 'cover', borderRadius: 10, marginBottom: 8, display: 'block' }} />
              )}
              <input ref={photoInputRef} type="file" accept="image/*" onChange={handlePhotoSelect} style={{ display: 'none' }} id="trace-photo-input" />
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="button" onClick={() => photoInputRef.current?.click()} disabled={photoUploading} style={{
                  flex: 1, padding: '9px 0', borderRadius: 8, border: '1.5px solid #ddd',
                  background: '#fafafa', color: '#555', fontSize: 13, fontWeight: 700,
                  cursor: photoUploading ? 'wait' : 'pointer',
                }}>{photoUploading ? 'アップロード中…' : editPhotoUrl ? '写真を変更' : '📷 写真を追加'}</button>
                {editPhotoUrl && (
                  <button type="button" onClick={() => setEditPhotoUrl(null)} style={{
                    padding: '9px 14px', borderRadius: 8, border: '1.5px solid #ddd',
                    background: '#fff', color: '#E55039', fontSize: 13, cursor: 'pointer',
                  }}>削除</button>
                )}
              </div>
              {photoError && <p style={{ margin: '6px 0 0', fontSize: 12, color: '#E55039' }}>{photoError}</p>}

              <label style={{ fontSize: 12, color: '#aaa', display: 'block', margin: '16px 0 6px' }}>🎥 動画（任意・1本まで）</label>
              {editVideoUrl && (
                <video controls src={editVideoUrl} style={{ width: '100%', maxHeight: 200, borderRadius: 10, marginBottom: 8, display: 'block', background: '#000' }} />
              )}
              <input ref={videoInputRef} type="file" accept="video/*" onChange={handleVideoSelect} style={{ display: 'none' }} />
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="button" onClick={() => videoInputRef.current?.click()} disabled={videoUploading} style={{
                  flex: 1, padding: '9px 0', borderRadius: 8, border: '1.5px solid #ddd',
                  background: '#fafafa', color: '#555', fontSize: 13, fontWeight: 700,
                  cursor: videoUploading ? 'wait' : 'pointer',
                }}>{videoUploading ? 'アップロード中…' : editVideoUrl ? '動画を変更' : '🎥 動画を追加'}</button>
                {editVideoUrl && (
                  <button type="button" onClick={() => setEditVideoUrl(null)} style={{
                    padding: '9px 14px', borderRadius: 8, border: '1.5px solid #ddd',
                    background: '#fff', color: '#E55039', fontSize: 13, cursor: 'pointer',
                  }}>削除</button>
                )}
              </div>
              {videoError && <p style={{ margin: '6px 0 0', fontSize: 12, color: '#E55039' }}>{videoError}</p>}
            </div>
          )}

          <div style={{ padding: '16px 16px 0' }}>

            {/* タグ行 */}
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
              {archiveType && (
                <span style={{
                  padding: '4px 10px', borderRadius: 20,
                  background: archiveType.color + '22', color: archiveType.color,
                  fontSize: 13, fontWeight: 700,
                }}>{archiveType.emoji} {archiveType.label}</span>
              )}
              {traceType && (
                <span style={{
                  padding: '4px 10px', borderRadius: 20,
                  background: traceType.color + '22', color: traceType.color,
                  fontSize: 13, fontWeight: 700,
                }}>{traceType.emoji} {traceType.label}</span>
              )}
              {trace.is_past_memory && (
                <span style={{
                  padding: '4px 10px', borderRadius: 20,
                  background: '#FFF3CD', color: '#856404',
                  fontSize: 13, fontWeight: 700,
                }}>🕰 過去の記憶{trace.memory_date ? `（${trace.memory_date}）` : ''}</span>
              )}
              {emotionList.map(emotion => (
                <span key={emotion.key} style={{
                  padding: '4px 10px', borderRadius: 20,
                  background: emotion.color + '22', color: emotion.color,
                  fontSize: 13, fontWeight: 700,
                }}>{emotion.emoji} {emotion.label}</span>
              ))}
              {category && (
                <span style={{
                  padding: '4px 10px', borderRadius: 20,
                  background: '#f0f0f0', color: '#666', fontSize: 13,
                }}>{category.emoji} {category.label}</span>
              )}
              {trace.intensity && (
                <span style={{ fontSize: 13, color: '#bbb', display: 'flex', alignItems: 'center' }}>
                  {'●'.repeat(trace.intensity)}{'○'.repeat(5 - trace.intensity)}
                </span>
              )}
              {(trace.custom_tags ?? []).map(tag => (
                <span key={tag} style={{
                  padding: '3px 9px', borderRadius: 20,
                  background: '#f5f5f5', color: '#555', fontSize: 12, border: '1px solid #e0e0e0',
                }}>#{tag}</span>
              ))}
            </div>

            {/* タイトル */}
            {editing ? (
              <div style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 12, color: '#aaa', display: 'block', marginBottom: 4 }}>タイトル *</label>
                <input value={editTitle} onChange={e => setEditTitle(e.target.value)} style={inputStyle} />
              </div>
            ) : (
              <h2 style={{ margin: '0 0 14px', fontSize: 20, lineHeight: 1.4, fontWeight: 800 }}>
                {trace.title}
                {trace.yomi && <span style={{ fontWeight: 400, color: '#aaa', fontSize: 14 }}>（{trace.yomi}）</span>}
              </h2>
            )}

            {editing && !archiveType && (
              <div style={{ marginBottom: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                  <label style={{ fontSize: 12, color: '#aaa', display: 'block', marginBottom: 6 }}>どんな感情？（複数選べます）</label>
                  <EmotionPicker value={editEmotions} onChange={setEditEmotions} />
                </div>
                <div>
                  <label style={{ fontSize: 12, color: '#aaa', display: 'block', marginBottom: 6 }}>強さ</label>
                  <IntensityPicker value={editIntensity} onChange={setEditIntensity} />
                </div>
                <div>
                  <label style={{ fontSize: 12, color: '#aaa', display: 'block', marginBottom: 6 }}>何に心が動いた？</label>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {CATEGORIES.map((c) => {
                      const selected = editCategory === c.key;
                      return (
                        <button key={c.key} type="button" onClick={() => setEditCategory(c.key)} style={{
                          display: 'flex', alignItems: 'center', gap: 4, padding: '8px 12px', borderRadius: 20,
                          border: `2px solid ${selected ? '#38ADA9' : '#ddd'}`,
                          background: selected ? '#38ADA9' : '#fff',
                          color: selected ? '#fff' : '#333', fontSize: 13, cursor: 'pointer',
                        }}>{c.emoji} {c.label}</button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* 共感（わかる／歩いてみたい／懐かしい）・ブックマーク */}
            {!editing && (
              <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
                {REACTIONS.map((r) => {
                  const active = myReactions.includes(r.key);
                  const count = reactionCounts[r.key] ?? 0;
                  return (
                    <button key={r.key} onClick={() => toggleReaction(r.key)} disabled={reactionLoading === r.key} style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      padding: '9px 14px', borderRadius: 20, cursor: reactionLoading === r.key ? 'wait' : 'pointer',
                      border: `2px solid ${active ? r.color : '#eee'}`,
                      background: active ? r.color + '18' : '#fff',
                      color: active ? r.color : '#999',
                      fontWeight: 700, fontSize: 13,
                    }}>
                      {r.emoji} {r.label} {count > 0 ? count : ''}
                    </button>
                  );
                })}
                <button onClick={toggleBookmark} disabled={bookmarkLoading} style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '9px 16px', borderRadius: 20, cursor: bookmarkLoading ? 'wait' : 'pointer',
                  border: `2px solid ${bookmarked ? '#F6B93B' : '#eee'}`,
                  background: bookmarked ? '#FFFBF0' : '#fff',
                  color: bookmarked ? '#B7791F' : '#999',
                  fontWeight: 700, fontSize: 13,
                }}>
                  {bookmarked ? '🔖 保存済み' : '🔖 保存する'}
                </button>
              </div>
            )}

            {/* 録音（表示モードのみ） */}
            {!editing && trace.audio_url && (
              <div style={{ marginBottom: 14 }}>
                <p style={{ fontSize: 12, color: '#bbb', margin: '0 0 4px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>🎙️ 録音</p>
                <div style={{ background: '#FBF6FF', borderRadius: 10, padding: '8px 10px 0' }}>
                  <AudioWaveform url={trace.audio_url} />
                </div>
                <audio controls src={trace.audio_url} style={{ width: '100%', marginTop: 6 }} />
                {trace.audio_transcript && (
                  <div style={{ marginTop: 8, background: '#fafafa', borderRadius: 10, padding: '10px 12px' }}>
                    <p style={{ fontSize: 11, color: '#aaa', margin: '0 0 4px', fontWeight: 700 }}>📝 文字起こし</p>
                    <p style={{ fontSize: 13, color: '#555', margin: 0, lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{trace.audio_transcript}</p>
                  </div>
                )}
              </div>
            )}

            {/* アーカイブ情報（表示モードのみ） */}
            {!editing && archiveType && (trace.alt_names || trace.era_label || voiceRelation || trace.source_ref) && (
              <div style={{
                background: archiveType.color + '0D', border: `1px solid ${archiveType.color}33`,
                borderRadius: 10, padding: '10px 12px', marginBottom: 14,
                display: 'flex', flexDirection: 'column', gap: 6,
              }}>
                {trace.alt_names && (
                  <p style={{ margin: 0, fontSize: 13, color: '#444' }}>
                    <span style={{ color: '#999', fontSize: 11, fontWeight: 700 }}>別名・旧称　</span>{trace.alt_names}
                  </p>
                )}
                {trace.era_label && (
                  <p style={{ margin: 0, fontSize: 13, color: '#444' }}>
                    <span style={{ color: '#999', fontSize: 11, fontWeight: 700 }}>時代・年代　</span>{trace.era_label}
                  </p>
                )}
                {voiceRelation && (
                  <p style={{ margin: 0, fontSize: 13, color: '#444' }}>
                    <span style={{ color: '#999', fontSize: 11, fontWeight: 700 }}>語り手　</span>{voiceRelation.label}
                  </p>
                )}
                {trace.source_ref && (
                  <p style={{ margin: 0, fontSize: 13, color: '#444', wordBreak: 'break-all' }}>
                    <span style={{ color: '#999', fontSize: 11, fontWeight: 700 }}>出典　</span>
                    {sourceIsUrl ? (
                      <a href={trace.source_ref} target="_blank" rel="noopener noreferrer" style={{ color: '#2E86C1' }}>
                        {trace.source_ref}
                      </a>
                    ) : trace.source_ref}
                  </p>
                )}
              </div>
            )}

            {/* なぜ */}
            {editing ? (
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 12, color: '#aaa', display: 'block', marginBottom: 4 }}>なぜ気になった？</label>
                <textarea value={editWhy} onChange={e => setEditWhy(e.target.value)} rows={2} style={inputStyle} />
              </div>
            ) : trace.why ? (
              <div style={{ marginBottom: 14 }}>
                <p style={{ fontSize: 12, color: '#bbb', margin: '0 0 4px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>{archiveType ? archiveType.bodyLabel : 'なぜ気になった'}</p>
                <p style={{ margin: 0, fontSize: 14, lineHeight: 1.7, color: '#333' }}>{trace.why}</p>
              </div>
            ) : null}

            {/* 見えた暮らし */}
            {editing ? (
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 12, color: '#aaa', display: 'block', marginBottom: 4 }}>誰のどんな暮らし・想いが見えた？</label>
                <textarea value={editInterp} onChange={e => setEditInterp(e.target.value)} rows={2} style={inputStyle} />
              </div>
            ) : trace.interpretation ? (
              <div style={{ marginBottom: 14 }}>
                <p style={{ fontSize: 12, color: '#bbb', margin: '0 0 4px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>見えた暮らし・想い</p>
                <p style={{ margin: 0, fontSize: 14, lineHeight: 1.7, color: '#333' }}>{trace.interpretation}</p>
              </div>
            ) : null}

            {/* 自分との接点 */}
            {editing ? (
              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 12, color: '#aaa', display: 'block', marginBottom: 4 }}>自分のどんな記憶・感情とつながった？</label>
                <textarea value={editSelf} onChange={e => setEditSelf(e.target.value)} rows={2} style={inputStyle} />
              </div>
            ) : null}

            {editing && trace.audio_url && (
              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 12, color: '#aaa', display: 'block', marginBottom: 4 }}>📝 文字起こし</label>
                <textarea value={editTranscript} onChange={e => setEditTranscript(e.target.value)} rows={3} style={inputStyle} />
              </div>
            )}

            {!editing && trace.self_reflection ? (
              <div style={{ marginBottom: 14 }}>
                <p style={{ fontSize: 12, color: '#bbb', margin: '0 0 4px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>自分との接点</p>
                <p style={{ margin: 0, fontSize: 14, lineHeight: 1.7, color: '#333' }}>{trace.self_reflection}</p>
              </div>
            ) : null}

            {/* 編集モードのトグル */}
            {editing && (
              <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
                {([
                  { label: '🔁 また来たい', val: editRevisit, toggle: () => setEditRevisit(v => !v) },
                  { label: '🗣 誰かに話したい', val: editShare, toggle: () => setEditShare(v => !v) },
                ] as { label: string; val: boolean; toggle: () => void }[]).map(({ label, val, toggle }) => (
                  <button key={label} type="button" onClick={toggle} style={{
                    flex: 1, padding: '10px 4px', borderRadius: 10, fontSize: 12,
                    border: `2px solid ${val ? '#38ADA9' : '#ddd'}`,
                    background: val ? '#E8F8F7' : '#fff',
                    color: val ? '#38ADA9' : '#aaa',
                    fontWeight: val ? 700 : 400, cursor: 'pointer',
                  }}>{label}</button>
                ))}
              </div>
            )}

            {/* バッジ（表示モード） */}
            {!editing && (trace.want_revisit || trace.want_to_share) && (
              <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
                {trace.want_revisit && (
                  <span style={{ padding: '4px 12px', borderRadius: 20, fontSize: 12, background: '#E8F8F7', color: '#38ADA9', fontWeight: 700 }}>
                    🔁 また来たい
                  </span>
                )}
                {trace.want_to_share && (
                  <span style={{ padding: '4px 12px', borderRadius: 20, fontSize: 12, background: '#EEF4FF', color: '#4A90E2', fontWeight: 700 }}>
                    🗣 誰かに話したい
                  </span>
                )}
              </div>
            )}

            {/* 日時・ニックネーム */}
            {!editing && (
              <p style={{ fontSize: 11, color: '#ccc', margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                {authorAvatarUrl && (
                  <img src={authorAvatarUrl} alt="" style={{ width: 18, height: 18, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                )}
                <span>
                  {new Date(trace.created_at).toLocaleString('ja-JP')}
                  {authorUsername ? (
                    <> · <a href={`/profile/${authorUsername}`} style={{ color: '#38ADA9' }}>@{authorUsername}</a></>
                  ) : trace.nickname ? ` · ${trace.nickname}` : ''}
                </span>
                {trace.team && (
                  <span style={{
                    display: 'inline-block', padding: '2px 9px', borderRadius: 20,
                    background: '#8E44AD22', color: '#8E44AD', fontSize: 11, fontWeight: 700,
                  }}>🏳 {trace.team}</span>
                )}
              </p>
            )}

            {/* 地域ページへのリンク */}
            {!editing && trace.region && (
              <a href={`/region/${encodeURIComponent(trace.region)}`} style={{
                display: 'inline-block', marginBottom: 8, fontSize: 12, color: '#38ADA9',
                textDecoration: 'none', fontWeight: 700,
              }}>🏘 {trace.region}の投稿を見る</a>
            )}

            {/* 重ね書き：同じ場所に残された他の痕跡 */}
            {!editing && nearbyTraces.length > 0 && (
              <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid #f0f0f0' }}>
                <p style={{ margin: '0 0 10px', fontSize: 13, fontWeight: 700, color: '#444' }}>
                  📍 あなたは今、{nearbyTraces.length}人が心を動かされた場所にいる
                </p>
                <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 4 }}>
                  {nearbyTraces.map((nt) => {
                    const ntEmotion = getEmotion(nt.emotion_key);
                    return (
                      <button
                        key={nt.id}
                        onClick={() => onNavigateTo?.(nt)}
                        style={{
                          flexShrink: 0, width: 130, textAlign: 'left', cursor: onNavigateTo ? 'pointer' : 'default',
                          border: '1px solid #eee', borderRadius: 10, overflow: 'hidden', background: '#fff', padding: 0,
                        }}
                      >
                        {nt.photo_url ? (
                          <img src={nt.photo_url} alt={nt.title} style={{ width: '100%', height: 80, objectFit: 'cover', display: 'block' }} />
                        ) : (
                          <div style={{
                            width: '100%', height: 80, background: (ntEmotion?.color ?? '#ddd') + '22',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22,
                          }}>{ntEmotion?.emoji ?? '📍'}</div>
                        )}
                        <div style={{ padding: '6px 8px' }}>
                          <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: '#333', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{nt.title}</p>
                          <p style={{ margin: '2px 0 0', fontSize: 10, color: '#aaa' }}>{new Date(nt.created_at).toLocaleDateString('ja-JP')}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* この痕跡自体が「その後」の記録である場合、元の痕跡へのリンクを出す */}
            {!editing && parentTrace && (
              <button
                onClick={() => onNavigateTo?.(parentTrace)}
                style={{
                  display: 'block', width: '100%', textAlign: 'left', marginTop: 16,
                  padding: '10px 12px', borderRadius: 10, border: '1px solid #F4ECFB',
                  background: '#FBF6FF', cursor: onNavigateTo ? 'pointer' : 'default',
                }}
              >
                <span style={{ fontSize: 12, color: '#8E44AD', fontWeight: 700 }}>
                  🔁 「{parentTrace.title}」のその後の記録です →
                </span>
              </button>
            )}

            {/* 痕跡の「その後」：また来た時に、同じ場所がどう変化したかを積み重ねていく */}
            {!editing && !archiveType && (
              <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid #f0f0f0' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#444' }}>
                    📆 その後の変化{revisits.length > 0 ? `（${revisits.length}）` : ''}
                  </p>
                  <a
                    href={`/post?revisit_of=${trace.id}&lat=${trace.latitude}&lng=${trace.longitude}&revisit_of_title=${encodeURIComponent(trace.title)}`}
                    style={{
                      fontSize: 12, fontWeight: 700, color: '#8E44AD',
                      background: '#F4ECFB', padding: '5px 12px', borderRadius: 20, textDecoration: 'none',
                    }}
                  >
                    🔁 その後を記録する
                  </a>
                </div>
                {revisits.length > 0 && (
                  <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 4 }}>
                    {revisits.map((rv) => {
                      const rvEmotion = getEmotion(rv.emotion_key);
                      return (
                        <button
                          key={rv.id}
                          onClick={() => onNavigateTo?.(rv)}
                          style={{
                            flexShrink: 0, width: 130, textAlign: 'left', cursor: onNavigateTo ? 'pointer' : 'default',
                            border: '1px solid #eee', borderRadius: 10, overflow: 'hidden', background: '#fff', padding: 0,
                          }}
                        >
                          {rv.photo_url ? (
                            <img src={rv.photo_url} alt={rv.title} style={{ width: '100%', height: 80, objectFit: 'cover', display: 'block' }} />
                          ) : (
                            <div style={{
                              width: '100%', height: 80, background: (rvEmotion?.color ?? '#ddd') + '22',
                              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22,
                            }}>{rvEmotion?.emoji ?? '📍'}</div>
                          )}
                          <div style={{ padding: '6px 8px' }}>
                            <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: '#333', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{rv.title}</p>
                            <p style={{ margin: '2px 0 0', fontSize: 10, color: '#aaa' }}>{new Date(rv.created_at).toLocaleDateString('ja-JP')}</p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {!editing && !archiveType && trace.emotion_key && trace.region && (
              <ResonanceTowns traceId={trace.id} />
            )}

            {!editing && (
              <div style={{ marginTop: 16, paddingTop: 12, borderTop: '1px solid #f5f5f5' }}>
                <button onClick={toggleVersions} style={{
                  background: 'none', border: 'none', padding: 0, cursor: 'pointer',
                  fontSize: 12, color: '#bbb', fontWeight: 700,
                }}>🕰 変更履歴を見る（痕跡は上書きしない）{versionsOpen ? ' ▴' : ' ▾'}</button>
                {versionsOpen && (
                  versionsLoaded && versions.length === 0 ? (
                    <p style={{ margin: '8px 0 0', fontSize: 12, color: '#ccc' }}>まだ編集履歴はありません</p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
                      {versions.map((v) => (
                        <div key={v.id} style={{ background: '#fafafa', borderRadius: 8, padding: '8px 10px' }}>
                          <p style={{ margin: '0 0 3px', fontSize: 10, color: '#bbb' }}>{new Date(v.edited_at).toLocaleString('ja-JP')} 時点</p>
                          <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#666' }}>{v.title}</p>
                          {v.why && <p style={{ margin: '3px 0 0', fontSize: 12, color: '#888' }}>{v.why}</p>}
                        </div>
                      ))}
                    </div>
                  )
                )}
              </div>
            )}
          </div>
        </div>

        {/* 自分の投稿フッター */}
        {isOwn && !editing && (
          <div style={{
            position: 'absolute', bottom: 0, left: 0, right: 0,
            padding: '12px 16px', background: '#fff',
            borderTop: '1px solid #f0f0f0',
            display: 'flex', flexDirection: 'column', gap: 8,
            paddingBottom: 'calc(12px + env(safe-area-inset-bottom))',
          }}>
            {confirmDelete ? (
              <>
                {trace.user_id ? (
                  <p style={{ margin: 0, fontSize: 13, color: '#E55039', fontWeight: 700 }}>
                    🔐 あなたのアカウントの投稿です。本当に削除しますか？（あとで管理者に復元を依頼できます）
                  </p>
                ) : (
                  <p style={{ margin: 0, fontSize: 13, color: '#E55039', fontWeight: 700 }}>
                    🔐 削除するにはニックネームを入力してください
                  </p>
                )}
                {!trace.user_id && trace.nickname && (
                  <input
                    placeholder={`ニックネームを入力（例: ${trace.nickname}）`}
                    value={deleteNickname}
                    onChange={e => { setDeleteNickname(e.target.value); setDeleteError(''); }}
                    style={{
                      padding: '9px 12px', borderRadius: 8, fontSize: 13,
                      border: `1.5px solid ${deleteError ? '#E55039' : '#ddd'}`,
                      outline: 'none', width: '100%', boxSizing: 'border-box' as const,
                    }}
                  />
                )}
                {deleteError && (
                  <p style={{ margin: 0, fontSize: 12, color: '#E55039' }}>{deleteError}</p>
                )}
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => { setConfirmDelete(false); setDeleteNickname(''); setDeleteError(''); }} style={{
                    flex: 1, padding: '10px 14px', borderRadius: 10, border: '1.5px solid #ddd',
                    background: '#fff', cursor: 'pointer', fontSize: 13,
                  }}>キャンセル</button>
                  <button onClick={handleDelete} disabled={deleting || (!trace.user_id && !!trace.nickname && !deleteNickname)} style={{
                    flex: 2, padding: '10px 14px', borderRadius: 10, border: 'none',
                    background: (deleting || (!trace.user_id && !!trace.nickname && !deleteNickname)) ? '#ddd' : '#E55039',
                    color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 700,
                  }}>{deleting ? '削除中…' : '削除する'}</button>
                </div>
              </>
            ) : (
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={() => setConfirmDelete(true)} style={{
                  flex: 1, padding: '12px', borderRadius: 10,
                  border: '1.5px solid #ddd', background: '#fff',
                  color: '#E55039', cursor: 'pointer', fontSize: 14,
                }}>削除</button>
                <button onClick={startEditing} style={{
                  flex: 2, padding: '12px', borderRadius: 10,
                  border: 'none', background: '#FF6B9D',
                  color: '#fff', cursor: 'pointer', fontSize: 14, fontWeight: 700,
                }}>✏️ 編集する</button>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
