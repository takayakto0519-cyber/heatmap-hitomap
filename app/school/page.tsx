import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '学校・総合学習でのご利用 | ヒトマップ',
  description: '総合学習の「町探検」「地域学習」にヒトマップを使う先生方向けのご案内です。',
};

const steps = [
  {
    title: 'クラス専用のパスワードを発行',
    body: '運営が「実験回コード」をクラスごとに発行します。生徒はこのコードを使って記録すると、クラスの記録だけをまとめて振り返れます。',
  },
  {
    title: '町を歩いて痕跡を記録',
    body: '生徒はスマートフォン（またはタブレット）で、気になったモノ・場所を写真と一言で記録します。文章が苦手な子でも、写真とタップだけで参加できます。',
  },
  {
    title: 'クラスの地図として振り返る',
    body: '記録が集まると、クラスだけの「地域理解レポート」が自動で出来上がります。どこにみんなの関心が集まったかが一目で分かり、発表・作文のもとになります。',
  },
];

export default function SchoolPage() {
  return (
    <div style={{ minHeight: '100dvh', background: '#fafafa', padding: '32px 20px 60px' }}>
      <div style={{ maxWidth: 640, margin: '0 auto' }}>
        <a href="/" style={{ fontSize: 13, color: '#38ADA9', textDecoration: 'none', fontWeight: 700 }}>← ヒトマップに戻る</a>

        <h1 style={{ fontSize: 24, fontWeight: 800, margin: '18px 0 8px' }}>
          総合学習・町探検で使う
        </h1>
        <p style={{ fontSize: 14, color: '#666', lineHeight: 1.8, margin: '0 0 28px' }}>
          言葉は嘘をつける。しかしモノの痕跡は嘘をつかない。<br />
          ヒトマップは、生徒が実際に町を歩いて見つけた「痕跡」を写真と一言で記録していく学習教材として使えます。
          文章にまとめるのが苦手な子でも、写真を撮ってタップするだけで参加できます。
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 28 }}>
          {steps.map((s, i) => (
            <div key={s.title} style={{
              background: '#fff', border: '1px solid #eee', borderRadius: 14, padding: '16px 18px',
              display: 'flex', gap: 14,
            }}>
              <div style={{
                width: 28, height: 28, borderRadius: '50%', background: '#FF6B9D', color: '#fff',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800, flexShrink: 0,
              }}>{i + 1}</div>
              <div>
                <p style={{ margin: '0 0 4px', fontWeight: 700, fontSize: 15 }}>{s.title}</p>
                <p style={{ margin: 0, fontSize: 13, color: '#666', lineHeight: 1.7 }}>{s.body}</p>
              </div>
            </div>
          ))}
        </div>

        <div style={{ background: '#fff', border: '1px solid #eee', borderRadius: 14, padding: '18px 20px', marginBottom: 20 }}>
          <p style={{ margin: '0 0 6px', fontWeight: 700, fontSize: 15 }}>💰 費用について</p>
          <p style={{ margin: 0, fontSize: 13, color: '#666', lineHeight: 1.7 }}>
            学校・教育機関でのご利用は個別にご相談のうえ決めさせていただいています。まずはお気軽にお問い合わせください。
          </p>
        </div>

        <a href="mailto:hitomap.info@gmail.com?subject=学校での利用について" style={{
          display: 'block', textAlign: 'center', padding: '15px', background: '#FF6B9D', color: '#fff',
          borderRadius: 12, fontWeight: 800, fontSize: 15, textDecoration: 'none',
        }}>
          ✉️ 学校での利用を問い合わせる
        </a>

        <p style={{ marginTop: 16, fontSize: 11, color: '#bbb', textAlign: 'center' }}>
          クラス専用コードの発行後、生徒はアプリの記録画面で「実験回コード」欄に入力するだけで使えます。
        </p>
      </div>
    </div>
  );
}
