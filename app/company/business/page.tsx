import type { Metadata } from 'next';
import CorpHeader from '@/components/corp/CorpHeader';
import CorpFooter from '@/components/corp/CorpFooter';
import BlockRenderer from '@/components/corp/BlockRenderer';
import { corpColor, corpFont } from '@/components/corp/tokens';
import type { SiteBlock } from '@/lib/siteBlocks';

export const metadata: Metadata = {
  title: '法人・行政の方へ',
  description:
    '痕跡から人と組織の生き様を伝える、解読型の採用・組織ブランディング支援。言葉ではなくモノの痕跡から、組織の「らしさ」を可視化します。',
};

export const revalidate = 60;

async function fetchBlocks(): Promise<SiteBlock[]> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return [];
  try {
    const { supabaseServer } = await import('@/lib/supabase/server');
    const { data } = await supabaseServer
      .from('site_blocks')
      .select('*')
      .eq('page', 'business')
      .eq('is_visible', true)
      .order('sort_order', { ascending: true });
    return (data ?? []) as SiteBlock[];
  } catch {
    return [];
  }
}

export default async function CompanyBusinessPage() {
  const blocks = await fetchBlocks();

  return (
    <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', background: corpColor.ground }}>
      <CorpHeader />

      <main style={{ flex: 1 }}>
        <section style={{ padding: '64px 24px 40px' }}>
          <div style={{ maxWidth: 720, margin: '0 auto' }}>
            <p style={{ margin: '0 0 18px', fontSize: 12, letterSpacing: '0.2em', color: corpColor.moss, fontFamily: corpFont.body, fontWeight: 700 }}>
              FOR BUSINESS / GOVERNMENT
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
              言葉は取り繕える。
              <br />
              しかし、モノに残った痕跡は取り繕えない。
            </h1>
            <p style={{ margin: 0, fontSize: 15, lineHeight: 2, color: corpColor.inkSoft, fontFamily: corpFont.body, maxWidth: 560 }}>
              ヒトマップは、個人の「まちあるき記録」の技術と思想を、企業・行政の組織づくりにも応用しています。
              社員が分岐点で見ていたモノ・言葉・行動の痕跡から、取り繕われていない「その組織らしさ」を可視化し、
              採用・組織ブランディング・地域振興に活かします。ヒトマップを用いたこの支援は始まったばかりで、
              導入実績はまだありません。
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
