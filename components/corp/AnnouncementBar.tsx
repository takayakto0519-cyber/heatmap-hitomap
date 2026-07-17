import { corpColor, corpFont } from './tokens';
import type { AnnouncementSettings } from '@/lib/siteSettings';

// トップページ最上部のお知らせ帯。運営ダッシュボード「サイト設定」タブでON/OFFと文言を編集できる。
// イベント告知・メンテナンス連絡など、期間限定の一言をコード変更なしで出せるようにする。
export default function AnnouncementBar({ settings }: { settings: AnnouncementSettings }) {
  if (!settings.enabled || !settings.text.trim()) return null;

  const inner = (
    <p
      style={{
        margin: 0,
        maxWidth: 960,
        marginLeft: 'auto',
        marginRight: 'auto',
        padding: '10px 24px',
        fontSize: 12.5,
        lineHeight: 1.7,
        fontFamily: corpFont.body,
        fontWeight: 700,
        color: corpColor.white,
        textAlign: 'center',
      }}
    >
      📢 {settings.text}
      {settings.href.trim() && <span style={{ marginLeft: 6, textDecoration: 'underline' }}>詳しく →</span>}
    </p>
  );

  const style: React.CSSProperties = {
    display: 'block',
    background: corpColor.moss,
    textDecoration: 'none',
  };

  return settings.href.trim()
    ? <a href={settings.href} style={style}>{inner}</a>
    : <div style={style}>{inner}</div>;
}
