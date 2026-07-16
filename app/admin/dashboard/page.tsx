'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import dynamic from 'next/dynamic';
import type { Trace, Sponsor, Route } from '@/lib/types';
import { EMOTIONS, getEmotion } from '@/lib/emotions';
import { getCategory } from '@/lib/categories';
import BlocksTab from '@/components/admin/BlocksTab';
import PostsTab from '@/components/admin/PostsTab';
import OverviewTab from '@/components/admin/OverviewTab';
import AttachmentTab from '@/components/admin/AttachmentTab';

const LocationPickerMap = dynamic(() => import('@/components/form/LocationPickerMap'), {
  ssr: false,
  loading: () => <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f0f0f0', color: '#aaa', fontSize: 12 }}>地図を読み込み中…</div>,
});

type Tab = 'overview' | 'blocks' | 'posts' | 'review' | 'traces' | 'reports' | 'comments' | 'sponsors' | 'routes' | 'quests' | 'users' | 'events' | 'leads' | 'attachment';

// タブをカテゴリ分けして表示するためのメタ情報（アイコン・説明・所属グループ）
const TAB_META: Record<Tab, { label: string; icon: string; group: string; desc: string }> = {
  overview: { label: 'ホーム', icon: '🏠', group: '', desc: '全体の状況をひと目で確認' },
  blocks: { label: 'サイトCMS', icon: '🧩', group: 'サイト', desc: 'ページのセクションを自由に編集（プレビュー付き）' },
  posts: { label: '実績ブログ', icon: '📝', group: 'サイト', desc: 'イベント記録・参加者の声を書いて公開' },
  review: { label: '承認待ち', icon: '✅', group: '投稿・安全', desc: '全国公開の申請を承認/却下' },
  traces: { label: '投稿管理', icon: '📍', group: '投稿・安全', desc: '投稿を検索・削除・復元' },
  reports: { label: '通報', icon: '🚨', group: '投稿・安全', desc: '寄せられた通報の対応' },
  comments: { label: 'コメント', icon: '💬', group: '投稿・安全', desc: 'コメントの確認・削除' },
  users: { label: '登録ユーザー', icon: '👤', group: 'コミュニティ', desc: '会員の投稿履歴を確認' },
  sponsors: { label: 'スポンサー', icon: '🏷', group: 'コミュニティ', desc: '協賛枠の作成・管理' },
  routes: { label: '公開イベント', icon: '🧭', group: '体験づくり', desc: 'route/relay/煩悩イベントの作成・管理' },
  quests: { label: 'クエスト', icon: '🎯', group: '体験づくり', desc: 'クエストの作成・管理' },
  events: { label: 'イベント計画', icon: '🎪', group: '体験づくり', desc: '企画中イベントのメモ' },
  leads: { label: '学校・法人', icon: '🎓', group: '学校・法人', desc: '問い合わせ・契約状況の管理' },
  attachment: { label: '愛着の見える化', icon: '🌀', group: '調査・研究', desc: '地域別ファネルとイベント前後の感情変化' },
};

const TAB_GROUPS = ['サイト', '投稿・安全', 'コミュニティ', '体験づくり', '学校・法人', '調査・研究'];

// ホームからも本体サイトへ直接飛べるよう、主要ページへのリンクを集約
const SITE_LINKS: { label: string; href: string; icon: string; desc: string }[] = [
  { label: 'サイトホーム', href: '/', icon: '🏡', desc: '一般ユーザーが見るトップページ' },
  { label: '地図', href: '/map', icon: '🗺️', desc: '投稿の分布・ヒートマップ表示' },
  { label: 'イベント一覧', href: '/routes', icon: '🧭', desc: '公開中のイベント（route/relay/煩悩）' },
  { label: '学校向け', href: '/school', icon: '🏫', desc: '学校・教育機関向けの紹介ページ' },
  { label: '法人向け', href: '/business', icon: '🏢', desc: '法人・自治体向けの紹介ページ' },
  { label: '投稿を始める', href: '/start', icon: '📸', desc: '新規投稿フローの確認' },
];

const inputStyle: React.CSSProperties = {
  padding: '9px 12px', borderRadius: 8, border: '1.5px solid #ddd',
  fontSize: 13, outline: 'none', fontFamily: 'inherit',
};

interface Report {
  id: string;
  trace_id: string;
  reason: string;
  note: string | null;
  status: string;
  created_at: string;
  trace: { id: string; title: string; photo_url: string | null; is_deleted: boolean } | null;
}

interface AdminUserRecentTrace {
  id: string;
  title: string;
  photo_url: string | null;
  emotion_key: string | null;
  visibility: string;
  why: string | null;
  created_at: string;
}

interface AdminUser {
  id: string;
  username: string;
  display_name: string | null;
  bio: string | null;
  avatar_url: string | null;
  created_at: string;
  traceCount: number;
  lastPostedAt: string | null;
  followerCount: number;
  followingCount: number;
  recentTraces: AdminUserRecentTrace[];
  auto_approve: boolean;
}

const VISIBILITY_LABELS: Record<string, { label: string; color: string }> = {
  public: { label: '🌏 全国公開', color: '#38ADA9' },
  followers: { label: '👥 フォロワー限定', color: '#4A69BD' },
  private: { label: '🔒 非公開', color: '#999' },
  pending_review: { label: '⏳ 審査待ち', color: '#E5A139' },
};

// 投稿の「誰が」を表示するため、user_id→プロフィールの対応表を1回だけ取得して使い回す
function useAuthorMap(authHeaders: () => HeadersInit) {
  const [authorMap, setAuthorMap] = useState<Record<string, { username: string; avatar_url: string | null }>>({});
  useEffect(() => {
    fetch('/api/admin/profiles', { headers: authHeaders() })
      .then(r => r.json())
      .then(d => {
        if (!d.ok) return;
        const map: Record<string, { username: string; avatar_url: string | null }> = {};
        for (const u of d.users as AdminUser[]) map[u.id] = { username: u.username, avatar_url: u.avatar_url };
        setAuthorMap(map);
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return authorMap;
}

// 投稿カードの「誰が」表示（アカウント投稿はアイコン+ユーザー名、匿名投稿はニックネーム）
function AuthorLine({ trace, authorMap }: { trace: Trace; authorMap: Record<string, { username: string; avatar_url: string | null }> }) {
  if (trace.user_id) {
    const author = authorMap[trace.user_id];
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
        {author?.avatar_url ? (
          <img src={author.avatar_url} alt="" style={{ width: 14, height: 14, borderRadius: '50%', objectFit: 'cover' }} />
        ) : '👤'}
        {author ? `@${author.username}` : 'ログインユーザー'}
      </span>
    );
  }
  return <span>🕶 {trace.nickname ?? '匿名'}</span>;
}

// 投稿内容が一目でわかるタグ行（感情・カテゴリ・動画有無）
function ContentTags({ trace }: { trace: Trace }) {
  const emotion = getEmotion(trace.emotion_key);
  const category = getCategory(trace.category);
  if (!emotion && !category && !trace.video_url) return null;
  return (
    <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', margin: '4px 0' }}>
      {emotion && (
        <span style={{ padding: '2px 8px', borderRadius: 20, background: emotion.color + '22', color: emotion.color, fontSize: 11, fontWeight: 700 }}>
          {emotion.emoji} {emotion.label}
        </span>
      )}
      {category && (
        <span style={{ padding: '2px 8px', borderRadius: 20, background: '#f0f0f0', color: '#666', fontSize: 11 }}>
          {category.emoji} {category.label}
        </span>
      )}
      {trace.video_url && (
        <span style={{ padding: '2px 8px', borderRadius: 20, background: '#EEF4FF', color: '#4A90E2', fontSize: 11, fontWeight: 700 }}>🎥 動画</span>
      )}
    </div>
  );
}

const REASON_LABELS: Record<string, string> = {
  inappropriate: '不適切な内容',
  spam: 'スパム・宣伝',
  personal_info: '個人情報が写っている',
  private_property: '個人の自宅・敷地が特定できる',
  copyright: '著作権・肖像権の侵害',
  other: 'その他',
};

// 個人宅・敷地の特定は削除対応を急ぐべきなので、通報キューの先頭に出す
const URGENT_REPORT_REASONS = new Set(['private_property']);

export default function AdminDashboardPage() {
  const [password, setPassword] = useState('');
  const [unlocked, setUnlocked] = useState(false);
  const [unlockError, setUnlockError] = useState('');
  const [unlocking, setUnlocking] = useState(false);
  const [tab, setTab] = useState<Tab>('overview');
  const [badgeCounts, setBadgeCounts] = useState<{ pendingReview: number; pendingReports: number } | null>(null);
  const [siteMenuOpen, setSiteMenuOpen] = useState(false);
  const [navOpen, setNavOpen] = useState(false);

  const authHeaders = useCallback((): HeadersInit => {
    return { 'Content-Type': 'application/json', 'x-admin-password': password };
  }, [password]);

  // ナビのタブに未処理件数バッジを出すため、タブ切替のたびに軽量に取り直す（対応後すぐ数字が減るように）
  useEffect(() => {
    if (!unlocked) return;
    fetch('/api/admin/stats', { headers: authHeaders() })
      .then(r => r.json())
      .then(d => { if (d.ok) setBadgeCounts({ pendingReview: d.stats.pendingReview, pendingReports: d.stats.pendingReports }); })
      .catch(() => {});
  }, [unlocked, tab, authHeaders]);

  // ページ更新のたびにログインし直すのが煩雑だったため、タブを閉じるまではsessionStorageに保持する
  useEffect(() => {
    // ?tab= ディープリンク（/admin/posts 等の旧URLからのリダイレクト受け口）。
    // 不正な値は無視して overview のまま。
    const param = new URLSearchParams(window.location.search).get('tab');
    if (param && param in TAB_META) setTab(param as Tab);
    // 旧・単独ページ（/admin/posts /admin/blocks）が使っていた hm-admin-pw も受け入れて、
    // リダイレクトで来た人が再ログインせずに済むようにする
    const saved = sessionStorage.getItem('admin_dashboard_password') ?? sessionStorage.getItem('hm-admin-pw');
    if (saved) tryUnlock(saved);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function tryUnlock(pw: string) {
    setUnlocking(true);
    setUnlockError('');
    try {
      const res = await fetch('/api/admin/stats', { headers: { 'x-admin-password': pw } });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error ?? 'パスワードが違います');
      setPassword(pw);
      setUnlocked(true);
      sessionStorage.setItem('admin_dashboard_password', pw);
    } catch (e) {
      setUnlockError(e instanceof Error ? e.message : '認証に失敗しました');
      sessionStorage.removeItem('admin_dashboard_password');
    } finally {
      setUnlocking(false);
    }
  }

  if (!unlocked) {
    return (
      <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fafafa', padding: 16, boxSizing: 'border-box' }}>
        <form
          onSubmit={e => { e.preventDefault(); tryUnlock(password); }}
          style={{ background: '#fff', padding: 24, borderRadius: 16, width: '100%', maxWidth: 320, boxSizing: 'border-box', boxShadow: '0 1px 8px rgba(0,0,0,0.06)' }}
        >
          <h1 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>運営ダッシュボード（パスワード）</h1>
          <input
            type="password" value={password} onChange={e => setPassword(e.target.value)}
            placeholder="パスワード" style={{ ...inputStyle, width: '100%', boxSizing: 'border-box', marginBottom: 10 }}
          />
          {unlockError && <p style={{ color: '#E74C3C', fontSize: 12, margin: '0 0 8px' }}>{unlockError}</p>}
          <button type="submit" disabled={unlocking} style={{
            width: '100%', padding: 10, borderRadius: 8, border: 'none',
            background: '#38ADA9', color: '#fff', fontWeight: 700, cursor: 'pointer',
          }}>{unlocking ? '確認中…' : '入る'}</button>
        </form>
      </div>
    );
  }

  const badgeFor = (id: Tab): number =>
    id === 'review' ? (badgeCounts?.pendingReview ?? 0) : id === 'reports' ? (badgeCounts?.pendingReports ?? 0) : 0;

  function goTab(id: Tab) {
    setTab(id);
    setNavOpen(false);
    // タブをURLにも反映して、リロード・共有で同じタブに戻れるようにする
    window.history.replaceState(null, '', id === 'overview' ? '/admin/dashboard' : `/admin/dashboard?tab=${id}`);
  }

  const navButtonStyle = (active: boolean, urgent: boolean): React.CSSProperties => ({
    display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'left',
    padding: '10px 14px', borderRadius: 10, border: 'none', cursor: 'pointer',
    background: active ? 'rgba(255,255,255,0.16)' : 'transparent',
    color: active ? '#fff' : urgent ? '#FFB4A8' : 'rgba(255,255,255,0.75)',
    fontWeight: active ? 800 : 600, fontSize: 13,
  });

  return (
    <div style={{ minHeight: '100dvh', background: '#f4f6f5', display: 'flex' }}>
      <style>{`
        .hm-sidebar { position: sticky; top: 0; height: 100dvh; transition: transform .2s ease; }
        .hm-hamburger { display: none; }
        .hm-overlay { display: none; }
        @media (max-width: 880px) {
          .hm-sidebar { position: fixed; top: 0; left: 0; bottom: 0; height: 100dvh; z-index: 40; transform: translateX(-100%); }
          .hm-sidebar.open { transform: translateX(0); }
          .hm-hamburger { display: flex; }
          .hm-overlay.open { display: block; }
          .hm-main { margin-left: 0 !important; }
        }
      `}</style>

      {/* オーバーレイ（モバイルでサイドバーを開いた時に背景をタップして閉じる） */}
      <div className={`hm-overlay${navOpen ? ' open' : ''}`} onClick={() => setNavOpen(false)} style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 30,
      }} />

      {/* サイドバー */}
      <aside className={`hm-sidebar${navOpen ? ' open' : ''}`} style={{
        width: 232, flexShrink: 0, background: '#1F2A2A', color: '#fff',
        display: 'flex', flexDirection: 'column', overflowY: 'auto',
      }}>
        <div style={{ padding: '20px 16px 12px' }}>
          <p style={{ margin: 0, fontSize: 15, fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
            onClick={() => goTab('overview')}>🛠 運営ダッシュボード</p>
          <p style={{ margin: '2px 0 0', fontSize: 11, color: 'rgba(255,255,255,0.45)' }}>ヒトマップ</p>
        </div>

        <nav style={{ flex: 1, padding: '4px 10px', display: 'flex', flexDirection: 'column', gap: 2 }}>
          <button onClick={() => goTab('overview')} style={navButtonStyle(tab === 'overview', false)}>
            {TAB_META.overview.icon} {TAB_META.overview.label}
          </button>

          {TAB_GROUPS.map(group => (
            <div key={group} style={{ marginTop: 14 }}>
              <p style={{ margin: '0 0 4px', padding: '0 14px', fontSize: 10, letterSpacing: 1, color: 'rgba(255,255,255,0.4)', fontWeight: 700 }}>{group.toUpperCase()}</p>
              {(Object.keys(TAB_META) as Tab[]).filter(id => TAB_META[id].group === group).map(id => {
                const count = badgeFor(id);
                const urgent = count > 0 && tab !== id;
                return (
                  <button key={id} onClick={() => goTab(id)} title={TAB_META[id].desc} style={navButtonStyle(tab === id, urgent)}>
                    <span>{TAB_META[id].icon}</span>
                    <span style={{ flex: 1 }}>{TAB_META[id].label}</span>
                    {count > 0 && (
                      <span style={{ padding: '1px 7px', borderRadius: 10, fontSize: 11, background: '#E55039', color: '#fff', fontWeight: 700 }}>{count}</span>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

        <div style={{ padding: 10, borderTop: '1px solid rgba(255,255,255,0.1)' }}>
          <button onClick={() => setSiteMenuOpen(v => !v)} style={navButtonStyle(siteMenuOpen, false)}>
            🌐 <span style={{ flex: 1 }}>本体サイトを見る</span> {siteMenuOpen ? '▴' : '▾'}
          </button>
          {siteMenuOpen && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginTop: 4 }}>
              {SITE_LINKS.map(link => (
                <a key={link.href} href={link.href} target="_blank" rel="noopener noreferrer" style={{
                  display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px 8px 30px', borderRadius: 10,
                  textDecoration: 'none', color: 'rgba(255,255,255,0.7)', fontSize: 12,
                }}>
                  <span>{link.icon}</span>{link.label} ↗
                </a>
              ))}
            </div>
          )}
        </div>
      </aside>

      {/* メインコンテンツ */}
      <main className="hm-main" style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          position: 'sticky', top: 0, zIndex: 10, background: 'rgba(244,246,245,0.92)', backdropFilter: 'blur(6px)',
          padding: '14px 20px', borderBottom: '1px solid #e5e8e7', display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <button className="hm-hamburger" onClick={() => setNavOpen(v => !v)} style={{
            width: 34, height: 34, borderRadius: 8, border: '1px solid #ddd', background: '#fff',
            alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: 16,
          }}>☰</button>
          <h1 style={{ fontSize: 17, fontWeight: 800, margin: 0 }}>{TAB_META[tab].icon} {TAB_META[tab].label}</h1>
          <span style={{ fontSize: 12, color: '#999' }}>{TAB_META[tab].desc}</span>
        </div>

        <div style={{ maxWidth: 900, margin: '0 auto', padding: '20px 20px 60px' }}>
          {tab === 'overview' && (
            <OverviewTab
              authHeaders={authHeaders}
              goTab={id => goTab(id as Tab)}
              badgeCounts={badgeCounts}
              tabMeta={TAB_META}
              tabGroups={TAB_GROUPS}
              siteLinks={SITE_LINKS}
            />
          )}
          {tab === 'blocks' && <BlocksTab authHeaders={authHeaders} />}
          {tab === 'posts' && <PostsTab authHeaders={authHeaders} />}
          {tab === 'review' && <ReviewTab authHeaders={authHeaders} />}
          {tab === 'traces' && <TracesTab authHeaders={authHeaders} />}
          {tab === 'reports' && <ReportsTab authHeaders={authHeaders} />}
          {tab === 'comments' && <CommentsTab authHeaders={authHeaders} />}
          {tab === 'users' && <UsersTab authHeaders={authHeaders} />}
          {tab === 'sponsors' && <SponsorsTab authHeaders={authHeaders} />}
          {tab === 'routes' && <RoutesTab authHeaders={authHeaders} />}
          {tab === 'quests' && <QuestsTab authHeaders={authHeaders} />}
          {tab === 'events' && <EventPlansTab authHeaders={authHeaders} />}
          {tab === 'leads' && <ClientLeadsTab authHeaders={authHeaders} />}
          {tab === 'attachment' && <AttachmentTab authHeaders={authHeaders} />}
        </div>
      </main>
    </div>
  );
}

// ────────────────────────────────────────────
function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ background: '#fff', borderRadius: 12, padding: 16, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', ...style }}>
      {children}
    </div>
  );
}

// ── 承認待ち ──────────────────────────────
function ReviewTab({ authHeaders }: { authHeaders: () => HeadersInit }) {
  const [traces, setTraces] = useState<Trace[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const authorMap = useAuthorMap(authHeaders);

  const load = useCallback(() => {
    setLoading(true);
    fetch('/api/admin/traces?status=pending_review', { headers: authHeaders() })
      .then(r => r.json())
      .then(d => { if (d.ok) setTraces(d.traces); else setError(d.error ?? '取得に失敗しました'); })
      .catch(() => setError('通信エラー'))
      .finally(() => setLoading(false));
  }, [authHeaders]);

  useEffect(() => { load(); }, [load]);

  async function review(id: string, action: 'approve' | 'reject') {
    const res = await fetch(`/api/admin/traces/${id}/review`, {
      method: 'POST', headers: authHeaders(), body: JSON.stringify({ action }),
    });
    const data = await res.json();
    if (data.ok) setTraces(prev => prev.filter(t => t.id !== id));
    else setError(data.error ?? '処理に失敗しました');
  }

  if (loading) return <p style={{ color: '#999' }}>読み込み中…</p>;

  return (
    <div>
      <p style={{ fontSize: 12, color: '#999', marginBottom: 12 }}>全国公開の申請 {traces.length}件</p>
      {error && <p style={{ color: '#E74C3C', fontSize: 13 }}>{error}</p>}
      {traces.length === 0 && <p style={{ color: '#aaa' }}>審査待ちの投稿はありません。</p>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {traces.map(t => (
          <Card key={t.id}>
            <div style={{ display: 'flex', gap: 10 }}>
              {t.photo_url && (
                <img src={t.photo_url} alt={t.title} style={{ width: 64, height: 64, objectFit: 'cover', borderRadius: 8, flexShrink: 0 }} />
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontWeight: 700, marginBottom: 4 }}>{t.title}</p>
                <ContentTags trace={t} />
                {t.why && <p style={{ fontSize: 13, color: '#555', margin: '0 0 6px' }}>{t.why}</p>}
                <p style={{ fontSize: 11, color: '#aaa', margin: 0 }}>
                  <AuthorLine trace={t} authorMap={authorMap} /> ・ {new Date(t.created_at).toLocaleString('ja-JP')} ・ {t.latitude.toFixed(4)}, {t.longitude.toFixed(4)}
                </p>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <button onClick={() => review(t.id, 'approve')} style={{
                flex: 1, padding: '8px 0', borderRadius: 8, border: 'none',
                background: '#27AE60', color: '#fff', fontWeight: 700, cursor: 'pointer',
              }}>承認（全国公開）</button>
              <button onClick={() => review(t.id, 'reject')} style={{
                flex: 1, padding: '8px 0', borderRadius: 8, border: '1px solid #ddd',
                background: '#fff', color: '#888', fontWeight: 700, cursor: 'pointer',
              }}>却下（非公開に戻す）</button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ── 投稿管理 ──────────────────────────────
function TracesTab({ authHeaders }: { authHeaders: () => HeadersInit }) {
  const [q, setQ] = useState('');
  const [showDeleted, setShowDeleted] = useState(false);
  const [traces, setTraces] = useState<Trace[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const authorMap = useAuthorMap(authHeaders);

  const load = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams({ status: 'all', limit: '100' });
    if (q.trim()) params.set('q', q.trim());
    if (showDeleted) params.set('include_deleted', 'true');
    fetch(`/api/admin/traces?${params}`, { headers: authHeaders() })
      .then(r => r.json())
      .then(d => { if (d.ok) setTraces(d.traces); else setError(d.error ?? '取得に失敗しました'); })
      .catch(() => setError('通信エラー'))
      .finally(() => setLoading(false));
  }, [authHeaders, q, showDeleted]);

  useEffect(() => { load(); }, [load]);

  async function softDelete(id: string) {
    if (!confirm('この投稿を非公開（削除）にしますか？')) return;
    const res = await fetch(`/api/admin/traces/${id}`, { method: 'DELETE', headers: authHeaders() });
    const data = await res.json();
    if (data.ok) load(); else setError(data.error ?? '処理に失敗しました');
  }

  async function restore(id: string) {
    const res = await fetch(`/api/admin/traces/${id}`, { method: 'PATCH', headers: authHeaders() });
    const data = await res.json();
    if (data.ok) load(); else setError(data.error ?? '処理に失敗しました');
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
        <input value={q} onChange={e => setQ(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') load(); }}
          placeholder="タイトルで検索" style={{ ...inputStyle, flex: 1, minWidth: 160 }} />
        <button onClick={load} style={{ ...inputStyle, background: '#38ADA9', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 700 }}>検索</button>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#666' }}>
          <input type="checkbox" checked={showDeleted} onChange={e => setShowDeleted(e.target.checked)} />
          削除済みも表示
        </label>
      </div>

      {error && <p style={{ color: '#E74C3C', fontSize: 13 }}>{error}</p>}
      {loading ? <p style={{ color: '#999' }}>読み込み中…</p> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {traces.length === 0 && <p style={{ color: '#aaa' }}>該当する投稿はありません。</p>}
          {traces.map(t => (
            <div key={t.id} style={{
              display: 'flex', alignItems: 'flex-start', gap: 10,
              background: '#fff', borderRadius: 10, padding: '10px 12px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
              opacity: t.is_deleted ? 0.55 : 1,
            }}>
              {t.photo_url && <img src={t.photo_url} alt="" style={{ width: 48, height: 48, objectFit: 'cover', borderRadius: 6, flexShrink: 0 }} />}
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: 0, fontWeight: 700, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.title}</p>
                <ContentTags trace={t} />
                {t.why && (
                  <p style={{ margin: '2px 0 4px', fontSize: 12, color: '#666', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.why}</p>
                )}
                <p style={{ margin: 0, fontSize: 11, color: '#aaa' }}>
                  <AuthorLine trace={t} authorMap={authorMap} /> ・ {t.visibility} ・ {new Date(t.created_at).toLocaleDateString('ja-JP')}
                  {t.is_deleted && ' ・ 削除済み'}
                </p>
              </div>
              {t.is_deleted ? (
                <button onClick={() => restore(t.id)} style={{
                  padding: '6px 12px', borderRadius: 8, border: 'none',
                  background: '#EEF4FF', color: '#4A90E2', fontSize: 12, fontWeight: 700, cursor: 'pointer',
                }}>復元</button>
              ) : (
                <button onClick={() => softDelete(t.id)} style={{
                  padding: '6px 12px', borderRadius: 8, border: 'none',
                  background: '#FFF0F0', color: '#E55039', fontSize: 12, fontWeight: 700, cursor: 'pointer',
                }}>削除</button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── 通報 ──────────────────────────────────
function ReportsTab({ authHeaders }: { authHeaders: () => HeadersInit }) {
  const [status, setStatus] = useState<'pending' | 'all'>('pending');
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    fetch(`/api/admin/reports?status=${status}`, { headers: authHeaders() })
      .then(r => r.json())
      .then(d => {
        if (d.ok) {
          // 個人宅・敷地の特定通報を先頭に出す（それ以外は元の並び＝新着順を維持）
          const sorted = [...(d.reports as Report[])].sort((a, b) =>
            Number(URGENT_REPORT_REASONS.has(b.reason)) - Number(URGENT_REPORT_REASONS.has(a.reason))
          );
          setReports(sorted);
        } else setError(d.error ?? '取得に失敗しました');
      })
      .catch(() => setError('通信エラー'))
      .finally(() => setLoading(false));
  }, [authHeaders, status]);

  useEffect(() => { load(); }, [load]);

  async function act(id: string, action: 'dismiss' | 'action') {
    const res = await fetch(`/api/admin/reports/${id}`, {
      method: 'PATCH', headers: authHeaders(), body: JSON.stringify({ action }),
    });
    const data = await res.json();
    if (data.ok) load(); else setError(data.error ?? '処理に失敗しました');
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
        {([['pending', '未処理'], ['all', 'すべて']] as [typeof status, string][]).map(([id, label]) => (
          <button key={id} onClick={() => setStatus(id)} style={{
            padding: '7px 14px', borderRadius: 16, border: 'none', cursor: 'pointer',
            background: status === id ? '#E55039' : '#fff',
            color: status === id ? '#fff' : '#666', fontWeight: 700, fontSize: 12,
            boxShadow: status === id ? 'none' : '0 1px 3px rgba(0,0,0,0.08)',
          }}>{label}</button>
        ))}
      </div>

      {error && <p style={{ color: '#E74C3C', fontSize: 13 }}>{error}</p>}
      {loading ? <p style={{ color: '#999' }}>読み込み中…</p> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {reports.length === 0 && <p style={{ color: '#aaa' }}>該当する通報はありません。</p>}
          {reports.map(r => {
            const urgent = URGENT_REPORT_REASONS.has(r.reason);
            return (
            <Card key={r.id} style={urgent ? { background: '#FFF5F3', boxShadow: '0 1px 4px rgba(229,80,57,0.2)', border: '1.5px solid #FFB4A8' } : undefined}>
              <div style={{ display: 'flex', gap: 10 }}>
                {r.trace?.photo_url && (
                  <img src={r.trace.photo_url} alt="" style={{ width: 56, height: 56, objectFit: 'cover', borderRadius: 8, flexShrink: 0 }} />
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: '0 0 4px', fontWeight: 700, fontSize: 13 }}>
                    {r.trace?.title ?? '（投稿が見つかりません）'}
                    {r.trace?.is_deleted && <span style={{ color: '#aaa', fontWeight: 400 }}> ・ 削除済み</span>}
                  </p>
                  <p style={{ margin: '0 0 4px', fontSize: 12, color: '#E55039', fontWeight: 700 }}>
                    {urgent && '🚨 至急・'}{REASON_LABELS[r.reason] ?? r.reason}
                  </p>
                  {r.note && <p style={{ margin: '0 0 4px', fontSize: 12, color: '#555' }}>{r.note}</p>}
                  <p style={{ margin: 0, fontSize: 11, color: '#aaa' }}>
                    {new Date(r.created_at).toLocaleString('ja-JP')} ・ ステータス：{r.status}
                  </p>
                </div>
              </div>
              {r.status === 'pending' && (
                <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                  <button onClick={() => act(r.id, 'dismiss')} style={{
                    flex: 1, padding: '8px 0', borderRadius: 8, border: '1px solid #ddd',
                    background: '#fff', color: '#888', fontWeight: 700, cursor: 'pointer',
                  }}>却下</button>
                  <button onClick={() => act(r.id, 'action')} style={{
                    flex: 1, padding: '8px 0', borderRadius: 8, border: 'none',
                    background: '#E55039', color: '#fff', fontWeight: 700, cursor: 'pointer',
                  }}>投稿を削除</button>
                </div>
              )}
            </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── コメント管理 ──────────────────────────
interface AdminComment {
  id: string;
  created_at: string;
  trace_id: string;
  body: string;
  is_deleted: boolean;
  trace_title: string | null;
  trace_deleted: boolean;
  username: string | null;
}

function CommentsTab({ authHeaders }: { authHeaders: () => HeadersInit }) {
  const [comments, setComments] = useState<AdminComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    fetch('/api/admin/comments', { headers: authHeaders() })
      .then(r => r.json())
      .then(d => { if (d.ok) setComments(d.comments); else setError(d.error ?? '取得に失敗しました'); })
      .catch(() => setError('通信エラー'))
      .finally(() => setLoading(false));
  }, [authHeaders]);

  useEffect(() => { load(); }, [load]);

  async function remove(id: string) {
    if (!confirm('このコメントを削除しますか？')) return;
    const res = await fetch(`/api/admin/comments/${id}`, { method: 'DELETE', headers: authHeaders() });
    const data = await res.json();
    if (data.ok) setComments(prev => prev.map(c => c.id === id ? { ...c, is_deleted: true } : c));
    else setError(data.error ?? '削除に失敗しました');
  }

  return (
    <div>
      {error && <p style={{ color: '#E74C3C', fontSize: 13 }}>{error}</p>}
      {loading ? <p style={{ color: '#999' }}>読み込み中…</p> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {comments.length === 0 && <p style={{ color: '#aaa' }}>まだコメントはありません。</p>}
          {comments.map(c => (
            <Card key={c.id} style={c.is_deleted ? { opacity: 0.5 } : undefined}>
              <p style={{ margin: '0 0 4px', fontSize: 12, color: '#999' }}>
                <a href={`/t/${c.trace_id}`} target="_blank" rel="noopener noreferrer" style={{ color: '#38ADA9' }}>
                  {c.trace_title ?? '（投稿が見つかりません）'}
                </a>
                {c.trace_deleted && <span style={{ color: '#aaa' }}> ・ 投稿は削除済み</span>}
                {' '}・ {c.username ? `@${c.username}` : 'ユーザー不明'}
              </p>
              <p style={{ margin: '0 0 6px', fontSize: 14, color: '#333', whiteSpace: 'pre-wrap' }}>{c.body}</p>
              <p style={{ margin: 0, fontSize: 11, color: '#bbb' }}>
                {new Date(c.created_at).toLocaleString('ja-JP')}
                {c.is_deleted && ' ・ 削除済み'}
              </p>
              {!c.is_deleted && (
                <button onClick={() => remove(c.id)} style={{
                  marginTop: 8, padding: '6px 14px', borderRadius: 8, border: '1px solid #ddd',
                  background: '#fff', color: '#E55039', fontWeight: 700, fontSize: 12, cursor: 'pointer',
                }}>削除</button>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ── スポンサー管理 ────────────────────────
function SponsorsTab({ authHeaders }: { authHeaders: () => HeadersInit }) {
  const [sponsors, setSponsors] = useState<Sponsor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ placement: 'region', region: '', name: '', message: '', url: '' });
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    fetch('/api/admin/sponsors', { headers: authHeaders() })
      .then(r => r.json())
      .then(d => { if (d.ok) setSponsors(d.sponsors); else setError(d.error ?? '取得に失敗しました'); })
      .catch(() => setError('通信エラー'))
      .finally(() => setLoading(false));
  }, [authHeaders]);

  useEffect(() => { load(); }, [load]);

  async function createSponsor(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      const res = await fetch('/api/sponsors', {
        method: 'POST', headers: authHeaders(),
        body: JSON.stringify({
          placement: form.placement, region: form.region || null,
          name: form.name, message: form.message || null, url: form.url || null,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setForm({ placement: 'region', region: '', name: '', message: '', url: '' });
        setShowForm(false);
        load();
      } else setError(data.error ?? '作成に失敗しました');
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(s: Sponsor) {
    const res = await fetch(`/api/admin/sponsors/${s.id}`, {
      method: 'PATCH', headers: authHeaders(),
      body: JSON.stringify({ is_active: !s.is_active }),
    });
    const data = await res.json();
    if (data.ok) load(); else setError(data.error ?? '更新に失敗しました');
  }

  async function removeSponsor(id: string) {
    if (!confirm('このスポンサー枠を削除しますか？')) return;
    const res = await fetch(`/api/admin/sponsors/${id}`, { method: 'DELETE', headers: authHeaders() });
    const data = await res.json();
    if (data.ok) load(); else setError(data.error ?? '削除に失敗しました');
  }

  return (
    <div>
      <button onClick={() => setShowForm(v => !v)} style={{
        padding: '9px 16px', borderRadius: 8, border: 'none', marginBottom: 14,
        background: '#FF6B9D', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer',
      }}>{showForm ? '閉じる' : '＋ 新しいスポンサー枠を追加'}</button>

      {showForm && (
        <Card>
          <form onSubmit={createSponsor} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <select value={form.placement} onChange={e => setForm(f => ({ ...f, placement: e.target.value }))} style={inputStyle}>
              <option value="region">region（自治体ページ）</option>
              <option value="detour">detour（寄り道モード）</option>
            </select>
            <input placeholder="対象の自治体名（regionの場合）" value={form.region} onChange={e => setForm(f => ({ ...f, region: e.target.value }))} style={inputStyle} />
            <input placeholder="スポンサー名 *" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} style={inputStyle} required />
            <input placeholder="メッセージ" value={form.message} onChange={e => setForm(f => ({ ...f, message: e.target.value }))} style={inputStyle} />
            <input placeholder="リンクURL" value={form.url} onChange={e => setForm(f => ({ ...f, url: e.target.value }))} style={inputStyle} />
            <button type="submit" disabled={saving} style={{
              padding: '9px 0', borderRadius: 8, border: 'none',
              background: '#38ADA9', color: '#fff', fontWeight: 700, cursor: 'pointer',
            }}>{saving ? '作成中…' : '作成する'}</button>
          </form>
        </Card>
      )}

      {error && <p style={{ color: '#E74C3C', fontSize: 13, marginTop: 10 }}>{error}</p>}
      {loading ? <p style={{ color: '#999', marginTop: 10 }}>読み込み中…</p> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 14 }}>
          {sponsors.length === 0 && <p style={{ color: '#aaa' }}>登録されたスポンサー枠はありません。</p>}
          {sponsors.map(s => (
            <div key={s.id} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              background: '#fff', borderRadius: 10, padding: '10px 12px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.06)', opacity: s.is_active ? 1 : 0.5,
            }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: 0, fontWeight: 700, fontSize: 13 }}>{s.name}
                  <span style={{ fontWeight: 400, color: '#aaa', fontSize: 11 }}> ・ {s.placement}{s.region ? ` ・ ${s.region}` : ''}</span>
                </p>
                {s.message && <p style={{ margin: '2px 0 0', fontSize: 12, color: '#666' }}>{s.message}</p>}
              </div>
              <button onClick={() => toggleActive(s)} style={{
                padding: '6px 12px', borderRadius: 8, border: 'none',
                background: s.is_active ? '#FFF3CD' : '#E8F8F7',
                color: s.is_active ? '#856404' : '#38ADA9', fontSize: 12, fontWeight: 700, cursor: 'pointer',
              }}>{s.is_active ? '停止する' : '再開する'}</button>
              <button onClick={() => removeSponsor(s.id)} style={{
                padding: '6px 10px', borderRadius: 8, border: 'none',
                background: 'none', color: '#ccc', fontSize: 12, cursor: 'pointer',
              }}>削除</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── ルート管理 ────────────────────────────
// datetime-local入力用：ISO文字列 ⇄ "YYYY-MM-DDTHH:mm" の相互変換
function isoToInputValue(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function inputValueToIso(v: string): string | null {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

interface EventFieldsForm {
  event_slug: string;
  event_cover_url: string;
  event_starts_at: string;
  event_ends_at: string;
  event_area: string;
  event_mode: 'route' | 'relay' | 'bonno';
  event_session_code: string;
  event_start_lat: number | null;
  event_start_lng: number | null;
  event_start_label: string;
  event_end_lat: number | null;
  event_end_lng: number | null;
  event_end_label: string;
  event_waypoints: { lat: number; lng: number; label: string }[];
  event_fee: string;
  event_meeting_info: string;
  event_photo_urls: string[];
  is_public_recommendation: boolean;
  bonno_requires_moderation: boolean;
}

const emptyEventFields: EventFieldsForm = {
  event_slug: '', event_cover_url: '', event_starts_at: '', event_ends_at: '', event_area: '',
  event_mode: 'route', event_session_code: '',
  event_start_lat: null, event_start_lng: null, event_start_label: '',
  event_end_lat: null, event_end_lng: null, event_end_label: '',
  event_waypoints: [],
  event_fee: '', event_meeting_info: '', event_photo_urls: [],
  is_public_recommendation: false,
  bonno_requires_moderation: false,
};

interface RelayCreateForm {
  title: string;
  description: string;
  event_mode: 'relay' | 'bonno';
  event_session_code: string;
  event_slug: string;
  event_cover_url: string;
  event_area: string;
  event_starts_at: string;
  event_ends_at: string;
  event_start_lat: number | null;
  event_start_lng: number | null;
  event_start_label: string;
  event_end_lat: number | null;
  event_end_lng: number | null;
  event_end_label: string;
  event_waypoints: { lat: number; lng: number; label: string }[];
  event_fee: string;
  event_meeting_info: string;
  event_photo_urls: string[];
  bonno_requires_moderation: boolean;
}

const emptyRelayForm: RelayCreateForm = {
  title: '', description: '', event_mode: 'relay', event_session_code: '', event_slug: '', event_cover_url: '',
  event_area: '', event_starts_at: '', event_ends_at: '',
  event_start_lat: null, event_start_lng: null, event_start_label: '',
  event_end_lat: null, event_end_lng: null, event_end_label: '',
  event_waypoints: [],
  event_fee: '', event_meeting_info: '', event_photo_urls: [],
  bonno_requires_moderation: false,
};

// スタート/ゴール地点ピッカー：地図タップで座標を決め、ラベルを添える（イベントページのRouteMap/TraceMapに反映される）
function StartEndPicker({ kind, lat, lng, label, onChange }: {
  kind: 'start' | 'end';
  lat: number | null; lng: number | null; label: string;
  onChange: (v: { lat: number | null; lng: number | null; label: string }) => void;
}) {
  const [open, setOpen] = useState(false);
  const emoji = kind === 'start' ? '🚩' : '🏁';
  const title = kind === 'start' ? 'スタート地点' : 'ゴール地点';
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: open ? 6 : 0 }}>
        <button type="button" onClick={() => setOpen(v => !v)} style={{
          padding: '6px 12px', borderRadius: 8, fontSize: 12, cursor: 'pointer',
          border: `1.5px solid ${lat != null ? (kind === 'start' ? '#27AE60' : '#E55039') : '#ddd'}`,
          background: lat != null ? (kind === 'start' ? '#E8F8F1' : '#FFF0F0') : '#fff',
          color: lat != null ? (kind === 'start' ? '#27AE60' : '#E55039') : '#888', fontWeight: 700,
        }}>
          {emoji} {title}{lat != null ? '設定済み' : '未設定'} {open ? '▴' : '▾'}
        </button>
        {lat != null && (
          <button type="button" onClick={() => onChange({ lat: null, lng: null, label: '' })} style={{
            background: 'none', border: 'none', color: '#ccc', fontSize: 11, cursor: 'pointer',
          }}>解除</button>
        )}
      </div>
      {open && (
        <div style={{ marginTop: 6 }}>
          <input placeholder={`${title}の名前（例：渋谷駅ハチ公口）`} value={label}
            onChange={e => onChange({ lat, lng, label: e.target.value })}
            style={{ ...inputStyle, width: '100%', boxSizing: 'border-box', marginBottom: 6 }} />
          <div style={{ height: 200, borderRadius: 8, overflow: 'hidden', border: '1px solid #eee' }}>
            <LocationPickerMap
              lat={lat ?? 35.681236} lng={lng ?? 139.767125}
              onChange={(la, ln) => onChange({ lat: la, lng: ln, label })}
            />
          </div>
          <p style={{ margin: '4px 0 0', fontSize: 11, color: '#aaa' }}>地図をタップして{title}を指定してください</p>
        </div>
      )}
    </div>
  );
}

// フィールドの下に添える、非エンジニアにも分かる一言説明
function Hint({ children }: { children: React.ReactNode }) {
  return <p style={{ margin: '-2px 0 2px', fontSize: 11, color: '#aaa', lineHeight: 1.5 }}>{children}</p>;
}

// 経由地点：スタートとゴールの間に何箇所でも置け、順番どおりに線でつながる
function WaypointsEditor({ waypoints, onChange }: {
  waypoints: { lat: number; lng: number; label: string }[];
  onChange: (waypoints: { lat: number; lng: number; label: string }[]) => void;
}) {
  const [open, setOpen] = useState(false);

  function addWaypoint() {
    onChange([...waypoints, { lat: 35.681236, lng: 139.767125, label: '' }]);
    setOpen(true);
  }
  function updateWaypoint(i: number, patch: Partial<{ lat: number; lng: number; label: string }>) {
    onChange(waypoints.map((w, idx) => idx === i ? { ...w, ...patch } : w));
  }
  function removeWaypoint(i: number) {
    onChange(waypoints.filter((_, idx) => idx !== i));
  }
  function moveWaypoint(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= waypoints.length) return;
    const next = [...waypoints];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  }

  return (
    <div>
      <button type="button" onClick={() => setOpen(v => !v)} style={{
        padding: '6px 12px', borderRadius: 8, fontSize: 12, cursor: 'pointer',
        border: `1.5px solid ${waypoints.length > 0 ? '#38ADA9' : '#ddd'}`,
        background: waypoints.length > 0 ? '#E8F8F7' : '#fff',
        color: waypoints.length > 0 ? '#38ADA9' : '#888', fontWeight: 700,
      }}>
        📍 経由地点{waypoints.length > 0 ? `（${waypoints.length}件）` : 'なし'} {open ? '▴' : '▾'}
      </button>
      {open && (
        <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {waypoints.map((w, i) => (
            <div key={i} style={{ border: '1px solid #eee', borderRadius: 8, padding: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                <span style={{
                  width: 20, height: 20, borderRadius: '50%', background: '#38ADA9', color: '#fff',
                  fontSize: 11, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>{i + 1}</span>
                <input placeholder={`経由地点${i + 1}の名前（例：〇〇商店街）`} value={w.label}
                  onChange={e => updateWaypoint(i, { label: e.target.value })}
                  style={{ ...inputStyle, flex: 1 }} />
                <button type="button" onClick={() => moveWaypoint(i, -1)} disabled={i === 0} style={{
                  background: 'none', border: 'none', cursor: i === 0 ? 'default' : 'pointer', color: i === 0 ? '#eee' : '#888', fontSize: 14,
                }}>▲</button>
                <button type="button" onClick={() => moveWaypoint(i, 1)} disabled={i === waypoints.length - 1} style={{
                  background: 'none', border: 'none', cursor: i === waypoints.length - 1 ? 'default' : 'pointer', color: i === waypoints.length - 1 ? '#eee' : '#888', fontSize: 14,
                }}>▼</button>
                <button type="button" onClick={() => removeWaypoint(i)} style={{
                  background: 'none', border: 'none', color: '#E55039', fontSize: 12, cursor: 'pointer',
                }}>削除</button>
              </div>
              <div style={{ height: 160, borderRadius: 8, overflow: 'hidden', border: '1px solid #eee' }}>
                <LocationPickerMap lat={w.lat} lng={w.lng} onChange={(la, ln) => updateWaypoint(i, { lat: la, lng: ln })} />
              </div>
            </div>
          ))}
          <button type="button" onClick={addWaypoint} style={{
            padding: '8px 0', borderRadius: 8, border: '1.5px dashed #38ADA9',
            background: '#fff', color: '#38ADA9', fontWeight: 700, fontSize: 12, cursor: 'pointer',
          }}>＋ 経由地点を追加</button>
        </div>
      )}
    </div>
  );
}

// イベント写真（複数枚）：1枚目が自動でヒーロー画像になる
function EventPhotosUploader({ urls, onChange }: { urls: string[]; onChange: (urls: string[]) => void }) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const MAX_PHOTOS = 6;

  async function handleFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []).slice(0, MAX_PHOTOS - urls.length);
    if (files.length === 0) return;
    setUploading(true);
    setError('');
    try {
      const { uploadTracePhoto } = await import('@/lib/supabase/upload');
      const uploaded: string[] = [];
      for (const file of files) uploaded.push(await uploadTracePhoto(file));
      onChange([...urls, ...uploaded]);
    } catch (err) {
      setError(err instanceof Error ? err.message : '画像のアップロードに失敗しました');
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }
  function removeAt(i: number) {
    onChange(urls.filter((_, idx) => idx !== i));
  }

  return (
    <div>
      {urls.length > 0 && (
        <div style={{ display: 'flex', gap: 6, overflowX: 'auto', marginBottom: 6 }}>
          {urls.map((url, i) => (
            <div key={i} style={{ position: 'relative', flexShrink: 0 }}>
              <img src={url} alt="" style={{ width: 90, height: 70, objectFit: 'cover', borderRadius: 8, display: 'block' }} />
              {i === 0 && (
                <span style={{
                  position: 'absolute', top: 2, left: 2, padding: '1px 6px', borderRadius: 8,
                  background: 'rgba(0,0,0,0.6)', color: '#fff', fontSize: 9, fontWeight: 700,
                }}>ヒーロー</span>
              )}
              <button type="button" onClick={() => removeAt(i)} style={{
                position: 'absolute', top: -6, right: -6, width: 20, height: 20, borderRadius: '50%',
                background: 'rgba(0,0,0,0.65)', color: '#fff', border: 'none', fontSize: 11, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>✕</button>
            </div>
          ))}
        </div>
      )}
      <input ref={inputRef} type="file" accept="image/*" multiple onChange={handleFiles} style={{ display: 'none' }} />
      <button type="button" onClick={() => inputRef.current?.click()} disabled={uploading || urls.length >= MAX_PHOTOS} style={{
        width: '100%', padding: '9px 0', borderRadius: 8, border: '1.5px solid #ddd',
        background: '#fafafa', color: '#555', fontSize: 12, fontWeight: 700,
        cursor: uploading ? 'wait' : 'pointer',
      }}>{uploading ? 'アップロード中…' : `🖼 写真を追加（任意・最大${MAX_PHOTOS}枚、${urls.length}/${MAX_PHOTOS}）`}</button>
      {error && <p style={{ margin: '6px 0 0', fontSize: 11, color: '#E55039' }}>{error}</p>}
    </div>
  );
}

function RoutesTab({ authHeaders }: { authHeaders: () => HeadersInit }) {
  const [routes, setRoutes] = useState<Route[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [sponsorName, setSponsorName] = useState('');
  const [sponsorUrl, setSponsorUrl] = useState('');
  const [eventEditingId, setEventEditingId] = useState<string | null>(null);
  const [eventFields, setEventFields] = useState<EventFieldsForm>(emptyEventFields);
  const [eventSaving, setEventSaving] = useState(false);
  const [showRelayCreate, setShowRelayCreate] = useState(false);
  const [relayForm, setRelayForm] = useState<RelayCreateForm>(emptyRelayForm);
  const [relaySaving, setRelaySaving] = useState(false);
  const [expandedRouteId, setExpandedRouteId] = useState<string | null>(null);
  const [routeTraces, setRouteTraces] = useState<Record<string, Trace[]>>({});
  const [routeTracesLoading, setRouteTracesLoading] = useState<string | null>(null);

  async function toggleExpand(id: string) {
    if (expandedRouteId === id) { setExpandedRouteId(null); return; }
    setExpandedRouteId(id);
    if (!routeTraces[id]) {
      setRouteTracesLoading(id);
      try {
        const res = await fetch(`/api/routes/${id}`).then(r => r.json());
        if (res.ok) setRouteTraces(prev => ({ ...prev, [id]: res.traces ?? [] }));
      } finally {
        setRouteTracesLoading(null);
      }
    }
  }

  const load = useCallback(() => {
    setLoading(true);
    fetch('/api/routes')
      .then(r => r.json())
      .then(d => { if (d.ok) setRoutes(d.routes); else setError(d.error ?? '取得に失敗しました'); })
      .catch(() => setError('通信エラー'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  function startEdit(r: Route) {
    setEditingId(r.id);
    setSponsorName(r.sponsor_name ?? '');
    setSponsorUrl(r.sponsor_url ?? '');
  }

  async function saveSponsor(id: string) {
    const res = await fetch(`/api/admin/routes/${id}`, {
      method: 'PATCH', headers: authHeaders(),
      body: JSON.stringify({ sponsor_name: sponsorName || null, sponsor_url: sponsorUrl || null }),
    });
    const data = await res.json();
    if (data.ok) { setEditingId(null); load(); } else setError(data.error ?? '更新に失敗しました');
  }

  function startEventEdit(r: Route) {
    setEventEditingId(r.id);
    setEventFields({
      event_slug: r.event_slug ?? '',
      event_cover_url: r.event_cover_url ?? '',
      event_starts_at: isoToInputValue(r.event_starts_at),
      event_ends_at: isoToInputValue(r.event_ends_at),
      event_area: r.event_area ?? '',
      event_mode: r.event_mode === 'relay' ? 'relay' : r.event_mode === 'bonno' ? 'bonno' : 'route',
      event_session_code: r.event_session_code ?? '',
      event_start_lat: r.event_start_lat, event_start_lng: r.event_start_lng, event_start_label: r.event_start_label ?? '',
      event_end_lat: r.event_end_lat, event_end_lng: r.event_end_lng, event_end_label: r.event_end_label ?? '',
      event_waypoints: r.event_waypoints ?? [],
      event_fee: r.event_fee ?? '', event_meeting_info: r.event_meeting_info ?? '',
      event_photo_urls: r.event_photo_urls ?? (r.event_cover_url ? [r.event_cover_url] : []),
      is_public_recommendation: r.is_public_recommendation ?? false,
      bonno_requires_moderation: r.bonno_requires_moderation ?? false,
    });
  }

  async function saveEventFields(id: string) {
    setEventSaving(true);
    try {
      const res = await fetch(`/api/admin/routes/${id}`, {
        method: 'PATCH', headers: authHeaders(),
        body: JSON.stringify({
          event_slug: eventFields.event_slug.trim() || null,
          event_cover_url: eventFields.event_photo_urls[0] ?? null,
          event_photo_urls: eventFields.event_photo_urls.length > 0 ? eventFields.event_photo_urls : null,
          event_starts_at: inputValueToIso(eventFields.event_starts_at),
          event_ends_at: inputValueToIso(eventFields.event_ends_at),
          event_area: eventFields.event_area.trim() || null,
          event_mode: eventFields.event_mode,
          event_session_code: eventFields.event_mode === 'relay' ? (eventFields.event_session_code.trim() || null) : null,
          event_start_lat: eventFields.event_start_lat, event_start_lng: eventFields.event_start_lng,
          event_start_label: eventFields.event_start_label.trim() || null,
          event_end_lat: eventFields.event_end_lat, event_end_lng: eventFields.event_end_lng,
          event_end_label: eventFields.event_end_label.trim() || null,
          event_waypoints: eventFields.event_waypoints.length > 0 ? eventFields.event_waypoints : null,
          event_fee: eventFields.event_fee.trim() || null,
          event_meeting_info: eventFields.event_meeting_info.trim() || null,
          is_public_recommendation: eventFields.is_public_recommendation,
          bonno_requires_moderation: eventFields.bonno_requires_moderation,
        }),
      });
      const data = await res.json();
      if (data.ok) { setEventEditingId(null); load(); } else setError(data.error ?? '更新に失敗しました');
    } finally {
      setEventSaving(false);
    }
  }

  async function createRelayEvent() {
    if (!relayForm.title.trim()) { setError('タイトルは必須です'); return; }
    setRelaySaving(true);
    try {
      const res = await fetch('/api/routes', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: relayForm.title.trim(),
          description: relayForm.description.trim() || null,
          trace_ids: [],
          event_mode: 'relay',
          event_session_code: relayForm.event_session_code.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!data.ok) { setError(data.error ?? '作成に失敗しました'); return; }

      // 続けて event_slug 等の公開情報を設定（bonno型は/api/routesが受けないため、ここでモードを確定させる）
      const patchRes = await fetch(`/api/admin/routes/${data.route.id}`, {
        method: 'PATCH', headers: authHeaders(),
        body: JSON.stringify({
          event_mode: relayForm.event_mode,
          event_slug: relayForm.event_slug.trim() || null,
          event_cover_url: relayForm.event_photo_urls[0] ?? null,
          event_photo_urls: relayForm.event_photo_urls.length > 0 ? relayForm.event_photo_urls : null,
          event_area: relayForm.event_area.trim() || null,
          event_starts_at: inputValueToIso(relayForm.event_starts_at),
          event_ends_at: inputValueToIso(relayForm.event_ends_at),
          event_start_lat: relayForm.event_start_lat, event_start_lng: relayForm.event_start_lng,
          event_start_label: relayForm.event_start_label.trim() || null,
          event_end_lat: relayForm.event_end_lat, event_end_lng: relayForm.event_end_lng,
          event_end_label: relayForm.event_end_label.trim() || null,
          event_waypoints: relayForm.event_waypoints.length > 0 ? relayForm.event_waypoints : null,
          event_fee: relayForm.event_fee.trim() || null,
          event_meeting_info: relayForm.event_meeting_info.trim() || null,
          bonno_requires_moderation: relayForm.bonno_requires_moderation,
        }),
      });
      const patchData = await patchRes.json();
      if (!patchData.ok) { setError(patchData.error ?? '公開情報の設定に失敗しました'); }

      setShowRelayCreate(false);
      setRelayForm(emptyRelayForm);
      load();
    } finally {
      setRelaySaving(false);
    }
  }

  async function reviewRoute(id: string, status: 'approved' | 'rejected') {
    const res = await fetch(`/api/admin/routes/${id}`, {
      method: 'PATCH', headers: authHeaders(),
      body: JSON.stringify({ review_status: status }),
    });
    const data = await res.json();
    if (data.ok) load(); else setError(data.error ?? '更新に失敗しました');
  }

  if (loading) return <p style={{ color: '#999' }}>読み込み中…</p>;

  const pendingRoutes = routes.filter(r => r.review_status === 'pending');

  return (
    <div>
      {error && <p style={{ color: '#E74C3C', fontSize: 13 }}>{error}</p>}

      {pendingRoutes.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <p style={{ margin: '0 0 8px', fontWeight: 800, fontSize: 14, color: '#B7791F' }}>✨ おすすめルート承認待ち（{pendingRoutes.length}件）</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {pendingRoutes.map(r => (
              <Card key={r.id} style={{ background: '#FFFAF0', border: '1px solid #F6E4B8' }}>
                <p style={{ margin: '0 0 4px', fontWeight: 700, fontSize: 14 }}>{r.title}</p>
                {r.description && <p style={{ margin: '0 0 6px', fontSize: 12, color: '#888' }}>{r.description}</p>}
                {r.highlights && (
                  <p style={{ margin: '0 0 8px', fontSize: 12, color: '#8E44AD', background: '#FBF6FF', padding: '8px 10px', borderRadius: 8, whiteSpace: 'pre-wrap' }}>
                    👀 {r.highlights}
                  </p>
                )}
                <p style={{ margin: '0 0 8px', fontSize: 12, color: '#aaa' }}>{r.trace_ids.length}地点 ・ <a href={`/routes/${r.id}`} target="_blank" rel="noopener noreferrer" style={{ color: '#8E44AD' }}>プレビュー ↗</a></p>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => reviewRoute(r.id, 'approved')} style={{
                    flex: 1, padding: '7px 0', borderRadius: 8, border: 'none',
                    background: '#38ADA9', color: '#fff', fontWeight: 700, cursor: 'pointer', fontSize: 12,
                  }}>承認する</button>
                  <button onClick={() => reviewRoute(r.id, 'rejected')} style={{
                    flex: 1, padding: '7px 0', borderRadius: 8, border: '1px solid #ddd',
                    background: '#fff', color: '#E74C3C', cursor: 'pointer', fontSize: 12,
                  }}>却下する</button>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {showRelayCreate ? (
        <Card>
          <p style={{ margin: '0 0 10px', fontWeight: 800, fontSize: 14, color: '#38ADA9' }}>＋ 新規イベントを作成</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontSize: 11, color: '#666', fontWeight: 700 }}>イベント形式</label>
            <Hint>relay＝参加者が街で発見して投稿していく型。煩悩＝会場で参加者が煩悩を投稿し、壁一面に投影する型（煩悩オークションなど）。</Hint>
            <div style={{ display: 'flex', gap: 6 }}>
              <button onClick={() => setRelayForm(f => ({ ...f, event_mode: 'relay' }))} style={{
                flex: 1, padding: '7px 0', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 700,
                border: relayForm.event_mode === 'relay' ? '1.5px solid #38ADA9' : '1.5px solid #ddd',
                background: relayForm.event_mode === 'relay' ? '#38ADA9' : '#fff',
                color: relayForm.event_mode === 'relay' ? '#fff' : '#888',
              }}>🏃 relay（発見連鎖型）</button>
              <button onClick={() => setRelayForm(f => ({ ...f, event_mode: 'bonno' }))} style={{
                flex: 1, padding: '7px 0', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 700,
                border: relayForm.event_mode === 'bonno' ? '1.5px solid #B7791F' : '1.5px solid #ddd',
                background: relayForm.event_mode === 'bonno' ? '#B7791F' : '#fff',
                color: relayForm.event_mode === 'bonno' ? '#fff' : '#888',
              }}>🔥 煩悩（会場投影型）</button>
            </div>
            {relayForm.event_mode === 'bonno' && (
              <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 12, color: '#555', cursor: 'pointer', padding: '8px 10px', background: '#FFF8EC', borderRadius: 8 }}>
                <input type="checkbox" checked={relayForm.bonno_requires_moderation}
                  onChange={e => setRelayForm(f => ({ ...f, bonno_requires_moderation: e.target.checked }))}
                  style={{ marginTop: 2 }} />
                <span>投稿を運営が確認してから壁に出す（学校・法人向けイベントでは推奨）</span>
              </label>
            )}
            <label style={{ fontSize: 11, color: '#666', fontWeight: 700 }}>① イベント名</label>
            <input placeholder="例：ヒトマップ×山手線一周プロジェクト" value={relayForm.title}
              onChange={e => setRelayForm(f => ({ ...f, title: e.target.value }))} style={inputStyle} />
            <label style={{ fontSize: 11, color: '#666', fontWeight: 700 }}>② 説明文</label>
            <textarea placeholder="どんなイベントか、参加者に伝えたいことを書いてください" value={relayForm.description} rows={3}
              onChange={e => setRelayForm(f => ({ ...f, description: e.target.value }))} style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }} />

            {relayForm.event_mode === 'relay' && (
              <>
                <label style={{ fontSize: 11, color: '#666', fontWeight: 700 }}>③ 参加コード</label>
                <Hint>参加者が投稿するときにこの文字を入力してもらうと、投稿がこのイベントに自動でまとまります。</Hint>
                <input placeholder="例：yamanote2026（好きな英数字でOK）" value={relayForm.event_session_code}
                  onChange={e => setRelayForm(f => ({ ...f, event_session_code: e.target.value }))} style={inputStyle} />
              </>
            )}

            <label style={{ fontSize: 11, color: '#666', fontWeight: 700 }}>④ イベントページのアドレス</label>
            <Hint>「hitomap.com/events/○○」の○○の部分になります。英数字とハイフンだけで、他と被らない文字にしてください。</Hint>
            <input placeholder="例：yamanote-2026" value={relayForm.event_slug}
              onChange={e => setRelayForm(f => ({ ...f, event_slug: e.target.value }))} style={inputStyle} />

            <label style={{ fontSize: 11, color: '#666', fontWeight: 700 }}>⑤ イベント写真</label>
            <Hint>1枚目がページ上部の大きな画像になります。設定しなくてもきれいな色の背景が自動で使われます。</Hint>
            <EventPhotosUploader urls={relayForm.event_photo_urls} onChange={urls => setRelayForm(f => ({ ...f, event_photo_urls: urls }))} />

            <label style={{ fontSize: 11, color: '#666', fontWeight: 700 }}>⑥ エリア名</label>
            <Hint>ページ上部に表示される、開催場所のざっくりした名前です。</Hint>
            <input placeholder="例：山手線" value={relayForm.event_area}
              onChange={e => setRelayForm(f => ({ ...f, event_area: e.target.value }))} style={inputStyle} />

            <label style={{ fontSize: 11, color: '#666', fontWeight: 700 }}>⑦ 参加費（任意）</label>
            <Hint>「無料」「500円（当日集合場所で徴収）」のように自由に書いてください。</Hint>
            <input placeholder="例：無料" value={relayForm.event_fee}
              onChange={e => setRelayForm(f => ({ ...f, event_fee: e.target.value }))} style={inputStyle} />

            <label style={{ fontSize: 11, color: '#666', fontWeight: 700 }}>⑧ 集合場所・持ち物などの詳細（任意）</label>
            <Hint>参加者に事前に伝えておきたいことを自由に書いてください（例：集合時間・持ち物・雨天時の対応など）。</Hint>
            <textarea placeholder="例：JR渋谷駅ハチ公口に10時集合。歩きやすい靴でお越しください。雨天決行。" value={relayForm.event_meeting_info} rows={3}
              onChange={e => setRelayForm(f => ({ ...f, event_meeting_info: e.target.value }))} style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }} />

            <label style={{ fontSize: 11, color: '#666', fontWeight: 700 }}>⑨ 開催期間（任意）</label>
            <div style={{ display: 'flex', gap: 6 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <label style={{ fontSize: 10, color: '#aaa', display: 'block' }}>開始日時</label>
                <input type="datetime-local" value={relayForm.event_starts_at}
                  onChange={e => setRelayForm(f => ({ ...f, event_starts_at: e.target.value }))} style={{ ...inputStyle, width: '100%', boxSizing: 'border-box' }} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <label style={{ fontSize: 10, color: '#aaa', display: 'block' }}>終了日時</label>
                <input type="datetime-local" value={relayForm.event_ends_at}
                  onChange={e => setRelayForm(f => ({ ...f, event_ends_at: e.target.value }))} style={{ ...inputStyle, width: '100%', boxSizing: 'border-box' }} />
              </div>
            </div>

            {relayForm.event_mode === 'relay' && (
              <>
                <label style={{ fontSize: 11, color: '#666', fontWeight: 700 }}>⑩ スタート・ゴール地点（任意）</label>
                <Hint>歩くルートがまだ決まっていなくても、待ち合わせ場所だけ地図で先に決められます。</Hint>
                <StartEndPicker kind="start"
                  lat={relayForm.event_start_lat} lng={relayForm.event_start_lng} label={relayForm.event_start_label}
                  onChange={v => setRelayForm(f => ({ ...f, event_start_lat: v.lat, event_start_lng: v.lng, event_start_label: v.label }))} />
                <WaypointsEditor waypoints={relayForm.event_waypoints}
                  onChange={wp => setRelayForm(f => ({ ...f, event_waypoints: wp }))} />
                <StartEndPicker kind="end"
                  lat={relayForm.event_end_lat} lng={relayForm.event_end_lng} label={relayForm.event_end_label}
                  onChange={v => setRelayForm(f => ({ ...f, event_end_lat: v.lat, event_end_lng: v.lng, event_end_label: v.label }))} />
                <p style={{ margin: '-4px 0 0', fontSize: 11, color: '#aaa' }}>スタート→経由地点→ゴールの順で地図に線が引かれます。</p>
              </>
            )}
            <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
              <button onClick={createRelayEvent} disabled={relaySaving} style={{
                flex: 1, padding: '9px 0', borderRadius: 8, border: 'none',
                background: '#38ADA9', color: '#fff', fontWeight: 700, cursor: relaySaving ? 'wait' : 'pointer', fontSize: 13,
              }}>{relaySaving ? '作成中…' : '作成する'}</button>
              <button onClick={() => { setShowRelayCreate(false); setRelayForm(emptyRelayForm); }} style={{
                flex: 1, padding: '9px 0', borderRadius: 8, border: '1px solid #ddd',
                background: '#fff', color: '#888', cursor: 'pointer', fontSize: 13,
              }}>キャンセル</button>
            </div>
          </div>
        </Card>
      ) : (
        <button onClick={() => setShowRelayCreate(true)} style={{
          display: 'block', width: '100%', padding: '10px 0', borderRadius: 10, border: '1.5px dashed #38ADA9',
          background: '#fff', color: '#38ADA9', fontWeight: 700, fontSize: 13, cursor: 'pointer', marginBottom: 12,
        }}>＋ 新規イベントを作成（relay / 煩悩）</button>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {routes.length === 0 && <p style={{ color: '#aaa' }}>公開中のイベントはありません。</p>}
        {routes.map(r => (
          <Card key={r.id}>
            <p style={{ margin: '0 0 4px', fontWeight: 700, fontSize: 14 }}>{r.title}</p>
            {r.description && <p style={{ margin: '0 0 6px', fontSize: 12, color: '#666' }}>{r.description}</p>}
            {r.highlights && (
              <p style={{ margin: '0 0 6px', fontSize: 12, color: '#8E44AD', background: '#FBF6FF', padding: '6px 9px', borderRadius: 8, whiteSpace: 'pre-wrap' }}>
                👀 {r.highlights}
              </p>
            )}
            <p style={{ margin: '0 0 4px', fontSize: 12, color: '#888' }}>
              {r.trace_ids.length}地点 ・ {new Date(r.created_at).toLocaleDateString('ja-JP')}
              {r.sponsor_name && ` ・ 協賛：${r.sponsor_name}`}
              {r.review_status === 'approved' && <span style={{ color: '#38ADA9', fontWeight: 700 }}> ・ ✨承認済み</span>}
              {r.review_status === 'rejected' && <span style={{ color: '#E74C3C', fontWeight: 700 }}> ・ 却下済み</span>}
            </p>
            {r.trace_ids.length > 0 && (
              <button onClick={() => toggleExpand(r.id)} style={{
                background: 'none', border: 'none', color: '#38ADA9', fontSize: 12, fontWeight: 700, cursor: 'pointer', padding: 0, marginBottom: 8,
              }}>
                {expandedRouteId === r.id ? '▴ 地点を閉じる' : '▾ 地点の中身を見る'}
              </button>
            )}
            {expandedRouteId === r.id && (
              <div style={{ marginBottom: 8, paddingLeft: 4, borderLeft: '2px solid #eee' }}>
                {routeTracesLoading === r.id ? (
                  <p style={{ fontSize: 12, color: '#aaa', margin: 0 }}>読み込み中…</p>
                ) : (routeTraces[r.id] ?? []).length === 0 ? (
                  <p style={{ fontSize: 12, color: '#aaa', margin: 0 }}>地点データがありません。</p>
                ) : (
                  (routeTraces[r.id] ?? []).map((t, i) => (
                    <p key={t.id} style={{ margin: '2px 0', fontSize: 12, color: '#555', display: 'flex', gap: 6 }}>
                      <span style={{ color: '#bbb' }}>{i + 1}.</span>
                      {t.photo_url && <img src={t.photo_url} alt="" style={{ width: 18, height: 18, borderRadius: 4, objectFit: 'cover' }} />}
                      {t.title}
                      {getEmotion(t.emotion_key) && <span>{getEmotion(t.emotion_key)!.emoji}</span>}
                    </p>
                  ))
                )}
              </div>
            )}
            {r.event_slug && (
              <p style={{ margin: '0 0 8px', fontSize: 12 }}>
                <a href={`/events/${r.event_slug}`} target="_blank" rel="noopener noreferrer" style={{ color: r.event_mode === 'relay' ? '#38ADA9' : r.event_mode === 'bonno' ? '#B7791F' : '#8E44AD', fontWeight: 700 }}>
                  {r.event_mode === 'relay' ? '🏃 relay' : r.event_mode === 'bonno' ? '🔥 煩悩' : '🎪 route'} ・ /events/{r.event_slug} を公開中 ↗
                </a>
                {r.event_mode === 'relay' && r.event_session_code && (
                  <span style={{ marginLeft: 8, color: '#999' }}>コード: {r.event_session_code}</span>
                )}
                {r.event_mode === 'bonno' && (
                  <span style={{ marginLeft: 8 }}>
                    <a href={`/events/${r.event_slug}/wall`} target="_blank" rel="noopener noreferrer" style={{ color: '#B7791F', marginRight: 8 }}>投影ウォール ↗</a>
                    <a href={`/events/${r.event_slug}/console`} target="_blank" rel="noopener noreferrer" style={{ color: '#B7791F', marginRight: 8 }}>運営 ↗</a>
                    <a href={`/events/${r.event_slug}/invest`} target="_blank" rel="noopener noreferrer" style={{ color: '#B7791F', marginRight: 8 }}>投資ページ ↗</a>
                    <a href={`/events/${r.event_slug}/board`} target="_blank" rel="noopener noreferrer" style={{ color: '#B7791F' }}>投資ボード ↗</a>
                  </span>
                )}
              </p>
            )}

            {editingId === r.id ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10 }}>
                <input placeholder="協賛企業名" value={sponsorName} onChange={e => setSponsorName(e.target.value)} style={inputStyle} />
                <input placeholder="協賛企業URL" value={sponsorUrl} onChange={e => setSponsorUrl(e.target.value)} style={inputStyle} />
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => saveSponsor(r.id)} style={{
                    flex: 1, padding: '7px 0', borderRadius: 8, border: 'none',
                    background: '#38ADA9', color: '#fff', fontWeight: 700, cursor: 'pointer', fontSize: 12,
                  }}>保存</button>
                  <button onClick={() => setEditingId(null)} style={{
                    flex: 1, padding: '7px 0', borderRadius: 8, border: '1px solid #ddd',
                    background: '#fff', color: '#888', cursor: 'pointer', fontSize: 12,
                  }}>キャンセル</button>
                </div>
              </div>
            ) : (
              <button onClick={() => startEdit(r)} style={{
                padding: '6px 12px', borderRadius: 8, border: '1px solid #eee', marginRight: 8, marginBottom: 8,
                background: '#fff', color: '#38ADA9', fontSize: 12, fontWeight: 700, cursor: 'pointer',
              }}>協賛を設定</button>
            )}

            {eventEditingId === r.id ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 4, padding: 10, background: '#FBF6FF', borderRadius: 8 }}>
                <label style={{ fontSize: 11, color: '#8E44AD', fontWeight: 700 }}>イベント形式</label>
                <Hint>route＝運営が決めた順路を歩いてもらう型。relay＝参加者が自由に見つけて投稿していく型（コースは決まっていなくてもOK）。煩悩＝会場で参加者が煩悩を投稿し、壁に投影する型。</Hint>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button onClick={() => setEventFields(f => ({ ...f, event_mode: 'route' }))} style={{
                    flex: 1, padding: '7px 0', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 700,
                    border: eventFields.event_mode === 'route' ? '1.5px solid #8E44AD' : '1.5px solid #ddd',
                    background: eventFields.event_mode === 'route' ? '#8E44AD' : '#fff',
                    color: eventFields.event_mode === 'route' ? '#fff' : '#888',
                  }}>🚶 route（事前ルート型）</button>
                  <button onClick={() => setEventFields(f => ({ ...f, event_mode: 'relay' }))} style={{
                    flex: 1, padding: '7px 0', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 700,
                    border: eventFields.event_mode === 'relay' ? '1.5px solid #38ADA9' : '1.5px solid #ddd',
                    background: eventFields.event_mode === 'relay' ? '#38ADA9' : '#fff',
                    color: eventFields.event_mode === 'relay' ? '#fff' : '#888',
                  }}>🏃 relay（発見連鎖型）</button>
                  <button onClick={() => setEventFields(f => ({ ...f, event_mode: 'bonno' }))} style={{
                    flex: 1, padding: '7px 0', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 700,
                    border: eventFields.event_mode === 'bonno' ? '1.5px solid #B7791F' : '1.5px solid #ddd',
                    background: eventFields.event_mode === 'bonno' ? '#B7791F' : '#fff',
                    color: eventFields.event_mode === 'bonno' ? '#fff' : '#888',
                  }}>🔥 煩悩（会場投影型）</button>
                </div>
                {eventFields.event_mode === 'bonno' && (
                  <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 12, color: '#555', cursor: 'pointer', padding: '8px 10px', background: '#FFF8EC', borderRadius: 8 }}>
                    <input type="checkbox" checked={eventFields.bonno_requires_moderation}
                      onChange={e => setEventFields(f => ({ ...f, bonno_requires_moderation: e.target.checked }))}
                      style={{ marginTop: 2 }} />
                    <span>投稿を運営が確認してから壁に出す（学校・法人向けイベントでは推奨）</span>
                  </label>
                )}
                {eventFields.event_mode === 'relay' && (
                  <>
                    <label style={{ fontSize: 11, color: '#8E44AD', fontWeight: 700 }}>参加コード</label>
                    <Hint>参加者が投稿するときにこの文字を入力してもらうと、投稿がこのイベントに自動でまとまります。</Hint>
                    <input placeholder="例：yamanote2026（好きな英数字でOK）" value={eventFields.event_session_code}
                      onChange={e => setEventFields(f => ({ ...f, event_session_code: e.target.value }))} style={inputStyle} />
                  </>
                )}
                <label style={{ fontSize: 11, color: '#8E44AD', fontWeight: 700 }}>イベントページのアドレス</label>
                <Hint>「hitomap.com/events/○○」の○○の部分になります。英数字とハイフンだけで、他と被らない文字にしてください。</Hint>
                <input placeholder="例：shibuya-2026" value={eventFields.event_slug}
                  onChange={e => setEventFields(f => ({ ...f, event_slug: e.target.value }))} style={inputStyle} />
                <label style={{ fontSize: 11, color: '#8E44AD', fontWeight: 700 }}>イベント写真</label>
                <Hint>1枚目がページ上部の大きな画像になります。設定しなくてもきれいな色の背景が自動で使われます。</Hint>
                <EventPhotosUploader urls={eventFields.event_photo_urls} onChange={urls => setEventFields(f => ({ ...f, event_photo_urls: urls }))} />
                <label style={{ fontSize: 11, color: '#8E44AD', fontWeight: 700 }}>エリア名</label>
                <Hint>ページ上部に表示される、開催場所のざっくりした名前です（例：渋谷、山手線）。</Hint>
                <input placeholder="例：渋谷" value={eventFields.event_area}
                  onChange={e => setEventFields(f => ({ ...f, event_area: e.target.value }))} style={inputStyle} />
                <label style={{ fontSize: 11, color: '#8E44AD', fontWeight: 700 }}>参加費（任意）</label>
                <Hint>「無料」「500円（当日集合場所で徴収）」のように自由に書いてください。</Hint>
                <input placeholder="例：無料" value={eventFields.event_fee}
                  onChange={e => setEventFields(f => ({ ...f, event_fee: e.target.value }))} style={inputStyle} />
                <label style={{ fontSize: 11, color: '#8E44AD', fontWeight: 700 }}>集合場所・持ち物などの詳細（任意）</label>
                <Hint>参加者に事前に伝えておきたいことを自由に書いてください（例：集合時間・持ち物・雨天時の対応など）。</Hint>
                <textarea placeholder="例：JR渋谷駅ハチ公口に10時集合。歩きやすい靴でお越しください。雨天決行。" value={eventFields.event_meeting_info} rows={3}
                  onChange={e => setEventFields(f => ({ ...f, event_meeting_info: e.target.value }))} style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }} />
                <label style={{ fontSize: 11, color: '#8E44AD', fontWeight: 700 }}>開催期間（任意）</label>
                <div style={{ display: 'flex', gap: 6 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <label style={{ fontSize: 10, color: '#c3a6dd', display: 'block' }}>開始日時</label>
                    <input type="datetime-local" value={eventFields.event_starts_at}
                      onChange={e => setEventFields(f => ({ ...f, event_starts_at: e.target.value }))} style={{ ...inputStyle, width: '100%', boxSizing: 'border-box' }} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <label style={{ fontSize: 10, color: '#c3a6dd', display: 'block' }}>終了日時</label>
                    <input type="datetime-local" value={eventFields.event_ends_at}
                      onChange={e => setEventFields(f => ({ ...f, event_ends_at: e.target.value }))} style={{ ...inputStyle, width: '100%', boxSizing: 'border-box' }} />
                  </div>
                </div>
                <label style={{ fontSize: 11, color: '#8E44AD', fontWeight: 700 }}>スタート・ゴール地点（任意）</label>
                <Hint>歩くルートがまだ決まっていなくても、待ち合わせ場所だけ地図で先に決められます。</Hint>
                <StartEndPicker kind="start"
                  lat={eventFields.event_start_lat} lng={eventFields.event_start_lng} label={eventFields.event_start_label}
                  onChange={v => setEventFields(f => ({ ...f, event_start_lat: v.lat, event_start_lng: v.lng, event_start_label: v.label }))} />
                <WaypointsEditor waypoints={eventFields.event_waypoints}
                  onChange={wp => setEventFields(f => ({ ...f, event_waypoints: wp }))} />
                <StartEndPicker kind="end"
                  lat={eventFields.event_end_lat} lng={eventFields.event_end_lng} label={eventFields.event_end_label}
                  onChange={v => setEventFields(f => ({ ...f, event_end_lat: v.lat, event_end_lng: v.lng, event_end_label: v.label }))} />
                <p style={{ margin: '-4px 0 0', fontSize: 11, color: '#c3a6dd' }}>スタート→経由地点→ゴールの順で地図に線が引かれます。</p>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#8E44AD', fontWeight: 700, cursor: 'pointer', marginTop: 4 }}>
                  <input type="checkbox" checked={eventFields.is_public_recommendation}
                    onChange={e => setEventFields(f => ({ ...f, is_public_recommendation: e.target.checked }))} />
                  「イベント一覧」（/routes）にも掲載する
                </label>
                <Hint>チェックすると審査待ちを経由せず即座に一覧に載ります（会長がここで直接判断するため）。</Hint>
                <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                  <button onClick={() => saveEventFields(r.id)} disabled={eventSaving} style={{
                    flex: 1, padding: '7px 0', borderRadius: 8, border: 'none',
                    background: '#8E44AD', color: '#fff', fontWeight: 700, cursor: eventSaving ? 'wait' : 'pointer', fontSize: 12,
                  }}>{eventSaving ? '保存中…' : '保存してイベント公開'}</button>
                  <button onClick={() => setEventEditingId(null)} style={{
                    flex: 1, padding: '7px 0', borderRadius: 8, border: '1px solid #ddd',
                    background: '#fff', color: '#888', cursor: 'pointer', fontSize: 12,
                  }}>キャンセル</button>
                </div>
              </div>
            ) : (
              <button onClick={() => startEventEdit(r)} style={{
                padding: '6px 12px', borderRadius: 8, border: '1px solid #eee',
                background: '#fff', color: '#8E44AD', fontSize: 12, fontWeight: 700, cursor: 'pointer',
              }}>{r.event_slug ? 'イベント情報を編集' : '🎪 イベントとして公開'}</button>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}

// ────────────────────────────────────────────
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

function QuestsTab({ authHeaders }: { authHeaders: () => HeadersInit }) {
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

// ── 登録ユーザー ──────────────────────────
function UsersTab({ authHeaders }: { authHeaders: () => HeadersInit }) {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [sortBy, setSortBy] = useState<'traces' | 'recent' | 'new'>('traces');
  const [q, setQ] = useState('');
  const [fullTraces, setFullTraces] = useState<Record<string, Trace[]>>({});
  const [loadingFull, setLoadingFull] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetch('/api/admin/profiles', { headers: authHeaders() })
      .then(r => r.json())
      .then(d => { if (d.ok) setUsers(d.users); else setError(d.error ?? '取得に失敗しました'); })
      .catch(() => setError('通信エラー'))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function toggle(id: string) {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  async function toggleAutoApprove(id: string, next: boolean) {
    setUsers(prev => prev.map(u => u.id === id ? { ...u, auto_approve: next } : u));
    const res = await fetch(`/api/admin/profiles/${id}`, {
      method: 'PATCH', headers: authHeaders(), body: JSON.stringify({ auto_approve: next }),
    });
    const data = await res.json();
    if (!data.ok) {
      setUsers(prev => prev.map(u => u.id === id ? { ...u, auto_approve: !next } : u));
      setError(data.error ?? '更新に失敗しました');
    }
  }

  async function loadAllTraces(userId: string) {
    setLoadingFull(prev => new Set(prev).add(userId));
    try {
      const res = await fetch(`/api/admin/traces?status=all&user_id=${userId}&limit=1000`, { headers: authHeaders() })
        .then(r => r.json());
      if (res.ok) setFullTraces(prev => ({ ...prev, [userId]: res.traces }));
    } finally {
      setLoadingFull(prev => { const next = new Set(prev); next.delete(userId); return next; });
    }
  }

  if (loading) return <p style={{ color: '#999' }}>読み込み中…</p>;

  const filtered = users.filter(u => {
    if (!q.trim()) return true;
    const needle = q.trim().toLowerCase();
    return u.username.toLowerCase().includes(needle) || (u.display_name ?? '').toLowerCase().includes(needle);
  });
  const sorted = [...filtered].sort((a, b) => {
    if (sortBy === 'traces') return b.traceCount - a.traceCount;
    if (sortBy === 'new') return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    // 'recent'：最終投稿が新しい人を先に（未投稿は最後）
    if (!a.lastPostedAt) return 1;
    if (!b.lastPostedAt) return -1;
    return new Date(b.lastPostedAt).getTime() - new Date(a.lastPostedAt).getTime();
  });

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12, flexWrap: 'wrap' }}>
        <p style={{ fontSize: 12, color: '#999', margin: 0 }}>
          登録ユーザー {users.length}人（投稿・フォローと連携した実データ）
        </p>
        <div style={{ flex: 1 }} />
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="ユーザー名で検索"
          style={{ ...inputStyle, width: 160 }} />
        <select value={sortBy} onChange={e => setSortBy(e.target.value as typeof sortBy)} style={inputStyle}>
          <option value="traces">投稿数順</option>
          <option value="recent">最終投稿が新しい順</option>
          <option value="new">登録が新しい順</option>
        </select>
      </div>
      {error && <p style={{ color: '#E74C3C', fontSize: 13 }}>{error}</p>}
      {sorted.length === 0 && <p style={{ color: '#aaa' }}>該当するユーザーはいません。</p>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {sorted.map(u => {
          const isOpen = expanded.has(u.id);
          return (
            <Card key={u.id}>
              <button onClick={() => toggle(u.id)} style={{
                display: 'flex', gap: 10, alignItems: 'center', width: '100%',
                background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left',
              }}>
                {u.avatar_url ? (
                  <img src={u.avatar_url} alt="" style={{ width: 44, height: 44, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                ) : (
                  <div style={{
                    width: 44, height: 44, borderRadius: '50%', background: '#f0f0f0', flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18,
                  }}>👤</div>
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: 0, fontWeight: 700, fontSize: 14 }}>
                    {u.display_name ?? u.username}
                    <span style={{ marginLeft: 6, fontSize: 11, color: '#999', fontWeight: 400 }}>@{u.username}</span>
                  </p>
                  {u.bio && <p style={{ margin: '2px 0', fontSize: 12, color: '#666' }}>{u.bio}</p>}
                  <p style={{ margin: '2px 0 0', fontSize: 11, color: '#aaa' }}>
                    📍{u.traceCount}件の投稿 ・ 👥フォロワー{u.followerCount} ・ フォロー中{u.followingCount}
                  </p>
                  <p style={{ margin: '2px 0 0', fontSize: 11, color: '#ccc' }}>
                    登録: {new Date(u.created_at).toLocaleDateString('ja-JP')}
                    {u.lastPostedAt && ` ・ 最終投稿: ${new Date(u.lastPostedAt).toLocaleDateString('ja-JP')}`}
                  </p>
                </div>
                {u.traceCount > 0 && (
                  <span style={{ fontSize: 18, color: '#ccc', flexShrink: 0 }}>{isOpen ? '▴' : '▾'}</span>
                )}
              </button>

              <button onClick={() => toggleAutoApprove(u.id, !u.auto_approve)} title="今後の投稿を審査なしで即座に全国公開する" style={{
                marginTop: 8, padding: '5px 10px', borderRadius: 16, fontSize: 11, fontWeight: 700, cursor: 'pointer',
                border: `1.5px solid ${u.auto_approve ? '#27AE60' : '#ddd'}`,
                background: u.auto_approve ? '#E8F8F1' : '#fff',
                color: u.auto_approve ? '#27AE60' : '#999',
              }}>{u.auto_approve ? '✓ 自動承認 ON' : '自動承認 OFF'}</button>

              {isOpen && u.recentTraces.length > 0 && (
                <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid #f0f0f0', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <p style={{ margin: 0, fontSize: 11, color: '#aaa', fontWeight: 700 }}>
                      {fullTraces[u.id]
                        ? `全投稿（${fullTraces[u.id].length}件・非公開/審査待ち含む）`
                        : `直近の投稿（最大${u.recentTraces.length}件${u.traceCount > u.recentTraces.length ? `・全${u.traceCount}件中` : ''}）`}
                    </p>
                    {!fullTraces[u.id] && u.traceCount > u.recentTraces.length && (
                      <button onClick={() => loadAllTraces(u.id)} disabled={loadingFull.has(u.id)} style={{
                        background: 'none', border: 'none', color: '#38ADA9', fontSize: 11, fontWeight: 700,
                        cursor: loadingFull.has(u.id) ? 'wait' : 'pointer', padding: 0,
                      }}>{loadingFull.has(u.id) ? '読み込み中…' : `全${u.traceCount}件を見る（非公開含む）`}</button>
                    )}
                  </div>
                  {(fullTraces[u.id] ?? u.recentTraces).map(t => {
                    const emotion = getEmotion(t.emotion_key);
                    const vis = VISIBILITY_LABELS[t.visibility];
                    // fullTraces（/api/admin/traces由来）にだけ入っている詳細フィールド
                    const full = 'region' in t ? (t as Trace) : null;
                    const category = full?.category ? getCategory(full.category) : null;
                    return (
                      <div key={t.id} style={{
                        display: 'flex', gap: 10, alignItems: 'flex-start',
                        padding: '8px 0', borderBottom: '1px solid #f5f5f5',
                      }}>
                        {t.photo_url ? (
                          <img src={t.photo_url} alt="" style={{ width: 56, height: 56, objectFit: 'cover', borderRadius: 8, flexShrink: 0 }} />
                        ) : (
                          <div style={{
                            width: 56, height: 56, borderRadius: 8, background: (emotion?.color ?? '#eee') + '22', flexShrink: 0,
                            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22,
                          }}>{emotion?.emoji ?? '📍'}</div>
                        )}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#333' }}>
                            {t.title}
                          </p>
                          <p style={{ margin: '2px 0 0', fontSize: 10, color: '#bbb' }}>
                            {new Date(t.created_at).toLocaleDateString('ja-JP')}
                            {vis && <span style={{ marginLeft: 6, color: vis.color, fontWeight: 700 }}>{vis.label}</span>}
                            {emotion && <span style={{ marginLeft: 6 }}>{emotion.emoji} {emotion.label}</span>}
                            {full?.region && <span style={{ marginLeft: 6 }}>🏘 {full.region}</span>}
                            {category && <span style={{ marginLeft: 6 }}>🏷 {category.label}</span>}
                          </p>
                          {t.why && (
                            <p style={{ margin: '4px 0 0', fontSize: 12, color: '#666' }}>
                              <strong style={{ color: '#999', fontWeight: 700 }}>なぜ気になった：</strong>{t.why}
                            </p>
                          )}
                          {full?.interpretation && (
                            <p style={{ margin: '4px 0 0', fontSize: 12, color: '#666' }}>
                              <strong style={{ color: '#999', fontWeight: 700 }}>見えた暮らし：</strong>{full.interpretation}
                            </p>
                          )}
                          {full?.self_reflection && (
                            <p style={{ margin: '4px 0 0', fontSize: 12, color: '#666' }}>
                              <strong style={{ color: '#999', fontWeight: 700 }}>自分とのつながり：</strong>{full.self_reflection}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}

// ── イベント計画 ──────────────────────────
interface EventPlan {
  id: string;
  title: string;
  memo: string | null;
  status: string;
  event_date: string | null;
  created_at: string;
  updated_at: string;
}

const EVENT_STATUS_LABELS: Record<string, { label: string; color: string }> = {
  idea: { label: '💡 アイデア', color: '#8E44AD' },
  planning: { label: '📝 検討中', color: '#F6B93B' },
  confirmed: { label: '✅ 確定', color: '#38ADA9' },
  done: { label: '🏁 完了', color: '#aaa' },
};

function EventPlansTab({ authHeaders }: { authHeaders: () => HeadersInit }) {
  const [plans, setPlans] = useState<EventPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDate, setNewDate] = useState('');
  const [saving, setSaving] = useState(false);
  const [editingMemo, setEditingMemo] = useState<Record<string, string>>({});

  const load = useCallback(() => {
    setLoading(true);
    fetch('/api/admin/event-plans', { headers: authHeaders() })
      .then(r => r.json())
      .then(d => {
        if (d.ok) {
          setPlans(d.plans);
          const memoMap: Record<string, string> = {};
          for (const p of d.plans as EventPlan[]) memoMap[p.id] = p.memo ?? '';
          setEditingMemo(memoMap);
        } else setError(d.error ?? '取得に失敗しました');
      })
      .catch(() => setError('通信エラー'))
      .finally(() => setLoading(false));
  }, [authHeaders]);

  useEffect(() => { load(); }, [load]);

  async function createPlan() {
    if (!newTitle.trim()) return;
    setSaving(true);
    try {
      const res = await fetch('/api/admin/event-plans', {
        method: 'POST', headers: authHeaders(),
        body: JSON.stringify({ title: newTitle.trim(), event_date: newDate || null }),
      });
      const data = await res.json();
      if (data.ok) { setNewTitle(''); setNewDate(''); setShowCreate(false); load(); }
      else setError(data.error ?? '作成に失敗しました');
    } finally {
      setSaving(false);
    }
  }

  async function updatePlan(id: string, fields: Record<string, unknown>) {
    const res = await fetch(`/api/admin/event-plans/${id}`, {
      method: 'PATCH', headers: authHeaders(), body: JSON.stringify(fields),
    });
    const data = await res.json();
    if (data.ok) load(); else setError(data.error ?? '更新に失敗しました');
  }

  async function deletePlan(id: string) {
    if (!confirm('このイベント計画を削除しますか？')) return;
    const res = await fetch(`/api/admin/event-plans/${id}`, { method: 'DELETE', headers: authHeaders() });
    const data = await res.json();
    if (data.ok) load(); else setError(data.error ?? '削除に失敗しました');
  }

  if (loading) return <p style={{ color: '#999' }}>読み込み中…</p>;

  return (
    <div>
      <p style={{ fontSize: 12, color: '#999', margin: '0 0 12px' }}>
        今後どんなイベントをやるか、協力者とここでメモを練っていくための計画表です。
      </p>
      {error && <p style={{ color: '#E74C3C', fontSize: 13 }}>{error}</p>}

      {showCreate ? (
        <Card style={{ marginBottom: 14 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <input placeholder="イベント名（例：山手線一周・痕跡リレー）" value={newTitle}
              onChange={e => setNewTitle(e.target.value)} style={inputStyle} />
            <input type="date" value={newDate} onChange={e => setNewDate(e.target.value)} style={inputStyle} />
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={createPlan} disabled={saving || !newTitle.trim()} style={{
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
        }}>＋ 新しいイベント案を追加</button>
      )}

      {plans.length === 0 && <p style={{ color: '#aaa' }}>まだイベント案がありません。</p>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {plans.map(p => {
          const statusInfo = EVENT_STATUS_LABELS[p.status] ?? EVENT_STATUS_LABELS.idea;
          return (
            <Card key={p.id}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                <div>
                  <p style={{ margin: '0 0 4px', fontWeight: 800, fontSize: 15 }}>
                    {p.title}
                    <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 700, color: statusInfo.color }}>{statusInfo.label}</span>
                  </p>
                  {p.event_date && <p style={{ margin: 0, fontSize: 12, color: '#999' }}>📅 {p.event_date}</p>}
                </div>
                <button onClick={() => deletePlan(p.id)} style={{
                  padding: '4px 8px', borderRadius: 8, border: 'none', background: 'none', color: '#ccc', fontSize: 12, cursor: 'pointer',
                }}>削除</button>
              </div>

              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', margin: '8px 0' }}>
                {Object.entries(EVENT_STATUS_LABELS).map(([key, info]) => (
                  <button key={key} onClick={() => updatePlan(p.id, { status: key })} style={{
                    padding: '4px 10px', borderRadius: 16, fontSize: 11, cursor: 'pointer',
                    border: `1.5px solid ${p.status === key ? info.color : '#ddd'}`,
                    background: p.status === key ? info.color + '18' : '#fff',
                    color: p.status === key ? info.color : '#999', fontWeight: p.status === key ? 700 : 400,
                  }}>{info.label}</button>
                ))}
              </div>

              <textarea
                value={editingMemo[p.id] ?? ''}
                onChange={e => setEditingMemo(prev => ({ ...prev, [p.id]: e.target.value }))}
                onBlur={() => { if ((editingMemo[p.id] ?? '') !== (p.memo ?? '')) updatePlan(p.id, { memo: editingMemo[p.id] || null }); }}
                placeholder="協力者と練っているメモ（会場案・企画内容・TODOなど自由に）"
                rows={4}
                style={{ ...inputStyle, width: '100%', boxSizing: 'border-box', resize: 'vertical', fontFamily: 'inherit' }}
              />
              <p style={{ margin: '4px 0 0', fontSize: 10, color: '#ccc' }}>
                最終更新: {new Date(p.updated_at).toLocaleString('ja-JP')}（欄外をタップすると自動保存されます）
              </p>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

// ── 学校・法人（縁のデータベース） ────────
interface ClientLead {
  id: string;
  client_type: 'school' | 'business';
  org_name: string;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  status: string;
  memo: string | null;
  created_at: string;
  updated_at: string;
}

const LEAD_STATUS_LABELS: Record<string, { label: string; color: string }> = {
  lead: { label: '候補', color: '#999' },
  contacted: { label: '接触済み', color: '#4A90E2' },
  negotiating: { label: '商談中', color: '#E5A139' },
  contracted: { label: '契約中', color: '#27AE60' },
  lost: { label: '見送り', color: '#E55039' },
};

function ClientLeadsTab({ authHeaders }: { authHeaders: () => HeadersInit }) {
  const [filter, setFilter] = useState<'all' | 'school' | 'business'>('all');
  const [leads, setLeads] = useState<ClientLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ client_type: 'business', org_name: '', contact_name: '', email: '', phone: '' });
  const [saving, setSaving] = useState(false);
  const [editingMemo, setEditingMemo] = useState<Record<string, string>>({});
  const [enrichOpen, setEnrichOpen] = useState<Record<string, boolean>>({});
  const [enrichSource, setEnrichSource] = useState<Record<string, string>>({});
  const [enrichLoading, setEnrichLoading] = useState<Record<string, boolean>>({});
  const [enrichDraft, setEnrichDraft] = useState<Record<string, string>>({});
  const [enrichError, setEnrichError] = useState<Record<string, string>>({});
  const [proposalLoading, setProposalLoading] = useState<Record<string, boolean>>({});
  const [proposalDraft, setProposalDraft] = useState<Record<string, string>>({});
  const [proposalError, setProposalError] = useState<Record<string, string>>({});

  const load = useCallback(() => {
    setLoading(true);
    fetch('/api/admin/client-leads', { headers: authHeaders() })
      .then(r => r.json())
      .then(d => {
        if (d.ok) {
          setLeads(d.leads);
          setEditingMemo(Object.fromEntries((d.leads as ClientLead[]).map(l => [l.id, l.memo ?? ''])));
        } else setError(d.error ?? '取得に失敗しました');
      })
      .catch(() => setError('通信エラー'))
      .finally(() => setLoading(false));
  }, [authHeaders]);

  useEffect(() => { load(); }, [load]);

  async function createLead(e: React.FormEvent) {
    e.preventDefault();
    if (!form.org_name.trim()) return;
    setSaving(true);
    try {
      const res = await fetch('/api/admin/client-leads', {
        method: 'POST', headers: authHeaders(), body: JSON.stringify(form),
      });
      const data = await res.json();
      if (data.ok) {
        setForm({ client_type: 'business', org_name: '', contact_name: '', email: '', phone: '' });
        setShowCreate(false);
        load();
      } else setError(data.error ?? '作成に失敗しました');
    } finally {
      setSaving(false);
    }
  }

  async function updateLead(id: string, patch: Record<string, unknown>) {
    const res = await fetch(`/api/admin/client-leads/${id}`, {
      method: 'PATCH', headers: authHeaders(), body: JSON.stringify(patch),
    });
    const data = await res.json();
    if (data.ok) load(); else setError(data.error ?? '更新に失敗しました');
  }

  async function removeLead(id: string) {
    if (!confirm('この案件を削除しますか？')) return;
    const res = await fetch(`/api/admin/client-leads/${id}`, { method: 'DELETE', headers: authHeaders() });
    const data = await res.json();
    if (data.ok) load(); else setError(data.error ?? '削除に失敗しました');
  }

  // AIで証拠パックの下書きを生成する（ここでは保存しない。会長が確認してから「反映」で初めてmemoに入る）
  async function runEnrich(id: string) {
    const sourceText = (enrichSource[id] ?? '').trim();
    if (!sourceText) return;
    setEnrichLoading(prev => ({ ...prev, [id]: true }));
    setEnrichError(prev => ({ ...prev, [id]: '' }));
    try {
      const res = await fetch(`/api/admin/client-leads/${id}/enrich`, {
        method: 'POST', headers: authHeaders(), body: JSON.stringify({ source_text: sourceText }),
      });
      const data = await res.json();
      if (data.ok) setEnrichDraft(prev => ({ ...prev, [id]: data.draft }));
      else setEnrichError(prev => ({ ...prev, [id]: data.error ?? '生成に失敗しました' }));
    } catch {
      setEnrichError(prev => ({ ...prev, [id]: '通信エラー' }));
    } finally {
      setEnrichLoading(prev => ({ ...prev, [id]: false }));
    }
  }

  // 生成された下書きを、既存メモの下に追記する形でmemoに反映する（会長が明示的に押した時だけ保存される）
  function applyEnrichDraft(id: string, existingMemo: string | null) {
    const draft = enrichDraft[id];
    if (!draft) return;
    const merged = existingMemo?.trim() ? `${existingMemo.trim()}\n\n---\n${draft}` : draft;
    setEditingMemo(prev => ({ ...prev, [id]: merged }));
    updateLead(id, { memo: merged });
    setEnrichDraft(prev => { const next = { ...prev }; delete next[id]; return next; });
    setEnrichOpen(prev => ({ ...prev, [id]: false }));
  }

  // 提案書ドラフトを生成する（証拠パック=memoが元になる）。保存はせず、ダウンロードして会長が06_実行待機_Approvalに置く運用
  async function runDraftProposal(id: string) {
    setProposalLoading(prev => ({ ...prev, [id]: true }));
    setProposalError(prev => ({ ...prev, [id]: '' }));
    try {
      const res = await fetch(`/api/admin/client-leads/${id}/draft-proposal`, {
        method: 'POST', headers: authHeaders(), body: JSON.stringify({}),
      });
      const data = await res.json();
      if (data.ok) setProposalDraft(prev => ({ ...prev, [id]: data.draft }));
      else setProposalError(prev => ({ ...prev, [id]: data.error ?? '生成に失敗しました' }));
    } catch {
      setProposalError(prev => ({ ...prev, [id]: '通信エラー' }));
    } finally {
      setProposalLoading(prev => ({ ...prev, [id]: false }));
    }
  }

  function downloadProposal(id: string, orgName: string) {
    const draft = proposalDraft[id];
    if (!draft) return;
    const blob = new Blob([draft], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    a.href = url;
    a.download = `提案書ドラフト_${orgName}_${stamp}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const visibleLeads = leads.filter(l => filter === 'all' || l.client_type === filter);
  const counts = {
    all: leads.length,
    school: leads.filter(l => l.client_type === 'school').length,
    business: leads.filter(l => l.client_type === 'business').length,
  };

  return (
    <div>
      <p style={{ margin: '0 0 12px', fontSize: 12, color: '#999' }}>
        学校・法人からの問い合わせや契約状況をまとめる「縁のデータベース」です。<a href="/company/school" target="_blank" rel="noopener noreferrer" style={{ color: '#38ADA9' }}>学校向けページ ↗</a>
        {' '}・<a href="/company/business" target="_blank" rel="noopener noreferrer" style={{ color: '#38ADA9' }}> 法人向けページ ↗</a>
      </p>

      <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
        {([['all', `すべて（${counts.all}）`], ['school', `🏫 学校（${counts.school}）`], ['business', `🏢 法人（${counts.business}）`]] as [typeof filter, string][]).map(([id, label]) => (
          <button key={id} onClick={() => setFilter(id)} style={{
            padding: '7px 14px', borderRadius: 16, border: 'none', cursor: 'pointer',
            background: filter === id ? '#38ADA9' : '#fff',
            color: filter === id ? '#fff' : '#666', fontWeight: 700, fontSize: 12,
            boxShadow: filter === id ? 'none' : '0 1px 3px rgba(0,0,0,0.08)',
          }}>{label}</button>
        ))}
      </div>

      {showCreate ? (
        <Card style={{ marginBottom: 14 }}>
          <form onSubmit={createLead} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <select value={form.client_type} onChange={e => setForm(f => ({ ...f, client_type: e.target.value }))} style={inputStyle}>
              <option value="business">🏢 法人</option>
              <option value="school">🏫 学校</option>
            </select>
            <input placeholder="団体名 *" value={form.org_name} onChange={e => setForm(f => ({ ...f, org_name: e.target.value }))} style={inputStyle} required />
            <input placeholder="担当者名" value={form.contact_name} onChange={e => setForm(f => ({ ...f, contact_name: e.target.value }))} style={inputStyle} />
            <input placeholder="メールアドレス" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} style={inputStyle} />
            <input placeholder="電話番号" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} style={inputStyle} />
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="submit" disabled={saving} style={{
                flex: 1, padding: '9px 0', borderRadius: 8, border: 'none',
                background: '#38ADA9', color: '#fff', fontWeight: 700, cursor: 'pointer',
              }}>{saving ? '作成中…' : '追加する'}</button>
              <button type="button" onClick={() => setShowCreate(false)} style={{
                flex: 1, padding: '9px 0', borderRadius: 8, border: '1px solid #ddd',
                background: '#fff', color: '#888', cursor: 'pointer',
              }}>キャンセル</button>
            </div>
          </form>
        </Card>
      ) : (
        <button onClick={() => setShowCreate(true)} style={{
          display: 'block', width: '100%', padding: '10px 0', borderRadius: 10, border: '1.5px dashed #38ADA9',
          background: '#fff', color: '#38ADA9', fontWeight: 700, fontSize: 13, cursor: 'pointer', marginBottom: 14,
        }}>＋ 学校・法人の案件を追加</button>
      )}

      {error && <p style={{ color: '#E74C3C', fontSize: 13 }}>{error}</p>}
      {loading ? <p style={{ color: '#999' }}>読み込み中…</p> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {visibleLeads.length === 0 && <p style={{ color: '#aaa' }}>まだ案件がありません。</p>}
          {visibleLeads.map(l => {
            const statusInfo = LEAD_STATUS_LABELS[l.status] ?? LEAD_STATUS_LABELS.lead;
            return (
              <Card key={l.id}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                  <div>
                    <p style={{ margin: '0 0 4px', fontWeight: 800, fontSize: 15 }}>
                      {l.client_type === 'school' ? '🏫' : '🏢'} {l.org_name}
                      <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 700, color: statusInfo.color }}>{statusInfo.label}</span>
                    </p>
                    <p style={{ margin: 0, fontSize: 12, color: '#999' }}>
                      {l.contact_name && `👤 ${l.contact_name}`}
                      {l.email && ` ・ ✉ ${l.email}`}
                      {l.phone && ` ・ 📞 ${l.phone}`}
                      {!l.contact_name && !l.email && !l.phone && '連絡先未登録'}
                    </p>
                  </div>
                  <button onClick={() => removeLead(l.id)} style={{
                    padding: '4px 8px', borderRadius: 8, border: 'none', background: 'none', color: '#ccc', fontSize: 12, cursor: 'pointer',
                  }}>削除</button>
                </div>

                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', margin: '8px 0' }}>
                  {Object.entries(LEAD_STATUS_LABELS).map(([key, info]) => (
                    <button key={key} onClick={() => updateLead(l.id, { status: key })} style={{
                      padding: '4px 10px', borderRadius: 16, fontSize: 11, cursor: 'pointer',
                      border: `1.5px solid ${l.status === key ? info.color : '#ddd'}`,
                      background: l.status === key ? info.color + '18' : '#fff',
                      color: l.status === key ? info.color : '#999', fontWeight: l.status === key ? 700 : 400,
                    }}>{info.label}</button>
                  ))}
                </div>

                <textarea
                  value={editingMemo[l.id] ?? ''}
                  onChange={e => setEditingMemo(prev => ({ ...prev, [l.id]: e.target.value }))}
                  onBlur={() => { if ((editingMemo[l.id] ?? '') !== (l.memo ?? '')) updateLead(l.id, { memo: editingMemo[l.id] || null }); }}
                  placeholder="商談メモ・要望・次のアクションなど自由に"
                  rows={3}
                  style={{ ...inputStyle, width: '100%', boxSizing: 'border-box', resize: 'vertical', fontFamily: 'inherit' }}
                />
                <p style={{ margin: '4px 0 0', fontSize: 10, color: '#ccc' }}>
                  最終更新: {new Date(l.updated_at).toLocaleString('ja-JP')}（欄外をタップすると自動保存されます）
                </p>

                <button type="button" onClick={() => setEnrichOpen(prev => ({ ...prev, [l.id]: !prev[l.id] }))} style={{
                  marginTop: 8, padding: '6px 12px', borderRadius: 16, fontSize: 11, fontWeight: 700, cursor: 'pointer',
                  border: '1.5px solid #8E44AD', background: enrichOpen[l.id] ? '#8E44AD' : '#FBF6FF',
                  color: enrichOpen[l.id] ? '#fff' : '#8E44AD',
                }}>🔎 AIで証拠パックを強化</button>

                {enrichOpen[l.id] && (
                  <div style={{ marginTop: 8, padding: 10, borderRadius: 10, background: '#FBF6FF', border: '1px solid #F3EAFB' }}>
                    <p style={{ margin: '0 0 6px', fontSize: 11, color: '#8E44AD' }}>
                      ニュース記事・IR情報・自治体の総合戦略資料など、参考になる文章を貼り付けてください（URLではなく本文を貼ると精度が上がります）。生成されるだけで、まだ保存はされません。
                    </p>
                    <textarea
                      value={enrichSource[l.id] ?? ''}
                      onChange={e => setEnrichSource(prev => ({ ...prev, [l.id]: e.target.value }))}
                      placeholder="参考情報を貼り付け"
                      rows={4}
                      style={{ ...inputStyle, width: '100%', boxSizing: 'border-box', resize: 'vertical', fontFamily: 'inherit', marginBottom: 6 }}
                    />
                    <button type="button" onClick={() => runEnrich(l.id)} disabled={enrichLoading[l.id] || !(enrichSource[l.id] ?? '').trim()} style={{
                      padding: '7px 14px', borderRadius: 8, border: 'none', fontSize: 12, fontWeight: 700,
                      background: enrichLoading[l.id] ? '#ddd' : '#8E44AD', color: '#fff',
                      cursor: enrichLoading[l.id] ? 'wait' : 'pointer',
                    }}>{enrichLoading[l.id] ? '生成中…' : '生成する（Claude Haiku使用）'}</button>

                    {enrichError[l.id] && <p style={{ margin: '6px 0 0', fontSize: 11, color: '#E55039' }}>{enrichError[l.id]}</p>}

                    {enrichDraft[l.id] && (
                      <div style={{ marginTop: 8 }}>
                        <p style={{ margin: '0 0 4px', fontSize: 11, fontWeight: 700, color: '#8E44AD' }}>生成された下書き（確認してから反映してください）</p>
                        <p style={{ margin: '0 0 6px', fontSize: 13, color: '#333', background: '#fff', padding: 8, borderRadius: 8, whiteSpace: 'pre-wrap' }}>
                          {enrichDraft[l.id]}
                        </p>
                        <button type="button" onClick={() => applyEnrichDraft(l.id, l.memo)} style={{
                          padding: '6px 12px', borderRadius: 8, border: 'none', fontSize: 12, fontWeight: 700,
                          background: '#38ADA9', color: '#fff', cursor: 'pointer',
                        }}>この内容を証拠パックに反映する</button>
                      </div>
                    )}
                  </div>
                )}

                <button type="button" onClick={() => runDraftProposal(l.id)} disabled={proposalLoading[l.id] || !l.memo?.trim()} title={!l.memo?.trim() ? '先に証拠パック（メモ）を作ってください' : undefined} style={{
                  marginTop: 8, marginLeft: 8, padding: '6px 12px', borderRadius: 16, fontSize: 11, fontWeight: 700,
                  border: '1.5px solid #38ADA9', background: proposalLoading[l.id] ? '#ddd' : '#E8F8F7',
                  color: proposalLoading[l.id] ? '#888' : '#38ADA9',
                  cursor: (proposalLoading[l.id] || !l.memo?.trim()) ? 'default' : 'pointer',
                  opacity: !l.memo?.trim() ? 0.5 : 1,
                }}>{proposalLoading[l.id] ? '生成中…' : '📄 提案書ドラフトを生成（Claude Sonnet使用）'}</button>

                {proposalError[l.id] && <p style={{ margin: '6px 0 0', fontSize: 11, color: '#E55039' }}>{proposalError[l.id]}</p>}

                {proposalDraft[l.id] && (
                  <div style={{ marginTop: 8, padding: 10, borderRadius: 10, background: '#E8F8F7', border: '1px solid #D5F0EE' }}>
                    <p style={{ margin: '0 0 6px', fontSize: 11, fontWeight: 700, color: '#38ADA9' }}>
                      生成された提案書ドラフト（会長が確認・編集してから使ってください。外部送信前は必ず06_実行待機_Approvalで保管）
                    </p>
                    <pre style={{
                      margin: '0 0 6px', fontSize: 12, color: '#333', background: '#fff', padding: 10, borderRadius: 8,
                      whiteSpace: 'pre-wrap', maxHeight: 320, overflowY: 'auto', fontFamily: 'inherit',
                    }}>{proposalDraft[l.id]}</pre>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button type="button" onClick={() => downloadProposal(l.id, l.org_name)} style={{
                        padding: '6px 12px', borderRadius: 8, border: 'none', fontSize: 12, fontWeight: 700,
                        background: '#38ADA9', color: '#fff', cursor: 'pointer',
                      }}>⬇ ダウンロード（.md）</button>
                      <button type="button" onClick={() => setProposalDraft(prev => { const next = { ...prev }; delete next[l.id]; return next; })} style={{
                        padding: '6px 12px', borderRadius: 8, border: '1px solid #ddd', fontSize: 12,
                        background: '#fff', color: '#888', cursor: 'pointer',
                      }}>閉じる</button>
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
