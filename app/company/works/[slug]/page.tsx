import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import CorpHeader from '@/components/corp/CorpHeader';
import CorpFooter from '@/components/corp/CorpFooter';
import Reveal from '@/components/corp/Reveal';
import { corpColor, corpFont } from '@/components/corp/tokens';
import { categoryLabel, type SitePost } from '@/lib/sitePosts';

export const revalidate = 300;

async function fetchPost(slug: string): Promise<SitePost | null> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return null;
  try {
    const { supabaseServer } = await import('@/lib/supabase/server');
    const { data } = await supabaseServer
      .from('site_posts')
      .select('*')
      .eq('slug', slug)
      .eq('is_published', true)
      .maybeSingle();
    return (data as SitePost) ?? null;
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const post = await fetchPost(params.slug);
  if (!post) return { title: '実績' };
  return {
    title: post.title,
    description: post.body.slice(0, 90),
    openGraph: post.cover_url ? { images: [post.cover_url] } : undefined,
  };
}

export default async function WorkDetailPage({ params }: { params: { slug: string } }) {
  const post = await fetchPost(params.slug);
  if (!post) notFound();

  const paragraphs = post.body.split(/\n{2,}/).map(s => s.trim()).filter(Boolean);

  return (
    <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', background: corpColor.ground }}>
      <CorpHeader />

      <main style={{ flex: 1 }}>
        <article>
          <section style={{ padding: '64px 24px 36px' }}>
            <div style={{ maxWidth: 720, margin: '0 auto' }}>
              <a href="/works" style={{ fontSize: 12, color: corpColor.moss, textDecoration: 'none', fontFamily: corpFont.body, fontWeight: 700 }}>
                ← 実績一覧に戻る
              </a>
              <p style={{ margin: '22px 0 12px', fontSize: 11, letterSpacing: '0.12em', color: corpColor.moss, fontFamily: corpFont.body, fontWeight: 700 }}>
                {categoryLabel(post.category)}
                {post.event_date && ` ・ ${new Date(post.event_date).toLocaleDateString('ja-JP')}`}
              </p>
              <h1
                style={{
                  margin: 0,
                  fontFamily: corpFont.mincho,
                  fontSize: 'clamp(24px, 3.8vw, 34px)',
                  lineHeight: 1.7,
                  color: corpColor.ink,
                  fontWeight: 600,
                }}
              >
                {post.title}
              </h1>
            </div>
          </section>

          {post.cover_url && (
            <div style={{ maxWidth: 960, margin: '0 auto', padding: '0 24px' }}>
              <div className="hm-photo-zoom" style={{ maxHeight: 440 }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={post.cover_url} alt="" style={{ width: '100%', maxHeight: 440, objectFit: 'cover', display: 'block' }} />
              </div>
            </div>
          )}

          <section style={{ background: corpColor.white, padding: '48px 24px 72px', marginTop: post.cover_url ? -1 : 0 }}>
            <div style={{ maxWidth: 720, margin: '0 auto' }}>
              {paragraphs.map((p, i) => (
                <p
                  key={i}
                  style={{
                    margin: '0 0 24px',
                    fontSize: 15,
                    lineHeight: 2.2,
                    color: corpColor.inkSoft,
                    fontFamily: corpFont.body,
                    whiteSpace: 'pre-wrap',
                  }}
                >
                  {p}
                </p>
              ))}

              {post.photo_urls.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, margin: '36px 0' }}>
                  {post.photo_urls.map(url => (
                    <div key={url} className="hm-photo-zoom" style={{ flex: '1 1 220px', height: 180 }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={url} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                    </div>
                  ))}
                </div>
              )}

              {post.testimonials.length > 0 && (
                <div style={{ marginTop: 48 }}>
                  <p style={{ margin: '0 0 20px', fontSize: 12, letterSpacing: '0.2em', color: corpColor.moss, fontFamily: corpFont.body, fontWeight: 700 }}>
                    参加者の声
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    {post.testimonials.map((t, i) => (
                      <Reveal key={i} delay={Math.min(i * 90, 270)}>
                        <figure
                          style={{
                            margin: 0,
                            borderLeft: `2px solid ${corpColor.moss}`,
                            background: corpColor.ground,
                            padding: '18px 22px',
                            marginLeft: i % 2 === 1 ? 24 : 0,
                          }}
                        >
                          <blockquote
                            style={{
                              margin: '0 0 10px',
                              fontFamily: corpFont.mincho,
                              fontSize: 15,
                              lineHeight: 2,
                              color: corpColor.ink,
                              whiteSpace: 'pre-wrap',
                            }}
                          >
                            {t.comment}
                          </blockquote>
                          <figcaption style={{ fontSize: 12, color: corpColor.inkSoft, fontFamily: corpFont.body }}>
                            — {t.name}
                          </figcaption>
                        </figure>
                      </Reveal>
                    ))}
                  </div>
                </div>
              )}

              <div style={{ marginTop: 56, borderTop: `1px solid ${corpColor.line}`, paddingTop: 28 }}>
                <p style={{ margin: '0 0 16px', fontSize: 13, color: corpColor.inkSoft, fontFamily: corpFont.body, lineHeight: 1.9 }}>
                  同じような取り組みをご検討中の学校・法人・行政の方は、お気軽にご相談ください。
                </p>
                <a
                  href="/contact"
                  className="hm-lift"
                  style={{
                    display: 'inline-block',
                    padding: '13px 30px',
                    background: corpColor.ink,
                    color: corpColor.white,
                    textDecoration: 'none',
                    fontWeight: 700,
                    fontSize: 13,
                    fontFamily: corpFont.body,
                    letterSpacing: '0.05em',
                  }}
                >
                  お問い合わせ
                </a>
              </div>
            </div>
          </section>
        </article>
      </main>

      <CorpFooter />
    </div>
  );
}
