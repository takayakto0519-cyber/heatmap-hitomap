// TraceCardのバッジ表示専用：lib/emotions.ts・categories.ts・archiveTypes.tsのキー→SVGアイコン対応表。
// 元データ（色分けロジック・emojiフィールド）はそのまま維持し、表示側だけこのマップを見てSVGに差し替える。
// 地図ピン・管理画面・クエスト等、他19箇所のemoji表示は今回のスコープ外のため据え置き。
import {
  SparkleIcon, MapleLeafIcon, DropletIcon, BoltIcon, SwirlStarIcon,
  BlossomIcon, LeafIcon, BalloonIcon, MedalIcon, SpiralIcon,
  HouseIcon, PlantIcon, ToolIcon, EarIcon, PersonIcon, AsteriskIcon,
  TagIcon, ScrollIcon, BookIcon, SpeakIcon,
  type IconProps,
} from '@/components/icons';

type IconComponent = (p: IconProps) => React.ReactElement;

export const EMOTION_ICONS: Record<string, IconComponent> = {
  tokimeki: SparkleIcon,
  natsukashii: MapleLeafIcon,
  setsunai: DropletIcon,
  odoroki: BoltIcon,
  kandou: SwirlStarIcon,
  atatakasa: BlossomIcon,
  anshin: LeafIcon,
  tanoshisa: BalloonIcon,
  hokorashisa: MedalIcon,
  fushigi: SpiralIcon,
};

export const CATEGORY_ICONS: Record<string, IconComponent> = {
  building: HouseIcon,
  nature: PlantIcon,
  tool: ToolIcon,
  sense: EarIcon,
  people: PersonIcon,
  other: AsteriskIcon,
};

export const ARCHIVE_TYPE_ICONS: Record<string, IconComponent> = {
  chimei: TagIcon,
  denshou: ScrollIcon,
  bunken: BookIcon,
  koe: SpeakIcon,
};
