'use client';

// 痕跡データパターン分析：agents/trace_pattern.py（AIエージェント62）と同じ考え方をサイト本体からライブに見る画面。
// データは /api/admin/trace-pattern（lib/tracePattern.ts）。自治体向けレポート商品の中身（数字）を作る装置。
import { useEffect, useState } from 'react';

interface TracePatternResult {
  ok: boolean;
  total: number;
  wantRevisitRate?: number;
  wantToShareRate?: number;
  deepWriteRate?: number;
  peakHours?: { hour: number; count: number }[];
  topSessions?: { sessionCode: string; count: number }[];
  error?: string;
  note?: string;
}

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ background: '#fff', borderRadius: 12, padding: 16, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', ...style }}>
      {children}
    </div>
  );
}

function StatTile({ label, value, hint, color }: { label: string; value: string; hint: string; color: string }) {
  return (
    <div style={{ flex: 1, minWidth: 120, textAlign: 'center', padding: '12px 8px', borderRadius: 10, background: '#fafafa' }}>
      <div style={{ fontSize: 22, fontWeight: 800, color }}>{value}</div>
      <div style={{ fontSize: 12, fontWeight: 700, color: '#666', marginTop: 2 }}>{label}</div>
      <div style={{ fontSize: 10.5, color: '#aaa', marginTop: 4, lineHeight: 1.5 }}>{hint}</div>
    </div>
  );
}

export default function TracePatternTab({ authHeaders }: { authHeaders: () => HeadersInit }) {
  const [result, setResult] = useState<TracePatternResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/admin/trace-pattern', { headers: authHeaders() })
      .then(r => r.json())
      .then(d => { if (d.ok) setResult(d); else setError(d.error ?? '取得に失敗しました'); })
      .catch(() => setError('通信エラー'))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div>
      <Card>
        <p style={{ margin: '0 0 4px', fontWeight: 800, fontSize: 15 }}>📊 投稿パターン分析</p>
        <p style={{ margin: 0, fontSize: 12, color: '#888', lineHeight: 1.7 }}>
          蓄積された痕跡（投稿）全体の傾向です。投稿時間帯・また来たい率・話したい率・書き込みの厚み（3つの問いの完答率）を数えます。<br />
          自治体向け提案書・レポートの一次データとして使えます。
        </p>
      </Card>

      {error && <p style={{ margin: '12px 0 0', fontSize: 13, color: '#E74C3C' }}>{error}</p>}

      <p style={{ margin: '20px 0 8px', fontWeight: 800, fontSize: 14 }}>📈 全体傾向</p>
      <Card>
        {loading ? (
          <p style={{ margin: 0, fontSize: 13, color: '#999' }}>集計中…</p>
        ) : result?.note ? (
          <p style={{ margin: 0, fontSize: 13, color: '#aaa' }}>{result.note}</p>
        ) : result ? (
          <>
            <p style={{ margin: '0 0 8px', fontSize: 12, color: '#888' }}>対象：全国公開・非公開含む有効な投稿 {result.total}件</p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <StatTile label="また来たい" value={`${result.wantRevisitRate}%`} hint="再訪意向のある投稿の割合" color="#38ADA9" />
              <StatTile label="話したい" value={`${result.wantToShareRate}%`} hint="誰かに話したいと答えた投稿の割合" color="#4A69BD" />
              <StatTile label="書き込みの厚み" value={`${result.deepWriteRate}%`} hint="なぜ・どんな暮らし・自分との接点の3問すべて記入" color="#E5A139" />
            </div>
          </>
        ) : null}
      </Card>

      <p style={{ margin: '24px 0 8px', fontWeight: 800, fontSize: 14 }}>🕒 投稿が多い時間帯（上位3）</p>
      <Card>
        {loading ? (
          <p style={{ margin: 0, fontSize: 13, color: '#999' }}>集計中…</p>
        ) : !result?.peakHours || result.peakHours.length === 0 ? (
          <p style={{ margin: 0, fontSize: 13, color: '#aaa' }}>データがありません。</p>
        ) : (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {result.peakHours.map(h => (
              <div key={h.hour} style={{ padding: '8px 14px', borderRadius: 8, background: '#fafafa', fontSize: 13 }}>
                <b>{h.hour}時台</b><span style={{ color: '#999', marginLeft: 6 }}>{h.count}件</span>
              </div>
            ))}
          </div>
        )}
      </Card>

      <p style={{ margin: '24px 0 8px', fontWeight: 800, fontSize: 14 }}>🎪 実験回別の件数（上位5）</p>
      <Card>
        {loading ? (
          <p style={{ margin: 0, fontSize: 13, color: '#999' }}>集計中…</p>
        ) : !result?.topSessions || result.topSessions.length === 0 ? (
          <p style={{ margin: 0, fontSize: 13, color: '#aaa' }}>session_code付きの投稿がまだありません。</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {result.topSessions.map(s => (
              <div key={s.sessionCode} style={{
                display: 'flex', justifyContent: 'space-between', padding: '8px 10px', borderRadius: 8, background: '#fafafa',
              }}>
                <span style={{ fontSize: 13, fontWeight: 700 }}>{s.sessionCode}</span>
                <span style={{ fontSize: 12, color: '#666' }}>{s.count}件</span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
