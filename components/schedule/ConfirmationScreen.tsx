'use client';

import { colors, radii, shadows } from '@/lib/theme';
import { formatDateLabel, formatTimeLabel } from '@/lib/scheduleFormat';
import { SCHEDULING_MEET_URL } from '@/lib/scheduleConstants';
import type { AvailabilitySlot } from './types';

function googleCalendarAddUrl(slot: AvailabilitySlot, name: string): string {
  const toGCalDate = (iso: string) => iso.replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
  const dates = `${toGCalDate(slot.start)}/${toGCalDate(slot.end)}`;
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: `【仮】ヒトマップ 打ち合わせ（${name}様）`,
    dates,
    location: SCHEDULING_MEET_URL,
    details: `ヒトマップとの打ち合わせ（確定待ち）。確定後、Google Meetの招待メールが届きます。\n会議室URL: ${SCHEDULING_MEET_URL}`,
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

export default function ConfirmationScreen({ selected, name, onReset }: {
  selected: AvailabilitySlot;
  name: string;
  onReset: () => void;
}) {
  return (
    <main style={{ maxWidth: 480, margin: '0 auto', padding: '48px 20px 60px', textAlign: 'center' }}>
      <p style={{ fontSize: 30, margin: '0 0 8px' }}>✅</p>
      <h1 style={{ fontSize: 19, margin: '0 0 20px', color: colors.textPrimary }}>リクエストを送りました</h1>

      <div style={{ background: colors.surface, borderRadius: radii.lg, padding: 18, boxShadow: shadows.card, textAlign: 'left', marginBottom: 18 }}>
        <p style={{ margin: '0 0 4px', fontSize: 11, color: colors.textFaint, fontWeight: 700 }}>希望日時</p>
        <p style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 800, color: colors.textPrimary }}>
          {formatDateLabel(selected.start.slice(0, 10))} {formatTimeLabel(selected.start)}〜{formatTimeLabel(selected.end)}
        </p>
        <p style={{ margin: 0, fontSize: 13, color: colors.textSecondary, lineHeight: 1.8 }}>
          担当者が確認のうえ、追ってご連絡いたします。<br />
          確定後、Google Meet（オンライン会議）の招待メールをお送りします。
        </p>
      </div>

      <a href={googleCalendarAddUrl(selected, name)} target="_blank" rel="noopener noreferrer" style={{
        display: 'block', textAlign: 'center', padding: '13px', borderRadius: radii.md,
        background: colors.surfaceMuted, color: colors.textPrimary, fontWeight: 700, fontSize: 14,
        textDecoration: 'none', marginBottom: 10, border: `1.5px solid ${colors.border}`,
      }}>📅 仮の予定として自分のカレンダーに追加</a>

      <button type="button" onClick={onReset} style={{
        background: 'none', border: 'none', color: colors.textMuted, fontSize: 13,
        cursor: 'pointer', textDecoration: 'underline', fontFamily: 'inherit', padding: 8,
      }}>別の日時を選び直す</button>
    </main>
  );
}
