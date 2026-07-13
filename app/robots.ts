import type { MetadataRoute } from 'next';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://hitomap.com';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/admin', '/api', '/messages', '/login', '/reset-password', '/experiments'],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
