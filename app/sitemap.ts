import type { MetadataRoute } from 'next';
import { supabaseServer } from '@/lib/supabase/server';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://hitomap.com';

const STATIC_PAGES: MetadataRoute.Sitemap = [
  { url: `${SITE_URL}/`, changeFrequency: 'daily', priority: 1 },
  { url: `${SITE_URL}/start`, changeFrequency: 'monthly', priority: 0.8 },
  { url: `${SITE_URL}/map`, changeFrequency: 'daily', priority: 0.8 },
  { url: `${SITE_URL}/routes`, changeFrequency: 'weekly', priority: 0.6 },
  { url: `${SITE_URL}/school`, changeFrequency: 'monthly', priority: 0.5 },
  { url: `${SITE_URL}/terms`, changeFrequency: 'yearly', priority: 0.2 },
  { url: `${SITE_URL}/privacy`, changeFrequency: 'yearly', priority: 0.2 },
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [{ data: traces }, { data: regionRows }] = await Promise.all([
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

  return [...STATIC_PAGES, ...regionEntries, ...traceEntries];
}
