import type { Metadata } from 'next';
import CorpHeader from '@/components/corp/CorpHeader';
import CorpFooter from '@/components/corp/CorpFooter';
import BlockRenderer from '@/components/corp/BlockRenderer';
import { corpColor, corpFont } from '@/components/corp/tokens';
import type { SiteBlock } from '@/lib/siteBlocks';

export const metadata: Metadata = {
  title: '学校・総合学習でのご利用',
  description: '総合学習の「町探検」「地域学習」にヒトマップを使う先生方向けのご案内です。',
};

export const revalidate = 60;

async function fetchBlocks(): Promise<SiteBlock[]> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return [];
  try {
    const { supabaseServer } = await import('@/lib/supabase/server');
    const { data } = await supabaseServer
      .from('site_blocks')
      .select('*')
      .eq('page', 'school')
      .eq('is_visible', true)
      .order('sort_order', { ascending: true });
    return (data ?? []) as SiteBlock[];
  } catch {
    return [];
  }
}

export default async function CompanySchoolPage() {
  const blocks = await fetchBlocks();

  return (
    <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', background: corpColor.ground }}>
      <CorpHeader />

      <main style={{ flex: 1 }}>
        <section style={{ padding: '64px 24px 40px' }}>
          <div style={{ maxWidth: 720, margin: '0 auto' }}>
            <p style={{ margin: '0 0 18px', fontSize: 12, letterSpacing: '0.2em', color: corpColor.moss, fontFamily: corpFont.body, fontWeight: 700 }}>
              FOR SCHOOL
            </p>
            <h1
              style={{
                margin: '0 0 24px',
                fontFamily: corpFont.mincho,
                fontSize: 'clamp(24px, 3.6vw, 32px)',
                lineHeight: 1.8,
                color: corpColor.ink,
                fontWeight: 600,
              }}
            >
              言葉は嘘をつける。しかしモノの痕跡は嘘をつかない。
            </h1>
            <p style={{ margin: 0, fontSize: 15, lineHeight: 2, color: corpColor.inkSoft, fontFamily: corpFont.body, maxWidth: 560 }}>
              ヒトマップは、生徒が実際に町を歩いて見つけた「痕跡」を写真と一言で記録していく学習教材として使えます。
              文章にまとめるのが苦手な子でも、写真を撮ってタップするだけで参加できます。
              ヒトマップを用いたこの取り組みは始まったばかりで、導入実績はまだありません。
            </p>
          </div>
        </section>

        {/* 以下は運営ダッシュボード（サイトCMS）から自由に編集・追加・並び替えできる */}
        <BlockRenderer blocks={blocks} />
      </main>

      <CorpFooter />
    </div>
  );
}
