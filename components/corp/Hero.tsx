import { corpColor, corpFont } from './tokens';

// peaceput.com（世界中の街に、ひとときの平和を置いていく。）の、単一の見出しではなく
// 詩のような短い連を段階的に重ねていくヒーロー構成を参考にしている。
const STANZAS = [
  '変わりゆく暮らしの中で、\n変わらずそこにある痕跡。',
  '誰かが立ち止まった場所に、\nその人の生きた証が残る。',
  '記録は、ひとつ、またひとつ。\nまちに積み重なり、感情の地図になる。',
  '名所を見るのではなく、人に会いに行く。\n物語は、始まったばかりです。',
];

export default function Hero() {
  return (
    <section
      style={{
        background: corpColor.ground,
        padding: '72px 24px 64px',
      }}
    >
      <div style={{ maxWidth: 720, margin: '0 auto' }}>
        <p
          style={{
            margin: '0 0 32px',
            fontSize: 12,
            letterSpacing: '0.2em',
            color: corpColor.moss,
            fontFamily: corpFont.body,
            fontWeight: 700,
          }}
        >
          HITOMAP
        </p>

        {STANZAS.map((stanza, i) => (
          <p
            key={i}
            style={{
              margin: `0 0 ${i === STANZAS.length - 1 ? 44 : 30}px`,
              marginLeft: i * 18, // 非対称：連ごとに少しずつ右にずらす
              fontFamily: corpFont.body,
              fontSize: 'clamp(19px, 2.6vw, 26px)',
              lineHeight: 1.75,
              color: i === STANZAS.length - 1 ? corpColor.ink : corpColor.inkSoft,
              fontWeight: i === STANZAS.length - 1 ? 700 : 500,
              whiteSpace: 'pre-line',
            }}
          >
            {stanza}
          </p>
        ))}

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'center', marginLeft: (STANZAS.length - 1) * 18 }}>
          <a
            href="/start"
            style={{
              display: 'inline-block',
              padding: '15px 32px',
              background: corpColor.ink,
              color: corpColor.white,
              textDecoration: 'none',
              fontWeight: 700,
              fontSize: 14,
              fontFamily: corpFont.body,
              letterSpacing: '0.05em',
            }}
          >
            地図をひらく
          </a>
          <a
            href="/service"
            style={{
              fontSize: 13,
              color: corpColor.moss,
              textDecoration: 'none',
              fontWeight: 700,
              fontFamily: corpFont.body,
              borderBottom: `1px solid ${corpColor.moss}`,
              paddingBottom: 2,
            }}
          >
            使い方を見る →
          </a>
        </div>
      </div>
    </section>
  );
}
