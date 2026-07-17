import CorpHeader from '@/components/corp/CorpHeader';
import CorpFooter from '@/components/corp/CorpFooter';
import Hero from '@/components/corp/Hero';
import EmotionPalette from '@/components/corp/EmotionPalette';
import RecentTraces from '@/components/corp/RecentTraces';
import ProofBand from '@/components/corp/ProofBand';
import BlockRenderer from '@/components/corp/BlockRenderer';
import MobileCTABar from '@/components/corp/MobileCTABar';
import AnnouncementBar from '@/components/corp/AnnouncementBar';
import { corpColor } from '@/components/corp/tokens';
import AdSlot from '@/components/AdSlot';
import type { SiteBlock } from '@/lib/siteBlocks';
import { fetchSiteSettings } from '@/lib/siteSettings';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://hitomap.com';

const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'Organization',
      '@id': `${SITE_URL}/#organization`,
      name: 'ヒトマップ',
      url: SITE_URL,
      logo: `${SITE_URL}/logo.png`,
      description: '町を歩いて見つけた誰かの生きた証（痕跡）を記録し、地図に積み重ねていくコミュニティサービス',
    },
    {
      '@type': 'WebSite',
      '@id': `${SITE_URL}/#website`,
      name: 'ヒトマップ',
      alternateName: 'HitoMap',
      url: SITE_URL,
      publisher: { '@id': `${SITE_URL}/#organization` },
      inLanguage: 'ja',
      description:
        'データ分析用の「ヒートマップ」ツールではありません。町を歩いて見つけた誰かの生きた証を、写真と言葉で記録するコミュニティサービスです。',
    },
  ],
};

export const revalidate = 60; // 運営が/admin/blocksで編集した内容を1分ごとに反映

async function fetchHomeBlocks(): Promise<SiteBlock[]> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return [];
  try {
    const { supabaseServer } = await import('@/lib/supabase/server');
    const { data } = await supabaseServer
      .from('site_blocks')
      .select('*')
      .eq('page', 'home')
      .eq('is_visible', true)
      .order('sort_order', { ascending: true });
    return (data ?? []) as SiteBlock[];
  } catch {
    return [];
  }
}

export default async function HomePage() {
  const [blocks, settings] = await Promise.all([fetchHomeBlocks(), fetchSiteSettings()]);

  return (
    <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', background: corpColor.ground }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <AnnouncementBar settings={settings.announcement} />
      <CorpHeader />

      {/* Heroの文言とお知らせ帯は運営ダッシュボード「サイト設定」タブから編集できる。
          感情・実投稿フィードは固定表示。それ以外のセクション（機能紹介・体験の流れ・MVV・
          事業紹介・CTA帯等）は運営がページ編集タブから自由に追加・並び替え・削除できるブロックで構成される。 */}
      <main style={{ flex: 1 }}>
        <Hero settings={settings.hero} />
        <ProofBand />
        <BlockRenderer blocks={blocks} />
        <EmotionPalette />
        <RecentTraces />

        <div style={{ maxWidth: 960, margin: '0 auto', padding: '40px 24px' }}>
          <AdSlot />
        </div>
      </main>

      <CorpFooter />
      <MobileCTABar />
    </div>
  );
}
