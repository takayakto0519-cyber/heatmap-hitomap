'use client';

// 日程調整ページ（公開・ログイン不要）。行政面談専用ではなく、汎用の日程調整ツールとして
// 誰にでも渡せる1本のURL（/schedule）。Googleカレンダーの実際の空きから枠を計算し、
// 相手が選んで送信すると「仮リクエスト」として保存される（即座にはカレンダーへ書き込まない）。
// 確定は必ず会長が運営ダッシュボードで行う。
//
// UI: 月間カレンダーグリッドで日付を選び→その日の時間枠を選び→氏名等を入力、の3段階
// （Calendly等の日程調整サービスの作法に合わせた構成）。
import { useEffect, useState } from 'react';
import { colors, radii, shadows } from '@/lib/theme';
import { currentMonthKey, shiftMonthKey } from '@/lib/scheduleFormat';
import DurationTabs from '@/components/schedule/DurationTabs';
import MonthCalendar from '@/components/schedule/MonthCalendar';
import TimeSlotList from '@/components/schedule/TimeSlotList';
import BookingForm from '@/components/schedule/BookingForm';
import ConfirmationScreen from '@/components/schedule/ConfirmationScreen';
import type { AvailabilityDay, AvailabilitySlot } from '@/components/schedule/types';

const cardStyle: React.CSSProperties = { background: colors.surface, borderRadius: radii.lg, padding: 20, boxShadow: shadows.card };

export default function SchedulePage() {
  const [duration, setDuration] = useState(30);
  const [monthKey, setMonthKey] = useState(currentMonthKey);
  const [minMonth, setMinMonth] = useState(currentMonthKey);
  const [maxMonth, setMaxMonth] = useState(currentMonthKey);
  const [days, setDays] = useState<AvailabilityDay[] | null>(null);
  const [loadError, setLoadError] = useState('');
  const [loading, setLoading] = useState(true);

  const [selectedDate, setSelectedDate] = useState<string | null>(null);
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
    fetch(`/api/schedule/availability?duration=${duration}&month=${monthKey}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) {
          setDays(d.days);
          setMinMonth(d.minMonth);
          setMaxMonth(d.maxMonth);
        } else {
          setLoadError(d.error ?? '空き状況の取得に失敗しました');
        }
      })
      .catch(() => setLoadError('通信エラーが発生しました'))
      .finally(() => setLoading(false));
  }, [duration, monthKey]);

  function handleChangeDuration(v: number) {
    setDuration(v);
    setSelectedDate(null);
    setSelected(null);
  }

  function handleChangeMonth(diff: 1 | -1) {
    setMonthKey((k) => shiftMonthKey(k, diff));
    setSelectedDate(null);
    setSelected(null);
  }

  function handleSelectDate(date: string) {
    setSelectedDate(date);
    setSelected(null);
  }

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

  function handleReset() {
    setSubmitted(false);
    setSelectedDate(null);
    setSelected(null);
    setName('');
    setEmail('');
    setCompany('');
    setPurpose('');
    setSubmitError('');
  }

  if (submitted && selected) {
    return <ConfirmationScreen selected={selected} name={name} onReset={handleReset} />;
  }

  const selectedDaySlots = days?.find((d) => d.date === selectedDate)?.slots ?? [];

  return (
    <main style={{ maxWidth: 640, margin: '0 auto', padding: '32px 16px 60px' }}>
      <style>{`
        .hm-schedule-pills button { transition: none; }
        @media (max-width: 480px) {
          .hm-schedule-card { padding: 14px !important; }
        }
      `}</style>

      <h1 style={{ fontSize: 22, margin: '0 0 6px', color: colors.textPrimary }}>日程調整</h1>
      <p style={{ color: colors.textMuted, fontSize: 13, margin: '0 0 24px' }}>ご都合の良い日時をお選びください。</p>

      <div className="hm-schedule-card" style={{ ...cardStyle, marginBottom: 16 }}>
        <label style={{ display: 'block', fontWeight: 700, fontSize: 13, marginBottom: 10, color: colors.textSecondary }}>所要時間</label>
        <DurationTabs value={duration} onChange={handleChangeDuration} />

        <div style={{ marginTop: 20 }}>
          {loading && <p style={{ color: colors.textFaint, fontSize: 13, margin: 0 }}>空き状況を確認しています…</p>}
          {loadError && <p style={{ color: colors.danger, fontSize: 13, margin: 0 }}>{loadError}</p>}
          {!loading && !loadError && days && (
            <MonthCalendar
              monthKey={monthKey}
              days={days}
              selectedDate={selectedDate}
              onSelectDate={handleSelectDate}
              onChangeMonth={handleChangeMonth}
              minMonth={minMonth}
              maxMonth={maxMonth}
            />
          )}
        </div>

        {selectedDate && !loading && (
          <div style={{ marginTop: 20, paddingTop: 16, borderTop: `1px solid ${colors.borderSoft}` }}>
            <TimeSlotList slots={selectedDaySlots} selected={selected} onSelect={setSelected} />
          </div>
        )}
      </div>

      {selected && (
        <BookingForm
          selected={selected}
          name={name} email={email} company={company} purpose={purpose}
          submitting={submitting} submitError={submitError}
          onNameChange={setName} onEmailChange={setEmail} onCompanyChange={setCompany} onPurposeChange={setPurpose}
          onSubmit={handleSubmit}
        />
      )}
    </main>
  );
}
