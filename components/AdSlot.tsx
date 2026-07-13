interface Props {
  height?: number;
}

// 広告ネットワーク未接続のため何も表示しない。実際の広告タグ（AdSenseの<ins>など）を
// 導入する際にここへ差し込む。
export default function AdSlot(_props: Props) {
  return null;
}
