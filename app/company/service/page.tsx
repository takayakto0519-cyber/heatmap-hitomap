import type { Metadata } from 'next';
import CorpHeader from '@/components/corp/CorpHeader';
import CorpFooter from '@/components/corp/CorpFooter';
import ServiceFlow from '@/components/corp/ServiceFlow';
import BlockRenderer from '@/components/corp/BlockRenderer';
import { corpColor, corpFont } from '@/components/corp/tokens';
import type { SiteBlock } from '@/lib/siteBlocks';

export const metadata: Metadata = {
  title: 'ヒトマップの使い方',
  description: 'ヒトマップアプリの使い方と、体験の流れについて。記録・ヒートマップ・つながる・歩く、の4段階で説明します。',
  alternates: { canonical: '/company/service' },
};

export const revalidate = 60;

async function fetchBlocks(): Promise<SiteBlock[]> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return [];
  try {
    const { supabaseServer } = await import('@/lib/supabase/server');
    const { data } = await supabaseServer
      .from('site_blocks')
      .select('*')
      .eq('page', 'service')
      .eq('is_visible', true)
      .order('sort_order', { ascending: true });
    return (data ?? []) as SiteBlock[];
  } catch {
    return [];
  }
}

export default async function ServicePage() {
  const blocks = await fetchBlocks();

  return (
    <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', background: corpColor.ground }}>
      <CorpHeader />

      <main style={{ flex: 1 }}>
        <section style={{ padding: '64px 24px 40px' }}>
          <div style={{ maxWidth: 720, margin: '0 auto' }}>
            <p
              style={{
                margin: '0 0 18px',
                fontSize: 12,
                letterSpacing: '0.2em',
                color: corpColor.moss,
                fontFamily: corpFont.body,
                fontWeight: 700,
              }}
            >
              SERVICE
            </p>
            <h1
              style={{
                margin: '0 0 20px',
                fontFamily: corpFont.mincho,
                fontSize: 'clamp(24px, 3.6vw, 32px)',
                lineHeight: 1.8,
                color: corpColor.ink,
                fontWeight: 600,
              }}
            >
              地図は、あなたが見つけた痕跡でできています。
            </h1>
            <p style={{ margin: 0, fontSize: 15, lineHeight: 2, color: corpColor.inkSoft, fontFamily: corpFont.body, maxWidth: 560 }}>
              町を歩いて見つけた「誰かが生きた証」を、写真と一言で記録するだけ。
              ログイン不要、匿名のまま今すぐ始められます。
            </p>
          </div>
        </section>

        <ServiceFlow />

        {/* 以下は運営ダッシュボード（サイトCMS）から自由に編集・追加・並び替えできる */}
        <BlockRenderer blocks={blocks} />

        <section style={{ background: corpColor.white, padding: '0 24px 72px' }}>
          <div style={{ maxWidth: 720, margin: '0 auto', display: 'flex', flexWrap: 'wrap', gap: 16 }}>
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
              href="/login"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                fontSize: 13,
                color: corpColor.inkSoft,
                textDecoration: 'none',
                fontWeight: 600,
                fontFamily: corpFont.body,
              }}
            >
              ログイン / 新規登録
            </a>
          </div>
        </section>
      </main>

      <CorpFooter />
    </div>
  );
}
