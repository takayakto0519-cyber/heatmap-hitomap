// コーポレートサイト用の線画SVGアイコン。
// 絵文字はカジュアルに見えるため、行政・法人向けの品位を出す目的で自作の細線アイコンに統一する。
// すべて 24x24 のストローク線画。currentColor でも color 指定でも使える。
// サーバーコンポーネントから直接使える（'use client' 不要）。

type IconProps = {
  size?: number;
  color?: string;
  strokeWidth?: number;
  style?: React.CSSProperties;
};

function Svg({ size = 22, color = 'currentColor', strokeWidth = 1.6, style, children }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={style}
    >
      {children}
    </svg>
  );
}

// 歩く（人が歩く姿）
export function IconWalk(p: IconProps) {
  return (
    <Svg {...p}>
      <circle cx="13" cy="4.5" r="1.6" />
      <path d="M12.5 8 L10 12 L7.5 14" />
      <path d="M12.5 8 L15 11 L17 12.5" />
      <path d="M10.5 11.5 L9 16 L7 20" />
      <path d="M10.5 11.5 L12.5 15 L11.5 20" />
    </Svg>
  );
}

// 記録する（カメラ）
export function IconCamera(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M3 8.5 A1.5 1.5 0 0 1 4.5 7 H7 L8.3 5 H15.7 L17 7 H19.5 A1.5 1.5 0 0 1 21 8.5 V17 A1.5 1.5 0 0 1 19.5 18.5 H4.5 A1.5 1.5 0 0 1 3 17 Z" />
      <circle cx="12" cy="12.5" r="3.2" />
    </Svg>
  );
}

// 積み重なる／地図レイヤー
export function IconLayers(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M12 3 L21 7.5 L12 12 L3 7.5 Z" />
      <path d="M3 12 L12 16.5 L21 12" />
      <path d="M3 16.5 L12 21 L21 16.5" />
    </Svg>
  );
}

// 自治体・行政（建物）
export function IconBuilding(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M4 20 H20" />
      <path d="M4 20 V9.5 L12 5 L20 9.5 V20" />
      <path d="M9 20 V13 H15 V20" />
      <path d="M7.5 10.5 H8.5 M11.5 10.5 H12.5 M15.5 10.5 H16.5" />
    </Svg>
  );
}

// 実データ（棒グラフ）
export function IconChart(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M4 4 V20 H20" />
      <path d="M8 16 V12" />
      <path d="M12 16 V8" />
      <path d="M16 16 V10" />
    </Svg>
  );
}

// 地図ピン
export function IconMapPin(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M12 21 C12 21 5 14.5 5 9.5 A7 7 0 0 1 19 9.5 C19 14.5 12 21 12 21 Z" />
      <circle cx="12" cy="9.5" r="2.4" />
    </Svg>
  );
}
