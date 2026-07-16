import type { Metadata } from 'next';
import { computeRegionSummary, regionSummaryText } from '@/lib/regionAggregate';

// page.tsx はクライアントコンポーネントのため metadata を直接exportできない。
// SEO施策（地域名×ロングテールキーワードでの検索流入）のため、ここで地域ごとの
// title/descriptionを動的に生成する。
// 参照: ヒトマップ Growth Report「マーケティング案08 SEO：地域名 × ロングテール」
//
// 2026-07-16: 件数・感情内訳（自治体向けサマリーと同じ集計）を description と
// ページ本文の冒頭に出すよう拡張。検索結果での説得力に加え、営業提案の一次資料としても使える。

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://hitomap.com';

async function fetchSummaryText(regionName: string): Promise<string | null> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return null;
  try {
    const { supabaseServer } = await import('@/lib/supabase/server');
    const summary = await computeRegionSummary(supabaseServer, regionName);
    return regionSummaryText(summary);
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: { params: { name: string } }): Promise<Metadata> {
  const regionName = decodeURIComponent(params.name);
  const title = `${regionName}のまち歩き記録・隠れスポット`;
  const description = (await fetchSummaryText(regionName))
    ?? `${regionName}で見つかった痕跡（生きた証）の記録一覧。地元の人が実際に歩いて見つけた場所・モノ・感情を、ヒトマップで見ることができます。`;

  return {
    title,
    description,
    alternates: {
      canonical: `/region/${encodeURIComponent(regionName)}`,
    },
    openGraph: {
      title,
      description,
      url: `${SITE_URL}/region/${encodeURIComponent(regionName)}`,
      type: 'website',
    },
    twitter: {
      card: 'summary',
      title,
      description,
    },
  };
}

export default async function RegionLayout({ children, params }: { children: React.ReactNode; params: { name: string } }) {
  const regionName = decodeURIComponent(params.name);
  const summaryText = await fetchSummaryText(regionName);

  // page.tsx（クライアント側）は height:100dvh の固定レイアウトで、そこに割り込むと
  // 崩れやすい。サーバー描画の要約文は通常のフロー内に置き、その分だけbody全体が
  // わずかに伸びるだけにする（地図・投稿一覧のレイアウトには一切触れない）。
  return (
    <>
      {summaryText && (
        <p
          style={{
            margin: 0, padding: '6px 16px', fontSize: 11.5, lineHeight: 1.6, color: '#999',
            background: '#fff', borderBottom: '1px solid #eee',
          }}
        >
          {summaryText}
        </p>
      )}
      {children}
    </>
  );
}
