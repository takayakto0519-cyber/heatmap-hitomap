import type { Metadata } from 'next';
import CorpHeader from '@/components/corp/CorpHeader';
import CorpFooter from '@/components/corp/CorpFooter';
import Reveal from '@/components/corp/Reveal';
import { corpColor, corpFont } from '@/components/corp/tokens';
import { categoryLabel, type SitePost } from '@/lib/sitePosts';

export const metadata: Metadata = {
  title: '実績',
  description: 'ヒトマップが実施したイベント・導入事例の記録です。参加者の声とともに紹介します。',
};

export const revalidate = 300; // 5分ごとに再生成（CMSでの更新をほどよく反映）

async function fetchPosts(): Promise<SitePost[]> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return [];
  try {
    const { supabaseServer } = await import('@/lib/supabase/server');
    const { data } = await supabaseServer
      .from('site_posts')
      .select('*')
      .eq('is_published', true)
      .eq('post_type', 'achievement')
      .order('event_date', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false })
      .limit(50);
    return (data ?? []) as SitePost[];
  } catch {
    return [];
  }
}

export default async function WorksPage() {
  const posts = await fetchPosts();

  return (
    <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', background: corpColor.ground }}>
      <CorpHeader />

      <main style={{ flex: 1 }}>
        <section style={{ padding: '64px 24px 40px' }}>
          <div style={{ maxWidth: 960, margin: '0 auto' }}>
            <p style={{ margin: '0 0 18px', fontSize: 12, letterSpacing: '0.2em', color: corpColor.moss, fontFamily: corpFont.body, fontWeight: 700 }}>
              WORKS
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
              歩いた記録は、ここにも残る。
            </h1>
            <p style={{ margin: 0, fontSize: 14, lineHeight: 2, color: corpColor.inkSoft, fontFamily: corpFont.body, maxWidth: 560 }}>
              ヒトマップが実施したイベントや取り組みの記録です。参加した人の声も、そのまま載せています。
            </p>
          </div>
        </section>

        <section style={{ background: corpColor.white, padding: '48px 24px 72px', flex: 1 }}>
          <div style={{ maxWidth: 960, margin: '0 auto' }}>
            {posts.length === 0 ? (
              <p style={{ margin: 0, fontSize: 14, lineHeight: 2, color: corpColor.inkSoft, fontFamily: corpFont.body }}>
                実施したイベントの記録を、これからここに積み重ねていきます。
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
                {posts.map((post, i) => (
                  <Reveal key={post.id} delay={Math.min(i * 80, 240)}>
                    <a
                      href={`/works/${post.slug}`}
                      className="hm-lift"
                      style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: 24,
                        border: `1px solid ${corpColor.line}`,
                        background: corpColor.white,
                        textDecoration: 'none',
                        padding: 24,
                        marginLeft: i % 2 === 1 ? 28 : 0, // 非対称に互い違い
                      }}
                    >
                      {post.cover_url && (
                        <div className="hm-photo-zoom" style={{ flex: '0 0 260px', maxWidth: '100%', height: 170 }}>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={post.cover_url}
                            alt=""
                            loading="lazy"
                            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                          />
                        </div>
                      )}
                      <div style={{ flex: '1 1 300px', minWidth: 0 }}>
                        <p style={{ margin: '0 0 8px', fontSize: 11, letterSpacing: '0.12em', color: corpColor.moss, fontFamily: corpFont.body, fontWeight: 700 }}>
                          {categoryLabel(post.category)}
                          {post.event_date && ` ・ ${new Date(post.event_date).toLocaleDateString('ja-JP')}`}
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
                            margin: '0 0 12px',
                            fontSize: 13.5,
                            lineHeight: 1.9,
                            color: corpColor.inkSoft,
                            fontFamily: corpFont.body,
                            display: '-webkit-box',
                            WebkitLineClamp: 3,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden',
                          }}
                        >
                          {post.body}
                        </p>
                        {post.testimonials.length > 0 && (
                          <p style={{ margin: 0, fontSize: 12, color: corpColor.moss, fontFamily: corpFont.body, fontWeight: 700 }}>
                            参加者の声 {post.testimonials.length}件 →
                          </p>
                        )}
                      </div>
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
