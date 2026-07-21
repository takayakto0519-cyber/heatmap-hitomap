'use client';

// 経営ホーム：分野別（集客・営業・マネタイズ・守り）のKPIと導線を1画面に集約した
// 運営ダッシュボードのホームタブ。2026-07の全方位改善計画で、単なる件数一覧から
// 「どの分野が動いていて、どこが滞っているか」を見る画面に再設計した。
// 数値は /api/admin/stats（既存・ログイン確認兼用）と /api/admin/biz-stats（分野別）の2本から取る。
import { useEffect, useState } from 'react';
import { ErrorBanner, LoadingLine, type TabBadgeCounts } from '@/components/admin/adminShared';

interface RegionValence { region: string; valence: { positive: number; negative: number; neutral: number; total: number } }

interface Stats {
  totalTraces: number;
  pendingReview: number;
  last7Days: number;
  profileCount: number;
  routeCount: number;
  activeSponsors: number;
  pendingReports: number;
  valence: { positive: number; negative: number; neutral: number; total: number };
}

interface BizStats {
  attract: { publishedPosts: number; draftPosts: number; newUsers7d: number; traces7d: number };
  sales: { leadsByStatus: Record<string, number>; leadsTotal: number };
  monetize: { activeSponsors: number; billingConfigured: boolean; partnerApiConfigured: boolean };
  risk: { pendingReview: number; pendingReports: number; bonnoHidden: number };
}

export interface OverviewTabMetaEntry { label: string; icon: string; group: string; desc: string }
export interface OverviewSiteLink { label: string; href: string; icon: string; desc: string }

// /api/admin/stats が落ちてもホームを真っ白にしないための土台。
// 以前は if (error) return <p>{error}</p> で画面全体が赤文字1行になっていたが、
// クイックアクセス・本体サイトリンク・今日の要注意は stats に依存しないので描画できる。
const EMPTY_STATS: Stats = {
  totalTraces: 0, pendingReview: 0, last7Days: 0, profileCount: 0,
  routeCount: 0, activeSponsors: 0, pendingReports: 0,
  valence: { positive: 0, negative: 0, neutral: 0, total: 0 },
};

// 営業台帳のステータス表示順（client_leads.status の定義に合わせる）
const LEAD_PIPELINE: { key: string; label: string; color: string }[] = [
  { key: 'lead', label: '候補', color: '#888' },
  { key: 'contacted', label: '接触済み', color: '#4A69BD' },
  { key: 'negotiating', label: '商談中', color: '#E5A139' },
  { key: 'contracted', label: '契約', color: '#639922' },
  { key: 'lost', label: '見送り', color: '#bbb' },
];

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ background: '#fff', borderRadius: 12, padding: 16, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', ...style }}>
      {children}
    </div>
  );
}

function SectionHeading({ icon, title, hint }: { icon: string; title: string; hint: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, margin: '24px 0 10px' }}>
      <p style={{ margin: 0, fontWeight: 800, fontSize: 14 }}>{icon} {title}</p>
      <span style={{ fontSize: 11, color: '#999' }}>{hint}</span>
    </div>
  );
}

function Kpi({ label, value, urgent, onClick }: { label: string; value: number | string; urgent?: boolean; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      disabled={!onClick}
      style={{
        textAlign: 'left', padding: '12px 14px', borderRadius: 12,
        border: urgent ? '1px solid #FFD9D0' : '1px solid #eee',
        background: urgent ? '#FFF5F3' : '#fff',
        cursor: onClick ? 'pointer' : 'default', fontFamily: 'inherit',
      }}
    >
      <div style={{ fontSize: 24, fontWeight: 800, color: urgent ? '#E55039' : '#222' }}>{value}</div>
      <div style={{ fontSize: 11.5, color: urgent ? '#E55039' : '#888', marginTop: 2, fontWeight: urgent ? 700 : 400 }}>{label}</div>
    </button>
  );
}

// 統合司令室(command_center)が抽出した「今すぐ判断が要ること」1件分
interface AttentionItem { agent_id: string; floor: string; name: string; headline: string }
// 要注意項目から運営ダッシュボードのタブへ飛べるものは飛ばす
const ATTENTION_JUMP: Record<string, { tab: string; label: string }> = {
  report_screen: { tab: 'reports', label: '通報へ' },
  spam_detect: { tab: 'traces', label: '投稿管理へ' },
  trace_qa: { tab: 'traces', label: '投稿管理へ' },
  deadline_watch: { tab: 'funding', label: 'コンテスト・助成金へ' },
  case_pipeline_watch: { tab: 'sales', label: '営業へ' },
  payment_watch: { tab: 'sales', label: '営業（案件）へ' },
  burnout_watch: { tab: 'secretary', label: '秘書へ' },
};

export default function OverviewTab({ authHeaders, goTab, badgeCounts, tabMeta, tabGroups, siteLinks }: {
  authHeaders: () => HeadersInit;
  goTab: (id: string) => void;
  badgeCounts: TabBadgeCounts | null;
  tabMeta: Record<string, OverviewTabMetaEntry>;
  tabGroups: string[];
  siteLinks: OverviewSiteLink[];
}) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [biz, setBiz] = useState<BizStats | null>(null);
  const [error, setError] = useState('');
  const [exporting, setExporting] = useState<'csv' | 'geojson' | null>(null);
  const [attention, setAttention] = useState<AttentionItem[] | null>(null);
  const [regionValence, setRegionValence] = useState<RegionValence[] | null>(null);
  const [includeDemo, setIncludeDemo] = useState(false);
  const [demoHiddenCount, setDemoHiddenCount] = useState(0);

  useEffect(() => {
    const demoParam = includeDemo ? '?includeDemo=true' : '';
    fetch(`/api/admin/stats${demoParam}`, { headers: authHeaders() })
      .then(r => r.json())
      .then(d => {
        if (d.ok) { setStats(d.stats); setDemoHiddenCount(d.demoHiddenCount ?? 0); }
        else { setError(d.error ?? '取得に失敗しました'); setStats(EMPTY_STATS); }
      })
      .catch(() => { setError('通信エラー'); setStats(EMPTY_STATS); });
    // 自治体別の内訳（regionが入っている投稿のみ。regionが空の投稿は全国集計側にのみ含まれる）
    fetch('/api/admin/stats/by-region', { headers: authHeaders() })
      .then(r => r.json())
      .then(d => { if (d.ok) setRegionValence(d.regions); })
      .catch(() => {});
    // 分野別の数字は取れなくてもホーム全体は表示する（エラーにしない）
    fetch(`/api/admin/biz-stats${demoParam}`, { headers: authHeaders() })
      .then(r => r.json())
      .then(d => { if (d.ok) setBiz(d.biz); })
      .catch(() => {});
    // 統合司令室AIの「今すぐ判断が要ること」（番人が拾った要注意項目）
    fetch('/api/admin/command-center', { headers: authHeaders() })
      .then(r => r.json())
      .then(d => { if (d.ok) setAttention(d.result?.attention_items ?? []); })
      .catch(() => {});
  }, [authHeaders, includeDemo]);

  async function exportData(format: 'csv' | 'geojson') {
    setExporting(format);
    try {
      const res = await fetch(`/api/admin/export?format=${format}`, { headers: authHeaders() });
      if (!res.ok) { setError('書き出しに失敗しました'); return; }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      a.href = url;
      a.download = `hitomap_traces_${stamp}.${format === 'geojson' ? 'geojson' : 'csv'}`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(null);
    }
  }

  // errorでも早期リターンしない（ホーム全体が赤文字1行になってしまうため）。
  // 数字が取れなかったことは下のErrorBannerで伝えつつ、導線は描画し続ける。
  if (!stats) return <LoadingLine />;

  const pendingReview = badgeCounts?.review ?? stats.pendingReview;
  const pendingReports = badgeCounts?.reports ?? stats.pendingReports;

  return (
    <div>
      {error && <ErrorBanner message={`${error}（数字の一部が取れませんでした。下の導線はそのまま使えます）`} />}

      {/* 今日の要注意（統合司令室AIが全番人の結果から抽出） */}
      {attention && attention.length > 0 && (
        <Card style={{ marginBottom: 16, borderLeft: '4px solid #E55039', background: '#FFF7F5' }}>
          <p style={{ margin: '0 0 8px', fontWeight: 800, fontSize: 14, color: '#C0392B' }}>
            ⚠ 今日の要注意（{attention.length}件）
            <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 400, color: '#999' }}>統合司令室AIが番人の報告から拾った、いま判断が要ること</span>
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {attention.map((it, i) => {
              const jump = ATTENTION_JUMP[it.agent_id];
              return (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', borderRadius: 8, background: '#fff' }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#E55039', background: '#E5503914', padding: '1px 7px', borderRadius: 8, flexShrink: 0 }}>{it.name}</span>
                  <span style={{ flex: 1, minWidth: 0, fontSize: 12.5, color: '#444' }}>{it.headline}</span>
                  {jump && (
                    <button onClick={() => goTab(jump.tab)} style={{
                      flexShrink: 0, fontSize: 11, fontWeight: 700, cursor: 'pointer',
                      border: '1px solid #E55039', borderRadius: 12, padding: '2px 10px', background: '#fff', color: '#E55039',
                    }}>{jump.label} →</button>
                  )}
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {(includeDemo || demoHiddenCount > 0) && (
        <label style={{
          display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 10, padding: '5px 12px',
          borderRadius: 16, fontSize: 11, fontWeight: 700, cursor: 'pointer',
          background: includeDemo ? '#E5A13918' : '#f4f4f4', color: includeDemo ? '#B7791F' : '#999',
        }}>
          <input type="checkbox" checked={includeDemo} onChange={e => setIncludeDemo(e.target.checked)} />
          🎭 商談デモ用データ{includeDemo ? 'を件数に含めて表示中' : `（${demoHiddenCount}件）を件数から除いています`}
        </label>
      )}

      {/* 全体のいまを4つで押さえる */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10 }}>
        <Kpi label="総投稿数" value={stats.totalTraces} />
        <Kpi label="直近7日の投稿" value={stats.last7Days} />
        <Kpi label="登録ユーザー" value={stats.profileCount} />
        <Kpi label="公開イベント" value={stats.routeCount} onClick={() => goTab('routes')} />
      </div>

      {/* 集客 */}
      <SectionHeading icon="📣" title="集客" hint="記事と新しい人の流れ" />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10 }}>
        <Kpi label="公開中の記事" value={biz?.attract.publishedPosts ?? '—'} onClick={() => goTab('posts')} />
        <Kpi label="下書きの記事" value={biz?.attract.draftPosts ?? '—'} urgent={(biz?.attract.draftPosts ?? 0) > 0} onClick={() => goTab('posts')} />
        <Kpi label="新規ユーザー（7日）" value={biz?.attract.newUsers7d ?? '—'} onClick={() => goTab('users')} />
        <Kpi label="投稿（7日）" value={biz?.attract.traces7d ?? '—'} onClick={() => goTab('traces')} />
      </div>

      {/* 営業 */}
      <SectionHeading icon="🎓" title="営業" hint="学校・法人・自治体の台帳" />
      <Card>
        {biz ? (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {LEAD_PIPELINE.map(s => (
              <button key={s.key} onClick={() => goTab('sales')} style={{
                flex: '1 1 90px', textAlign: 'center', padding: '10px 4px', borderRadius: 8,
                border: '1px solid #eee', background: '#fafafa', cursor: 'pointer', fontFamily: 'inherit',
              }}>
                <div style={{ fontSize: 20, fontWeight: 800, color: s.color }}>{biz.sales.leadsByStatus[s.key] ?? 0}</div>
                <div style={{ fontSize: 11, color: '#888' }}>{s.label}</div>
              </button>
            ))}
          </div>
        ) : <p style={{ margin: 0, fontSize: 12, color: '#999' }}>読み込み中…</p>}
        <p style={{ margin: '10px 0 0', fontSize: 11, color: '#999' }}>
          台帳の更新・証拠パック・提案書づくりは「🧭 営業」タブ →上の「🎓 学校・法人（台帳）」ボタンから。
        </p>
      </Card>

      {/* 外部コンテスト応募状況（このカードの中身は手動更新。締切は「コンテスト・助成金」タブの
          締切台帳へ移行できるので、移行したらこのカードごと削除してよい） */}
      <Card style={{ marginTop: 10 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 13, fontWeight: 800 }}>🏆 牧之原市チャレンジビジネスコンテスト2026</span>
          <span style={{ fontSize: 11, fontWeight: 700, color: '#fff', background: '#4A69BD', padding: '2px 9px', borderRadius: 10 }}>応募中</span>
        </div>
        <ul style={{ margin: '8px 0 0', paddingLeft: 18, fontSize: 12, color: '#555', lineHeight: 1.9 }}>
          <li>エントリー済み（受付は2026-07-17で終了）</li>
          <li>ビジネスプラン最終提出期限：2026-08-03</li>
          <li>協賛企業：SBプレイヤーズ株式会社を想定</li>
          <li>10/21 協業ミートアップ（受賞可否に関わらず参加可）</li>
        </ul>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
          <a href="/admin/makichalle" style={{
            fontSize: 12, fontWeight: 700, textDecoration: 'none',
            border: '1px solid #4A69BD', borderRadius: 12, padding: '4px 12px', color: '#4A69BD',
          }}>📊 まきチャレ専用ダッシュボードを開く ↗</a>
          <button onClick={() => goTab('funding')} style={{
            fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
            border: '1px solid #ddd', borderRadius: 12, padding: '4px 12px', background: '#fff', color: '#888',
          }}>🏆 締切台帳へ →</button>
        </div>
      </Card>

      {/* マネタイズ */}
      <SectionHeading icon="💰" title="マネタイズ" hint="収益の入口の状態" />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10 }}>
        <Kpi label="稼働中スポンサー" value={biz?.monetize.activeSponsors ?? stats.activeSponsors} onClick={() => goTab('sponsors')} />
        <Card>
          <div style={{ fontSize: 13, fontWeight: 700, color: biz?.monetize.billingConfigured ? '#639922' : '#999' }}>
            {biz?.monetize.billingConfigured ? '✅ サポーター課金 稼働中' : '💤 サポーター課金 未設定'}
          </div>
          <div style={{ fontSize: 11, color: '#999', marginTop: 4 }}>
            {biz?.monetize.billingConfigured ? 'Stripeの鍵が設定されています' : 'Stripeの鍵を設定すると開始できます（利用者が育ってから）'}
          </div>
        </Card>
        <Card>
          <div style={{ fontSize: 13, fontWeight: 700, color: biz?.monetize.partnerApiConfigured ? '#639922' : '#999' }}>
            {biz?.monetize.partnerApiConfigured ? '✅ 提携先API 発行済み' : '💤 提携先API 未発行'}
          </div>
          <div style={{ fontSize: 11, color: '#999', marginTop: 4 }}>契約先ごとの合鍵。請求は契約ごとに手動。</div>
        </Card>
      </div>

      {/* 守り */}
      <SectionHeading icon="🛡" title="守り" hint="安全と信頼の当番表" />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10 }}>
        <Kpi label="承認待ち" value={pendingReview} urgent={pendingReview > 0} onClick={() => goTab('review')} />
        <Kpi label="未処理の通報" value={pendingReports} urgent={pendingReports > 0} onClick={() => goTab('reports')} />
        <Kpi label="非表示にした煩悩投稿" value={biz?.risk.bonnoHidden ?? '—'} onClick={() => goTab('routes')} />
      </div>
      <Card style={{ marginTop: 10 }}>
        <p style={{ margin: '0 0 8px', fontWeight: 700, fontSize: 13 }}>点検メモ（2026-07-16 全体点検の記録）</p>
        <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: '#555', lineHeight: 2 }}>
          <li>✅ スキーマ変更の入口（/api/migrate）を運営パスワード必須にした</li>
          <li>✅ 投稿テーブルの直接更新・削除をサーバー経由のみに締めた</li>
          <li>⚠ 投稿受付の回数制限は未導入——Discord通知での監視を継続</li>
          <li>⚠ 煩悩投稿は即時表示。学校イベントで使う前に事前確認モードを入れること</li>
        </ul>
      </Card>

      {/* クイックアクセス */}
      <div style={{ marginTop: 24 }}>
        <p style={{ margin: '0 0 8px', fontWeight: 800, fontSize: 14 }}>⚡ クイックアクセス</p>
        {tabGroups.map(group => (
          <div key={group} style={{ marginBottom: 14 }}>
            <p style={{ margin: '0 0 6px', fontSize: 12, color: '#999', fontWeight: 700 }}>{group}</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 8 }}>
              {Object.keys(tabMeta).filter(id => tabMeta[id].group === group).map(id => {
                // page.tsx の badgeFor と同じマップを引くだけ（以前はここに同じ三項演算子が
                // 二重に書かれていて、バッジを増やすたび2箇所直す必要があった）
                const count = badgeCounts?.[id] ?? 0;
                return (
                  <button key={id} onClick={() => goTab(id)} style={{
                    textAlign: 'left', padding: '12px 14px', borderRadius: 12, cursor: 'pointer', fontFamily: 'inherit',
                    border: count > 0 ? '1px solid #FFD9D0' : '1px solid #eee',
                    background: count > 0 ? '#FFF5F3' : '#fff',
                  }}>
                    <div style={{ fontSize: 18 }}>{tabMeta[id].icon}</div>
                    <div style={{ fontSize: 13, fontWeight: 700, marginTop: 4, color: count > 0 ? '#E55039' : '#222' }}>
                      {tabMeta[id].label}
                      {count > 0 && <span style={{ marginLeft: 6, padding: '1px 7px', borderRadius: 10, fontSize: 11, background: '#E55039', color: '#fff' }}>{count}</span>}
                    </div>
                    <div style={{ fontSize: 11, color: '#999', marginTop: 2 }}>{tabMeta[id].desc}</div>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* 本体サイト */}
      <div style={{ marginTop: 8 }}>
        <p style={{ margin: '0 0 8px', fontWeight: 800, fontSize: 14 }}>🌐 本体サイトを見る</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 8 }}>
          {siteLinks.map(link => (
            <a key={link.href} href={link.href} target="_blank" rel="noopener noreferrer" style={{
              textAlign: 'left', padding: '12px 14px', borderRadius: 12, cursor: 'pointer',
              border: '1px solid #eee', background: '#fff', textDecoration: 'none', color: 'inherit', display: 'block',
            }}>
              <div style={{ fontSize: 18 }}>{link.icon}</div>
              <div style={{ fontSize: 13, fontWeight: 700, marginTop: 4, color: '#222' }}>{link.label} ↗</div>
              <div style={{ fontSize: 11, color: '#999', marginTop: 2 }}>{link.desc}</div>
            </a>
          ))}
        </div>
      </div>

      {/* 全国集計サマリー（旧・自治体向けサマリー。特定自治体の数字ではないため誤解防止に改名） */}
      {stats.valence.total > 0 && (
        <Card style={{ marginTop: 16 }}>
          <p style={{ margin: '0 0 4px', fontWeight: 700, fontSize: 14 }}>😊 全国集計サマリー（好悪の内訳・速報値）</p>
          <p style={{ margin: '0 0 10px', fontSize: 12, color: '#999' }}>
            全国公開済み投稿{stats.valence.total}件を全部まとめた、感情タグから機械的に判定した粗い内訳です。特定の自治体の数字ではありません。自治体ごとの内訳は下の「自治体別の内訳」、または「🧭 営業」タブの「🎓 学校・法人（台帳）」で発行した顧客専用ダッシュボードURLをご覧ください。
          </p>
          <div style={{ display: 'flex', gap: 8 }}>
            <div style={{ flex: 1, textAlign: 'center', padding: '10px 0', borderRadius: 8, background: '#F3F9EA' }}>
              <div style={{ fontSize: 20, fontWeight: 800, color: '#639922' }}>{Math.round((stats.valence.positive / stats.valence.total) * 100)}%</div>
              <div style={{ fontSize: 11, color: '#639922' }}>😊 好意的</div>
            </div>
            <div style={{ flex: 1, textAlign: 'center', padding: '10px 0', borderRadius: 8, background: '#F5F5F5' }}>
              <div style={{ fontSize: 20, fontWeight: 800, color: '#888' }}>{Math.round((stats.valence.neutral / stats.valence.total) * 100)}%</div>
              <div style={{ fontSize: 11, color: '#888' }}>😐 中立</div>
            </div>
            <div style={{ flex: 1, textAlign: 'center', padding: '10px 0', borderRadius: 8, background: '#FCEBEB' }}>
              <div style={{ fontSize: 20, fontWeight: 800, color: '#E24B4A' }}>{Math.round((stats.valence.negative / stats.valence.total) * 100)}%</div>
              <div style={{ fontSize: 11, color: '#E24B4A' }}>😟 否定的</div>
            </div>
          </div>
        </Card>
      )}

      {/* 自治体別の内訳：regionが入っている公開投稿だけをregionごとに集計。件数が少ない地域も参考値として全部出す */}
      {regionValence && regionValence.length > 0 && (
        <Card style={{ marginTop: 10 }}>
          <p style={{ margin: '0 0 4px', fontWeight: 700, fontSize: 14 }}>🗾 自治体別の内訳</p>
          <p style={{ margin: '0 0 10px', fontSize: 12, color: '#999' }}>
            投稿に紐づくregion（地域名）ごとの好悪内訳です。件数が少ない自治体は参考値として見てください。
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {regionValence.map(r => (
              <div key={r.region} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', borderRadius: 8, background: '#fafafa' }}>
                <span style={{ flex: '0 0 120px', fontSize: 12.5, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.region}</span>
                <span style={{ fontSize: 11, color: '#aaa', flex: '0 0 50px' }}>{r.valence.total}件</span>
                <span style={{ fontSize: 12, color: '#639922', fontWeight: 700 }}>😊{Math.round((r.valence.positive / r.valence.total) * 100)}%</span>
                <span style={{ fontSize: 12, color: '#888' }}>😐{Math.round((r.valence.neutral / r.valence.total) * 100)}%</span>
                <span style={{ fontSize: 12, color: '#E24B4A', fontWeight: 700 }}>😟{Math.round((r.valence.negative / r.valence.total) * 100)}%</span>
              </div>
            ))}
          </div>
          <p style={{ margin: '10px 0 0', fontSize: 11, color: '#999' }}>
            契約先ごとの正式なダッシュボードURLは「🧭 営業」タブの「🎓 学校・法人（台帳）」から発行・確認できます。
          </p>
        </Card>
      )}

      {/* データ書き出し */}
      <Card style={{ marginTop: 16 }}>
        <p style={{ margin: '0 0 4px', fontWeight: 700, fontSize: 14 }}>📤 データ書き出し</p>
        <p style={{ margin: '0 0 10px', fontSize: 12, color: '#999' }}>全国公開済みの投稿のみを対象に書き出します（審査待ち・非公開・削除済みは含みません）。</p>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => exportData('csv')} disabled={exporting !== null} style={{
            flex: 1, padding: '9px 0', borderRadius: 8, border: '1.5px solid #ddd',
            background: '#fff', color: '#555', fontWeight: 700, fontSize: 13,
            cursor: exporting ? 'wait' : 'pointer',
          }}>{exporting === 'csv' ? '書き出し中…' : 'CSVを書き出す'}</button>
          <button onClick={() => exportData('geojson')} disabled={exporting !== null} style={{
            flex: 1, padding: '9px 0', borderRadius: 8, border: '1.5px solid #ddd',
            background: '#fff', color: '#555', fontWeight: 700, fontSize: 13,
            cursor: exporting ? 'wait' : 'pointer',
          }}>{exporting === 'geojson' ? '書き出し中…' : 'GeoJSONを書き出す'}</button>
        </div>
      </Card>
    </div>
  );
}
