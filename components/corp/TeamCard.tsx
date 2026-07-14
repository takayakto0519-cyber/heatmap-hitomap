import { corpColor, corpFont } from './tokens';

export default function TeamCard({
  name,
  role,
  bio,
  photoSrc,
}: {
  name: string;
  role: string;
  bio: string;
  photoSrc?: string; // 未指定の間はイニシャル表示。写真が届き次第 /public/images/team/ に配置して渡す
}) {
  const initial = name.slice(0, 1);

  return (
    <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start', padding: '28px 0', borderTop: `1px solid ${corpColor.line}` }}>
      <div
        style={{
          flexShrink: 0,
          width: 84,
          height: 84,
          borderRadius: '50%',
          background: photoSrc ? 'transparent' : corpColor.kinariDeep,
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
          <span style={{ fontFamily: corpFont.mincho, fontSize: 28, color: corpColor.tsuchi }}>{initial}</span>
        )}
      </div>
      <div>
        <p style={{ margin: '0 0 2px', fontFamily: corpFont.mincho, fontSize: 19, fontWeight: 600, color: corpColor.sumi }}>
          {name}
        </p>
        <p style={{ margin: '0 0 10px', fontSize: 12, color: corpColor.shu, fontFamily: corpFont.body, fontWeight: 700 }}>
          {role}
        </p>
        <p style={{ margin: 0, fontSize: 13, lineHeight: 1.9, color: corpColor.sumiSoft, fontFamily: corpFont.body, maxWidth: 520 }}>
          {bio}
        </p>
        {!photoSrc && (
          <p style={{ margin: '10px 0 0', fontSize: 11, color: corpColor.tsuchiSoft, fontFamily: corpFont.body }}>
            ※ 写真は後日追加予定
          </p>
        )}
      </div>
    </div>
  );
}
