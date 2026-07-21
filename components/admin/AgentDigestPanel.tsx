'use client';

// 🤖 AIエージェントが自動で集めてきた調査結果を読むための共通パネル。
//
// これまでAIエージェント（agents/*.py）の結果は agent_status_snapshot に丸ごと同期されていたのに、
// 稼働状況タブが1行に潰して表示するだけで中身は捨てられていた
// （例：競合・市場調査の24件が「total=24件」としか出ていなかった）。
// このパネルはその中身を実際に読める形にする。
//
// 「AIエージェントが自動で集めたもの（流れていく）」と「会長が残した提案（strategy_proposals）」は
// 別物なので、見た目と言葉ではっきり分ける。ここは読み取り専用で、保存は一切しない。
import { useCallback, useEffect, useState } from 'react';

interface DigestItem { title?: string; link?: string; source?: string; summary?: string }
interface DigestAgent {
  id: string;
  name: string;
  emoji: string;
  schedule: string;
  generatedAt: string | null;
  result: Record<string, unknown> | null;
}

/** result.digest が {カテゴリ名: [{title, link, source}]} 形かどうか */
function getDigest(result: Record<string, unknown> | null): Record<string, DigestItem[]> | null {
  const d = result?.digest;
  if (!d || typeof d !== 'object' || Array.isArray(d)) return null;
  return d as Record<string, DigestItem[]>;
}

/** digestを持たないAIエージェント（marketing_digest等）向けの1行サマリ */
function fallbackLine(result: Record<string, unknown> | null): string {
  if (!result) return '実行履歴なし（次回のスケジュール実行を待っています）';
  if (typeof result.error === 'string') return `⚠️ ${result.error}`;
  if (typeof result.sections === 'number') return `${result.sections}分野をDiscordへ報告（${result.post_result ?? '未実行'}）`;
  const kw = result.top_keywords as { word: string }[] | undefined;
  if (kw?.length) return `頻出フレーズ最多:「${kw[0].word.slice(0, 20)}」／停滞事業案 ${result.stale_idea_count ?? 0}件`;
  if (typeof result.total === 'number') return `${result.total}件`;
  return '正常';
}

function formatStamp(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function AgentDigestPanel({
  authHeaders, agentIds, title, hint, categoryFilter,
}: {
  authHeaders: () => HeadersInit;
  agentIds: string[];
  title: string;
  hint: string;
  /** 指定したカテゴリだけ出す（news_digestのように無関係な分野まで持っているAIエージェント向け） */
  categoryFilter?: string[];
}) {
  const [agents, setAgents] = useState<DigestAgent[]>([]);
  const [source, setSource] = useState<'local' | 'synced' | 'none'>('none');
  const [syncedAt, setSyncedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [openIds, setOpenIds] = useState<Record<string, boolean>>({});
  const [expandedCats, setExpandedCats] = useState<Record<string, boolean>>({});

  const idsKey = agentIds.join(',');
  const load = useCallback(() => {
    setLoading(true);
    fetch(`/api/admin/agent-digest?ids=${encodeURIComponent(idsKey)}`, { headers: authHeaders() })
      .then(r => r.json())
      .then(d => {
        if (!d.ok) return;
        const list = (d.agents ?? []) as DigestAgent[];
        setAgents(list);
        setSource(d.source ?? 'none');
        setSyncedAt(d.syncedAt ?? null);
        // スマホで縦に伸びすぎないよう、既定では中身のある最初の1体だけ開く
        const first = list.find(a => getDigest(a.result));
        if (first) setOpenIds({ [first.id]: true });
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [authHeaders, idsKey]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <p style={{ color: '#999', fontSize: 12 }}>AIエージェントの調査結果を読み込み中…</p>;

  return (
    <div style={{
      borderLeft: '4px solid #ccc', background: '#fafafa',
      borderRadius: 10, padding: '12px 14px', marginBottom: 16,
    }}>
      <p style={{ margin: 0, fontWeight: 800, fontSize: 13.5 }}>{title}</p>
      <p style={{ margin: '4px 0 0', fontSize: 11, color: '#999', lineHeight: 1.7 }}>{hint}</p>

      {/* 鮮度：本番では「会長のPCが最後に同期した時点」のデータになる */}
      <p style={{ margin: '6px 0 10px', fontSize: 10.5, color: '#aaa' }}>
        {source === 'synced' && `🔄 最終同期: ${formatStamp(syncedAt)}（会長のPCが最後に送った時点のデータです）`}
        {source === 'local' && '💻 このPCのAIエージェントの結果を直接読んでいます'}
        {source === 'none' && 'まだ同期されたデータがありません（会長のPCでAIエージェントが動くと表示されます）'}
      </p>

      {agents.length === 0 && <p style={{ margin: 0, fontSize: 12, color: '#bbb' }}>表示できるAIエージェントがありません。</p>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {agents.map(a => {
          const digest = getDigest(a.result);
          const isOpen = !!openIds[a.id];
          const cats = digest
            ? Object.entries(digest).filter(([cat]) => !categoryFilter || categoryFilter.includes(cat))
            : [];
          const totalItems = cats.reduce((sum, [, items]) => sum + (items?.length ?? 0), 0);

          return (
            <div key={a.id} style={{ background: '#fff', border: '1px solid #eee', borderRadius: 10, overflow: 'hidden' }}>
              <button
                onClick={() => setOpenIds(prev => ({ ...prev, [a.id]: !prev[a.id] }))}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px',
                  border: 'none', background: 'none', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit',
                }}
              >
                <span style={{ fontSize: 11, color: '#bbb', flexShrink: 0 }}>{isOpen ? '▼' : '▶'}</span>
                <span style={{ flexShrink: 0 }}>{a.emoji}</span>
                <span style={{ flex: 1, minWidth: 0, fontSize: 12.5, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {a.name}
                </span>
                {totalItems > 0 && (
                  <span style={{ flexShrink: 0, fontSize: 10, fontWeight: 700, color: '#4A69BD', background: '#4A69BD14', padding: '1px 8px', borderRadius: 10 }}>
                    {totalItems}件
                  </span>
                )}
                <span style={{ flexShrink: 0, fontSize: 10, color: '#ccc' }}>{formatStamp(a.generatedAt)}</span>
              </button>

              {isOpen && (
                <div style={{ padding: '0 12px 12px' }}>
                  {cats.length === 0 ? (
                    <p style={{ margin: 0, fontSize: 12, color: '#999' }}>{fallbackLine(a.result)}</p>
                  ) : cats.map(([cat, items]) => {
                    const catKey = `${a.id}:${cat}`;
                    const showAll = !!expandedCats[catKey];
                    const shown = showAll ? items : items.slice(0, 3);
                    return (
                      <div key={cat} style={{ marginTop: 10 }}>
                        <p style={{ margin: '0 0 4px', fontSize: 11, fontWeight: 800, color: '#B9770E' }}>{cat}</p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                          {shown.map((it, i) => (
                            <div key={i} style={{ fontSize: 12, lineHeight: 1.6 }}>
                              {it.link ? (
                                <a href={it.link} target="_blank" rel="noopener noreferrer" style={{ color: '#38ADA9', textDecoration: 'none' }}>
                                  {it.title ?? it.link}
                                </a>
                              ) : (
                                <span>{it.title ?? '（タイトルなし）'}</span>
                              )}
                              {it.source && <span style={{ marginLeft: 6, fontSize: 10, color: '#bbb' }}>／{it.source}</span>}
                            </div>
                          ))}
                        </div>
                        {items.length > 3 && (
                          <button
                            onClick={() => setExpandedCats(prev => ({ ...prev, [catKey]: !prev[catKey] }))}
                            style={{ marginTop: 4, fontSize: 11, color: '#38ADA9', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                          >
                            {showAll ? '▲ 閉じる' : `▼ 残り${items.length - 3}件を見る`}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
