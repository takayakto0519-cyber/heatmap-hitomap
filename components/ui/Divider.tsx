import { appColor } from '@/lib/appTokens';

export default function Divider({ label }: { label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '4px 0 16px' }}>
      <div style={{ flex: 1, height: 1, background: appColor.line }} />
      <span style={{ fontSize: 11, color: appColor.inkGhost }}>{label}</span>
      <div style={{ flex: 1, height: 1, background: appColor.line }} />
    </div>
  );
}
