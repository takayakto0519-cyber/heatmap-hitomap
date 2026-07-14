// 絵文字アイコンの置き換え用、ヒトマップ独自の線画SVGアイコンセット。
// 全て 24x24 viewBox・線幅1.5・currentColor継承の統一スタイル。Lucide等の既存ライブラリは使わない。

export interface IconProps {
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}

function base(children: React.ReactNode, { size = 18, className, style }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={style}
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

/* ── ナビゲーション（BottomNav） ── */

export function MapIcon(p: IconProps = {}) {
  return base(<>
    <path d="M9 4 L4 6 V20 L9 18 M9 4 L15 6 M9 4 V18 M15 6 L20 4 V18 L15 20 M15 6 V20 M9 18 L15 20" />
  </>, p);
}

export function AddIcon(p: IconProps = {}) {
  return base(<>
    <path d="M12 5 V19 M5 12 H19" />
  </>, p);
}

export function ListIcon(p: IconProps = {}) {
  return base(<>
    <path d="M8 6 H20 M8 12 H20 M8 18 H20" />
    <path d="M4 6 H4.01 M4 12 H4.01 M4 18 H4.01" />
  </>, p);
}

export function TrailIcon(p: IconProps = {}) {
  // 足あと＝痕跡モチーフ
  return base(<>
    <ellipse cx="8" cy="8" rx="2.4" ry="3.2" transform="rotate(-18 8 8)" />
    <ellipse cx="15.5" cy="14.5" rx="2.4" ry="3.2" transform="rotate(-18 15.5 14.5)" />
    <ellipse cx="7" cy="16.5" rx="1.3" ry="1.7" transform="rotate(-18 7 16.5)" />
    <ellipse cx="17" cy="6.5" rx="1.3" ry="1.7" transform="rotate(-18 17 6.5)" />
  </>, p);
}

export function PeopleIcon(p: IconProps = {}) {
  return base(<>
    <circle cx="9" cy="8" r="3" />
    <path d="M3.5 20 C3.5 15.5 6 13.5 9 13.5 C12 13.5 14.5 15.5 14.5 20" />
    <circle cx="17.5" cy="9.5" r="2.4" />
    <path d="M15.3 13.7 C17.8 13.4 20.5 15 20.5 19" />
  </>, p);
}

export function MessageIcon(p: IconProps = {}) {
  return base(<>
    <path d="M4 5.5 H20 V16 H9 L5 19.5 V16 H4 Z" />
  </>, p);
}

/* ── TraceCard操作 ── */

export function PinIcon(p: IconProps = {}) {
  return base(<>
    <path d="M12 21 C12 21 18 14.6 18 10 A6 6 0 1 0 6 10 C6 14.6 12 21 12 21 Z" />
    <circle cx="12" cy="10" r="2.1" />
  </>, p);
}

export function ClockIcon(p: IconProps = {}) {
  return base(<>
    <circle cx="12" cy="12.5" r="8" />
    <path d="M12 8 V12.5 L15 14.5" />
    <path d="M9 2.5 H15" />
  </>, p);
}

export function MicIcon(p: IconProps = {}) {
  return base(<>
    <rect x="9.5" y="3" width="5" height="10" rx="2.5" />
    <path d="M6 11 A6 6 0 0 0 18 11" />
    <path d="M12 17 V21 M9 21 H15" />
  </>, p);
}

export function EditIcon(p: IconProps = {}) {
  return base(<>
    <path d="M15.5 4.5 L19.5 8.5 L8 20 H4 V16 Z" />
  </>, p);
}

export function TrashIcon(p: IconProps = {}) {
  return base(<>
    <path d="M5 7 H19 M9 7 V4.5 H15 V7 M7 7 L8 20 H16 L17 7" />
    <path d="M10 11 V16 M14 11 V16" />
  </>, p);
}

export function RepeatIcon(p: IconProps = {}) {
  return base(<>
    <path d="M4 12 A8 8 0 0 1 12 4 H18 M18 4 L15 1.5 M18 4 L15 6.5" />
    <path d="M20 12 A8 8 0 0 1 12 20 H6 M6 20 L9 22.5 M6 20 L9 17.5" />
  </>, p);
}

export function SpeakIcon(p: IconProps = {}) {
  return base(<>
    <path d="M4 9.5 H7.5 L13 5.5 V18.5 L7.5 14.5 H4 Z" />
    <path d="M17 8.5 A5 5 0 0 1 17 15.5" />
  </>, p);
}

export function BookIcon(p: IconProps = {}) {
  return base(<>
    <path d="M4 5 C6 4 9 4 12 5.5 C15 4 18 4 20 5 V19 C18 18 15 18 12 19.5 C9 18 6 18 4 19 Z" />
    <path d="M12 5.5 V19.5" />
  </>, p);
}

/* ── ページCTA ── */

export function EnvelopeIcon(p: IconProps = {}) {
  return base(<>
    <rect x="3.5" y="5.5" width="17" height="13" rx="1.5" />
    <path d="M4 6.5 L12 13 L20 6.5" />
  </>, p);
}

export function CoinIcon(p: IconProps = {}) {
  return base(<>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 8 V16 M9.5 9.8 C9.5 8.5 10.6 8 12 8 C13.6 8 14.5 8.8 14.5 9.8 C14.5 12 9.5 11.2 9.5 13.6 C9.5 14.7 10.6 15.5 12 15.5 C13.4 15.5 14.5 15 14.5 13.6" />
  </>, p);
}

/* ── 感情タグ（lib/emotions.ts）── */

export function SparkleIcon(p: IconProps = {}) {
  // ✨ ときめき
  return base(<path d="M12 3 L13.6 9.4 L20 11 L13.6 12.6 L12 19 L10.4 12.6 L4 11 L10.4 9.4 Z" />, p);
}

export function MapleLeafIcon(p: IconProps = {}) {
  // 🍂 なつかしさ
  return base(<>
    <path d="M12 3 C15 6 18 8 18 12 C18 16.5 15 19.5 12 21 C9 19.5 6 16.5 6 12 C6 8 9 6 12 3 Z" />
    <path d="M12 8 V21" />
  </>, p);
}

export function DropletIcon(p: IconProps = {}) {
  // 💧 切なさ
  return base(<path d="M12 3 C15 8 18 12 18 15.5 A6 6 0 1 1 6 15.5 C6 12 9 8 12 3 Z" />, p);
}

export function BoltIcon(p: IconProps = {}) {
  // ⚡ 驚き
  return base(<path d="M13 3 L6 13.5 H11.5 L10.5 21 L18 10 H12.5 Z" />, p);
}

export function SwirlStarIcon(p: IconProps = {}) {
  // 💫 感動
  return base(<>
    <path d="M4 15 A7 7 0 1 1 11 22" />
    <path d="M18 4 L19 7 L22 8 L19 9 L18 12 L17 9 L14 8 L17 7 Z" />
  </>, p);
}

export function BlossomIcon(p: IconProps = {}) {
  // 🌸 あたたかさ
  return base(<>
    {[0, 72, 144, 216, 288].map((deg) => (
      <ellipse key={deg} cx="12" cy="7" rx="2.4" ry="3.6" transform={`rotate(${deg} 12 12)`} />
    ))}
  </>, p);
}

export function LeafIcon(p: IconProps = {}) {
  // 🍃 安心
  return base(<>
    <path d="M5 19 C5 10 11 5 20 5 C20 14 15 19 5 19 Z" />
    <path d="M5 19 C9 15 13 11 20 5" />
  </>, p);
}

export function BalloonIcon(p: IconProps = {}) {
  // 🎈 楽しさ
  return base(<>
    <ellipse cx="12" cy="9" rx="6" ry="7" />
    <path d="M12 16 L11 18 L13 19 L11 20.5" />
  </>, p);
}

export function MedalIcon(p: IconProps = {}) {
  // 🏅 誇らしさ
  return base(<>
    <circle cx="12" cy="14" r="6" />
    <path d="M9 8.5 L7 2.5 L11 5 M15 8.5 L17 2.5 L13 5" />
  </>, p);
}

export function SpiralIcon(p: IconProps = {}) {
  // 🌀 不思議
  return base(<path d="M12 12 A2 2 0 1 1 10 10 A4.5 4.5 0 1 1 14.5 14.5 A7 7 0 1 1 5 8" />, p);
}

/* ── カテゴリタグ（lib/categories.ts）── */

export function HouseIcon(p: IconProps = {}) {
  return base(<path d="M4 11.5 L12 4 L20 11.5 M6 10 V20 H18 V10" />, p);
}

export function PlantIcon(p: IconProps = {}) {
  return base(<>
    <path d="M12 21 V11" />
    <path d="M12 12 C12 8 9 6 5.5 6 C5.5 10 8 12 12 12 Z" />
    <path d="M12 9 C12 6 14.5 4 18 4 C18 7.5 15.5 9.5 12 9.5 Z" />
  </>, p);
}

export function ToolIcon(p: IconProps = {}) {
  return base(<path d="M14.5 6.5 A3.5 3.5 0 1 1 9.9 10.7 L4 16.6 V19.5 H6.9 L12.8 13.6 A3.5 3.5 0 0 1 14.5 6.5 Z" />, p);
}

export function EarIcon(p: IconProps = {}) {
  return base(<path d="M9 4.5 A5.5 5.5 0 0 1 17 9 C17 13 13.5 12.5 13.5 16 A2.5 2.5 0 0 1 9 17.5 M9 4.5 A5.5 5.5 0 0 0 6 9 V15" />, p);
}

export function PersonIcon(p: IconProps = {}) {
  return base(<>
    <circle cx="12" cy="7.5" r="3.5" />
    <path d="M4.5 20.5 C4.5 15.5 7.8 13 12 13 C16.2 13 19.5 15.5 19.5 20.5" />
  </>, p);
}

export function AsteriskIcon(p: IconProps = {}) {
  return base(<path d="M12 3 V21 M4.5 7.5 L19.5 16.5 M19.5 7.5 L4.5 16.5" />, p);
}

/* ── アーカイブ種別（lib/archiveTypes.ts）── */

export function TagIcon(p: IconProps = {}) {
  // 🏷️ 地名
  return base(<>
    <path d="M11 3.5 H18.5 V11 L10 19.5 L2.5 12 Z" />
    <circle cx="15" cy="7.5" r="1.3" />
  </>, p);
}

export function ScrollIcon(p: IconProps = {}) {
  // 📜 言い伝え
  return base(<>
    <path d="M6 4 H16 A2.5 2.5 0 0 1 18.5 6.5 V17.5 A2.5 2.5 0 0 0 21 20" />
    <path d="M6 4 A2.5 2.5 0 0 0 3.5 6.5 V17.5 A2.5 2.5 0 0 0 6 20 H21" />
    <path d="M8.5 9 H15 M8.5 12.5 H15" />
  </>, p);
}
