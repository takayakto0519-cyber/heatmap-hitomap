'use client';

// 🏢 AIエージェント稼働状況 — ローカルで動いているAIエージェント（agents/*.py、Windowsタスク
// スケジューラ登録済み）の稼働状況を、外部の「ヒトマップビル」ダッシュボード（agent-dashboard/、
// localhost:8765）に行かなくても運営ダッシュボードから直接確認できるようにする統合ビュー。
// 会長がこのPCで npm run dev したときはローカルファイル（agents/work/*.json）を直接読んで
// リアルタイム表示する。hitomap.com（本番）から見た場合はローカルファイルが無いため、
// agents/sync_status_to_supabase.py が1時間おきに書き込むSupabaseのスナップショット
// （＝会長のPCが最後に同期した時点の状況）を代わりに表示する。
//
// 2026-07-22: 組織図（社長→部長→従業員）表示に再編。「動いている」ときはパルスドットで
// 強調し、「直近3件の実行」パネルで部門をまたいだ最新の動きを1画面で追えるようにした。
// 部門カードを開くと配下の従業員がたこ足状（トランク→バス→各エージェントへの支線）に
// 広がって直下に表示され、各エージェントが他のどのエージェントの結果を読んでいるか
// （lib/agents/roster.ts の reads フィールド＝agents/*.py の実コードから抽出した実データ）も表示する。
import { useCallback, useEffect, useMemo, useState, Fragment } from 'react';
import { SKILLS, SCRIPTS, FLOORS as ROSTER_FLOORS } from '@/lib/agents/roster';

interface Floor { id: string; name: string; emoji: string; order: number }
interface AgentStatus {
  id: string; name: string; emoji: string; floor: string; schedule: string;
  status: 'working' | 'resting' | 'synced';
  result: Record<string, unknown> | null;
  generatedAt: string | null;
  syncedAt?: string | null;
  level: number; xp: number;
}
interface VacantAgent { floor: string; num: number; name: string }

const cardStyle: React.CSSProperties = { background: '#fff', borderRadius: 12, padding: 16, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' };
const pillStyle = (active: boolean, color: string): React.CSSProperties => ({
  padding: '2px 9px', borderRadius: 12, fontSize: 10, fontWeight: 700,
  background: active ? color + '18' : '#f0f0f0', color: active ? color : '#999',
});

// 「どのエージェントがどのエージェントを読んでいるか」— roster.tsのreadsフィールドから
// 静的に一度だけ計算する（agentsの実行結果に依存しないメタ情報なのでモジュール直下でOK）。
const scriptById = new Map(SCRIPTS.map(s => [s.id, s]));
const feedsIntoById = new Map<string, string[]>();
for (const s of SCRIPTS) {
  for (const r of s.reads ?? []) {
    const arr = feedsIntoById.get(r) ?? [];
    arr.push(s.id);
    feedsIntoById.set(r, arr);
  }
}

function relTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diffMs / 60000);
  if (min < 1) return 'たった今';
  if (min < 60) return `${min}分前`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}時間前`;
  return `${Math.floor(hr / 24)}日前`;
}

// 各エージェントの結果JSONは形がバラバラなので、よく使うフィールドから汎用的に一言を作る。
// 個別の言い回しが欲しい場合はここに専用ケースを足す（agent-dashboard/server.pyの
// _summarize_local_resultと同じ役割・簡易版）。
function summarize(agentId: string, result: Record<string, unknown> | null): string {
  if (result === null) return '実行履歴なし（次回のスケジュール実行を待っています）';
  if (result.error) return `⚠️ ${result.error}`;

  switch (agentId) {
    case 'office_diary': {
      const lines = (result.lines as string[]) ?? [];
      return lines[1] ?? '日報を書きました';
    }
    case 'line_mission':
      if (result.skipped) return String(result.status ?? '次の縁ミッションを待機中');
      return String(result.status ?? '縁ミッションを送りました');
    case 'news_digest':
      return `当日ニュース${result.total ?? 0}件／Discord投稿: ${result.post_result ?? '未実行'}`;
    case 'marketing_digest':
      return `${result.sections ?? 0}分野をDiscordへ報告（${result.post_result ?? '未実行'}）`;
    case 'command_center': {
      const n = Number(result.attention_count ?? 0);
      return n > 0 ? `要注意項目${n}件` : '全フロア異常なし';
    }
    case 'shacho_memo_daily':
      return String(result.top_headline ?? (result.memo ? String(result.memo).split('\n')[0] : '全部門、平常運転'));
    case 'shacho_keiei_kaigi_weekly':
      return `要注意${result.total_attention ?? 0}件を部門別に集約`;
    case 'ab_test_summary_watch':
      return result.test_count ? `実施中のA/Bテスト${result.test_count}件を集計` : String(result.note ?? 'まだ計測データがありません');
    case 'memorial_anniversary_watch': {
      const n = Number(result.upcoming_count ?? 0);
      return n > 0 ? `2週間以内に節目を迎えるアーカイブ${n}件` : `該当なし（日付を特定できたもの${result.date_parsed_count ?? 0}件）`;
    }
    case 'calendar_watch':
      return result.connected ? `今日の予定${((result.today as unknown[]) ?? []).length}件` : '未連携（agents/secrets/README.md参照）';
    case 'new_biz_signal_watch': {
      const kw = (result.top_keywords as { word: string }[]) ?? [];
      return (kw[0] ? `頻出フレーズ最多:「${kw[0].word.slice(0, 20)}」` : '目立つ頻出フレーズなし') + ` ／停滞事業案${result.stale_idea_count ?? 0}件`;
    }
    // 調査系のAIエージェント（digest形の結果を持つもの）は「total=24件」ではなく分野の内訳を出す。
    // 中身そのものは各タブの AgentDigestPanel で読める。
    case 'competitor_market_research':
    case 'competitor_feature_monitor':
    case 'global_market_watch':
    case 'academic_partnership_watch': {
      const digest = result.digest as Record<string, unknown[]> | undefined;
      const total = Number(result.total ?? 0);
      if (!digest) return total > 0 ? `${total}件` : '正常';
      const cats = Object.entries(digest);
      const top = cats.slice().sort((a, b) => (b[1]?.length ?? 0) - (a[1]?.length ?? 0))[0];
      return `${cats.length}分野${total}件${top ? `（${top[0]} ${top[1]?.length ?? 0}件ほか）` : ''}`;
    }
    default: {
      // 汎用フォールバック：よくあるフィールドを拾って並べる
      const fields: [string, string][] = [
        ['total', '件'], ['pending_count', '件未処理'], ['stale_count', '件停滞'],
        ['urgent_count', '件緊急'], ['hot_count', '件熱い'], ['unpaid_count', '件未入金'],
        ['issue_count', '件不整合'], ['duplicate_title_count', '件重複'], ['update_count', '件更新'],
        ['total_contributors', '人'],
      ];
      const parts: string[] = [];
      for (const [key, suffix] of fields) {
        const v = result[key];
        if (typeof v === 'number' && v > 0) parts.push(`${key}=${v}${suffix}`);
      }
      if (parts.length) return parts.join(' ／ ');
      if (typeof result.note === 'string') return result.note;
      return '正常';
    }
  }
}

function StatusBadge({ status }: { status: AgentStatus['status'] }) {
  if (status === 'working') {
    return (
      <span style={{ marginLeft: 8, display: 'inline-flex', alignItems: 'center', gap: 5, padding: '2px 10px', borderRadius: 12, fontSize: 10, fontWeight: 800, background: '#27AE6018', color: '#1E8449' }}>
        <span className="pulse-dot" />実行中
      </span>
    );
  }
  return (
    <span style={{ marginLeft: 8, ...pillStyle(status === 'synced', '#4A69BD') }}>
      {status === 'synced' ? '同期済み' : '待機中'}
    </span>
  );
}

// エージェントidから「名前＋所属部門の絵文字」を引くための軽量ルックアップ。
// 見つからなければscriptById（roster.ts静的データ）にフォールバックする。
type NameLookup = (id: string) => { name: string; floorEmoji: string } | undefined;

function ConnectionChips({ a, nameOf, ownFloor }: { a: AgentStatus; nameOf: NameLookup; ownFloor: string }) {
  const meta = scriptById.get(a.id);
  const reads = meta?.reads ?? [];
  const feeds = feedsIntoById.get(a.id) ?? [];
  if (reads.length === 0 && feeds.length === 0) return null;

  const chip = (id: string, arrow: string, color: string) => {
    const info = nameOf(id);
    const crossFloor = info && scriptById.get(id)?.floor !== ownFloor;
    return (
      <span key={arrow + id} title={id} style={{
        fontSize: 10, padding: '2px 7px', borderRadius: 10, whiteSpace: 'nowrap',
        background: color + '14', color,
      }}>
        {arrow} {info ? info.name.replace(/^\d+\.\s*/, '') : id}{crossFloor && info ? ` ${info.floorEmoji}` : ''}
      </span>
    );
  };

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 6 }}>
      {reads.map(id => chip(id, '📥 参照', '#4A69BD'))}
      {feeds.map(id => chip(id, '📤 連携先', '#8E44AD'))}
    </div>
  );
}

function AgentRow({ a, nameOf }: { a: AgentStatus; nameOf: NameLookup }) {
  return (
    <div style={{ ...cardStyle, padding: '10px 14px', border: a.status === 'working' ? '1.5px solid #27AE60' : '1.5px solid transparent' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 18, flexShrink: 0 }}>{a.emoji}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#333' }}>
            {a.name}
            <StatusBadge status={a.status} />
          </p>
          <p style={{ margin: '2px 0 0', fontSize: 11, color: '#777', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {summarize(a.id, a.result)}
          </p>
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <p style={{ margin: 0, fontSize: 10, color: '#bbb' }}>{a.schedule}</p>
          <p style={{ margin: '2px 0 0', fontSize: 10, color: '#ccc' }}>Lv.{a.level}（累計{a.xp}回）</p>
        </div>
      </div>
      <ConnectionChips a={a} nameOf={nameOf} ownFloor={a.floor} />
    </div>
  );
}

function DeptCard({ floor, floorAgents, expanded, onToggle }: { floor: Floor; floorAgents: AgentStatus[]; expanded: boolean; onToggle: () => void }) {
  const workingCount = floorAgents.filter(a => a.status === 'working').length;
  return (
    <button onClick={onToggle} style={{
      ...cardStyle, cursor: 'pointer', minWidth: 148, textAlign: 'left', position: 'relative',
      border: workingCount > 0 ? '2px solid #27AE60' : '1.5px solid transparent',
      outline: expanded ? '2px solid #38ADA966' : 'none', outlineOffset: 2,
    }}>
      <span style={{ position: 'absolute', top: 10, right: 12, fontSize: 10, color: '#ccc' }}>{expanded ? '▲' : '▼'}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontSize: 18 }}>{floor.emoji}</span>
        <span style={{ fontSize: 13, fontWeight: 800, color: '#333' }}>{floor.name.replace('（部長）', '')}</span>
      </div>
      <p style={{ margin: '6px 0 0', fontSize: 11, color: '#999' }}>実装{floorAgents.length}体</p>
      {workingCount > 0 ? (
        <p style={{ margin: '4px 0 0', fontSize: 12, fontWeight: 800, color: '#1E8449', display: 'flex', alignItems: 'center', gap: 6 }}>
          <span className="pulse-dot" />稼働中 {workingCount}体
        </p>
      ) : (
        <p style={{ margin: '4px 0 0', fontSize: 11, color: '#bbb' }}>待機中</p>
      )}
    </button>
  );
}

// たこ足ツリー：部門カードの真下に、トランク→バス（横線）→各従業員への支線、という
// 見た目で配下のエージェントを展開する。何体になっても折り返しに対応できるよう
// 個々の支線は各カードの真上に付ける（絶対座標計算をしない、崩れにくい構成）。
function TentacleTree({ floor, floorAgents, nameOf }: { floor: Floor; floorAgents: AgentStatus[]; nameOf: NameLookup }) {
  return (
    <div style={{ width: '100%', marginTop: 4 }}>
      <div style={{ width: 2, height: 14, background: '#cfd8dc', margin: '0 auto' }} />
      <div style={{ height: 2, background: '#cfd8dc', margin: '0 6%' }} />
      <p style={{ textAlign: 'center', fontSize: 11, color: '#999', margin: '4px 0 10px' }}>
        {floor.emoji} {floor.name.replace('（部長）', '')}の従業員 {floorAgents.length}体
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '18px 12px' }}>
        {floorAgents.map(a => (
          <div key={a.id}>
            <div style={{ width: 2, height: 12, background: '#cfd8dc', margin: '0 auto' }} />
            <AgentRow a={a} nameOf={nameOf} />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function AgentStatusTab({ authHeaders }: { authHeaders: () => HeadersInit }) {
  const [floors, setFloors] = useState<Floor[]>([]);
  const [agents, setAgents] = useState<AgentStatus[]>([]);
  const [vacant, setVacant] = useState<VacantAgent[]>([]);
  const [local, setLocal] = useState<boolean | null>(null);
  const [synced, setSynced] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showVacant, setShowVacant] = useState(false);
  const [expandedFloors, setExpandedFloors] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/admin/agent-status', { headers: authHeaders() });
      const data = await res.json();
      if (data.ok) {
        setFloors(data.floors ?? []);
        setAgents(data.agents ?? []);
        setVacant(data.vacant ?? []);
        setLocal(Boolean(data.local));
        setSynced(Boolean(data.synced));
      } else {
        setError(data.error ?? '取得に失敗しました');
      }
    } catch {
      setError('通信エラー');
    } finally {
      setLoading(false);
    }
  }, [authHeaders]);

  useEffect(() => { load(); }, [load]);
  // ローカルで動いている間は「動いている瞬間」を見逃さないよう15秒おきに自動更新する。
  useEffect(() => {
    if (!local) return;
    const timer = setInterval(load, 15000);
    return () => clearInterval(timer);
  }, [local, load]);

  const byFloor = useMemo(() => {
    const map = new Map<string, AgentStatus[]>();
    for (const a of agents) {
      const list = map.get(a.floor) ?? [];
      list.push(a);
      map.set(a.floor, list);
    }
    return map;
  }, [agents]);

  const vacantByFloor = useMemo(() => {
    const map = new Map<string, VacantAgent[]>();
    for (const v of vacant) {
      const list = map.get(v.floor) ?? [];
      list.push(v);
      map.set(v.floor, list);
    }
    return map;
  }, [vacant]);

  const recentAgents = useMemo(() => {
    return [...agents]
      .filter(a => a.generatedAt)
      .sort((a, b) => (b.generatedAt as string).localeCompare(a.generatedAt as string))
      .slice(0, 3);
  }, [agents]);

  // 「どのエージェントと繋がっているか」の表示名解決。稼働状況(agents)を優先し、
  // まだ実行履歴が無く一覧に出ていないエージェントはroster.tsの静的名で補う。
  const nameOf: NameLookup = useCallback((id: string) => {
    const live = agents.find(x => x.id === id);
    if (live) {
      const f = floors.find(fl => fl.id === live.floor);
      return { name: live.name, floorEmoji: f?.emoji ?? '' };
    }
    const meta = scriptById.get(id);
    if (!meta) return undefined;
    const f = floors.find(fl => fl.id === meta.floor);
    return { name: meta.name, floorEmoji: f?.emoji ?? '' };
  }, [agents, floors]);

  const floorName = useCallback((id: string) => floors.find(f => f.id === id)?.name ?? id, [floors]);

  const workingCount = agents.filter(a => a.status === 'working').length;
  const execFloor = floors.find(f => f.id === 'exec');
  const execAgents = byFloor.get('exec') ?? [];
  const execWorking = execAgents.filter(a => a.status === 'working').length;
  const deptFloors = [...floors].sort((a, b) => a.order - b.order).filter(f => f.id !== 'exec' && f.id !== 'FINANCE');
  const showRoster = local || synced;
  const latestSync = agents.reduce<string | null>((latest, a) => {
    const t = a.syncedAt ?? null;
    return t && (!latest || t > latest) ? t : latest;
  }, null);

  const toggleFloor = (id: string) => setExpandedFloors(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  if (loading) return <p style={{ fontSize: 13, color: '#999' }}>エージェント稼働状況を読み込み中…</p>;

  return (
    <div>
      <style>{`
        .pulse-dot { display:inline-block; width:8px; height:8px; border-radius:50%; background:#27AE60; animation: hitomapPulse 1.2s infinite; flex-shrink:0; }
        @keyframes hitomapPulse {
          0% { box-shadow: 0 0 0 0 rgba(39,174,96,0.6); }
          70% { box-shadow: 0 0 0 7px rgba(39,174,96,0); }
          100% { box-shadow: 0 0 0 0 rgba(39,174,96,0); }
        }
      `}</style>
      <p style={{ fontSize: 12, color: '#999', margin: '0 0 12px' }}>
        agents/配下のローカルAIエージェント（Windowsタスクスケジューラで自動実行）の稼働状況を確認します。
        書き込みはできません（読み取り専用）。組織図は👑社長→部長→従業員の順で、動いているところは緑のパルスで分かります。
      </p>
      {error && <p style={{ color: '#E74C3C', fontSize: 13 }}>{error}</p>}

      {local === false && synced && (
        <div style={{ ...cardStyle, borderLeft: '4px solid #4A69BD', marginBottom: 14 }}>
          <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#4A69BD' }}>🔄 最終同期データを表示しています</p>
          <p style={{ margin: '4px 0 0', fontSize: 12, color: '#777', lineHeight: 1.7 }}>
            会長の開発機がリアルタイムには繋がっていないため、1時間おきの自動同期（sync_status_to_supabase.py）で
            会長のPCが最後に送った状況を表示しています。
            {latestSync && `最終同期：${new Date(latestSync).toLocaleString('ja-JP')}`}
          </p>
        </div>
      )}

      {local === false && !synced && (
        <div style={{ ...cardStyle, borderLeft: '4px solid #E5A139', marginBottom: 14 }}>
          <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#B7791F' }}>⚠ まだ同期データがありません</p>
          <p style={{ margin: '4px 0 0', fontSize: 12, color: '#777', lineHeight: 1.7 }}>
            会長の開発機で <code style={{ background: '#f4f4f4', padding: '1px 5px', borderRadius: 4 }}>python agents/sync_status_to_supabase.py</code> を
            一度実行するか、次回の自動同期（1時間おき）を待つと表示されます。
            会長のPCで <code style={{ background: '#f4f4f4', padding: '1px 5px', borderRadius: 4 }}>npm run dev</code> して
            localhostからこのタブを開くとリアルタイムの状況も見られます。
          </p>
        </div>
      )}

      {showRoster && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10, marginBottom: 14 }}>
            {local && (
              <div style={{ ...cardStyle, padding: '12px 14px', borderTop: '3px solid #27AE60' }}>
                <p style={{ margin: 0, fontSize: 11, color: '#999', fontWeight: 700 }}>稼働中</p>
                <p style={{ margin: '4px 0 0', fontSize: 20, fontWeight: 800, color: '#333', display: 'flex', alignItems: 'center', gap: 8 }}>
                  {workingCount > 0 && <span className="pulse-dot" />}{workingCount}体
                </p>
              </div>
            )}
            <div style={{ ...cardStyle, padding: '12px 14px', borderTop: '3px solid #4A69BD' }}>
              <p style={{ margin: 0, fontSize: 11, color: '#999', fontWeight: 700 }}>実装済みAIエージェント</p>
              <p style={{ margin: '4px 0 0', fontSize: 20, fontWeight: 800, color: '#333' }}>{agents.length}体</p>
            </div>
            <div style={{ ...cardStyle, padding: '12px 14px', borderTop: '3px solid #999' }}>
              <p style={{ margin: 0, fontSize: 11, color: '#999', fontWeight: 700 }}>空きオフィス（未着工）</p>
              <p style={{ margin: '4px 0 0', fontSize: 20, fontWeight: 800, color: '#333' }}>{vacant.length}件</p>
            </div>
          </div>

          {/* 🕒 直近3件の実行 — 部門をまたいでどのエージェントが最近動いたかを1画面で追う */}
          <div style={{ ...cardStyle, marginBottom: 16 }}>
            <p style={{ margin: '0 0 10px', fontSize: 13, fontWeight: 800, color: '#444' }}>🕒 直近の実行 TOP3</p>
            {recentAgents.length === 0 ? (
              <p style={{ margin: 0, fontSize: 12, color: '#999' }}>まだ実行記録がありません</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {recentAgents.map(a => (
                  <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 16, flexShrink: 0 }}>{a.emoji}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: '#333', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {a.name}{a.status === 'working' && <StatusBadge status={a.status} />}
                      </p>
                      <p style={{ margin: 0, fontSize: 10, color: '#999', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {floorName(a.floor)} ／ {summarize(a.id, a.result)}
                      </p>
                    </div>
                    <span style={{ fontSize: 10, color: '#aaa', flexShrink: 0 }}>{relTime(a.generatedAt!)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={{ marginBottom: 14 }}>
            <button onClick={load} style={{
              padding: '4px 10px', borderRadius: 14, border: '1px solid #38ADA9', background: '#fff',
              color: '#38ADA9', fontSize: 11, fontWeight: 700, cursor: 'pointer',
            }}>↻ 最新に更新</button>
          </div>

          {/* 🏛️ 組織図：社長 → 部長（部門） → 従業員 */}
          {execFloor && (
            <div style={{ textAlign: 'center', marginBottom: 12 }}>
              <div style={{
                ...cardStyle, display: 'inline-flex', flexDirection: 'column', alignItems: 'center', padding: '14px 26px',
                border: execWorking > 0 ? '2px solid #27AE60' : '1.5px solid transparent',
              }}>
                <span style={{ fontSize: 26 }}>👑</span>
                <span style={{ fontSize: 14, fontWeight: 800, color: '#333', marginTop: 2 }}>AI社長</span>
                {execWorking > 0 ? (
                  <span style={{ fontSize: 11, fontWeight: 800, color: '#1E8449', display: 'flex', alignItems: 'center', gap: 5, marginTop: 4 }}>
                    <span className="pulse-dot" />稼働中
                  </span>
                ) : (
                  <span style={{ fontSize: 10, color: '#bbb', marginTop: 4 }}>待機中</span>
                )}
              </div>
              <p style={{ fontSize: 16, color: '#ccc', margin: '4px 0' }}>↓</p>
            </div>
          )}

          {execAgents.length > 0 && (
            <div style={{ marginBottom: 18, display: 'flex', flexDirection: 'column', gap: 6, maxWidth: 420, margin: '0 auto 18px' }}>
              {execAgents.map(a => <AgentRow key={a.id} a={a} nameOf={nameOf} />)}
            </div>
          )}

          {/* 部門カードの直下に、開いた部門だけたこ足状に従業員が広がる（flex-wrapのflexBasis:100%で強制改行） */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'center', marginBottom: 8 }}>
            {deptFloors.map(floor => {
              const floorAgents = byFloor.get(floor.id) ?? [];
              const floorVacant = vacantByFloor.get(floor.id) ?? [];
              if (floorAgents.length === 0 && floorVacant.length === 0) return null;
              const isExpanded = expandedFloors.has(floor.id);
              return (
                <Fragment key={floor.id}>
                  <DeptCard
                    floor={floor}
                    floorAgents={floorAgents}
                    expanded={isExpanded}
                    onToggle={() => toggleFloor(floor.id)}
                  />
                  {isExpanded && (
                    <div style={{ flexBasis: '100%', width: '100%' }}>
                      <TentacleTree floor={floor} floorAgents={floorAgents} nameOf={nameOf} />
                      {showVacant && floorVacant.length > 0 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 10, maxWidth: 420, marginLeft: 'auto', marginRight: 'auto' }}>
                          {floorVacant.map(v => (
                            <div key={`${v.floor}-${v.num}`} style={{ ...cardStyle, padding: '8px 14px', opacity: 0.55, display: 'flex', alignItems: 'center', gap: 10 }}>
                              <span style={{ fontSize: 16 }}>🚧</span>
                              <p style={{ margin: 0, fontSize: 12, color: '#888' }}>{v.num}. {v.name}（未着工）</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </Fragment>
              );
            })}
          </div>

          <button onClick={() => setShowVacant(v => !v)} style={{
            padding: '8px 0', width: '100%', borderRadius: 10, border: '1.5px dashed #ccc', background: 'none',
            color: '#888', fontSize: 12, fontWeight: 700, cursor: 'pointer', marginTop: 4,
          }}>{showVacant ? '空きオフィスを隠す' : `空きオフィス（未着工 ${vacant.length}件）を表示`}</button>
        </>
      )}

      <SkillInventory />
    </div>
  );
}

// 🧩 スキル名簿 — AIエージェント（Python自動実行）とは別に、会話で呼び出す Claude Code スキル群を
// フロア別に一覧する。これまでダッシュボードに一切出ていなかった〜105スキルを初めて可視化し、
// 「このビルにAIエージェント＋スキルで何体居るか」の全体像を見せる。会話起動のため最終実行時刻は出さない。
function SkillInventory() {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const byFloor = useMemo(() => {
    const map = new Map<string, typeof SKILLS>();
    for (const s of SKILLS) {
      const list = map.get(s.floor) ?? [];
      list.push(s);
      map.set(s.floor, list);
    }
    return map;
  }, []);
  const floors = [...ROSTER_FLOORS].sort((a, b) => a.order - b.order).filter(f => byFloor.has(f.id));

  async function copyInvoke(invoke: string) {
    try { await navigator.clipboard.writeText(invoke); setCopied(invoke); setTimeout(() => setCopied(null), 1200); } catch { /* noop */ }
  }

  return (
    <div style={{ marginTop: 22, borderTop: '1px solid #e5e8e7', paddingTop: 16 }}>
      <button onClick={() => setOpen(v => !v)} style={{
        display: 'flex', alignItems: 'center', gap: 8, width: '100%', textAlign: 'left',
        background: 'none', border: 'none', cursor: 'pointer', padding: 0,
      }}>
        <span style={{ fontSize: 14, fontWeight: 800, color: '#444' }}>🧩 スキル名簿（会話で呼び出すAI）</span>
        <span style={{ ...pillStyle(true, '#8E44AD') }}>{SKILLS.length}体</span>
        <span style={{ marginLeft: 'auto', fontSize: 12, color: '#888' }}>{open ? '▲ 閉じる' : '▼ 一覧を見る'}</span>
      </button>
      <p style={{ margin: '6px 0 0', fontSize: 11.5, color: '#999', lineHeight: 1.7 }}>
        AIエージェント（上の稼働状況）は自動で動くAI、こちらは会長がチャットで「◯◯して」と呼ぶAIです。
        AIエージェントとスキルを合わせてビルの全戦力になります。
        名前の右の <code style={{ background: '#f4f4f4', padding: '0 4px', borderRadius: 4 }}>/xxx</code> を押すとコマンドをコピーできます。
      </p>

      {open && (
        <div style={{ marginTop: 12 }}>
          {floors.map(floor => {
            const list = (byFloor.get(floor.id) ?? []).slice().sort((a, b) => (a.num ?? 999) - (b.num ?? 999));
            return (
              <div key={floor.id} style={{ marginBottom: 14 }}>
                <p style={{ margin: '0 0 6px', fontSize: 12.5, fontWeight: 800, color: '#555' }}>
                  {floor.emoji} {floor.name}
                  <span style={{ marginLeft: 6, fontSize: 11, fontWeight: 400, color: '#999' }}>{list.length}体</span>
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', gap: 6 }}>
                  {list.map(s => (
                    <div key={s.id} style={{ ...cardStyle, padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 5 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                        <span style={{ fontSize: 14, flexShrink: 0 }}>{s.emoji}</span>
                        <span title={`${s.num ? s.num + '. ' : ''}${s.name}`} style={{ flex: 1, minWidth: 0, fontSize: 12.5, fontWeight: 700, color: '#333', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {s.num ? `${s.num}. ` : ''}{s.name}
                        </span>
                      </div>
                      {s.invoke && (
                        <button onClick={() => copyInvoke(s.invoke!)} title="クリックでコマンドをコピー" style={{
                          alignSelf: 'flex-start', maxWidth: '100%', fontFamily: 'monospace', fontSize: 10.5, fontWeight: 700, cursor: 'pointer',
                          border: '1px solid #d9c7e8', borderRadius: 8, padding: '2px 8px',
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          background: copied === s.invoke ? '#8E44AD' : '#faf6ff', color: copied === s.invoke ? '#fff' : '#8E44AD',
                        }}>{copied === s.invoke ? '✓ コピーしました' : s.invoke}</button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
