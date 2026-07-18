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
  // 運営メンバー（氏名・肩書き・写真）は運営ダッシュボードのサイトCMSから編集できる
  // team_memberブロックのみを先に取り出し、TeamCardで一覧表示する。それ以外のブロック
  // （採用メッセージ等の自由セクション）は従来どおりBlockRendererに任せる。
  const memberBlocks = blocks.filter((b) => b.block_type === 'team_member');
  const otherBlocks = blocks.filter((b) => b.block_type !== 'team_member');

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
                運営メンバーのご紹介
              </h1>
            </Reveal>
          </div>
        </section>

        <section style={{ background: corpColor.white, padding: '8px 24px 72px' }}>
          <div style={{ maxWidth: 720, margin: '0 auto' }}>
            {memberBlocks.length === 0 && (
              <p style={{ margin: 0, fontSize: 13, color: corpColor.inkSoft, fontFamily: corpFont.body }}>
                運営メンバーは準備中です。
              </p>
            )}
            {memberBlocks.flatMap((block) =>
              (block.items as { title: string; body: string; role?: string; quote?: string; image_url?: string }[]).map((m, i) => (
                <Reveal key={`${block.id}-${i}`} delay={i * 100}>
                  <TeamCard name={m.title} role={m.role ?? ''} quote={m.quote ?? ''} bio={m.body} photoSrc={m.image_url} />
                </Reveal>
              ))
            )}
          </div>
        </section>

        {/* 以下は運営ダッシュボード（サイトCMS）から自由に追加できる（例：採用メッセージ、参画者の声など） */}
        <BlockRenderer blocks={otherBlocks} />

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
