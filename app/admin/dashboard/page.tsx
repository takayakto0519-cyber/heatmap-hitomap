'use client';

// 運営ダッシュボードのシェル：認証・サイドバーナビ・タブ切替のみを担う。
// 各タブの中身は components/admin/*.tsx に分割済み（monolith分割）。
//
// 【20260726 軽量化】以前は27タブすべてを静的importしていたため、ホーム画面を開いた瞬間に
// 全タブ分（1万行超）のJSがまとめて読み込まれていた。next/dynamicでタブごとに遅延読み込みに変え、
// 実際に開いたタブの分だけ読み込むようにした（見た目・機能は一切変えていない）。
// OverviewTabだけは最初に必ず表示するので静的importのまま。
import { useCallback, useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import OverviewTab from '@/components/admin/OverviewTab';
import { inputStyle, type TabBadgeCounts } from '@/components/admin/adminShared';
import { adminColor, adminRadius, adminShadow } from '@/lib/adminTokens';

const tabLoading = () => null;
const BlocksTab = dynamic(() => import('@/components/admin/BlocksTab'), { loading: tabLoading });
const PostsTab = dynamic(() => import('@/components/admin/PostsTab'), { loading: tabLoading });
const AttachmentTab = dynamic(() => import('@/components/admin/AttachmentTab'), { loading: tabLoading });
const TracePatternTab = dynamic(() => import('@/components/admin/TracePatternTab'), { loading: tabLoading });
const SettingsTab = dynamic(() => import('@/components/admin/SettingsTab'), { loading: tabLoading });
const SnsTab = dynamic(() => import('@/components/admin/SnsTab'), { loading: tabLoading });
const AgentStatusTab = dynamic(() => import('@/components/admin/AgentStatusTab'), { loading: tabLoading });
const MoneyTab = dynamic(() => import('@/components/admin/MoneyTab'), { loading: tabLoading });
const SalesTab = dynamic(() => import('@/components/admin/SalesTab'), { loading: tabLoading });
const FundingCalendarTab = dynamic(() => import('@/components/admin/FundingCalendarTab'), { loading: tabLoading });
const SecretaryTab = dynamic(() => import('@/components/admin/SecretaryTab'), { loading: tabLoading });
const ReviewTab = dynamic(() => import('@/components/admin/ReviewTab'), { loading: tabLoading });
const TracesTab = dynamic(() => import('@/components/admin/TracesTab'), { loading: tabLoading });
const ReportsTab = dynamic(() => import('@/components/admin/ReportsTab'), { loading: tabLoading });
const CommentsTab = dynamic(() => import('@/components/admin/CommentsTab'), { loading: tabLoading });
const SponsorsTab = dynamic(() => import('@/components/admin/SponsorsTab'), { loading: tabLoading });
const RoutesTab = dynamic(() => import('@/components/admin/RoutesTab'), { loading: tabLoading });
const QuestsTab = dynamic(() => import('@/components/admin/QuestsTab'), { loading: tabLoading });
const UsersTab = dynamic(() => import('@/components/admin/UsersTab'), { loading: tabLoading });
const EventPlansTab = dynamic(() => import('@/components/admin/EventPlansTab'), { loading: tabLoading });
const BizModelIdeasTab = dynamic(() => import('@/components/admin/BizModelIdeasTab'), { loading: tabLoading });
const MarketingProposalsTab = dynamic(() => import('@/components/admin/MarketingProposalsTab'), { loading: tabLoading });
const StrategyProposalsTab = dynamic(() => import('@/components/admin/StrategyProposalsTab'), { loading: tabLoading });
const MinutesTab = dynamic(() => import('@/components/admin/MinutesTab'), { loading: tabLoading });
const OrgDocsTab = dynamic(() => import('@/components/admin/OrgDocsTab'), { loading: tabLoading });
const DedicatedDashboardsTab = dynamic(() => import('@/components/admin/DedicatedDashboardsTab'), { loading: tabLoading });
const WebAnalyticsTab = dynamic(() => import('@/components/admin/WebAnalyticsTab'), { loading: tabLoading });
const BizModelStrengthenTab = dynamic(() => import('@/components/admin/BizModelStrengthenTab'), { loading: tabLoading });

type Tab = 'overview' | 'settings' | 'blocks' | 'posts' | 'sns' | 'webAnalytics' | 'review' | 'traces' | 'reports' | 'comments' | 'sponsors' | 'routes' | 'quests' | 'users' | 'events' | 'bizmodels' | 'marketing' | 'proposals' | 'funding' | 'sales' | 'money' | 'strengthen' | 'attachment' | 'patterns' | 'agents' | 'minutes' | 'secretary' | 'orgdocs' | 'dashboards';

// 旧タブIDからの後方互換：
// - ?tab=aiops / ?tab=agentstatus → agents（AIエージェント2タブ統合）
// - ?tab=leads → sales（学校・法人は営業ハブのサブビューへ吸収）
// - ?tab=calendar → secretary（カレンダーは秘書タブに内包）
const LEGACY_TAB_ALIAS: Record<string, Tab> = { aiops: 'agents', agentstatus: 'agents', leads: 'sales', calendar: 'secretary' };

// タブをカテゴリ分けして表示するためのメタ情報（アイコン・説明・所属グループ）
const TAB_META: Record<Tab, { label: string; icon: string; group: string; desc: string }> = {
  overview: { label: 'ホーム', icon: '🏠', group: '', desc: '全体の状況をひと目で確認' },
  secretary: { label: '秘書', icon: '🗒', group: '秘書', desc: '今日の予定・To-Do・カレンダー・議事録をまとめて確認' },
  settings: { label: 'サイト設定', icon: '🎨', group: 'サイト編集', desc: 'トップの大見出し・お知らせ帯の文言を書き換える' },
  blocks: { label: 'ページ編集', icon: '🧩', group: 'サイト編集', desc: '各ページのセクションを追加・並び替え（プレビュー付き）' },
  posts: { label: '実績ブログ', icon: '📝', group: 'サイト編集', desc: 'イベント記録・参加者の声を書いて公開' },
  sns: { label: 'SNS投稿', icon: '📣', group: 'サイト編集', desc: 'Instagram等のキャプション・画像をコピペしてすぐ投稿' },
  webAnalytics: { label: 'アクセス状況', icon: '🌐', group: 'サイト編集', desc: 'hitomap.comの訪問者・ページビュー・流入元をVercel Analyticsから確認する' },
  review: { label: '承認待ち', icon: '✅', group: '投稿・安全', desc: '全国公開の申請を承認/却下' },
  traces: { label: '投稿管理', icon: '📍', group: '投稿・安全', desc: '投稿を検索・削除・復元' },
  reports: { label: '通報', icon: '🚨', group: '投稿・安全', desc: '寄せられた通報の対応' },
  comments: { label: 'コメント', icon: '💬', group: '投稿・安全', desc: 'コメントの確認・削除' },
  users: { label: '登録ユーザー', icon: '👤', group: 'コミュニティ', desc: '会員の投稿履歴を確認' },
  sponsors: { label: 'スポンサー', icon: '🏷', group: 'コミュニティ', desc: '協賛枠の作成・管理' },
  routes: { label: '公開イベント', icon: '🧭', group: '体験づくり', desc: 'route/relay/煩悩イベントの作成・管理' },
  quests: { label: 'クエスト', icon: '🎯', group: '体験づくり', desc: 'クエストの作成・管理' },
  events: { label: 'イベント計画', icon: '🎪', group: '体験づくり', desc: '企画中イベントのメモ' },
  bizmodels: { label: 'ビジネスモデル案', icon: '💡', group: '調査・研究', desc: '新しい事業案を書き溜め、検証状況を追う（AIスキルの新規事業提案もここに集約）' },
  marketing: { label: 'マーケティング', icon: '📈', group: '調査・研究', desc: 'マーケティング施策のAI提案を一覧・ステータス管理する' },
  proposals: { label: '競合・価格インサイト', icon: '🔍', group: '調査・研究', desc: '競合・市場調査・価格に関するAI提案を一覧・ステータス管理する' },
  funding: { label: 'コンテスト・助成金', icon: '🏆', group: '営業・自治体', desc: '自治体支援・補助金・ビジネスコンテスト・資金調達イベントの締切を一覧管理' },
  dashboards: { label: '専用ダッシュボード', icon: '📊', group: '営業・自治体', desc: 'コンテスト・事業ライン・商談中の案件ごとの専用ダッシュボードへの入口をまとめて見る' },
  sales: { label: '営業', icon: '🧭', group: '営業・自治体', desc: '営業を縁の方程式（事実×共感＋行動×恩返し）で見立てる。学校・法人／関係人口／案件／顧問先の台帳も統合' },
  money: { label: '収益・損益', icon: '💰', group: '営業・自治体', desc: '収益化イニシアチブの進み具合と、事業別の月次損益(P&L)' },
  strengthen: { label: 'ビジネスモデル強化', icon: '💪', group: '営業・自治体', desc: '事業案・損益・AI提案・インサイトを横断し、次に磨くべき場所を示す' },
  attachment: { label: '愛着の見える化', icon: '🌀', group: '調査・研究', desc: '地域別ファネルとイベント前後の感情変化' },
  patterns: { label: '投稿パターン分析', icon: '📊', group: '調査・研究', desc: '投稿時間帯・また来たい率・話したい率・書き込みの厚み' },
  agents: { label: 'AIエージェント', icon: '🤖', group: 'AIエージェント', desc: 'AIエージェントの稼働状況とスキル名簿（全戦力）' },
  minutes: { label: '議事録', icon: '🗒', group: '秘書', desc: '打ち合わせ・商談の記録を日記のように書き溜める' },
  orgdocs: { label: '経営資料', icon: '📁', group: '秘書', desc: '戦略メモ・提案書・対外メール下書きをフォルダ別に一覧・保管する' },
};

// 売上を最優先で見るため、営業・自治体（商流・お金）を秘書の次＝最上位に置く
// （並び順の変更のみ。タブIDやコンテンツには手を入れない）
const TAB_GROUPS = ['秘書', '営業・自治体', 'サイト編集', '投稿・安全', 'コミュニティ', '体験づくり', '調査・研究', 'AIエージェント'];

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
  const [badgeCounts, setBadgeCounts] = useState<TabBadgeCounts | null>(null);
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
      .then(d => { if (d.ok) setBadgeCounts(d.stats.badges ?? {}); })
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
      <div style={{
        minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: `linear-gradient(160deg, ${adminColor.sidebarFrom}, ${adminColor.sidebarTo})`, padding: 16, boxSizing: 'border-box',
      }}>
        <form
          onSubmit={e => { e.preventDefault(); tryUnlock(password); }}
          style={{ background: adminColor.surface, padding: 28, borderRadius: adminRadius.lg, width: '100%', maxWidth: 320, boxSizing: 'border-box', boxShadow: adminShadow.cardHover }}
        >
          <p style={{ margin: '0 0 4px', fontSize: 22 }}>🛠</p>
          <h1 style={{ fontSize: 16, fontWeight: 800, margin: '0 0 14px', color: adminColor.ink }}>運営ダッシュボード</h1>
          <input
            type="password" value={password} onChange={e => setPassword(e.target.value)}
            placeholder="パスワード" style={{ ...inputStyle, width: '100%', boxSizing: 'border-box', marginBottom: 10 }}
          />
          {unlockError && <p style={{ color: '#E74C3C', fontSize: 12, margin: '0 0 8px' }}>{unlockError}</p>}
          <button type="submit" disabled={unlocking} className="hm-btn hm-magnet" style={{
            width: '100%', padding: 11, borderRadius: adminRadius.sm, border: 'none',
            background: adminColor.accent, color: '#fff', fontWeight: 700, cursor: 'pointer',
          }}>{unlocking ? '確認中…' : '入る'}</button>
        </form>
      </div>
    );
  }

  // バッジはタブIDをキーにしたマップ（/api/admin/stats の stats.badges）。
  // 種類を増やしたいときはAPI側にキーを足すだけでよく、この画面は変更不要。
  const badgeFor = (id: Tab): number => badgeCounts?.[id] ?? 0;

  // 引数を string で受けるのは、子コンポーネントが実際には任意の文字列を渡してくるため
  // （以前 'relation' というタブに存在しないIDが渡り、画面が真っ白になる事故があった）。
  function goTab(id: string) {
    // 旧タブID（aiops/agentstatus）で呼ばれても新しい agents ハブに寄せる
    const resolved = (LEGACY_TAB_ALIAS[id] ?? id) as Tab;
    // 存在しないタブIDは黙って無視する。setTabしてしまうと全ての {tab === '...'} が偽になり
    // コンテンツ領域が空になるため、現在のタブを維持するほうが安全。
    if (!(resolved in TAB_META)) return;
    setTab(resolved);
    setNavOpen(false);
    // タブをURLにも反映して、リロード・共有で同じタブに戻れるようにする
    window.history.replaceState(null, '', resolved === 'overview' ? '/admin/dashboard' : `/admin/dashboard?tab=${resolved}`);
  }

  const navButtonStyle = (active: boolean, urgent: boolean): React.CSSProperties => ({
    display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'left',
    padding: '10px 14px', borderRadius: adminRadius.sm, cursor: 'pointer',
    background: active ? adminColor.sidebarActive : 'transparent',
    borderLeft: active ? `3px solid ${adminColor.accent}` : '3px solid transparent',
    color: active ? '#fff' : urgent ? '#FFB4A8' : 'rgba(255,255,255,0.75)',
    fontWeight: active ? 800 : 600, fontSize: 13,
    transition: 'background .18s ease, border-color .18s ease, color .18s ease',
  });

  return (
    <div style={{ minHeight: '100dvh', background: adminColor.bg, display: 'flex' }}>
      <style>{`
        .hm-sidebar { position: sticky; top: 0; height: 100dvh; transition: transform .2s ease; }
        .hm-hamburger { display: none; }
        .hm-overlay { display: none; }
        .hm-admin-navbtn:not([disabled]):hover { background: ${adminColor.sidebarHover} !important; }
        .hm-admin-badge { animation: hm-pop .4s cubic-bezier(.22,1,.36,1) both; }
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
        width: 232, flexShrink: 0, color: '#fff',
        background: `linear-gradient(180deg, ${adminColor.sidebarFrom}, ${adminColor.sidebarTo})`,
        boxShadow: '2px 0 24px -14px rgba(0,0,0,.4)',
        display: 'flex', flexDirection: 'column', overflowY: 'auto',
      }}>
        <div style={{ padding: '20px 16px 14px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <p style={{ margin: 0, fontSize: 15, fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
            onClick={() => goTab('overview')}>🛠 運営ダッシュボード</p>
          <p style={{ margin: '2px 0 0', fontSize: 11, color: 'rgba(255,255,255,0.45)' }}>ヒトマップ</p>
        </div>

        <nav style={{ flex: 1, padding: '10px 10px 4px', display: 'flex', flexDirection: 'column', gap: 2 }}>
          <button className="hm-admin-navbtn" onClick={() => goTab('overview')} style={navButtonStyle(tab === 'overview', false)}>
            {TAB_META.overview.icon} {TAB_META.overview.label}
          </button>

          {TAB_GROUPS.map(group => (
            <div key={group} style={{ marginTop: 14 }}>
              <p style={{ margin: '0 0 4px', padding: '0 14px', fontSize: 10, letterSpacing: 1, color: 'rgba(255,255,255,0.4)', fontWeight: 700 }}>{group.toUpperCase()}</p>
              {(Object.keys(TAB_META) as Tab[]).filter(id => TAB_META[id].group === group).map(id => {
                const count = badgeFor(id);
                const urgent = count > 0 && tab !== id;
                return (
                  <button key={id} className="hm-admin-navbtn" onClick={() => goTab(id)} title={TAB_META[id].desc} style={navButtonStyle(tab === id, urgent)}>
                    <span>{TAB_META[id].icon}</span>
                    <span style={{ flex: 1 }}>{TAB_META[id].label}</span>
                    {count > 0 && (
                      <span className={`hm-admin-badge${urgent ? ' hm-pulse' : ''}`} style={{ padding: '1px 7px', borderRadius: 10, fontSize: 11, background: adminColor.danger, color: '#fff', fontWeight: 700 }}>{count}</span>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

        <div style={{ padding: 10, borderTop: '1px solid rgba(255,255,255,0.1)' }}>
          <button className="hm-admin-navbtn" onClick={() => setSiteMenuOpen(v => !v)} style={navButtonStyle(siteMenuOpen, false)}>
            🌐 <span style={{ flex: 1 }}>本体サイトを見る</span> {siteMenuOpen ? '▴' : '▾'}
          </button>
          {siteMenuOpen && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginTop: 4 }}>
              {SITE_LINKS.map(link => (
                <a key={link.href} href={link.href} target="_blank" rel="noopener noreferrer" className="hm-admin-navbtn" style={{
                  display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px 8px 30px', borderRadius: 10,
                  textDecoration: 'none', color: 'rgba(255,255,255,0.7)', fontSize: 12, transition: 'background .18s ease',
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
          padding: '14px 20px', borderBottom: `1px solid ${adminColor.line}`, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
          boxShadow: `0 1px 0 ${adminColor.accent}14`,
        }}>
          <button className="hm-hamburger" onClick={() => setNavOpen(v => !v)} style={{
            width: 34, height: 34, borderRadius: 8, border: '1px solid #ddd', background: '#fff',
            alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: 16,
          }}>☰</button>
          <h1 style={{ fontSize: 17, fontWeight: 800, margin: 0 }}>{TAB_META[tab].icon} {TAB_META[tab].label}</h1>
          <span style={{ fontSize: 12, color: adminColor.inkSoft }}>{TAB_META[tab].desc}</span>
        </div>

        <div style={{ maxWidth: 900, margin: '0 auto', padding: '20px 20px 60px' }}>
          {tab === 'overview' && (
            <OverviewTab
              authHeaders={authHeaders}
              goTab={goTab}
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
          {tab === 'marketing' && <MarketingProposalsTab authHeaders={authHeaders} />}
          {tab === 'proposals' && <StrategyProposalsTab authHeaders={authHeaders} />}
          {tab === 'funding' && <FundingCalendarTab authHeaders={authHeaders} goTab={goTab} />}
          {tab === 'dashboards' && <DedicatedDashboardsTab authHeaders={authHeaders} />}
          {tab === 'sales' && <SalesTab authHeaders={authHeaders} goTab={goTab} />}
          {tab === 'webAnalytics' && <WebAnalyticsTab authHeaders={authHeaders} />}
          {tab === 'attachment' && <AttachmentTab authHeaders={authHeaders} />}
          {tab === 'patterns' && <TracePatternTab authHeaders={authHeaders} />}
          {tab === 'agents' && <AgentStatusTab authHeaders={authHeaders} />}
          {tab === 'money' && <MoneyTab authHeaders={authHeaders} />}
          {tab === 'strengthen' && <BizModelStrengthenTab authHeaders={authHeaders} goTab={goTab} />}
          {tab === 'minutes' && <MinutesTab authHeaders={authHeaders} />}
          {tab === 'orgdocs' && <OrgDocsTab authHeaders={authHeaders} />}
          {tab === 'secretary' && <SecretaryTab authHeaders={authHeaders} goTab={goTab} />}
        </div>
      </main>
    </div>
  );
}
