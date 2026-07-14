import type { Metadata } from 'next';
import CorpHeader from '@/components/corp/CorpHeader';
import CorpFooter from '@/components/corp/CorpFooter';
import TeamCard from '@/components/corp/TeamCard';
import { corpColor, corpFont } from '@/components/corp/tokens';

export const metadata: Metadata = {
  title: '運営',
  description: 'ヒトマップ代表・加藤貴也の紹介です。',
};

// 小田太志の情報は本人確認後に追加する（現時点では加藤のみ掲載）。
const MEMBERS = [
  {
    name: '加藤貴也',
    role: '代表 / マーケティング',
    quote: 'モノに残った痕跡から、その人の生きた証を読み解く。',
    bio: 'ヒトマップの思想設計とマーケティングを担当。「モノの痕跡から人を読む」という視点をもとに、サービスの世界観をつくっています。',
    photoSrc: '/images/team/kato-takaya.jpg',
  },
];

export default function TeamPage() {
  return (
    <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', background: corpColor.ground }}>
      <CorpHeader />

      <main style={{ flex: 1 }}>
        <section style={{ padding: '64px 24px 40px' }}>
          <div style={{ maxWidth: 720, margin: '0 auto' }}>
            <p style={{ margin: '0 0 18px', fontSize: 12, letterSpacing: '0.2em', color: corpColor.moss, fontFamily: corpFont.body, fontWeight: 700 }}>
              TEAM
            </p>
            <h1
              style={{
                margin: 0,
                fontFamily: corpFont.mincho,
                fontSize: 'clamp(22px, 3.2vw, 28px)',
                lineHeight: 1.8,
                color: corpColor.ink,
                fontWeight: 600,
              }}
            >
              代表 加藤貴也が運営しています。
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
