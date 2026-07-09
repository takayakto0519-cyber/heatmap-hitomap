import { ImageResponse } from 'next/og';
import { supabaseServer } from '@/lib/supabase/server';

export const runtime = 'edge';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

export default async function OgImage({ params }: { params: { slug: string } }) {
  const { data: route } = await supabaseServer
    .from('routes').select('title, event_cover_url, event_area, event_starts_at, event_ends_at, is_deleted')
    .eq('event_slug', params.slug).single();

  const isVisible = route && !route.is_deleted;
  const title = isVisible ? route.title : 'ヒトマップ';
  const coverUrl = isVisible ? route.event_cover_url : null;
  const subtitle = isVisible
    ? [route.event_area, route.event_starts_at ? new Date(route.event_starts_at).toLocaleDateString('ja-JP') : null].filter(Boolean).join(' ・ ') || 'まちを歩いて巡るヒトマップのイベント'
    : 'イベントが見つかりません';

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
          justifyContent: 'flex-end', position: 'relative',
          backgroundColor: '#8E44AD',
          backgroundImage: coverUrl ? `url(${coverUrl})` : 'linear-gradient(135deg, #8E44AD, #C29FE0)',
          backgroundSize: 'cover', backgroundPosition: 'center',
        }}
      >
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(to top, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0.15) 55%, rgba(0,0,0,0) 100%)',
          display: 'flex',
        }} />
        <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', padding: '56px 64px' }}>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 18 }}>
            <img src={`${SITE_URL}/logo.png`} height={44} style={{ marginRight: 12 }} />
            <div style={{
              display: 'flex', padding: '6px 16px', borderRadius: 20,
              background: '#8E44AD', color: '#fff', fontSize: 22, fontWeight: 700,
            }}>ヒトマップ・イベント</div>
          </div>
          <div style={{ display: 'flex', fontSize: 56, fontWeight: 800, color: '#fff', lineHeight: 1.3, maxWidth: 1000 }}>
            {title}
          </div>
          <div style={{ display: 'flex', fontSize: 24, color: 'rgba(255,255,255,0.85)', marginTop: 14 }}>
            {subtitle}
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
