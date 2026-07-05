'use client';

import { useState, useEffect } from 'react';
import type { Trace } from '@/lib/types';
import { getEmotion } from '@/lib/emotions';
import { getCategory } from '@/lib/categories';
import { getTraceType } from '@/lib/traceTypes';
import { getArchiveType, getVoiceRelation } from '@/lib/archiveTypes';

interface Props {
  trace: Trace;
  isOwn: boolean;
  onClose: () => void;
  onUpdate: (updated: Trace) => void;
  onDelete: (id: string) => void;
}

const inputStyle: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box', padding: '10px 12px', fontSize: 14,
  border: '1.5px solid #e0e0e0', borderRadius: 8, fontFamily: 'inherit',
  resize: 'vertical' as const, outline: 'none', background: '#fafafa',
};

export default function TraceDetail({ trace: initial, isOwn, onClose, onUpdate, onDelete }: Props) {
  const [trace, setTrace] = useState(initial);
  const [editing, setEditing] = useState(false);
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
  const [authorUsername, setAuthorUsername] = useState<string | null>(null);

  useEffect(() => {
    if (!trace.user_id) { setAuthorUsername(null); return; }
    (async () => {
      const { createAuthBrowserClient } = await import('@/lib/supabase/authClient');
      const supabase = createAuthBrowserClient();
      const { data } = await supabase.from('profiles').select('username').eq('id', trace.user_id!).maybeSingle();
      setAuthorUsername(data?.username ?? null);
    })();
  }, [trace.user_id]);

  const archiveType = getArchiveType(trace.archive_type);
  const emotion = archiveType ? null : getEmotion(trace.emotion_key);
  const category = archiveType ? null : getCategory(trace.category);
  const traceType = archiveType ? null : getTraceType(trace.trace_type);
  const voiceRelation = getVoiceRelation(trace.voice_relation);
  const sourceIsUrl = !!trace.source_ref && /^https?:\/\//.test(trace.source_ref);

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

  async function handleShare() {
    const text = `${emotion ? emotion.emoji + ' ' + emotion.label + '：' : ''}${trace.title}`;
    if (navigator.share) {
      await navigator.share({ title: 'ヒトマップの痕跡', text, url: window.location.href }).catch(() => {});
    } else {
      await navigator.clipboard.writeText(`${text}\n${window.location.href}`);
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
              <button onClick={handleShare} style={{
                width: 32, height: 32, borderRadius: 16,
                background: '#f0f0f0', border: 'none', cursor: 'pointer', fontSize: 16,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>🔗</button>
            </>
          )}
        </div>

        {/* スクロール領域 */}
        <div style={{ flex: 1, overflowY: 'auto', paddingBottom: isOwn ? 80 : 24 }}>

          {/* 写真 */}
          {trace.photo_url && !editing && (
            <img src={trace.photo_url} alt={trace.title} loading="lazy"
              style={{ width: '100%', maxHeight: 300, objectFit: 'cover', display: 'block' }} />
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
              {emotion && (
                <span style={{
                  padding: '4px 10px', borderRadius: 20,
                  background: emotion.color + '22', color: emotion.color,
                  fontSize: 13, fontWeight: 700,
                }}>{emotion.emoji} {emotion.label}</span>
              )}
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

            {/* 録音（表示モードのみ） */}
            {!editing && trace.audio_url && (
              <div style={{ marginBottom: 14 }}>
                <p style={{ fontSize: 12, color: '#bbb', margin: '0 0 4px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>🎙️ 録音</p>
                <audio controls src={trace.audio_url} style={{ width: '100%' }} />
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
            ) : trace.self_reflection ? (
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
              <p style={{ fontSize: 11, color: '#ccc', margin: '0 0 4px' }}>
                {new Date(trace.created_at).toLocaleString('ja-JP')}
                {authorUsername ? (
                  <> · <a href={`/profile/${authorUsername}`} style={{ color: '#38ADA9' }}>@{authorUsername}</a></>
                ) : trace.nickname ? ` · ${trace.nickname}` : ''}
              </p>
            )}

            {/* 地域ページへのリンク */}
            {!editing && trace.region && (
              <a href={`/region/${encodeURIComponent(trace.region)}`} style={{
                display: 'inline-block', marginBottom: 8, fontSize: 12, color: '#38ADA9',
                textDecoration: 'none', fontWeight: 700,
              }}>🏘 {trace.region}の投稿を見る</a>
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
                <p style={{ margin: 0, fontSize: 13, color: '#E55039', fontWeight: 700 }}>
                  🔐 削除するにはニックネームを入力してください
                </p>
                {trace.nickname && (
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
                  <button onClick={handleDelete} disabled={deleting || (!!trace.nickname && !deleteNickname)} style={{
                    flex: 2, padding: '10px 14px', borderRadius: 10, border: 'none',
                    background: (deleting || (!!trace.nickname && !deleteNickname)) ? '#ddd' : '#E55039',
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
                <button onClick={() => setEditing(true)} style={{
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
