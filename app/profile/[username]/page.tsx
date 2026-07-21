'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import TraceCard from '@/components/report/TraceCard';
import TraceDetail from '@/components/TraceDetail';
import EmotionTimeline from '@/components/profile/EmotionTimeline';
import EnList from '@/components/profile/EnList';
import type { Trace } from '@/lib/types';
import { computeBadges } from '@/lib/badges';
import { computeCharacter } from '@/lib/character';
import CharacterScene from '@/components/profile/CharacterScene';
import RegionCounterCard from '@/components/profile/RegionCounterCard';

const TraceMap = dynamic(() => import('@/components/map/TraceMap'), { ssr: false });

const BIO_MAX_LENGTH = 300;
const APPOINTMENT_PURPOSE_MAX_LENGTH = 300;

// 自己紹介を1つの空欄ではなく3つの短い問いに分けて、書き出しやすくする。
// 保存時はこの3つを空行区切りで結合し、これまで通り単一のbio文字列としてDBに入れる。
const BIO_QUESTIONS = [
  {
    key: 'moved',
    label: 'どんな痕跡に心が動く？',
    placeholder: '例）古い商店の看板の文字が好きです。書いた人の手癖が残っているから。',
    traceField: 'why' as const,
  },
  {
    key: 'why_started',
    label: 'なぜヒトマップを始めた？',
    placeholder: '例）浦河町を歩いてから、モノに残った時間を探すのが習慣になりました。',
    traceField: 'self_reflection' as const,
  },
  {
    key: 'next',
    label: 'これからどんな町を歩いてみたい？',
    placeholder: '例）まだ歩いていない、海沿いの小さな町。',
    traceField: null,
  },
] as const;
const BIO_PART_MAX = 100;

interface Profile {
  id: string;
  username: string;
  display_name: string | null;
  bio: string | null;
  avatar_url: string | null;
  character_name: string | null;
}

interface AppointmentRequest {
  id: string;
  requester_id: string;
  requestee_id: string;
  trace_id: string | null;
  purpose: string;
  status: 'pending' | 'accepted' | 'declined';
  created_at: string;
}

function Avatar({ url, size = 72 }: { url: string | null; size?: number }) {
  if (url) {
    return (
      <img src={url} alt="" style={{
        width: size, height: size, borderRadius: '50%', objectFit: 'cover',
        border: '2px solid #fff', boxShadow: '0 1px 4px rgba(0,0,0,0.15)', flexShrink: 0,
      }} />
    );
  }
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', flexShrink: 0,
      background: '#F3EAFB', color: '#8E44AD',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.4, fontWeight: 800,
    }}>👤</div>
  );
}

export default function ProfilePage() {
  const { username } = useParams<{ username: string }>();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [followingCount, setFollowingCount] = useState(0);
  const [followersCount, setFollowersCount] = useState(0);
  const [isFollowing, setIsFollowing] = useState(false);
  const [isMutual, setIsMutual] = useState(false);
  const [isMe, setIsMe] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [bookmarks, setBookmarks] = useState<Trace[]>([]);
  const [selectedTrace, setSelectedTrace] = useState<Trace | null>(null);
  const [myTraces, setMyTraces] = useState<Trace[]>([]);
  const [routeCompletionCount, setRouteCompletionCount] = useState(0);

  const [editing, setEditing] = useState(false);
  const [editDisplayName, setEditDisplayName] = useState('');
  const [bioAnswers, setBioAnswers] = useState<string[]>(['', '', '']);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState('');
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const [showAppointmentForm, setShowAppointmentForm] = useState(false);
  const [appointmentPurpose, setAppointmentPurpose] = useState('');
  const [appointmentSending, setAppointmentSending] = useState(false);
  const [appointmentSent, setAppointmentSent] = useState(false);
  const [appointmentError, setAppointmentError] = useState('');
  const [receivedAppointments, setReceivedAppointments] = useState<AppointmentRequest[]>([]);
  const [respondingId, setRespondingId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [{ createAuthBrowserClient }] = await Promise.all([
          import('@/lib/supabase/authClient'),
        ]);
        const supabase = createAuthBrowserClient();
        let normalizedUsername = String(username);
        try { normalizedUsername = decodeURIComponent(normalizedUsername); } catch { /* already decoded */ }
        normalizedUsername = normalizedUsername.normalize('NFC').trim();
        const { data: rows, error: profileError } = await supabase
          .from('profiles').select('*').eq('username', normalizedUsername).maybeSingle();
        if (profileError || !rows) {
          setError('ユーザーが見つかりません');
          setLoading(false);
          return;
        }
        setProfile(rows as Profile);

        const { data: { user } } = await supabase.auth.getUser();
        const me = user?.id === rows.id;
        setIsMe(me);
        if (me) {
          const bmRes = await fetch('/api/bookmarks').then(r => r.json()).catch(() => null);
          if (bmRes?.ok) setBookmarks(bmRes.traces ?? []);
          const apptRes = await fetch('/api/appointments').then(r => r.json()).catch(() => null);
          if (apptRes?.ok) {
            setReceivedAppointments((apptRes.received ?? []).filter((a: AppointmentRequest) => a.status === 'pending'));
          }
        }

        const followRes = await fetch(`/api/follows?user_id=${rows.id}`).then(r => r.json());
        setFollowingCount(followRes.followingCount ?? 0);
        setFollowersCount(followRes.followersCount ?? 0);
        setIsFollowing(followRes.isFollowing ?? false);
        setIsMutual(followRes.isMutual ?? false);

        const tracesRes = await fetch(`/api/traces?user_id=${rows.id}&limit=500`).then(r => r.json()).catch(() => null);
        if (tracesRes?.ok) setMyTraces(tracesRes.traces ?? []);

        const routeRes = await fetch(`/api/routes/completions?user_id=${rows.id}`).then(r => r.json()).catch(() => null);
        if (routeRes?.ok) setRouteCompletionCount(routeRes.count ?? 0);
      } catch (e) {
        setError(e instanceof Error ? e.message : '読み込みに失敗しました');
      } finally {
        setLoading(false);
      }
    })();
  }, [username]);

  async function toggleFollow() {
    if (!profile) return;
    const method = isFollowing ? 'DELETE' : 'POST';
    const res = await fetch('/api/follows', {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ followee_id: profile.id }),
    });
    const data = await res.json();
    if (data.ok) {
      setIsFollowing(!isFollowing);
      setFollowersCount(c => c + (isFollowing ? -1 : 1));
      if (isFollowing) {
        setIsMutual(false);
      } else {
        const followRes = await fetch(`/api/follows?user_id=${profile.id}`).then(r => r.json()).catch(() => null);
        if (followRes?.ok) setIsMutual(followRes.isMutual ?? false);
      }
    } else if (res.status === 401) {
      window.location.href = '/login';
    }
  }

  function startEdit() {
    if (!profile) return;
    setEditDisplayName(profile.display_name ?? '');
    // 既存のbioは単一の自由文なので、空行で区切って3つの問いへの回答としてベストエフォートで復元する。
    // 区切りがなければ最初の問いにそのまま入れ、残りは空欄にする。
    const parts = (profile.bio ?? '').split(/\n{2,}/).map(s => s.trim()).filter(Boolean);
    setBioAnswers([parts[0] ?? '', parts[1] ?? '', parts[2] ?? '']);
    setEditError('');
    setEditing(true);
  }

  // 自分の痕跡投稿から、その問いに合う書き出し候補を1つ拾う（感情の強度が高いものを優先）。
  // 該当データがなければ null（無理に作らない）。
  function bioSuggestion(traceField: 'why' | 'self_reflection' | null): string | null {
    if (!traceField || myTraces.length === 0) return null;
    const candidates = [...myTraces]
      .filter(t => t[traceField]?.trim())
      .sort((a, b) => (b.intensity ?? 0) - (a.intensity ?? 0));
    return candidates[0]?.[traceField]?.trim() || null;
  }

  function applyBioSuggestion(index: number, suggestion: string) {
    setBioAnswers(prev => {
      const next = [...prev];
      const current = next[index].trim();
      const combined = current ? `${current} ${suggestion}` : suggestion;
      next[index] = combined.slice(0, BIO_PART_MAX);
      return next;
    });
  }

  async function handleAvatarPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !profile) return;
    setAvatarUploading(true);
    setEditError('');
    try {
      const { uploadAvatar } = await import('@/lib/supabase/upload');
      const avatarUrl = await uploadAvatar(file, profile.id);
      const res = await fetch('/api/profile', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ avatar_url: avatarUrl }),
      });
      const data = await res.json();
      if (data.ok) setProfile(data.profile as Profile);
      else setEditError(data.error ?? 'アイコンの更新に失敗しました');
    } catch (err) {
      setEditError(err instanceof Error ? err.message : 'アイコンの更新に失敗しました');
    } finally {
      setAvatarUploading(false);
    }
  }

  async function saveProfile() {
    setSaving(true);
    setEditError('');
    try {
      const joinedBio = bioAnswers.map(s => s.trim()).filter(Boolean).join('\n\n').slice(0, BIO_MAX_LENGTH);
      const res = await fetch('/api/profile', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ display_name: editDisplayName.trim() || null, bio: joinedBio || null }),
      });
      const data = await res.json();
      if (data.ok) {
        setProfile(data.profile as Profile);
        setEditing(false);
      } else {
        setEditError(data.error ?? '保存に失敗しました');
      }
    } catch (err) {
      setEditError(err instanceof Error ? err.message : '保存に失敗しました');
    } finally {
      setSaving(false);
    }
  }

  async function sendAppointmentRequest() {
    if (!profile) return;
    const purpose = appointmentPurpose.trim();
    if (!purpose) { setAppointmentError('会いたい理由を書いてください'); return; }
    setAppointmentSending(true);
    setAppointmentError('');
    try {
      const res = await fetch('/api/appointments', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestee_id: profile.id, purpose }),
      });
      const data = await res.json();
      if (data.ok) {
        setAppointmentSent(true);
        setShowAppointmentForm(false);
        setAppointmentPurpose('');
      } else if (res.status === 401) {
        window.location.href = '/login';
      } else {
        setAppointmentError(data.error ?? '送信に失敗しました');
      }
    } catch (err) {
      setAppointmentError(err instanceof Error ? err.message : '送信に失敗しました');
    } finally {
      setAppointmentSending(false);
    }
  }

  async function respondAppointment(id: string, status: 'accepted' | 'declined') {
    setRespondingId(id);
    try {
      const res = await fetch(`/api/appointments/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      const data = await res.json();
      if (data.ok) setReceivedAppointments(prev => prev.filter(a => a.id !== id));
    } finally {
      setRespondingId(null);
    }
  }

  if (loading) return <div style={{ padding: 20 }}>読み込み中…</div>;
  if (error || !profile) return <div style={{ padding: 20, color: '#E74C3C' }}>{error ?? 'ユーザーが見つかりません'}</div>;

  return (
    <div style={{ padding: 20, maxWidth: 480, margin: '0 auto' }}>
      <a href="/map" style={{ fontSize: 12, color: '#999', textDecoration: 'none' }}>← マップへ戻る</a>
      <div style={{ background: '#fff', borderRadius: 16, marginTop: 12, boxShadow: '0 1px 8px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
        {isMe && (
          <CharacterScene
            character={computeCharacter(myTraces)}
            characterName={profile.character_name}
            onRename={async (name) => {
              const res = await fetch('/api/profile', {
                method: 'PATCH', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ character_name: name }),
              });
              const data = await res.json();
              if (data.ok) setProfile(data.profile as Profile);
            }}
          />
        )}
        <div style={{ padding: 20 }}>
        <div style={{ display: 'flex', gap: 14, alignItems: 'center', marginBottom: 14 }}>
          <div style={{ position: 'relative' }}>
            <Avatar url={profile.avatar_url} />
            {isMe && (
              <>
                <button
                  onClick={() => avatarInputRef.current?.click()}
                  disabled={avatarUploading}
                  title="アイコンを変更"
                  style={{
                    position: 'absolute', bottom: -2, right: -2, width: 26, height: 26, borderRadius: '50%',
                    border: '2px solid #fff', background: '#38ADA9', color: '#fff', fontSize: 12,
                    cursor: avatarUploading ? 'wait' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                >{avatarUploading ? '…' : '📷'}</button>
                <input ref={avatarInputRef} type="file" accept="image/*" onChange={handleAvatarPick} style={{ display: 'none' }} />
              </>
            )}
          </div>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>{profile.display_name ?? profile.username}</h1>
            <p style={{ fontSize: 13, color: '#999', margin: '2px 0 0' }}>@{profile.username}</p>
          </div>
        </div>

        {editError && <p style={{ color: '#E55039', fontSize: 12, margin: '0 0 10px' }}>{editError}</p>}

        {editing ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
            <label style={{ fontSize: 11, color: '#666', fontWeight: 700 }}>表示名</label>
            <input value={editDisplayName} onChange={e => setEditDisplayName(e.target.value)} placeholder={profile.username}
              style={{ padding: '9px 12px', borderRadius: 8, border: '1.5px solid #ddd', fontSize: 13 }} />
            <label style={{ fontSize: 11, color: '#666', fontWeight: 700 }}>自己紹介</label>
            <p style={{ margin: 0, fontSize: 11, color: '#999', lineHeight: 1.6 }}>
              3つの問いに答えると、自己紹介文になります。埋められる分だけでかまいません。
            </p>
            {BIO_QUESTIONS.map((q, i) => {
              const suggestion = bioSuggestion(q.traceField);
              return (
                <div key={q.key} style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: i === 0 ? 0 : 6 }}>
                  <label style={{ fontSize: 12, color: '#555', fontWeight: 700 }}>{q.label}</label>
                  <textarea
                    value={bioAnswers[i]}
                    onChange={e => setBioAnswers(prev => {
                      const next = [...prev];
                      next[i] = e.target.value.slice(0, BIO_PART_MAX);
                      return next;
                    })}
                    rows={2}
                    placeholder={q.placeholder}
                    style={{ padding: '9px 11px', borderRadius: 8, border: '1.5px solid #ddd', fontSize: 13, lineHeight: 1.7, fontFamily: 'inherit', resize: 'vertical' }}
                  />
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                    {suggestion ? (
                      <button
                        type="button"
                        onClick={() => applyBioSuggestion(i, suggestion)}
                        style={{
                          fontSize: 11, padding: '4px 10px', borderRadius: 20,
                          border: '1px solid #38ADA9', background: '#fff', color: '#38ADA9',
                          fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap',
                        }}
                      >
                        📍 自分の痕跡から書き出す
                      </button>
                    ) : <span />}
                    <p style={{ margin: 0, fontSize: 11, color: bioAnswers[i].length >= BIO_PART_MAX ? '#E55039' : '#bbb' }}>
                      {bioAnswers[i].length} / {BIO_PART_MAX}
                    </p>
                  </div>
                </div>
              );
            })}
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={saveProfile} disabled={saving} style={{
                flex: 1, padding: '9px 0', borderRadius: 8, border: 'none',
                background: '#38ADA9', color: '#fff', fontWeight: 700, cursor: saving ? 'wait' : 'pointer', fontSize: 13,
              }}>{saving ? '保存中…' : '保存する'}</button>
              <button onClick={() => setEditing(false)} style={{
                flex: 1, padding: '9px 0', borderRadius: 8, border: '1px solid #ddd',
                background: '#fff', color: '#888', cursor: 'pointer', fontSize: 13,
              }}>キャンセル</button>
            </div>
          </div>
        ) : (
          profile.bio && <p style={{ fontSize: 13, color: '#555', lineHeight: 1.7, marginBottom: 14, whiteSpace: 'pre-wrap' }}>{profile.bio}</p>
        )}

        <div style={{ display: 'flex', gap: 16, fontSize: 13, color: '#666', marginBottom: 16 }}>
          <span><strong>{followingCount}</strong> フォロー中</span>
          <span><strong>{followersCount}</strong> フォロワー</span>
          <span><strong>{new Set(myTraces.map(t => t.region).filter(Boolean)).size}</strong> 訪問エリア</span>
        </div>

        {(() => {
          const badges = computeBadges(myTraces, routeCompletionCount);
          if (badges.length === 0) return null;
          return (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 8, marginBottom: 16 }}>
              {badges.map(badge => (
                <div key={badge.id} style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  background: '#FBF6FF', border: '1px solid #F3EAFB', borderRadius: 10, padding: '8px 10px',
                }}>
                  <span style={{ fontSize: 20 }}>{badge.emoji}</span>
                  <div style={{ minWidth: 0 }}>
                    <p style={{ margin: 0, fontSize: 12, fontWeight: 800, color: '#8E44AD', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{badge.label}</p>
                    <p style={{ margin: 0, fontSize: 10, color: '#999', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{badge.description}</p>
                  </div>
                </div>
              ))}
            </div>
          );
        })()}
        {!isMe && (
          <div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={toggleFollow} style={{
                flex: 1, padding: '10px 0', borderRadius: 10, border: 'none',
                background: isFollowing ? '#eee' : '#38ADA9',
                color: isFollowing ? '#666' : '#fff', fontWeight: 700, cursor: 'pointer',
              }}>{isFollowing ? 'フォロー中 ✓' : 'フォローする'}</button>
              {isMutual && (
                <a href={`/messages/${profile.username}`} style={{
                  flex: 1, padding: '10px 0', borderRadius: 10, border: '1.5px solid #FF6B9D',
                  background: '#fff', color: '#FF6B9D', fontWeight: 700, cursor: 'pointer',
                  textAlign: 'center', textDecoration: 'none', boxSizing: 'border-box',
                }}>💬 メッセージ</a>
              )}
              {!appointmentSent && (
                <button onClick={() => setShowAppointmentForm(v => !v)} style={{
                  flex: 1, padding: '10px 0', borderRadius: 10, border: '1.5px solid #8E44AD',
                  background: '#fff', color: '#8E44AD', fontWeight: 700, cursor: 'pointer',
                }}>会ってみたい</button>
              )}
            </div>

            {appointmentSent && (
              <p style={{ marginTop: 10, fontSize: 12, color: '#8E44AD', background: '#FBF6FF', borderRadius: 8, padding: '8px 10px' }}>
                申請を送りました。相手の承認をお待ちください。
              </p>
            )}

            {showAppointmentForm && !appointmentSent && (
              <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
                <p style={{ margin: 0, fontSize: 11, color: '#999' }}>
                  フォロー関係がなくても送れます。何が気になったか、何のために会いたいかを一言書いてください。
                </p>
                <textarea
                  value={appointmentPurpose}
                  onChange={e => setAppointmentPurpose(e.target.value.slice(0, APPOINTMENT_PURPOSE_MAX_LENGTH))}
                  rows={3}
                  placeholder="例）あなたが記録した〇〇の痕跡に共感しました。実際にどんな場所だったか話を聞いてみたいです。"
                  style={{ padding: '9px 12px', borderRadius: 8, border: '1.5px solid #ddd', fontSize: 13, lineHeight: 1.6, fontFamily: 'inherit', resize: 'vertical' }}
                />
                <p style={{ margin: 0, fontSize: 11, color: appointmentPurpose.length >= APPOINTMENT_PURPOSE_MAX_LENGTH ? '#E55039' : '#bbb', textAlign: 'right' }}>
                  {appointmentPurpose.length} / {APPOINTMENT_PURPOSE_MAX_LENGTH}
                </p>
                {appointmentError && <p style={{ margin: 0, color: '#E55039', fontSize: 12 }}>{appointmentError}</p>}
                <button onClick={sendAppointmentRequest} disabled={appointmentSending} style={{
                  padding: '9px 0', borderRadius: 8, border: 'none',
                  background: '#8E44AD', color: '#fff', fontWeight: 700, cursor: appointmentSending ? 'wait' : 'pointer', fontSize: 13,
                }}>{appointmentSending ? '送信中…' : '申請を送る'}</button>
              </div>
            )}
          </div>
        )}

        {isMe && receivedAppointments.length > 0 && (
          <div style={{ marginBottom: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: '#8E44AD' }}>
              会ってみたいという申請が{receivedAppointments.length}件届いています
            </p>
            {receivedAppointments.map(appt => (
              <div key={appt.id} style={{ background: '#FBF6FF', border: '1px solid #F3EAFB', borderRadius: 10, padding: '10px 12px' }}>
                <p style={{ margin: '0 0 8px', fontSize: 13, color: '#555', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{appt.purpose}</p>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => respondAppointment(appt.id, 'accepted')} disabled={respondingId === appt.id} style={{
                    flex: 1, padding: '7px 0', borderRadius: 8, border: 'none',
                    background: '#8E44AD', color: '#fff', fontWeight: 700, fontSize: 12, cursor: 'pointer',
                  }}>承認する</button>
                  <button onClick={() => respondAppointment(appt.id, 'declined')} disabled={respondingId === appt.id} style={{
                    flex: 1, padding: '7px 0', borderRadius: 8, border: '1px solid #ddd',
                    background: '#fff', color: '#888', fontWeight: 700, fontSize: 12, cursor: 'pointer',
                  }}>見送る</button>
                </div>
              </div>
            ))}
          </div>
        )}
        {isMe && !editing && (
          <button onClick={startEdit} style={{
            width: '100%', padding: '10px 0', borderRadius: 10, border: '1.5px solid #38ADA9',
            background: '#fff', color: '#38ADA9', fontWeight: 700, cursor: 'pointer',
          }}>✏️ プロフィールを編集</button>
        )}
        </div>
      </div>

      {myTraces.length > 0 && (
        <div style={{ marginTop: 20 }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 10 }}>🥾 歩いた軌跡（{myTraces.length}件）</h2>
          <div style={{ height: 260, borderRadius: 14, overflow: 'hidden', boxShadow: '0 1px 8px rgba(0,0,0,0.06)' }}>
            <TraceMap traces={myTraces} mode="pin" allowWideZoom onTraceClick={setSelectedTrace} />
          </div>
        </div>
      )}

      {isMe && <RegionCounterCard traces={myTraces} />}

      {myTraces.length > 1 && (
        <div style={{ marginTop: 20, background: '#fff', borderRadius: 14, padding: 16, boxShadow: '0 1px 8px rgba(0,0,0,0.06)' }}>
          <h2 style={{ fontSize: 14, fontWeight: 700, margin: '0 0 4px' }}>どんな出会いを重ねてきたか</h2>
          <p style={{ margin: '0 0 10px', fontSize: 11, color: '#999' }}>
            記録の感情の起伏を時系列で辿れます。点をタップすると、その記録を開きます。
          </p>
          <EmotionTimeline traces={myTraces} onSelect={setSelectedTrace} />
        </div>
      )}

      {/* 縁の一覧：出会った人ごとの感情の変遷。自分にしか見えない */}
      {isMe && <EnList traces={myTraces} onSelect={setSelectedTrace} />}

      {(() => {
        const now = new Date();
        const thisMonth = myTraces.filter(t => {
          const d = new Date(t.created_at);
          return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
        });
        if (thisMonth.length === 0) return null;
        const monthRegionCount = new Set(thisMonth.map(t => t.region).filter(Boolean)).size;
        return (
          <div style={{
            marginTop: 20, background: '#fff', borderRadius: 14, padding: 16,
            boxShadow: '0 1px 8px rgba(0,0,0,0.06)',
          }}>
            <h2 style={{ fontSize: 14, fontWeight: 700, margin: '0 0 8px' }}>
              📅 {now.getMonth() + 1}月の振り返り
            </h2>
            <p style={{ margin: 0, fontSize: 13, color: '#666' }}>
              今月は<strong style={{ color: '#38ADA9' }}>{thisMonth.length}件</strong>の記録を残し、
              <strong style={{ color: '#38ADA9' }}>{monthRegionCount}</strong>の町を歩いた
            </p>
          </div>
        );
      })()}

      {(() => {
        const now = new Date();
        const onThisDay = myTraces.filter(t => {
          const d = new Date(t.created_at);
          return d.getFullYear() < now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
        });
        if (onThisDay.length === 0) return null;
        return (
          <div style={{ marginTop: 20 }}>
            <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 10 }}>🕰 過去の今日</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {onThisDay.map(t => (
                <TraceCard key={t.id} trace={t} onClick={() => setSelectedTrace(t)} />
              ))}
            </div>
          </div>
        );
      })()}

      {isMe && (
        <div style={{ marginTop: 20 }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 10 }}>🔖 保存した記録（{bookmarks.length}）</h2>
          {bookmarks.length === 0 ? (
            <p style={{ fontSize: 13, color: '#aaa' }}>まだ保存した記録はありません</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {bookmarks.map(t => (
                <TraceCard key={t.id} trace={t} onClick={() => setSelectedTrace(t)} />
              ))}
            </div>
          )}
        </div>
      )}

      {isMe && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: 14, marginTop: 32, marginBottom: 8 }}>
          <a href="/company/business" style={{ fontSize: 11, color: '#aaa', textDecoration: 'none' }}>法人・自治体の方</a>
          <a href="/company/school" style={{ fontSize: 11, color: '#aaa', textDecoration: 'none' }}>学校の方</a>
          <a href="/support" style={{ fontSize: 11, color: '#aaa', textDecoration: 'none' }}>ヒトマップを支援する</a>
        </div>
      )}

      {selectedTrace && (
        <TraceDetail
          trace={selectedTrace}
          isOwn={isMe && selectedTrace.user_id === profile.id}
          onClose={() => setSelectedTrace(null)}
          onUpdate={(updated) => {
            setBookmarks(prev => prev.map(t => t.id === updated.id ? updated : t));
            setMyTraces(prev => prev.map(t => t.id === updated.id ? updated : t));
          }}
          onDelete={(id) => {
            setBookmarks(prev => prev.filter(t => t.id !== id));
            setMyTraces(prev => prev.filter(t => t.id !== id));
          }}
        />
      )}
    </div>
  );
}
