import { corpColor, corpFont } from './tokens';

// peaceput.com「recruit」セクション（本人の言葉を見出しにし、名前・所属を添える構成）を参考にしている。
export default function TeamCard({
  name,
  role,
  quote,
  bio,
  photoSrc,
}: {
  name: string;
  role: string;
  quote: string;
  bio: string;
  photoSrc?: string; // 未指定の間はイニシャル表示。写真が届き次第 /public/images/team/ に配置して渡す
}) {
  const initial = name.slice(0, 1);

  return (
    <div style={{ padding: '32px 0', borderTop: `1px solid ${corpColor.line}` }}>
      <p
        style={{
          margin: '0 0 20px',
          fontFamily: corpFont.body,
          fontSize: 'clamp(18px, 2.4vw, 22px)',
          fontWeight: 700,
          lineHeight: 1.7,
          color: corpColor.ink,
        }}
      >
        {quote}
      </p>

      <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
        <div
          style={{
            flexShrink: 0,
            width: 56,
            height: 56,
            borderRadius: '50%',
            background: photoSrc ? 'transparent' : corpColor.groundDeep,
            border: `1px solid ${corpColor.line}`,
            overflow: 'hidden',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {photoSrc ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photoSrc} alt={name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <span style={{ fontFamily: corpFont.body, fontWeight: 700, fontSize: 18, color: corpColor.moss }}>{initial}</span>
          )}
        </div>
        <div>
          <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: corpColor.ink, fontFamily: corpFont.body }}>
            {name}
          </p>
          <p style={{ margin: 0, fontSize: 12, color: corpColor.moss, fontFamily: corpFont.body, fontWeight: 700 }}>
            {role}
          </p>
        </div>
      </div>

      <p style={{ margin: '16px 0 0', fontSize: 13, lineHeight: 1.9, color: corpColor.inkSoft, fontFamily: corpFont.body, maxWidth: 520 }}>
        {bio}
      </p>
      {!photoSrc && (
        <p style={{ margin: '10px 0 0', fontSize: 11, color: corpColor.inkSoft, fontFamily: corpFont.body }}>
          ※ 写真は後日追加予定
        </p>
      )}
    </div>
  );
}
