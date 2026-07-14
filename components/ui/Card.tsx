import { appColor, appRadius, appShadow } from '@/lib/appTokens';

interface Props {
  elevated?: boolean; // true = タップ可能な要素（シャドウ）、false = 静的な情報カード（フラットボーダー）
  padding?: number;
  onClick?: () => void;
  children: React.ReactNode;
  className?: string;
}

export default function Card({ elevated = false, padding = 16, onClick, children, className }: Props) {
  return (
    <div
      onClick={onClick}
      className={className}
      style={{
        background: appColor.surface,
        borderRadius: appRadius.md,
        padding,
        border: elevated ? 'none' : `1px solid ${appColor.line}`,
        boxShadow: elevated ? appShadow.sm : 'none',
        cursor: onClick ? 'pointer' : 'default',
      }}
    >
      {children}
    </div>
  );
}
