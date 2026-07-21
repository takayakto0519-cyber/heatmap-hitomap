'use client';

import { colors, radii, shadows } from '@/lib/theme';
import { formatDateLabel, formatTimeLabel } from '@/lib/scheduleFormat';
import type { AvailabilitySlot } from './types';

const MIN_CANDIDATES = 3;

const inputStyle: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box', padding: '11px 13px', fontSize: 14,
  border: `1.5px solid ${colors.border}`, borderRadius: radii.md, fontFamily: 'inherit', outline: 'none',
};
const labelStyle: React.CSSProperties = { display: 'block', fontWeight: 700, fontSize: 13, marginBottom: 6, color: colors.textSecondary };

export default function BookingForm({
  selectedSlots, name, email, company, purpose, submitting, submitError,
  onRemoveSlot, onNameChange, onEmailChange, onCompanyChange, onPurposeChange, onSubmit,
}: {
  selectedSlots: AvailabilitySlot[];
  name: string;
  email: string;
  company: string;
  purpose: string;
  submitting: boolean;
  submitError: string;
  onRemoveSlot: (slot: AvailabilitySlot) => void;
  onNameChange: (v: string) => void;
  onEmailChange: (v: string) => void;
  onCompanyChange: (v: string) => void;
  onPurposeChange: (v: string) => void;
  onSubmit: (e: React.FormEvent) => void;
}) {
  const sorted = [...selectedSlots].sort((a, b) => a.start.localeCompare(b.start));
  const enough = sorted.length >= MIN_CANDIDATES;

  return (
    <form onSubmit={onSubmit} style={{ background: colors.surface, borderRadius: radii.lg, padding: 20, boxShadow: shadows.card }}>
      <p style={{ fontSize: 13, fontWeight: 700, color: colors.accent, margin: '0 0 10px' }}>
        候補として{sorted.length}件選択中{!enough && `（あと${MIN_CANDIDATES - sorted.length}件選んでください）`}
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
        {sorted.map((slot) => (
          <div key={slot.start} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '8px 12px', borderRadius: radii.sm, background: colors.surfaceMuted,
          }}>
            <span style={{ fontSize: 13, color: colors.textPrimary, fontWeight: 600 }}>
              {formatDateLabel(slot.start.slice(0, 10))} {formatTimeLabel(slot.start)}〜{formatTimeLabel(slot.end)}
            </span>
            <button type="button" onClick={() => onRemoveSlot(slot)} aria-label="この候補を外す" style={{
              background: 'none', border: 'none', color: colors.textFaint, fontSize: 16, cursor: 'pointer',
              padding: '2px 6px', lineHeight: 1,
            }}>×</button>
          </div>
        ))}
      </div>
      <div style={{ marginBottom: 12 }}>
        <label style={labelStyle}>お名前 *</label>
        <input required value={name} onChange={(e) => onNameChange(e.target.value)} style={inputStyle} placeholder="山田 太郎" />
      </div>
      <div style={{ marginBottom: 12 }}>
        <label style={labelStyle}>メールアドレス *</label>
        <input required type="email" value={email} onChange={(e) => onEmailChange(e.target.value)} style={inputStyle} placeholder="you@example.com" />
      </div>
      <div style={{ marginBottom: 12 }}>
        <label style={labelStyle}>会社名・団体名（任意）</label>
        <input value={company} onChange={(e) => onCompanyChange(e.target.value)} style={inputStyle} />
      </div>
      <div style={{ marginBottom: 16 }}>
        <label style={labelStyle}>ご用件（任意）</label>
        <textarea value={purpose} onChange={(e) => onPurposeChange(e.target.value)} rows={3}
          style={{ ...inputStyle, resize: 'vertical' }} placeholder="打合せの内容など" />
      </div>
      {submitError && <p style={{ color: colors.danger, fontSize: 13, margin: '0 0 12px' }}>{submitError}</p>}
      <button type="submit" disabled={submitting || !enough} style={{
        width: '100%', minHeight: 48, padding: '13px',
        background: enough ? colors.primary : colors.trackBg, color: enough ? '#fff' : colors.textFaint, border: 'none',
        borderRadius: radii.md, fontSize: 15, fontWeight: 700,
        cursor: submitting ? 'wait' : enough ? 'pointer' : 'not-allowed', fontFamily: 'inherit',
      }}>{submitting ? '送信中…' : enough ? 'この候補でリクエストする' : `候補をあと${MIN_CANDIDATES - sorted.length}件選んでください`}</button>
      <p style={{ fontSize: 11, color: colors.textFaint, margin: '10px 0 0', lineHeight: 1.6 }}>
        候補のうち、担当者が確認のうえ1つを選んで確定します。すぐに確定するわけではありません。
      </p>
    </form>
  );
}
