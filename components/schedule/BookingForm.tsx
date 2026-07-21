'use client';

import { colors, radii, shadows } from '@/lib/theme';
import { formatDateLabel, formatTimeLabel } from '@/lib/scheduleFormat';
import type { AvailabilitySlot } from './types';

const inputStyle: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box', padding: '11px 13px', fontSize: 14,
  border: `1.5px solid ${colors.border}`, borderRadius: radii.md, fontFamily: 'inherit', outline: 'none',
};
const labelStyle: React.CSSProperties = { display: 'block', fontWeight: 700, fontSize: 13, marginBottom: 6, color: colors.textSecondary };

export default function BookingForm({
  selected, name, email, company, purpose, submitting, submitError,
  onNameChange, onEmailChange, onCompanyChange, onPurposeChange, onSubmit,
}: {
  selected: AvailabilitySlot;
  name: string;
  email: string;
  company: string;
  purpose: string;
  submitting: boolean;
  submitError: string;
  onNameChange: (v: string) => void;
  onEmailChange: (v: string) => void;
  onCompanyChange: (v: string) => void;
  onPurposeChange: (v: string) => void;
  onSubmit: (e: React.FormEvent) => void;
}) {
  return (
    <form onSubmit={onSubmit} style={{ background: colors.surface, borderRadius: radii.lg, padding: 20, boxShadow: shadows.card }}>
      <p style={{ fontSize: 13, fontWeight: 700, color: colors.accent, margin: '0 0 16px' }}>
        {formatDateLabel(selected.start.slice(0, 10))} {formatTimeLabel(selected.start)}〜{formatTimeLabel(selected.end)} で仮リクエストします
      </p>
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
      <button type="submit" disabled={submitting} style={{
        width: '100%', minHeight: 48, padding: '13px', background: colors.primary, color: '#fff', border: 'none',
        borderRadius: radii.md, fontSize: 15, fontWeight: 700, cursor: submitting ? 'wait' : 'pointer', fontFamily: 'inherit',
      }}>{submitting ? '送信中…' : 'この日時でリクエストする'}</button>
      <p style={{ fontSize: 11, color: colors.textFaint, margin: '10px 0 0', lineHeight: 1.6 }}>
        送信してもすぐに確定するわけではありません。担当者が確認のうえご連絡します。
      </p>
    </form>
  );
}
