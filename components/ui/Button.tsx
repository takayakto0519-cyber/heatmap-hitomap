'use client';

import { appColor, appFont, appRadius } from '@/lib/appTokens';

type Variant = 'primary' | 'secondary' | 'ghost';
type Size = 'md' | 'lg';

interface BaseProps {
  variant?: Variant;
  size?: Size;
  fullWidth?: boolean;
  disabled?: boolean;
  children: React.ReactNode;
}

interface ButtonAsButton extends BaseProps {
  as?: 'button';
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  type?: 'button' | 'submit';
}

interface ButtonAsAnchor extends BaseProps {
  as: 'a';
  href: string;
}

type Props = ButtonAsButton | ButtonAsAnchor;

// 主要CTAを1種類に統一する（黒/ピンク/グラデーションと3パターンに分かれていた状態を解消）。
// primary = 単色の墨色。グラデーションは使わない。
function styleFor(variant: Variant, size: Size, fullWidth: boolean, disabled: boolean): React.CSSProperties {
  const base: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    width: fullWidth ? '100%' : undefined,
    padding: size === 'lg' ? '14px 24px' : '11px 18px',
    borderRadius: appRadius.md,
    fontSize: size === 'lg' ? 15 : 14,
    fontWeight: 700,
    fontFamily: appFont.body,
    textDecoration: 'none',
    cursor: disabled ? 'wait' : 'pointer',
    transition: 'opacity 0.15s',
    border: '1.5px solid transparent',
  };
  if (variant === 'primary') {
    return { ...base, background: disabled ? appColor.inkGhost : appColor.ink, color: '#fff' };
  }
  if (variant === 'secondary') {
    return { ...base, background: 'transparent', borderColor: appColor.teal, color: appColor.teal };
  }
  return { ...base, background: 'transparent', borderColor: 'transparent', color: appColor.inkSoft };
}

export default function Button(props: Props) {
  const { variant = 'primary', size = 'md', fullWidth = false, disabled = false, children } = props;
  const style = styleFor(variant, size, fullWidth, disabled);

  if (props.as === 'a') {
    return (
      <a href={props.href} style={style}>
        {children}
      </a>
    );
  }

  return (
    <button type={props.type ?? 'button'} onClick={props.onClick} disabled={disabled} style={style}>
      {children}
    </button>
  );
}
