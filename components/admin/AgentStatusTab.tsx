'use client';

// 🏢 AIエージェント稼働状況 — ローカルで動いているAIエージェント（agents/*.py、Windowsタスク
// スケジューラ登録済み）の稼働状況を、外部の「ヒトマップビル」ダッシュボード（agent-dashboard/、
// localhost:8765）に行かなくても運営ダッシュボードから直接確認できるようにする統合ビュー。
// 会長がこのPCで npm run dev したときはローカルファイル（agents/work/*.json）を直接読んで
// リアルタイム表示する。hitomap.com（本番）から見た場合はローカルファイルが無いため、
// agents/sync_status_to_supabase.py が1時間おきに書き込むSupabaseのスナップショット
// （＝会長のPCが最後に同期した時点の状況）を代わりに表示する。
import { useCallback, useEffect, useMemo, useState } from 'react';

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
    case 'burnout_watch': {
      const warnings = (result.warnings as string[]) ?? [];
      return warnings[0] ?? `健全（連続作業${result.current_streak ?? 0}日）`;
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

export default function AgentStatusTab({ authHeaders }: { authHeaders: () => HeadersInit }) {
  const [floors, setFloors] = useState<Floor[]>([]);
  const [agents, setAgents] = useState<AgentStatus[]>([]);
  const [vacant, setVacant] = useState<VacantAgent[]>([]);
  const [local, setLocal] = useState<boolean | null>(null);
  const [synced, setSynced] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showVacant, setShowVacant] = useState(false);

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

  const workingCount = agents.filter(a => a.status === 'working').length;
  const sortedFloors = [...floors].sort((a, b) => a.order - b.order).filter(f => f.id !== 'exec' && f.id !== 'H');
  const showRoster = local || synced;
  const latestSync = agents.reduce<string | null>((latest, a) => {
    const t = a.syncedAt ?? null;
    return t && (!latest || t > latest) ? t : latest;
  }, null);

  if (loading) return <p style={{ fontSize: 13, color: '#999' }}>エージェント稼働状況を読み込み中…</p>;

  return (
    <div>
      <p style={{ fontSize: 12, color: '#999', margin: '0 0 12px' }}>
        agents/配下のローカルAIエージェント（Windowsタスクスケジューラで自動実行）の稼働状況を確認します。
        書き込みはできません（読み取り専用）。フロアの考え方はagent-dashboard（ヒトマップビル）と共通です。
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
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10, marginBottom: 4 }}>
            {local && (
              <div style={{ ...cardStyle, padding: '12px 14px', borderTop: '3px solid #27AE60' }}>
                <p style={{ margin: 0, fontSize: 11, color: '#999', fontWeight: 700 }}>稼働中</p>
                <p style={{ margin: '4px 0 0', fontSize: 20, fontWeight: 800, color: '#333' }}>{workingCount}体</p>
              </div>
            )}
            <div style={{ ...cardStyle, padding: '12px 14px', borderTop: '3px solid #4A69BD' }}>
              <p style={{ margin: 0, fontSize: 11, color: '#999', fontWeight: 700 }}>実装済み番人</p>
              <p style={{ margin: '4px 0 0', fontSize: 20, fontWeight: 800, color: '#333' }}>{agents.length}体</p>
            </div>
            <div style={{ ...cardStyle, padding: '12px 14px', borderTop: '3px solid #999' }}>
              <p style={{ margin: 0, fontSize: 11, color: '#999', fontWeight: 700 }}>空きオフィス（未着工）</p>
              <p style={{ margin: '4px 0 0', fontSize: 20, fontWeight: 800, color: '#333' }}>{vacant.length}件</p>
            </div>
          </div>
          <div style={{ marginBottom: 14 }}>
            <button onClick={load} style={{
              padding: '4px 10px', borderRadius: 14, border: '1px solid #38ADA9', background: '#fff',
              color: '#38ADA9', fontSize: 11, fontWeight: 700, cursor: 'pointer',
            }}>↻ 最新に更新</button>
          </div>

          {sortedFloors.map(floor => {
            const floorAgents = byFloor.get(floor.id) ?? [];
            const floorVacant = vacantByFloor.get(floor.id) ?? [];
            if (floorAgents.length === 0 && floorVacant.length === 0) return null;
            return (
              <div key={floor.id} style={{ marginBottom: 18 }}>
                <p style={{ margin: '0 0 8px', fontSize: 13, fontWeight: 800, color: '#444' }}>
                  {floor.emoji} {floor.order}F {floor.name}
                  <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 400, color: '#999' }}>
                    実装{floorAgents.length}体・未着工{floorVacant.length}件
                  </span>
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {floorAgents.map(a => (
                    <div key={a.id} style={{ ...cardStyle, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: 18, flexShrink: 0 }}>{a.emoji}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#333' }}>
                          {a.name}
                          <span style={{ marginLeft: 8, ...pillStyle(a.status !== 'resting', a.status === 'working' ? '#27AE60' : '#4A69BD') }}>
                            {a.status === 'working' ? '実行中' : a.status === 'synced' ? '同期済み' : '待機中'}
                          </span>
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
                  ))}
                  {showVacant && floorVacant.map(v => (
                    <div key={`${v.floor}-${v.num}`} style={{ ...cardStyle, padding: '8px 14px', opacity: 0.55, display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: 16 }}>🚧</span>
                      <p style={{ margin: 0, fontSize: 12, color: '#888' }}>{v.num}. {v.name}（未着工）</p>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}

          <button onClick={() => setShowVacant(v => !v)} style={{
            padding: '8px 0', width: '100%', borderRadius: 10, border: '1.5px dashed #ccc', background: 'none',
            color: '#888', fontSize: 12, fontWeight: 700, cursor: 'pointer', marginTop: 4,
          }}>{showVacant ? '空きオフィスを隠す' : `空きオフィス（未着工 ${vacant.length}件）を表示`}</button>
        </>
      )}
    </div>
  );
}
