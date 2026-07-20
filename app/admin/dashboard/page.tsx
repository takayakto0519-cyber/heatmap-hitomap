'use client';

// 運営ダッシュボードのシェル：認証・サイドバーナビ・タブ切替のみを担う。
// 各タブの中身は components/admin/*.tsx に分割済み（monolith分割）。
import { useCallback, useEffect, useState } from 'react';
import BlocksTab from '@/components/admin/BlocksTab';
import PostsTab from '@/components/admin/PostsTab';
import OverviewTab from '@/components/admin/OverviewTab';
import AttachmentTab from '@/components/admin/AttachmentTab';
import TracePatternTab from '@/components/admin/TracePatternTab';
import SettingsTab from '@/components/admin/SettingsTab';
import SnsTab from '@/components/admin/SnsTab';
import AgentsHub from '@/components/admin/AgentsHub';
import SalesTab from '@/components/admin/SalesTab';
import FundingCalendarTab from '@/components/admin/FundingCalendarTab';
import CalendarTab from '@/components/admin/CalendarTab';
import SecretaryTab from '@/components/admin/SecretaryTab';
import ReviewTab from '@/components/admin/ReviewTab';
import TracesTab from '@/components/admin/TracesTab';
import ReportsTab from '@/components/admin/ReportsTab';
import CommentsTab from '@/components/admin/CommentsTab';
import SponsorsTab from '@/components/admin/SponsorsTab';
import RoutesTab from '@/components/admin/RoutesTab';
import QuestsTab from '@/components/admin/QuestsTab';
import UsersTab from '@/components/admin/UsersTab';
import EventPlansTab from '@/components/admin/EventPlansTab';
import BizModelIdeasTab from '@/components/admin/BizModelIdeasTab';
import MinutesTab from '@/components/admin/MinutesTab';
import ClientLeadsTab from '@/components/admin/ClientLeadsTab';
import { inputStyle } from '@/components/admin/adminShared';

type Tab = 'overview' | 'settings' | 'blocks' | 'posts' | 'sns' | 'review' | 'traces' | 'reports' | 'comments' | 'sponsors' | 'routes' | 'quests' | 'users' | 'events' | 'bizmodels' | 'funding' | 'sales' | 'leads' | 'attachment' | 'patterns' | 'agents' | 'minutes' | 'secretary' | 'calendar';

// 旧タブID（別々だったAIエージェント2タブ）からの後方互換。?tab=aiops / ?tab=agentstatus を agents に寄せる。
const LEGACY_TAB_ALIAS: Record<string, Tab> = { aiops: 'agents', agentstatus: 'agents' };

// タブをカテゴリ分けして表示するためのメタ情報（アイコン・説明・所属グループ）
const TAB_META: Record<Tab, { label: string; icon: string; group: string; desc: string }> = {
  overview: { label: 'ホーム', icon: '🏠', group: '', desc: '全体の状況をひと目で確認' },
  secretary: { label: '秘書', icon: '🗒', group: '秘書', desc: '今日の予定とTo-Doを1枚で確認' },
  calendar: { label: 'カレンダー', icon: '📅', group: '秘書', desc: '連携しているGoogleカレンダーの直近2週間の予定を確認' },
  settings: { label: 'サイト設定', icon: '🎨', group: 'サイト編集', desc: 'トップの大見出し・お知らせ帯の文言を書き換える' },
  blocks: { label: 'ページ編集', icon: '🧩', group: 'サイト編集', desc: '各ページのセクションを追加・並び替え（プレビュー付き）' },
  posts: { label: '実績ブログ', icon: '📝', group: 'サイト編集', desc: 'イベント記録・参加者の声を書いて公開' },
  sns: { label: 'SNS投稿', icon: '📣', group: 'サイト編集', desc: 'Instagram等のキャプション・画像をコピペしてすぐ投稿' },
  review: { label: '承認待ち', icon: '✅', group: '投稿・安全', desc: '全国公開の申請を承認/却下' },
  traces: { label: '投稿管理', icon: '📍', group: '投稿・安全', desc: '投稿を検索・削除・復元' },
  reports: { label: '通報', icon: '🚨', group: '投稿・安全', desc: '寄せられた通報の対応' },
  comments: { label: 'コメント', icon: '💬', group: '投稿・安全', desc: 'コメントの確認・削除' },
  users: { label: '登録ユーザー', icon: '👤', group: 'コミュニティ', desc: '会員の投稿履歴を確認' },
  sponsors: { label: 'スポンサー', icon: '🏷', group: 'コミュニティ', desc: '協賛枠の作成・管理' },
  routes: { label: '公開イベント', icon: '🧭', group: '体験づくり', desc: 'route/relay/煩悩イベントの作成・管理' },
  quests: { label: 'クエスト', icon: '🎯', group: '体験づくり', desc: 'クエストの作成・管理' },
  events: { label: 'イベント計画', icon: '🎪', group: '体験づくり', desc: '企画中イベントのメモ' },
  bizmodels: { label: 'ビジネスモデル案', icon: '💡', group: '調査・研究', desc: '新しい事業案を書き溜め、検証状況を追う' },
  funding: { label: 'コンテスト・助成金', icon: '🏆', group: '学校・法人', desc: '自治体支援・補助金・ビジネスコンテスト・資金調達イベントの締切を一覧管理' },
  sales: { label: '営業', icon: '🧭', group: '学校・法人', desc: '営業を縁の方程式（事実×共感＋行動×恩返し）で見立てる。関係人口・自治体プロファイルも統合' },
  leads: { label: '学校・法人', icon: '🎓', group: '学校・法人', desc: '問い合わせ・契約状況の管理' },
  attachment: { label: '愛着の見える化', icon: '🌀', group: '調査・研究', desc: '地域別ファネルとイベント前後の感情変化' },
  patterns: { label: '投稿パターン分析', icon: '📊', group: '調査・研究', desc: '投稿時間帯・また来たい率・話したい率・書き込みの厚み' },
  agents: { label: 'AIエージェント', icon: '🤖', group: 'AIエージェント', desc: '番人の稼働状況・スキル名簿(全戦力)と、収益化・案件・顧問先などの運営データを1箇所で' },
  minutes: { label: '議事録', icon: '🗒', group: '経営管理', desc: '打ち合わせ・商談の記録を日記のように書き溜める' },
};

const TAB_GROUPS = ['秘書', 'サイト編集', '投稿・安全', 'コミュニティ', '体験づくり', '学校・法人', '調査・研究', 'AIエージェント', '経営管理'];

// ホームからも本体サイトへ直接飛べるよう、主要ページへのリンクを集約
const SITE_LINKS: { label: string; href: string; icon: string; desc: string }[] = [
  { label: 'サイトホーム', href: '/', icon: '🏡', desc: '一般ユーザーが見るトップページ' },
  { label: '地図', href: '/map', icon: '🗺️', desc: '投稿の分布・ヒートマップ表示' },
  { label: 'イベント一覧', href: '/routes', icon: '🧭', desc: '公開中のイベント（route/relay/煩悩）' },
  { label: '学校向け', href: '/school', icon: '🏫', desc: '学校・教育機関向けの紹介ページ' },
  { label: '法人向け', href: '/business', icon: '🏢', desc: '法人・自治体向けの紹介ページ' },
  { label: '投稿を始める', href: '/start', icon: '📸', desc: '新規投稿フローの確認' },
];



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
    if (param) {
      const resolved = LEGACY_TAB_ALIAS[param] ?? (param in TAB_META ? (param as Tab) : null);
      if (resolved) setTab(resolved);
    }
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
    // 旧タブID（aiops/agentstatus）で呼ばれても新しい agents ハブに寄せる
    const resolved = (LEGACY_TAB_ALIAS[id] ?? id) as Tab;
    setTab(resolved);
    setNavOpen(false);
    // タブをURLにも反映して、リロード・共有で同じタブに戻れるようにする
    window.history.replaceState(null, '', resolved === 'overview' ? '/admin/dashboard' : `/admin/dashboard?tab=${resolved}`);
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
          padding: '14px 20px', borderBottom: '1px solid #e5e8e7', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
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
          {tab === 'settings' && <SettingsTab authHeaders={authHeaders} />}
          {tab === 'blocks' && <BlocksTab authHeaders={authHeaders} />}
          {tab === 'posts' && <PostsTab authHeaders={authHeaders} />}
          {tab === 'sns' && <SnsTab authHeaders={authHeaders} />}
          {tab === 'review' && <ReviewTab authHeaders={authHeaders} />}
          {tab === 'traces' && <TracesTab authHeaders={authHeaders} />}
          {tab === 'reports' && <ReportsTab authHeaders={authHeaders} />}
          {tab === 'comments' && <CommentsTab authHeaders={authHeaders} />}
          {tab === 'users' && <UsersTab authHeaders={authHeaders} />}
          {tab === 'sponsors' && <SponsorsTab authHeaders={authHeaders} />}
          {tab === 'routes' && <RoutesTab authHeaders={authHeaders} />}
          {tab === 'quests' && <QuestsTab authHeaders={authHeaders} />}
          {tab === 'events' && <EventPlansTab authHeaders={authHeaders} />}
          {tab === 'bizmodels' && <BizModelIdeasTab authHeaders={authHeaders} />}
          {tab === 'funding' && <FundingCalendarTab authHeaders={authHeaders} />}
          {tab === 'sales' && <SalesTab authHeaders={authHeaders} goTab={id => goTab(id as Tab)} />}
          {tab === 'leads' && <ClientLeadsTab authHeaders={authHeaders} />}
          {tab === 'attachment' && <AttachmentTab authHeaders={authHeaders} />}
          {tab === 'patterns' && <TracePatternTab authHeaders={authHeaders} />}
          {tab === 'agents' && <AgentsHub authHeaders={authHeaders} />}
          {tab === 'minutes' && <MinutesTab authHeaders={authHeaders} />}
          {tab === 'secretary' && <SecretaryTab authHeaders={authHeaders} />}
          {tab === 'calendar' && <CalendarTab authHeaders={authHeaders} />}
        </div>
      </main>
    </div>
  );
}
