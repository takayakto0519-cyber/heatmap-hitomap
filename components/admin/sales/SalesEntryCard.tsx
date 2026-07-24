'use client';

// 学校・法人（client_leads）と自治体（municipality_profiles）を1本の折りたたみカードで表示する。
// kindを問わず共通の骨格（ステータス・スコア・事実確認・送信）を持ち、自治体だけの追加項目
// （SMOUT・人口統計・公募登録・最優先ピン留め）はkind==='municipality'の時だけ末尾に展開する。
import { useState } from 'react';
import { CONFIDENCE_BADGE, FACT_CHECK_BADGE, canSendDraft, subjectOf } from '@/components/admin/sales/factCheckUi';
import AutoGrowTextarea from '@/components/admin/sales/AutoGrowTextarea';
import FactCheckWatchBadge, { type FactCheckFlag } from '@/components/admin/sales/FactCheckWatchBadge';
import LinkList from '@/components/admin/sales/LinkList';
import { LEAD_STATUS_LABELS, type SalesEntry, type FundingOpp } from '@/components/admin/sales/salesEntry';
import { smoutSearchUrl } from '@/lib/smout';

const ENGAGEMENT_STAGES = [
  { key: 'observing', label: '観察' },
  { key: 'lead', label: 'リード' },
  { key: 'proposed', label: '提案中' },
  { key: 'contracted', label: '契約済み' },
];
const OPPORTUNITY_LEVELS = ['高', '中', '低'];
const OPPORTUNITY_COLORS: Record<string, string> = { 高: '#27AE60', 中: '#E5A139', 低: '#999' };

const inputStyle: React.CSSProperties = {
  padding: '9px 12px', borderRadius: 8, border: '1.5px solid #ddd',
  fontSize: 13, outline: 'none', fontFamily: 'inherit', width: '100%', boxSizing: 'border-box',
};
const labelStyle: React.CSSProperties = { fontSize: 11.5, fontWeight: 700, color: '#555', margin: '10px 0 4px', display: 'block' };
const pillStyle = (active: boolean, color = '#38ADA9'): React.CSSProperties => ({
  padding: '4px 10px', borderRadius: 999, fontSize: 11, fontWeight: 700, cursor: 'pointer',
  border: active ? 'none' : '1px solid #ccc', background: active ? color : 'transparent', color: active ? '#fff' : '#666',
});

export interface MunicipalityExtras {
  smoutSentAt: string | null;
  smoutReply: string | null;
  onHold: boolean;
  isPriorityPick: boolean;
  municipalityCode: string | null;
  populationStats: { dayNightRatio?: number; statsYear?: string } | null;
  populationStatsFetchedAt: string | null;
  followedUpAt: string | null;
  linkedOpps: FundingOpp[];
  popStatsLoading: boolean;
  popStatsError?: string;
  onMarkSmoutSent: () => void;
  onUnmarkSmoutSent: () => void;
  onSaveSmoutReply: (v: string) => void;
  onToggleOnHold: () => void;
  onTogglePriorityPick: () => void;
  onSaveMunicipalityCode: (v: string) => void;
  onFetchPopulationStats: () => void;
  onMarkFollowedUp: () => void;
  onRegisterRfp: (title: string, deadline: string) => void;
}

export default function SalesEntryCard({
  entry, selected, onToggleSelect, factCheckFlags, isCaseified, caseId, caseBusy,
  onSetStatus, onSetOpportunityLevel, onSaveMemo, onSaveEvidence, onSaveSourceLinks,
  onSaveEmail, onSaveDraft, onToggleFactCheck, onSend, sendBusy, sendError,
  onCaseify, onIssueDashboardUrl, dashboardUrl, dashboardBusy, dashboardError,
  municipality,
}: {
  entry: SalesEntry;
  selected: boolean;
  onToggleSelect: () => void;
  factCheckFlags: FactCheckFlag[];
  isCaseified: boolean;
  caseId?: string | null;
  caseBusy: boolean;
  onSetStatus: (status: string) => void;
  onSetOpportunityLevel?: (level: string) => void;
  onSaveMemo: (v: string) => void;
  onSaveEvidence: (v: string) => void;
  onSaveSourceLinks: (v: string) => void;
  onSaveEmail: (v: string) => void;
  onSaveDraft: (v: string) => void;
  onToggleFactCheck: (status: 'verified' | 'unverified') => void;
  onSend: () => void;
  sendBusy: boolean;
  sendError?: string;
  onCaseify: () => void;
  onIssueDashboardUrl?: () => void;
  dashboardUrl?: string;
  dashboardBusy?: boolean;
  dashboardError?: string;
  municipality?: MunicipalityExtras;
}) {
  const [expanded, setExpanded] = useState(false);
  const [memo, setMemo] = useState(entry.lead?.memo ?? '');
  const [evidence, setEvidence] = useState(entry.evidenceSummary ?? '');
  const [sourceLinks, setSourceLinks] = useState(entry.sourceLinks ?? '');
  const [email, setEmail] = useState(entry.email ?? '');
  const [draft, setDraft] = useState(entry.emailDraft ?? '');
  const [rfpOpen, setRfpOpen] = useState(false);
  const [rfpForm, setRfpForm] = useState({ title: '', deadline: '' });

  const schedulingDetected = entry.schedulingRequestDetectedAt
    && (Date.now() - new Date(entry.schedulingRequestDetectedAt).getTime()) < 5 * 86400000;
  const isRfpActive = municipality?.linkedOpps.some(o => ['watching', 'preparing'].includes(o.status)) ?? false;

  return (
    <div style={{
      background: '#fff', borderRadius: 12, padding: 14,
      boxShadow: '0 1px 4px rgba(0,0,0,0.06)', border: selected ? '2px solid #38ADA9' : '1px solid transparent',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <input type="checkbox" checked={selected} onChange={onToggleSelect} style={{ marginTop: 4 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 6 }}>
            <p style={{ margin: 0, fontWeight: 800, fontSize: 14.5 }}>
              {entry.icon} {entry.name}
              <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 700, color: entry.statusColor }}>{entry.statusLabel}</span>
            </p>
            <button onClick={() => setExpanded(v => !v)} style={{
              padding: '3px 12px', borderRadius: 14, border: '1px solid #ddd', background: '#fff',
              color: '#666', fontSize: 11, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap',
            }}>{expanded ? '折りたたむ' : '詳細を見る'}</button>
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', margin: '4px 0 0' }}>
            <span title={entry.reason} style={{ fontSize: 10.5, fontWeight: 700, color: entry.badgeColor }}>{entry.badge}</span>
            {entry.contactEmailConfidence && (
              <span style={{ fontSize: 10.5, fontWeight: 700, color: CONFIDENCE_BADGE[entry.contactEmailConfidence].color }}>
                {CONFIDENCE_BADGE[entry.contactEmailConfidence].label}
              </span>
            )}
            {entry.factCheckStatus === 'verified' || entry.factCheckStatus === 'flagged' ? (
              <span style={{ fontSize: 10.5, fontWeight: 700, color: FACT_CHECK_BADGE[entry.factCheckStatus].color }}>
                {FACT_CHECK_BADGE[entry.factCheckStatus].label}
              </span>
            ) : (
              <span style={{ fontSize: 10.5, fontWeight: 700, color: '#999' }}>○ 事実確認: 未実施</span>
            )}
            {entry.assignedTo && (
              <span style={{ fontSize: 10.5, fontWeight: 700, color: '#8E44AD', background: '#F3E9FA', padding: '1px 7px', borderRadius: 20 }}>👤 {entry.assignedTo}</span>
            )}
            {isRfpActive && (
              <span style={{ fontSize: 10.5, fontWeight: 700, color: '#fff', background: '#E55039', padding: '1px 7px', borderRadius: 20 }}>🔥 公募中</span>
            )}
            {schedulingDetected && (
              <span title="Gmail AIエージェントが日程調整を求める返信を検知しました" style={{
                fontSize: 10.5, fontWeight: 700, color: '#4A69BD', background: '#4A69BD18', padding: '1px 7px', borderRadius: 20,
              }}>📅 日程調整依頼あり</span>
            )}
          </div>
          {entry.originNote && (
            <p style={{ margin: '6px 0 0', fontSize: 11, color: '#4A69BD', background: '#EEF1FB', padding: '4px 10px', borderRadius: 8 }}>
              💡 この営業先の由来：{entry.originNote}
            </p>
          )}
        </div>
      </div>

      {expanded && (
        <div style={{ marginTop: 12 }}>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
            {entry.kind === 'lead' ? (
              Object.entries(LEAD_STATUS_LABELS).map(([key, info]) => (
                <span key={key} onClick={() => onSetStatus(key)} style={pillStyle(entry.lead?.status === key, info.color)}>{info.label}</span>
              ))
            ) : (
              <>
                {ENGAGEMENT_STAGES.map(s => (
                  <span key={s.key} onClick={() => onSetStatus(s.key)} style={pillStyle(entry.municipality?.engagement_stage === s.key)}>{s.label}</span>
                ))}
                <span style={{ width: 1, background: '#eee' }} />
                {OPPORTUNITY_LEVELS.map(o => (
                  <span key={o} onClick={() => onSetOpportunityLevel?.(o)} style={pillStyle(entry.municipality?.opportunity_level === o, OPPORTUNITY_COLORS[o])}>{o}</span>
                ))}
              </>
            )}
          </div>

          <label style={labelStyle}>{entry.kind === 'lead' ? '商談メモ・要望・次のアクション' : '調べた内容（証拠パック）'}</label>
          <AutoGrowTextarea
            value={memo} onChange={setMemo}
            onBlur={v => { if (v !== (entry.lead?.memo ?? '')) onSaveMemo(v); }}
            placeholder="自由に記入" rows={2} style={inputStyle}
          />

          {entry.kind === 'municipality' && (
            <>
              <label style={labelStyle}>ヒトマップとの親和性・提案余地の理由</label>
              <AutoGrowTextarea
                value={evidence} onChange={setEvidence}
                onBlur={v => { if (v !== (entry.evidenceSummary ?? '')) onSaveEvidence(v); }}
                placeholder="根拠・理由" rows={2} style={inputStyle}
              />
            </>
          )}

          <label style={labelStyle}>情報源・根拠URL（1行に1つ）</label>
          {sourceLinks.trim() && (
            <div style={{ padding: '8px 10px', background: '#fafafa', borderRadius: 8, marginBottom: 6 }}>
              <LinkList text={sourceLinks} />
            </div>
          )}
          <AutoGrowTextarea
            value={sourceLinks} onChange={setSourceLinks}
            onBlur={v => { if (v !== (entry.sourceLinks ?? '')) onSaveSourceLinks(v); }}
            placeholder="https://... を1行に1つ貼り付け" rows={2} style={inputStyle}
          />
          <p style={{ margin: '4px 0 0', fontSize: 10.5, color: '#aaa' }}>
            人間が一次情報を確認するための出典です。ここにURLを置いてから「事実確認済みにする」を押してください。
          </p>

          <FactCheckWatchBadge flags={factCheckFlags} />

          <div style={{ marginTop: 10, padding: 10, borderRadius: 8, background: '#F4FAF9', border: '1px solid #DDF0EE' }}>
            <p style={{ margin: '0 0 6px', fontSize: 12, fontWeight: 800, color: '#2A8580' }}>🔍 事実確認・送信</p>
            <label style={labelStyle}>宛先メールアドレス</label>
            <input
              value={email} onChange={e => setEmail(e.target.value)}
              onBlur={e => onSaveEmail(e.target.value)}
              placeholder="判明していれば入力" style={inputStyle}
            />
            <label style={labelStyle}>メール文案（下書き・編集可・全文表示）</label>
            <AutoGrowTextarea
              value={draft} onChange={setDraft} onBlur={onSaveDraft}
              placeholder={subjectOf('')} rows={5} style={inputStyle}
            />

            <div style={{ display: 'flex', gap: 8, alignItems: 'center', margin: '8px 0 4px', flexWrap: 'wrap' }}>
              {entry.emailSentAt ? (
                <span style={{ fontSize: 11.5, color: '#27AE60', fontWeight: 700 }}>✓ 送信済み（{new Date(entry.emailSentAt).toLocaleDateString('ja-JP')}）</span>
              ) : (
                <>
                  {entry.factCheckStatus === 'verified' ? (
                    <button onClick={() => onToggleFactCheck('unverified')} disabled={sendBusy} style={{
                      padding: '4px 10px', borderRadius: 8, border: '1px solid #ddd', background: '#fff', color: '#999', fontSize: 11, cursor: 'pointer',
                    }}>未確認に戻す</button>
                  ) : (
                    <button onClick={() => onToggleFactCheck('verified')} disabled={sendBusy} style={{
                      padding: '4px 10px', borderRadius: 8, border: '1px solid #27AE60', background: '#fff', color: '#27AE60', fontWeight: 700, fontSize: 11, cursor: 'pointer',
                    }}>事実確認済みにする</button>
                  )}
                  <button
                    onClick={onSend}
                    disabled={!canSendDraft(entry.email, entry.contactEmailConfidence, entry.factCheckStatus) || sendBusy}
                    style={{
                      padding: '6px 14px', borderRadius: 8, border: 'none',
                      background: canSendDraft(entry.email, entry.contactEmailConfidence, entry.factCheckStatus) ? '#38ADA9' : '#ccc',
                      color: '#fff', fontWeight: 700, fontSize: 12,
                      cursor: canSendDraft(entry.email, entry.contactEmailConfidence, entry.factCheckStatus) && !sendBusy ? 'pointer' : 'not-allowed',
                    }}
                  >{sendBusy ? '送信中…' : '送信'}</button>
                </>
              )}
            </div>
            {sendError && <p style={{ margin: '6px 0 0', fontSize: 11, color: '#E74C3C' }}>{sendError}</p>}
          </div>

          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginTop: 10 }}>
            <div>
              {isCaseified ? (
                caseId ? (
                  <a href={`/admin/case/${caseId}`} target="_blank" rel="noopener noreferrer" style={{
                    fontSize: 11, fontWeight: 700, color: '#8E44AD', border: '1px solid #8E44AD', borderRadius: 999, padding: '4px 10px', textDecoration: 'none',
                  }}>📊 案件化済み →</a>
                ) : <span style={{ fontSize: 10.5, fontWeight: 700, color: '#8E44AD' }}>📇 案件化済み</span>
              ) : (
                <button onClick={onCaseify} disabled={caseBusy} style={{
                  padding: '4px 10px', borderRadius: 14, border: '1px solid #8E44AD', background: '#fff',
                  color: '#8E44AD', fontSize: 11, fontWeight: 700, cursor: 'pointer',
                }}>{caseBusy ? '処理中…' : '📇 案件化する'}</button>
              )}
              <p style={{ margin: '3px 0 0', fontSize: 10, color: '#aaa' }}>押すと商流ボード（business_cases）に案件を作り、進捗を専用ページで追えるようにします</p>
            </div>
            {onIssueDashboardUrl && (
              <div>
                <button onClick={onIssueDashboardUrl} disabled={dashboardBusy} style={{
                  padding: '4px 10px', borderRadius: 14, border: '1px solid #4A69BD', background: '#fff',
                  color: '#4A69BD', fontSize: 11, fontWeight: 700, cursor: 'pointer',
                }}>{dashboardBusy ? '発行中…' : '🗺 集計ダッシュボードURLを発行'}</button>
                <p style={{ margin: '3px 0 0', fontSize: 10, color: '#aaa' }}>認証不要で、この団体の地域だけに絞った集計ページのリンクを作ります</p>
                {dashboardUrl && (
                  <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <code style={{ fontSize: 10.5, background: '#f4f4f4', padding: '4px 6px', borderRadius: 6, wordBreak: 'break-all' }}>{dashboardUrl}</code>
                    <button onClick={() => navigator.clipboard.writeText(dashboardUrl)} style={{
                      padding: '3px 8px', borderRadius: 6, border: '1px solid #4A69BD', fontSize: 10.5, fontWeight: 700, background: '#fff', color: '#4A69BD', cursor: 'pointer',
                    }}>コピー</button>
                  </div>
                )}
                {dashboardError && <p style={{ margin: '4px 0 0', fontSize: 10.5, color: '#E74C3C' }}>{dashboardError}</p>}
              </div>
            )}
          </div>

          {entry.kind === 'municipality' && municipality && (
            <div style={{ marginTop: 12 }}>
              <p style={{ margin: '0 0 6px', fontSize: 12, fontWeight: 800, color: '#B7791F' }}>🏛 自治体専用の詳細</p>

              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 8 }}>
                <span onClick={municipality.onTogglePriorityPick} style={{
                  fontSize: 11, cursor: 'pointer', color: municipality.isPriorityPick ? '#E5A139' : '#ccc', fontWeight: 700,
                }} title="営業価値の高い最優先自治体としてピン留め">{municipality.isPriorityPick ? '★ 最優先' : '☆ ピン留め'}</span>
                <button onClick={municipality.onToggleOnHold} style={{
                  fontSize: 11, color: municipality.onHold ? '#fff' : '#888', fontWeight: 700, cursor: 'pointer',
                  background: municipality.onHold ? '#999' : 'none', border: '1px solid #ccc', borderRadius: 999, padding: '3px 10px',
                }} title="メール送信・フォローを一時的に止める（削除はしない）">{municipality.onHold ? '再開する' : 'メール送信を保留にする'}</button>
                <button onClick={() => setRfpOpen(v => !v)} style={{
                  fontSize: 11, fontWeight: 700, color: '#E55039', background: 'none', border: '1px solid #E55039', borderRadius: 999, padding: '3px 10px', cursor: 'pointer',
                }}>🔥 公募を登録</button>
              </div>

              {municipality.linkedOpps.length > 0 && (
                <div style={{ margin: '0 0 8px', display: 'flex', flexDirection: 'column', gap: 3 }}>
                  {municipality.linkedOpps.map(o => (
                    <p key={o.id} style={{ margin: 0, fontSize: 11.5, color: '#B7791F' }}>
                      🏛 {o.title}{o.deadline && ` ・ 締切${o.deadline}`}{o.url && <a href={o.url} target="_blank" rel="noopener noreferrer" style={{ marginLeft: 4, color: '#38ADA9' }}>↗</a>}
                    </p>
                  ))}
                </div>
              )}

              {rfpOpen && (
                <div style={{ margin: '0 0 10px', padding: 10, borderRadius: 8, background: '#FFF4F2', border: '1px solid #FBD9D2' }}>
                  <label style={labelStyle}>公募タイトル</label>
                  <input style={inputStyle} value={rfpForm.title} onChange={e => setRfpForm(f => ({ ...f, title: e.target.value }))}
                    placeholder={`例：${entry.name} 関係人口創出事業プロポーザル`} />
                  <label style={labelStyle}>締切</label>
                  <input type="date" style={inputStyle} value={rfpForm.deadline} onChange={e => setRfpForm(f => ({ ...f, deadline: e.target.value }))} />
                  <div style={{ marginTop: 8 }}>
                    <button onClick={() => { municipality.onRegisterRfp(rfpForm.title, rfpForm.deadline); setRfpForm({ title: '', deadline: '' }); setRfpOpen(false); }} style={{
                      padding: '6px 14px', borderRadius: 8, border: 'none', background: '#E55039', color: '#fff', fontWeight: 700, fontSize: 12, cursor: 'pointer',
                    }}>登録する</button>
                  </div>
                </div>
              )}

              <div style={{ padding: 10, borderRadius: 8, background: '#FBF6EE', border: '1px solid #F0E4CE', marginBottom: 8 }}>
                <p style={{ margin: '0 0 6px', fontSize: 12, fontWeight: 800, color: '#B7791F' }}>
                  📣 SMOUT <span style={{ fontWeight: 400, color: '#aaa', marginLeft: 6, fontSize: 10.5 }}>公式APIが無いため手動記録</span>
                </p>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  {municipality.smoutSentAt ? (
                    <>
                      <span style={{ fontSize: 11.5, color: '#27AE60', fontWeight: 700 }}>✓ 送信済み（{new Date(municipality.smoutSentAt).toLocaleDateString('ja-JP')}）</span>
                      <button onClick={municipality.onMarkFollowedUp} style={{ fontSize: 11, background: 'none', border: '1px solid #B7791F', color: '#B7791F', borderRadius: 999, padding: '3px 10px', cursor: 'pointer' }}>フォロー済みにする</button>
                      <button onClick={municipality.onUnmarkSmoutSent} style={{ fontSize: 11, background: 'none', border: '1px solid #ccc', borderRadius: 999, padding: '3px 10px', cursor: 'pointer' }}>取り消す</button>
                    </>
                  ) : (
                    <button onClick={municipality.onMarkSmoutSent} style={{ fontSize: 11.5, fontWeight: 700, background: '#E5A139', color: '#fff', border: 'none', borderRadius: 999, padding: '5px 12px', cursor: 'pointer' }}>
                      SMOUTで送信済みにする
                    </button>
                  )}
                  <a href={smoutSearchUrl(entry.name)} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, color: '#B7791F' }}>SMOUT ↗</a>
                </div>
                <label style={labelStyle}>届いた返信</label>
                <AutoGrowTextarea
                  value={municipality.smoutReply ?? ''} onChange={() => {}} onBlur={municipality.onSaveSmoutReply}
                  placeholder="SMOUT上で届いた返信を貼り付け" rows={2} style={inputStyle}
                />
              </div>

              <div style={{ padding: 10, borderRadius: 8, background: '#F2F6FB', border: '1px solid #DDE8F5' }}>
                <p style={{ margin: '0 0 6px', fontSize: 12, fontWeight: 800, color: '#2E5FA3' }}>📊 人口統計（e-Stat）</p>
                <label style={labelStyle}>全国地方公共団体コード（5桁）</label>
                <input
                  defaultValue={municipality.municipalityCode ?? ''} style={inputStyle}
                  placeholder="例：092010"
                  onBlur={e => { if (e.target.value !== (municipality.municipalityCode ?? '')) municipality.onSaveMunicipalityCode(e.target.value); }}
                />
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', margin: '8px 0 0', flexWrap: 'wrap' }}>
                  {municipality.populationStats?.dayNightRatio != null ? (
                    <span style={{ fontSize: 11.5, color: '#2E5FA3', fontWeight: 700 }}>
                      昼夜間人口比率 {municipality.populationStats.dayNightRatio}%（{municipality.populationStats.statsYear ?? '年不明'}）
                    </span>
                  ) : <span style={{ fontSize: 11.5, color: '#aaa' }}>まだ取得されていません</span>}
                  <button onClick={municipality.onFetchPopulationStats} disabled={!municipality.municipalityCode || municipality.popStatsLoading} style={{
                    fontSize: 11, fontWeight: 700, background: '#2E5FA3', color: '#fff', border: 'none', borderRadius: 999,
                    padding: '4px 12px', cursor: municipality.municipalityCode ? 'pointer' : 'not-allowed', opacity: municipality.municipalityCode ? 1 : 0.5,
                  }}>{municipality.popStatsLoading ? '取得中…' : '人口統計を取得'}</button>
                </div>
                {municipality.popStatsError && <p style={{ margin: '4px 0 0', fontSize: 10.5, color: '#E74C3C' }}>{municipality.popStatsError}</p>}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
