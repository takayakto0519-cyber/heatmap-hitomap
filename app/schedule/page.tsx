'use client';

// 日程調整ページ（公開・ログイン不要）。行政面談専用ではなく、汎用の日程調整ツールとして
// 誰にでも渡せる1本のURL（/schedule）。Googleカレンダーの実際の空きから枠を計算し、
// 相手が選んで送信すると「仮リクエスト」として保存される（即座にはカレンダーへ書き込まない）。
// 確定は必ず会長が運営ダッシュボードで行う。
import { useEffect, useState } from 'react';

interface AvailabilitySlot { start: string; end: string }
interface AvailabilityDay { date: string; slots: AvailabilitySlot[] }

const DURATIONS = [
  { value: 15, label: '15分' },
  { value: 30, label: '30分' },
  { value: 45, label: '45分' },
  { value: 60, label: '60分' },
];

const WEEKDAY_LABELS = ['日', '月', '火', '水', '木', '金', '土'];

function formatDateLabel(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00+09:00`);
  return `${d.getMonth() + 1}/${d.getDate()}(${WEEKDAY_LABELS[d.getDay()]})`;
}
function formatTimeLabel(iso: string): string {
  return new Date(iso).toLocaleTimeString('ja-JP', { timeZone: 'Asia/Tokyo', hour: '2-digit', minute: '2-digit' });
}

const cardStyle: React.CSSProperties = { background: '#fff', borderRadius: 14, padding: 20, boxShadow: '0 1px 6px rgba(0,0,0,0.06)' };
const inputStyle: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box', padding: '11px 13px', fontSize: 14,
  border: '1.5px solid #ddd', borderRadius: 10, fontFamily: 'inherit', outline: 'none',
};
const labelStyle: React.CSSProperties = { display: 'block', fontWeight: 700, fontSize: 13, marginBottom: 6, color: '#444' };

export default function SchedulePage() {
  const [duration, setDuration] = useState(30);
  const [days, setDays] = useState<AvailabilityDay[] | null>(null);
  const [loadError, setLoadError] = useState('');
  const [loading, setLoading] = useState(true);

  const [selected, setSelected] = useState<AvailabilitySlot | null>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [company, setCompany] = useState('');
  const [purpose, setPurpose] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    setLoading(true);
    setLoadError('');
    setSelected(null);
    fetch(`/api/schedule/availability?duration=${duration}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) setDays(d.days);
        else setLoadError(d.error ?? '空き状況の取得に失敗しました');
      })
      .catch(() => setLoadError('通信エラーが発生しました'))
      .finally(() => setLoading(false));
  }, [duration]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) return;
    setSubmitting(true);
    setSubmitError('');
    try {
      const res = await fetch('/api/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(), email: email.trim(), company: company.trim() || undefined,
          purpose: purpose.trim() || undefined, duration_minutes: duration, start: selected.start,
        }),
      });
      const data = await res.json();
      if (data.ok) setSubmitted(true);
      else setSubmitError(data.error ?? '送信に失敗しました');
    } catch {
      setSubmitError('通信エラーが発生しました');
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <main style={{ maxWidth: 480, margin: '0 auto', padding: '60px 20px', textAlign: 'center' }}>
        <p style={{ fontSize: 44, margin: '0 0 12px' }}>✅</p>
        <h1 style={{ fontSize: 20, margin: '0 0 8px' }}>リクエストを送りました</h1>
        <p style={{ color: '#777', fontSize: 14, lineHeight: 1.8 }}>
          {selected && `${formatDateLabel(selected.start.slice(0, 10))} ${formatTimeLabel(selected.start)}〜`} のご希望を受け付けました。<br />
          担当者が確認のうえ、追ってご連絡いたします。
        </p>
      </main>
    );
  }

  return (
    <main style={{ maxWidth: 640, margin: '0 auto', padding: '32px 16px 60px' }}>
      <h1 style={{ fontSize: 22, margin: '0 0 6px' }}>日程調整</h1>
      <p style={{ color: '#888', fontSize: 13, margin: '0 0 24px' }}>ご都合の良い日時をお選びください。</p>

      <div style={{ ...cardStyle, marginBottom: 16 }}>
        <label style={labelStyle}>所要時間</label>
        <div style={{ display: 'flex', gap: 8, marginBottom: selected ? 20 : 0 }}>
          {DURATIONS.map((d) => (
            <button key={d.value} type="button" onClick={() => setDuration(d.value)} style={{
              flex: 1, padding: '9px 0', borderRadius: 10, cursor: 'pointer', fontSize: 13, fontWeight: 700,
              border: duration === d.value ? '1.5px solid #38ADA9' : '1.5px solid #ddd',
              background: duration === d.value ? '#38ADA9' : '#fff',
              color: duration === d.value ? '#fff' : '#666',
            }}>{d.label}</button>
          ))}
        </div>

        {loading && <p style={{ color: '#aaa', fontSize: 13, margin: 0 }}>空き状況を確認しています…</p>}
        {loadError && <p style={{ color: '#E74C3C', fontSize: 13, margin: 0 }}>{loadError}</p>}
        {!loading && !loadError && days && days.length === 0 && (
          <p style={{ color: '#aaa', fontSize: 13, margin: 0 }}>直近で空いている枠が見つかりませんでした。</p>
        )}

        {!loading && days && days.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {days.map((day) => (
              <div key={day.date}>
                <p style={{ fontSize: 12.5, fontWeight: 700, color: '#666', margin: '0 0 6px' }}>{formatDateLabel(day.date)}</p>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {day.slots.map((slot) => {
                    const isSelected = selected?.start === slot.start;
                    return (
                      <button key={slot.start} type="button" onClick={() => setSelected(slot)} style={{
                        padding: '7px 12px', borderRadius: 8, cursor: 'pointer', fontSize: 12.5, fontWeight: 700,
                        border: isSelected ? '1.5px solid #38ADA9' : '1.5px solid #eee',
                        background: isSelected ? '#38ADA9' : '#fafafa',
                        color: isSelected ? '#fff' : '#555',
                      }}>{formatTimeLabel(slot.start)}</button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {selected && (
        <form onSubmit={handleSubmit} style={cardStyle}>
          <p style={{ fontSize: 13, fontWeight: 700, color: '#38ADA9', margin: '0 0 16px' }}>
            {formatDateLabel(selected.start.slice(0, 10))} {formatTimeLabel(selected.start)}〜{formatTimeLabel(selected.end)} で仮リクエストします
          </p>
          <div style={{ marginBottom: 12 }}>
            <label style={labelStyle}>お名前 *</label>
            <input required value={name} onChange={(e) => setName(e.target.value)} style={inputStyle} placeholder="山田 太郎" />
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={labelStyle}>メールアドレス *</label>
            <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} style={inputStyle} placeholder="you@example.com" />
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={labelStyle}>会社名・団体名（任意）</label>
            <input value={company} onChange={(e) => setCompany(e.target.value)} style={inputStyle} />
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>ご用件（任意）</label>
            <textarea value={purpose} onChange={(e) => setPurpose(e.target.value)} rows={3}
              style={{ ...inputStyle, resize: 'vertical' }} placeholder="打合せの内容など" />
          </div>
          {submitError && <p style={{ color: '#E74C3C', fontSize: 13, margin: '0 0 12px' }}>{submitError}</p>}
          <button type="submit" disabled={submitting} style={{
            width: '100%', padding: '13px', background: '#38ADA9', color: '#fff', border: 'none',
            borderRadius: 10, fontSize: 15, fontWeight: 700, cursor: submitting ? 'wait' : 'pointer',
          }}>{submitting ? '送信中…' : 'この日時でリクエストする'}</button>
          <p style={{ fontSize: 11, color: '#aaa', margin: '10px 0 0', lineHeight: 1.6 }}>
            送信してもすぐに確定するわけではありません。担当者が確認のうえご連絡します。
          </p>
        </form>
      )}
    </main>
  );
}
