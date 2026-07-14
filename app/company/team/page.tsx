import type { Metadata } from 'next';
import CorpHeader from '@/components/corp/CorpHeader';
import CorpFooter from '@/components/corp/CorpFooter';
import TeamCard from '@/components/corp/TeamCard';
import { corpColor, corpFont } from '@/components/corp/tokens';

export const metadata: Metadata = {
  title: '運営',
  description: 'ヒトマップの運営メンバー、加藤貴也・小田太志の紹介です。',
};

// 写真が届き次第、public/images/team/ にファイルを置き、photoSrc に指定してください（現在は未掲載）。
const MEMBERS = [
  {
    name: '加藤貴也',
    role: '共同代表 / マーケティング',
    bio: 'ヒトマップの思想設計とマーケティングを担当。「モノの痕跡から人を読む」という視点をもとに、サービスの世界観をつくっています。',
  },
  {
    name: '小田太志',
    role: '共同代表 / 営業・採用コンサル',
    bio: '営業と採用コンサルティングを担当。企業・行政との連携や、組織ブランディング支援の実務を担っています。',
  },
];

export default function TeamPage() {
  return (
    <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', background: corpColor.kinari }}>
      <CorpHeader />

      <main style={{ flex: 1 }}>
        <section style={{ padding: '64px 24px 40px' }}>
          <div style={{ maxWidth: 720, margin: '0 auto' }}>
            <p style={{ margin: '0 0 18px', fontSize: 12, letterSpacing: '0.2em', color: corpColor.tsuchi, fontFamily: corpFont.body, fontWeight: 700 }}>
              TEAM
            </p>
            <h1
              style={{
                margin: 0,
                fontFamily: corpFont.mincho,
                fontSize: 'clamp(22px, 3.2vw, 28px)',
                lineHeight: 1.8,
                color: corpColor.sumi,
                fontWeight: 600,
              }}
            >
              2人の共同代表で運営しています。
            </h1>
          </div>
        </section>

        <section style={{ background: corpColor.white, padding: '8px 24px 72px' }}>
          <div style={{ maxWidth: 720, margin: '0 auto' }}>
            {MEMBERS.map((m) => (
              <TeamCard key={m.name} {...m} />
            ))}
          </div>
        </section>
      </main>

      <CorpFooter />
    </div>
  );
}
