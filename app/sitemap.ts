import type { MetadataRoute } from 'next';
import { supabaseServer } from '@/lib/supabase/server';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://hitomap.com';

const STATIC_PAGES: MetadataRoute.Sitemap = [
  { url: `${SITE_URL}/`, changeFrequency: 'daily', priority: 1 },
  { url: `${SITE_URL}/start`, changeFrequency: 'monthly', priority: 0.8 },
  { url: `${SITE_URL}/map`, changeFrequency: 'daily', priority: 0.8 },
  { url: `${SITE_URL}/routes`, changeFrequency: 'weekly', priority: 0.6 },
  // 法人・行政・学校向けの集客ページ。旧 /business /school /works /blog /team /contact は
  // /company/* への301リダイレクトに統合したため、正規URLのみをここに載せる。
  { url: `${SITE_URL}/company/service`, changeFrequency: 'monthly', priority: 0.7 },
  { url: `${SITE_URL}/company/business`, changeFrequency: 'monthly', priority: 0.9 },
  { url: `${SITE_URL}/company/school`, changeFrequency: 'monthly', priority: 0.8 },
  { url: `${SITE_URL}/company/works`, changeFrequency: 'weekly', priority: 0.7 },
  { url: `${SITE_URL}/company/blog`, changeFrequency: 'weekly', priority: 0.6 },
  { url: `${SITE_URL}/company/team`, changeFrequency: 'monthly', priority: 0.4 },
  { url: `${SITE_URL}/company/contact`, changeFrequency: 'yearly', priority: 0.6 },
  { url: `${SITE_URL}/terms`, changeFrequency: 'yearly', priority: 0.2 },
  { url: `${SITE_URL}/privacy`, changeFrequency: 'yearly', priority: 0.2 },
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [{ data: traces }, { data: regionRows }, { data: posts }] = await Promise.all([
    supabaseServer
      .from('traces')
      .select('id, created_at')
      .eq('visibility', 'public')
      .eq('is_deleted', false)
      .order('created_at', { ascending: false })
      .limit(1000),
    supabaseServer
      .from('traces')
      .select('region')
      .eq('visibility', 'public')
      .eq('is_deleted', false)
      .not('region', 'is', null),
    supabaseServer
      .from('site_posts')
      .select('slug, post_type, created_at, updated_at')
      .eq('is_published', true),
  ]);

  const traceEntries: MetadataRoute.Sitemap = (traces ?? []).map((t) => ({
    url: `${SITE_URL}/t/${t.id}`,
    lastModified: t.created_at ?? undefined,
    changeFrequency: 'monthly',
    priority: 0.5,
  }));

  const regions = Array.from(new Set((regionRows ?? []).map((r) => r.region).filter(Boolean)));
  const regionEntries: MetadataRoute.Sitemap = regions.map((region) => ({
    url: `${SITE_URL}/region/${encodeURIComponent(region as string)}`,
    changeFrequency: 'daily',
    priority: 0.6,
  }));

  const postEntries: MetadataRoute.Sitemap = (posts ?? []).map((p) => ({
    url: `${SITE_URL}/company/${p.post_type === 'blog' ? 'blog' : 'works'}/${p.slug}`,
    lastModified: p.updated_at ?? p.created_at ?? undefined,
    changeFrequency: 'monthly',
    priority: 0.5,
  }));

  return [...STATIC_PAGES, ...regionEntries, ...traceEntries, ...postEntries];
}
