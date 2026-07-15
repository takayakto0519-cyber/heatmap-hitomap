import type { Metadata } from 'next';
import CorpHeader from '@/components/corp/CorpHeader';
import CorpFooter from '@/components/corp/CorpFooter';
import Reveal from '@/components/corp/Reveal';
import { corpColor, corpFont } from '@/components/corp/tokens';
import type { SitePost } from '@/lib/sitePosts';

export const metadata: Metadata = {
  title: 'ブログ',
  description: 'ヒトマップの取り組みの背景にある考えを、じっくり書いています。',
};

export const revalidate = 300;

async function fetchPosts(): Promise<SitePost[]> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return [];
  try {
    const { supabaseServer } = await import('@/lib/supabase/server');
    const { data } = await supabaseServer
      .from('site_posts')
      .select('*')
      .eq('is_published', true)
      .eq('post_type', 'blog')
      .order('created_at', { ascending: false })
      .limit(50);
    return (data ?? []) as SitePost[];
  } catch {
    return [];
  }
}

export default async function BlogPage() {
  const posts = await fetchPosts();

  return (
    <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', background: corpColor.ground }}>
      <CorpHeader />

      <main style={{ flex: 1 }}>
        <section style={{ padding: '64px 24px 40px' }}>
          <div style={{ maxWidth: 720, margin: '0 auto' }}>
            <p style={{ margin: '0 0 18px', fontSize: 12, letterSpacing: '0.2em', color: corpColor.moss, fontFamily: corpFont.body, fontWeight: 700 }}>
              BLOG
            </p>
            <h1
              style={{
                margin: '0 0 16px',
                fontFamily: corpFont.mincho,
                fontSize: 'clamp(24px, 3.6vw, 32px)',
                lineHeight: 1.7,
                color: corpColor.ink,
                fontWeight: 600,
              }}
            >
              実績の裏側を、じっくり書く。
            </h1>
            <p style={{ margin: 0, fontSize: 14, lineHeight: 2, color: corpColor.inkSoft, fontFamily: corpFont.body, maxWidth: 560 }}>
              <a href="/works" style={{ color: corpColor.moss, fontWeight: 700, textDecoration: 'none' }}>実績</a>
              が「何をしたか」の記録なら、ここは「なぜそれをしたか」を書く場所です。
            </p>
          </div>
        </section>

        <section style={{ background: corpColor.white, padding: '48px 24px 72px', flex: 1 }}>
          <div style={{ maxWidth: 720, margin: '0 auto' }}>
            {posts.length === 0 ? (
              <p style={{ margin: 0, fontSize: 14, lineHeight: 2, color: corpColor.inkSoft, fontFamily: corpFont.body }}>
                これから、ここに書いていきます。
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                {posts.map((post, i) => (
                  <Reveal key={post.id} delay={Math.min(i * 80, 240)}>
                    <a
                      href={`/blog/${post.slug}`}
                      style={{
                        display: 'block',
                        textDecoration: 'none',
                        padding: '28px 0',
                        borderBottom: `1px solid ${corpColor.line}`,
                      }}
                    >
                      <p style={{ margin: '0 0 8px', fontSize: 11, letterSpacing: '0.12em', color: corpColor.moss, fontFamily: corpFont.body, fontWeight: 700 }}>
                        {new Date(post.created_at).toLocaleDateString('ja-JP')}
                      </p>
                      <h2
                        style={{
                          margin: '0 0 10px',
                          fontFamily: corpFont.mincho,
                          fontSize: 20,
                          fontWeight: 600,
                          color: corpColor.ink,
                          lineHeight: 1.6,
                        }}
                      >
                        {post.title}
                      </h2>
                      <p
                        style={{
                          margin: 0, fontSize: 13.5, lineHeight: 1.9, color: corpColor.inkSoft, fontFamily: corpFont.body,
                          display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
                        }}
                      >
                        {post.body}
                      </p>
                    </a>
                  </Reveal>
                ))}
              </div>
            )}
          </div>
        </section>
      </main>

      <CorpFooter />
    </div>
  );
}
