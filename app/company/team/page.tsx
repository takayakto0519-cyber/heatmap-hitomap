import type { Metadata } from 'next';
import CorpHeader from '@/components/corp/CorpHeader';
import CorpFooter from '@/components/corp/CorpFooter';
import TeamCard from '@/components/corp/TeamCard';
import BlockRenderer from '@/components/corp/BlockRenderer';
import Reveal from '@/components/corp/Reveal';
import { corpColor, corpFont } from '@/components/corp/tokens';
import type { SiteBlock } from '@/lib/siteBlocks';

export const metadata: Metadata = {
  title: '運営',
  description: 'ヒトマップ代表・加藤貴也の紹介です。',
  alternates: { canonical: '/company/team' },
};

export const revalidate = 60;

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

async function fetchBlocks(): Promise<SiteBlock[]> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return [];
  try {
    const { supabaseServer } = await import('@/lib/supabase/server');
    const { data } = await supabaseServer
      .from('site_blocks')
      .select('*')
      .eq('page', 'team')
      .eq('is_visible', true)
      .order('sort_order', { ascending: true });
    return (data ?? []) as SiteBlock[];
  } catch {
    return [];
  }
}

export default async function TeamPage() {
  const blocks = await fetchBlocks();

  return (
    <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', background: corpColor.ground }}>
      <CorpHeader />

      <main style={{ flex: 1 }}>
        <section style={{ padding: '64px 24px 40px' }}>
          <div style={{ maxWidth: 720, margin: '0 auto' }}>
            <Reveal immediate y={16}>
              <p style={{ margin: '0 0 18px', fontSize: 12, letterSpacing: '0.2em', color: corpColor.moss, fontFamily: corpFont.body, fontWeight: 700 }}>
                TEAM
              </p>
            </Reveal>
            <Reveal immediate delay={150} y={18}>
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
            </Reveal>
          </div>
        </section>

        <section style={{ background: corpColor.white, padding: '8px 24px 72px' }}>
          <div style={{ maxWidth: 720, margin: '0 auto' }}>
            {MEMBERS.map((m, i) => (
              <Reveal key={m.name} delay={i * 100}>
                <TeamCard {...m} />
              </Reveal>
            ))}
          </div>
        </section>

        {/* 以下は運営ダッシュボード（サイトCMS）から自由に追加できる（例：採用メッセージ、参画者の声など） */}
        <BlockRenderer blocks={blocks} />

        <section style={{ padding: '8px 24px 72px' }}>
          <div style={{ maxWidth: 720, margin: '0 auto' }}>
            <Reveal>
              <p style={{ margin: '0 0 20px', fontSize: 13, lineHeight: 2, color: corpColor.inkSoft, fontFamily: corpFont.body }}>
                法人・行政・学校でのご利用や、取材・提携のご相談は、お気軽にご連絡ください。
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'center' }}>
                <a
                  href="/company/contact"
                  className="hm-lift"
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
                  お問い合わせ
                </a>
                <a
                  href="/company/business"
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
                  法人・行政の方はこちら →
                </a>
              </div>
            </Reveal>
          </div>
        </section>
      </main>

      <CorpFooter />
    </div>
  );
}
