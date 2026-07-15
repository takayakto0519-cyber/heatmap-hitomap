'use client';

// 編集内容を保存するたびに実際の本番ページを再読み込みして見せるプレビュー枠。
// draft状態を仮想描画するのではなく「本当に保存された、本物のサイト」を見せることに徹する
// （ヒトマップの「嘘をつかない」思想と同じで、プレビューも嘘をつかない）。
import { useState } from 'react';

interface Props {
  path: string;      // 例: '/', '/business', '/works'
  version: number;    // 増えるたびにiframeを再読み込みする
}

export default function LivePreview({ path, version }: Props) {
  const [open, setOpen] = useState(true);
  const url = path;

  return (
    <div style={{ border: '1px solid #e5e0d0', borderRadius: 10, background: '#fff', overflow: 'hidden' }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
        padding: '10px 14px', borderBottom: open ? '1px solid #e5e0d0' : 'none', background: '#faf8f3',
      }}>
        <button onClick={() => setOpen(v => !v)} style={{
          background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700, color: '#23231F',
          display: 'flex', alignItems: 'center', gap: 6, padding: 0,
        }}>
          {open ? '▾' : '▸'} 実サイトプレビュー
        </button>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <span style={{ fontSize: 11, color: '#999' }}>保存すると自動更新</span>
          <a href={url} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: '#566246', fontWeight: 700, textDecoration: 'none' }}>
            新しいタブで開く ↗
          </a>
        </div>
      </div>
      {open && (
        <iframe
          key={version}
          src={url}
          title="サイトプレビュー"
          style={{ width: '100%', height: 640, border: 'none', display: 'block', background: '#f7f6f3' }}
        />
      )}
    </div>
  );
}
