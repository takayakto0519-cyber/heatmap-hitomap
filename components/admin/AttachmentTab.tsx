'use client';

// 愛着タブ：縁の螺旋（地1.0→理2.0→心3.0）を数字で見る画面。
// データは /api/admin/attachment（lib/attachment.ts）から取得。個人を特定できる値は返ってこない。
// 自治体向け「関係人口・愛着レポート」の下書きにそのまま使える。
import { useEffect, useState } from 'react';

interface FunnelResult {
  ok: boolean;
  region: string;
  generatedAt: string;
  suppressed: boolean;
  stages?: { chi: number; ri: number; shin: number };
  rates?: { riRate: number; shinRate: number };
  error?: string;
}

interface ValenceSummary { positive: number; negative: number; neutral: number; total: number }

interface EventShiftResult {
  ok: boolean;
  eventSlug: string;
  generatedAt: string;
  suppressed: boolean;
  participantCount: number;
  phases?: { before: ValenceSummary; during: ValenceSummary; after: ValenceSummary };
  repeatVisitRate?: number;
  error?: string;
}

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ background: '#fff', borderRadius: 12, padding: 16, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', ...style }}>
      {children}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  padding: '9px 12px', borderRadius: 8, border: '1.5px solid #ddd',
  fontSize: 13, outline: 'none', fontFamily: 'inherit', flex: 1,
};

// 地→理→心の順にバーが伸びる（0.2秒ずつ遅らせ、段階が絞り込まれていく様子を見せる）
function StageBar({ label, count, total, color, hint, delay = 0 }: { label: string; count: number; total: number; color: string; hint: string; delay?: number }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div style={{ marginBottom: 14 }}>
      <style>{`
        @keyframes stage-bar-grow { from { width: 0; } }
      `}</style>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, marginBottom: 4 }}>
        <span style={{ fontWeight: 700 }}>{label}</span>
        <span style={{ color: '#888' }}>{count}人 {total > 0 ? `（${pct}%）` : ''}</span>
      </div>
      <div style={{ height: 10, borderRadius: 6, background: '#f0f0f0', overflow: 'hidden' }}>
        <div style={{
          height: '100%', width: `${pct}%`, background: color, borderRadius: 6,
          animation: 'stage-bar-grow 0.6s ease-out both', animationDelay: `${delay}s`,
        }} />
      </div>
      <p style={{ margin: '4px 0 0', fontSize: 11, color: '#aaa' }}>{hint}</p>
    </div>
  );
}

function ValenceRow({ label, v }: { label: string; v: ValenceSummary }) {
  if (v.total === 0) {
    return (
      <div style={{ flex: 1, textAlign: 'center', padding: '10px 4px', borderRadius: 8, background: '#fafafa' }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#999' }}>{label}</div>
        <div style={{ fontSize: 11, color: '#bbb', marginTop: 4 }}>記録なし</div>
      </div>
    );
  }
  return (
    <div style={{ flex: 1, textAlign: 'center', padding: '10px 4px', borderRadius: 8, background: '#fafafa' }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: '#666', marginBottom: 6 }}>{label}（{v.total}件）</div>
      <div style={{ display: 'flex', gap: 4 }}>
        <div style={{ flex: 1, fontSize: 13, fontWeight: 800, color: '#639922' }}>{Math.round((v.positive / v.total) * 100)}%<div style={{ fontSize: 9, fontWeight: 400, color: '#999' }}>😊</div></div>
        <div style={{ flex: 1, fontSize: 13, fontWeight: 800, color: '#888' }}>{Math.round((v.neutral / v.total) * 100)}%<div style={{ fontSize: 9, fontWeight: 400, color: '#999' }}>😐</div></div>
        <div style={{ flex: 1, fontSize: 13, fontWeight: 800, color: '#E24B4A' }}>{Math.round((v.negative / v.total) * 100)}%<div style={{ fontSize: 9, fontWeight: 400, color: '#999' }}>😟</div></div>
      </div>
    </div>
  );
}

export default function AttachmentTab({ authHeaders }: { authHeaders: () => HeadersInit }) {
  const [regionInput, setRegionInput] = useState('');
  const [eventInput, setEventInput] = useState('');
  const [eventOptions, setEventOptions] = useState<string[]>([]);
  const [funnel, setFunnel] = useState<FunnelResult | null>(null);
  const [shift, setShift] = useState<EventShiftResult | null>(null);
  const [loadingRegion, setLoadingRegion] = useState(false);
  const [loadingEvent, setLoadingEvent] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/routes')
      .then(r => r.json())
      .then(d => {
        const slugs = (d.routes ?? d ?? [])
          .map((r: { event_slug?: string | null }) => r.event_slug)
          .filter((s: string | null | undefined): s is string => !!s);
        setEventOptions([...new Set(slugs)] as string[]);
      })
      .catch(() => {});
  }, []);

  async function lookupRegion(region: string) {
    if (!region.trim()) return;
    setLoadingRegion(true);
    setError('');
    try {
      const res = await fetch(`/api/admin/attachment?region=${encodeURIComponent(region.trim())}`, { headers: authHeaders() });
      const d = await res.json();
      if (!res.ok && !d.region) { setError(d.error ?? '取得に失敗しました'); setFunnel(null); return; }
      setFunnel(d);
    } catch {
      setError('通信エラー');
    } finally {
      setLoadingRegion(false);
    }
  }

  async function lookupEvent(slug: string) {
    if (!slug.trim()) return;
    setLoadingEvent(true);
    setError('');
    try {
      const res = await fetch(`/api/admin/attachment?event=${encodeURIComponent(slug.trim())}`, { headers: authHeaders() });
      const d = await res.json();
      setShift(d);
      if (!d.ok && d.error) setError(d.error);
    } catch {
      setError('通信エラー');
    } finally {
      setLoadingEvent(false);
    }
  }

  return (
    <div>
      <Card>
        <p style={{ margin: '0 0 4px', fontWeight: 800, fontSize: 15 }}>🌀 愛着の見える化</p>
        <p style={{ margin: 0, fontSize: 12, color: '#888', lineHeight: 1.7 }}>
          ヒトマップの本義＝「出会いが、どんな感情を経て、その地域への愛着になるか」の計測です。<br />
          地（記録した）→理（他者とつながった）→心（再訪・その後・会いたい成立）の3段階で数えます。<br />
          個人が特定できる値は一切表示しません。地の段階が5人未満の地域・イベントは「少人数のため非表示」とします。
        </p>
      </Card>

      {/* 地域ファネル */}
      <p style={{ margin: '20px 0 8px', fontWeight: 800, fontSize: 14 }}>📍 地域別ファネル</p>
      <Card>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            placeholder="例：山形市"
            value={regionInput}
            onChange={e => setRegionInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && lookupRegion(regionInput)}
            style={inputStyle}
          />
          <button
            onClick={() => lookupRegion(regionInput)}
            disabled={loadingRegion || !regionInput.trim()}
            style={{ padding: '9px 16px', borderRadius: 8, border: 'none', background: '#38ADA9', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}
          >{loadingRegion ? '集計中…' : '集計する'}</button>
        </div>
        <p style={{ margin: '6px 0 0', fontSize: 11, color: '#aaa' }}>投稿時に選ばれた地域名と完全一致で検索します。</p>

        {funnel && funnel.suppressed && (
          <p style={{ marginTop: 14, fontSize: 12.5, color: '#B7791F', background: '#FFF8E8', padding: 10, borderRadius: 8 }}>
            「{funnel.region}」は地の段階の人数が5人未満のため、個人特定を避けて非表示にしています。
          </p>
        )}
        {funnel && funnel.ok && !funnel.suppressed && funnel.stages && funnel.rates && (
          <div style={{ marginTop: 16 }} key={funnel.region + funnel.generatedAt}>
            <StageBar label="① 地（記録した）" count={funnel.stages.chi} total={funnel.stages.chi} color="#38ADA9" hint="この地域に痕跡を残した人数（基準）" />
            <StageBar label="② 理（つながった）" count={funnel.stages.ri} total={funnel.stages.chi} color="#4A69BD" hint={`地の人のうち他者と反応・コメントを交わした割合＝${funnel.rates.riRate}%`} delay={0.2} />
            <StageBar label="③ 心（結ばれた）" count={funnel.stages.shin} total={funnel.stages.chi} color="#E5A139" hint={`地の人のうち再訪・その後記録・会いたい成立に至った割合＝${funnel.rates.shinRate}%`} delay={0.4} />
          </div>
        )}
        {funnel && !funnel.ok && (
          <p style={{ marginTop: 14, fontSize: 12.5, color: '#E74C3C' }}>{funnel.error}</p>
        )}
      </Card>

      {/* イベント前後の感情変化 */}
      <p style={{ margin: '24px 0 8px', fontWeight: 800, fontSize: 14 }}>🎪 イベント前後の感情変化</p>
      <Card>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            placeholder="event_slug（例：bonno）"
            value={eventInput}
            onChange={e => setEventInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && lookupEvent(eventInput)}
            list="attachment-event-options"
            style={inputStyle}
          />
          <datalist id="attachment-event-options">
            {eventOptions.map(slug => <option key={slug} value={slug} />)}
          </datalist>
          <button
            onClick={() => lookupEvent(eventInput)}
            disabled={loadingEvent || !eventInput.trim()}
            style={{ padding: '9px 16px', borderRadius: 8, border: 'none', background: '#8E44AD', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}
          >{loadingEvent ? '集計中…' : '集計する'}</button>
        </div>
        <p style={{ margin: '6px 0 0', fontSize: 11, color: '#aaa' }}>公開イベント（route/relay/煩悩）の event_slug を指定してください。開始・終了日時が未設定のイベントは比較できません。</p>

        {shift && shift.suppressed && (
          <p style={{ marginTop: 14, fontSize: 12.5, color: '#B7791F', background: '#FFF8E8', padding: 10, borderRadius: 8 }}>
            参加者が{shift.participantCount}人と5人未満のため、個人特定を避けて非表示にしています。
          </p>
        )}
        {shift && shift.ok && !shift.suppressed && shift.phases && (
          <div style={{ marginTop: 16 }}>
            <p style={{ margin: '0 0 8px', fontSize: 12, color: '#888' }}>参加者 {shift.participantCount}人の感情の内訳（前→中→後）</p>
            <div style={{ display: 'flex', gap: 8 }}>
              <ValenceRow label="前" v={shift.phases.before} />
              <ValenceRow label="中" v={shift.phases.during} />
              <ValenceRow label="後" v={shift.phases.after} />
            </div>
            <div style={{ marginTop: 12, padding: '10px 12px', borderRadius: 8, background: '#F3F9EA' }}>
              <span style={{ fontSize: 13, fontWeight: 800, color: '#639922' }}>再訪率 {shift.repeatVisitRate}%</span>
              <span style={{ fontSize: 11, color: '#888', marginLeft: 8 }}>イベント中に歩いた地域へ、イベント後にも記録を残した参加者の割合</span>
            </div>
          </div>
        )}
        {shift && !shift.ok && !shift.suppressed && (
          <p style={{ marginTop: 14, fontSize: 12.5, color: '#E74C3C' }}>{shift.error}</p>
        )}
      </Card>

      {error && <p style={{ marginTop: 12, fontSize: 12, color: '#E74C3C' }}>{error}</p>}
    </div>
  );
}
