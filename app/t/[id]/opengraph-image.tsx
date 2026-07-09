import { ImageResponse } from 'next/og';
import { supabaseServer } from '@/lib/supabase/server';

export const runtime = 'edge';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

export default async function OgImage({ params }: { params: { id: string } }) {
  const { data: trace } = await supabaseServer
    .from('traces').select('title, photo_url, visibility, is_deleted')
    .eq('id', params.id).single();

  const isPublic = trace && !trace.is_deleted && trace.visibility === 'public';
  const title = isPublic ? trace.title : 'ヒトマップ';
  const photoUrl = isPublic ? trace.photo_url : null;
  const subtitle = isPublic ? 'まちの痕跡を記録し、地域の暮らしを読み解く' : '非公開の投稿です';

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
          justifyContent: 'flex-end', position: 'relative',
          backgroundColor: '#222',
          backgroundImage: photoUrl ? `url(${photoUrl})` : 'linear-gradient(135deg, #FF6B9D, #FF9068)',
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
            <img src={`${SITE_URL}/logo.jpg`} width={44} height={44} style={{ borderRadius: 12, marginRight: 12 }} />
            <div style={{
              display: 'flex', padding: '6px 16px', borderRadius: 20,
              background: '#FF6B9D', color: '#fff', fontSize: 22, fontWeight: 700,
            }}>ヒトマップ</div>
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
