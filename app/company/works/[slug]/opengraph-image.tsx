// 実績記事のSNS共有画像。静的ロゴ1枚ではなく記事タイトル＋カバー写真を出して
// シェア時に「何の記事か」が一目で伝わるようにする（/t/[id] のOG画像と同じ構成）。
import { ImageResponse } from 'next/og';
import { supabaseServer } from '@/lib/supabase/server';

export const runtime = 'edge';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

export default async function OgImage({ params }: { params: { slug: string } }) {
  const { data: post } = await supabaseServer
    .from('site_posts').select('title, cover_url, is_published')
    .eq('slug', params.slug).eq('post_type', 'achievement').maybeSingle();

  const isPublic = Boolean(post?.is_published);
  const title = isPublic && post ? post.title : 'ヒトマップの実績';
  const photoUrl = isPublic && post ? post.cover_url : null;

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
          justifyContent: 'flex-end', position: 'relative',
          backgroundColor: '#2E3528',
          backgroundImage: photoUrl ? `url(${photoUrl})` : 'linear-gradient(135deg, #566246, #23231F)',
          backgroundSize: 'cover', backgroundPosition: 'center',
        }}
      >
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(to top, rgba(0,0,0,0.78) 0%, rgba(0,0,0,0.2) 55%, rgba(0,0,0,0) 100%)',
          display: 'flex',
        }} />
        <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', padding: '56px 64px' }}>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 18 }}>
            <img src={`${SITE_URL}/logo.png`} height={44} style={{ marginRight: 12 }} />
            <div style={{
              display: 'flex', padding: '6px 16px', borderRadius: 20,
              background: '#566246', color: '#fff', fontSize: 22, fontWeight: 700,
            }}>ヒトマップの実績</div>
          </div>
          <div style={{ display: 'flex', fontSize: 54, fontWeight: 800, color: '#fff', lineHeight: 1.35, maxWidth: 1040 }}>
            {title}
          </div>
          <div style={{ display: 'flex', fontSize: 24, color: 'rgba(255,255,255,0.85)', marginTop: 14 }}>
            まちの痕跡と人の縁を記録する — hitomap.com
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
