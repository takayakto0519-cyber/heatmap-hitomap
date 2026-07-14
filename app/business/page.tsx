import type { Metadata } from 'next';
import SiteHeader from '@/components/SiteHeader';

export const metadata: Metadata = {
  title: '法人・行政の方へ',
  description:
    '痕跡から人と組織の生き様を伝える、採用インターンシップ・組織ブランディング支援。言葉ではなくモノの痕跡から、組織の「らしさ」を可視化します。',
};

const cardStyle: React.CSSProperties = {
  background: '#fff', border: '1px solid #f0f0f0', borderRadius: 14, padding: 20,
};

export default function BusinessPage() {
  return (
    <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', background: '#fafafa' }}>
      <SiteHeader />

      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '40px 24px' }}>
        <div style={{ width: '100%', maxWidth: 560 }}>
          <a href="/" style={{ display: 'block', marginBottom: 20, fontSize: 12, color: '#bbb', textDecoration: 'none' }}>
            ← ヒトマップに戻る
          </a>

          <h1 style={{ fontSize: 22, fontWeight: 800, margin: '0 0 12px', lineHeight: 1.5 }}>
            言葉は取り繕える。<br />しかし、モノに残った痕跡は取り繕えない。
          </h1>
          <p style={{ fontSize: 14, color: '#666', lineHeight: 1.9, margin: '0 0 32px' }}>
            ヒトマップは、個人の「まちあるき記録」の技術と思想を、
            企業・行政の組織づくりにも応用しています。
            社員が分岐点で見ていたモノ・言葉・行動の痕跡から、
            取り繕われていない「その組織らしさ」を可視化し、
            採用・ブランディング・地域振興に活かします。
          </p>

          <section style={{ ...cardStyle, marginBottom: 16 }}>
            <h2 style={{ fontSize: 15, fontWeight: 800, margin: '0 0 10px' }}>解読型の採用・組織ブランディング</h2>
            <p style={{ fontSize: 13, color: '#777', lineHeight: 1.9, margin: 0 }}>
              「面白い人に会いに行く」対話型のインターンではなく、
              その人が使い込んだモノ・現場の痕跡を先に読み解いてから本人と向き合う「解読型」の設計を採ります。
              表層的な共感ではなく、「この痕跡が自分の中の何かと共鳴した」という
              本人にも説明しきれない必然の接続をつくることを目的にしています。
            </p>
          </section>

          <section style={{ ...cardStyle, marginBottom: 16 }}>
            <h2 style={{ fontSize: 15, fontWeight: 800, margin: '0 0 10px' }}>ヒトマップ型採用インターンシップ</h2>
            <p style={{ fontSize: 13, color: '#777', lineHeight: 1.9, margin: '0 0 14px' }}>
              社員一人ひとりの痕跡を取材・記録し、社員トレーディングカードや
              ショート動画などの成果物に落とし込みながら、学生と社員の関係を
              一度きりのイベントで終わらせず、その後も続く「縁」として設計します。
            </p>
            <div style={{ display: 'grid', gap: 8 }}>
              {[
                ['Phase 1', 'ホスト選定・心理的安全性の醸成'],
                ['Phase 2', 'エディター育成ワークショップ'],
                ['Phase 3', '密着取材・編集作業'],
                ['Phase 4', '成果発表・経営陣へのプレゼン'],
              ].map(([phase, desc]) => (
                <div key={phase} style={{ display: 'flex', gap: 10, alignItems: 'baseline' }}>
                  <span style={{ fontSize: 11, fontWeight: 800, color: '#38ADA9', flexShrink: 0, width: 56 }}>{phase}</span>
                  <span style={{ fontSize: 13, color: '#555' }}>{desc}</span>
                </div>
              ))}
            </div>
          </section>

          <section style={{ ...cardStyle, marginBottom: 16 }}>
            <h2 style={{ fontSize: 15, fontWeight: 800, margin: '0 0 10px' }}>成果物の例</h2>
            <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: '#777', lineHeight: 2 }}>
              <li>社員トレーディングカード</li>
              <li>共創型ショート動画（30〜60秒・縦型）</li>
              <li>取材を通じて生まれる、社員と学生の持続的な関係（アンバサダー化）</li>
            </ul>
          </section>

          <section style={{ ...cardStyle, marginBottom: 28 }}>
            <h2 style={{ fontSize: 15, fontWeight: 800, margin: '0 0 10px' }}>行政・地域の方へ</h2>
            <p style={{ fontSize: 13, color: '#777', lineHeight: 1.9, margin: 0 }}>
              まちあるき記録アプリで集まった痕跡・感情データを、地域振興や
              観光施策の検討材料としてご活用いただける形でのご提供も行っています。
              まずは個別にご相談ください。
            </p>
          </section>

          <a href="mailto:hitomap.info@gmail.com" style={{
            display: 'block', width: '100%', boxSizing: 'border-box', padding: '15px', borderRadius: 12,
            background: 'linear-gradient(135deg, #FF6B9D, #FF9068)', textAlign: 'center',
            color: '#fff', fontWeight: 800, fontSize: 15, textDecoration: 'none',
          }}>
            お問い合わせ
          </a>
          <p style={{ textAlign: 'center', fontSize: 11, color: '#bbb', marginTop: 10 }}>
            hitomap.info@gmail.com
          </p>
        </div>
      </main>
    </div>
  );
}
