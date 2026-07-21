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
    text: `【候補】ヒトマップ 打ち合わせ（${name}様）`,
    dates,
    location: SCHEDULING_MEET_URL,
    details: `ヒトマップとの打ち合わせの候補日時（複数の候補のうち1つ・確定待ち）。確定後、Google Meetの招待メールが届きます。\n会議室URL: ${SCHEDULING_MEET_URL}`,
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

export default function ConfirmationScreen({ selectedSlots, name, onReset }: {
  selectedSlots: AvailabilitySlot[];
  name: string;
  onReset: () => void;
}) {
  const sorted = [...selectedSlots].sort((a, b) => a.start.localeCompare(b.start));

  return (
    <main style={{ maxWidth: 480, margin: '0 auto', padding: '48px 20px 60px', textAlign: 'center' }}>
      <p style={{ fontSize: 30, margin: '0 0 8px' }}>✅</p>
      <h1 style={{ fontSize: 19, margin: '0 0 20px', color: colors.textPrimary }}>リクエストを送りました</h1>

      <div style={{ background: colors.surface, borderRadius: radii.lg, padding: 18, boxShadow: shadows.card, textAlign: 'left', marginBottom: 18 }}>
        <p style={{ margin: '0 0 10px', fontSize: 11, color: colors.textFaint, fontWeight: 700 }}>ご提示いただいた候補（{sorted.length}件）</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
          {sorted.map((slot) => (
            <div key={slot.start} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '8px 10px', borderRadius: radii.sm, background: colors.surfaceMuted,
            }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: colors.textPrimary }}>
                {formatDateLabel(slot.start.slice(0, 10))} {formatTimeLabel(slot.start)}〜{formatTimeLabel(slot.end)}
              </span>
              <a href={googleCalendarAddUrl(slot, name)} target="_blank" rel="noopener noreferrer" style={{
                fontSize: 11, fontWeight: 700, color: colors.accent, textDecoration: 'none', whiteSpace: 'nowrap',
              }}>📅 仮登録</a>
            </div>
          ))}
        </div>
        <p style={{ margin: 0, fontSize: 13, color: colors.textSecondary, lineHeight: 1.8 }}>
          この中から担当者が確認のうえ1つを選び、確定いたします。<br />
          確定後、Google Meet（オンライン会議）の招待メールをお送りします。
        </p>
      </div>

      <button type="button" onClick={onReset} style={{
        background: 'none', border: 'none', color: colors.textMuted, fontSize: 13,
        cursor: 'pointer', textDecoration: 'underline', fontFamily: 'inherit', padding: 8,
      }}>別の日時を選び直す</button>
    </main>
  );
}
