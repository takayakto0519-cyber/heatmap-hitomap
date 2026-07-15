import type { Metadata } from 'next';

// page.tsx はクライアントコンポーネントのため metadata を直接exportできない。
// SEO施策（地域名×ロングテールキーワードでの検索流入）のため、ここで地域ごとの
// title/descriptionを動的に生成する。
// 参照: ヒトマップ Growth Report「マーケティング案08 SEO：地域名 × ロングテール」

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://hitomap.com';

export async function generateMetadata({ params }: { params: { name: string } }): Promise<Metadata> {
  const regionName = decodeURIComponent(params.name);
  const title = `${regionName}のまち歩き記録・隠れスポット`;
  const description = `${regionName}で見つかった痕跡（生きた証）の記録一覧。地元の人が実際に歩いて見つけた場所・モノ・感情を、ヒトマップで見ることができます。`;

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

export default function RegionLayout({ children }: { children: React.ReactNode }) {
  return children;
}
