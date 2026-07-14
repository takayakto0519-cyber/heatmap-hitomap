import { appColor } from '@/lib/appTokens';

interface Props {
  maxWidth?: number;
  children: React.ReactNode;
}

export function Container({ maxWidth = 480, children }: Props) {
  return (
    <div
      style={{
        minHeight: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        background: appColor.canvas,
      }}
    >
      <div style={{ width: '100%', maxWidth }}>{children}</div>
    </div>
  );
}

export function BackLink({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      style={{
        display: 'block',
        textAlign: 'center',
        marginBottom: 12,
        fontSize: 12,
        color: appColor.inkGhost,
        textDecoration: 'none',
      }}
    >
      ← {label}
    </a>
  );
}
