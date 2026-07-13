interface Props {
  height?: number;
}

// 広告ネットワーク未接続のプレースホルダー。将来ここにAdSenseの<ins>タグ等を差し込む。
export default function AdSlot({ height = 90 }: Props) {
  return (
    <div style={{
      width: '100%', maxWidth: 400, height, margin: '16px auto 0',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      border: '1px dashed #ddd', borderRadius: 8, background: '#fafafa',
      color: '#ccc', fontSize: 11,
    }}>
      広告枠
    </div>
  );
}
