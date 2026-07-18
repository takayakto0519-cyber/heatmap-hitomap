import type { Metadata } from 'next';
import CorpHeader from '@/components/corp/CorpHeader';
import CorpFooter from '@/components/corp/CorpFooter';
import BlockRenderer from '@/components/corp/BlockRenderer';
import Reveal from '@/components/corp/Reveal';
import CharReveal from '@/components/corp/CharReveal';
import { corpColor, corpFont, corpRadius, corpShadow } from '@/components/corp/tokens';
import type { SiteBlock } from '@/lib/siteBlocks';

const PAIN_POINTS = [
  '探究学習・総合学習で「まちを歩かせたい」が、具体的なお題や進め方が決まらない',
  '文章にまとめるのが苦手な生徒が、活動から置いていかれてしまう',
  '地域の人・モノとの出会いが、単発の職場体験で終わってしまう',
];

const VALUES = [
  { n: '壱', title: '写真とひとことで、誰でも参加できる', body: '「なぜ惹かれたか」を長い文章で書けなくても大丈夫。写真を撮って、タップして、一言添えるだけで記録が地図に残ります。' },
  { n: '弐', title: 'お題ひとつで、探究のきっかけが生まれる', body: '「修理跡を5つ探そう」「100年以上使われているものを見つけよう」——具体的な問いを渡すだけで、生徒は自分の足でまちを解読し始めます。' },
  { n: '参', title: '個人の記録が、クラス全体の地図になる', body: '一人ひとりの発見が積み重なり、まちごとの感情の濃淡が見えてきます。誰かの発見に自分を重ねる余白が、次の学びにつながります。' },
];

export const metadata: Metadata = {
  title: '学校・総合学習でのご利用｜探究学習・地域学習の教材',
  description: '総合学習の「町探検」「地域学習」「探究学習」の受け入れ先・教材をお探しの先生方向けのご案内です。写真とひとことで参加できます。',
  alternates: { canonical: '/company/school' },
};

export const revalidate = 60;

async function fetchBlocks(): Promise<SiteBlock[]> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return [];
  try {
    const { supabaseServer } = await import('@/lib/supabase/server');
    const { data } = await supabaseServer
      .from('site_blocks')
      .select('*')
      .eq('page', 'school')
      .eq('is_visible', true)
      .order('sort_order', { ascending: true });
    return (data ?? []) as SiteBlock[];
  } catch {
    return [];
  }
}

export default async function CompanySchoolPage() {
  const blocks = await fetchBlocks();

  return (
    <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', background: corpColor.surface }}>
      <CorpHeader />

      <main style={{ flex: 1 }}>
        <section style={{ padding: '64px 24px 40px' }}>
          <div style={{ maxWidth: 720, margin: '0 auto' }}>
            <Reveal immediate y={16}>
              <p style={{ margin: '0 0 18px', fontSize: 12, letterSpacing: '0.2em', color: corpColor.moss, fontFamily: corpFont.body, fontWeight: 700 }}>
                FOR SCHOOL
              </p>
            </Reveal>
            <CharReveal
              lines={['言葉には、伝えきれないことがあります。', 'しかし、モノに残った痕跡は嘘をつきません。']}
              baseDelay={150}
              charDelay={18}
              style={{
                margin: '0 0 24px',
                fontFamily: corpFont.mincho,
                fontSize: 'clamp(24px, 3.6vw, 32px)',
                lineHeight: 1.8,
                color: corpColor.ink,
                fontWeight: 600,
              }}
            />
            <Reveal immediate delay={300} y={16}>
              <p style={{ margin: 0, fontSize: 15, lineHeight: 2, color: corpColor.inkSoft, fontFamily: corpFont.body, maxWidth: 560 }}>
                ヒトマップは、生徒が実際に町を歩いて見つけた「痕跡」を写真と一言で記録していく学習教材です。
                探究学習・総合学習の「町探検」「地域学習」の受け入れ先・教材をお探しの先生方に向けたご案内です。
              </p>
            </Reveal>
          </div>
        </section>

        <section style={{ background: corpColor.surfaceSoft, padding: '40px 24px 64px', borderTop: `1px solid ${corpColor.lineSoft}` }}>
          <div style={{ maxWidth: 720, margin: '0 auto' }}>
            <Reveal y={16}>
              <p style={{ margin: '0 0 28px', fontSize: 12, letterSpacing: '0.2em', color: corpColor.moss, fontFamily: corpFont.body, fontWeight: 700 }}>
                こんなお悩みはありませんか
              </p>
            </Reveal>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              {PAIN_POINTS.map((text, i) => (
                <Reveal key={text} delay={i * 90}>
                  <p
                    style={{
                      margin: 0,
                      padding: '20px 0',
                      borderTop: `1px solid ${corpColor.line}`,
                      fontSize: 14.5,
                      lineHeight: 1.9,
                      color: corpColor.ink,
                      fontFamily: corpFont.body,
                    }}
                  >
                    {text}
                  </p>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        <section style={{ padding: '64px 24px' }}>
          <div style={{ maxWidth: 720, margin: '0 auto' }}>
            <Reveal y={16}>
              <p style={{ margin: '0 0 12px', fontSize: 12, letterSpacing: '0.2em', color: corpColor.moss, fontFamily: corpFont.body, fontWeight: 700 }}>
                ヒトマップが提供できること
              </p>
              <h2
                style={{
                  margin: '0 0 36px',
                  fontFamily: corpFont.mincho,
                  fontSize: 'clamp(20px, 2.8vw, 26px)',
                  lineHeight: 1.7,
                  color: corpColor.ink,
                  fontWeight: 600,
                }}
              >
                書けなくても、歩いて見つけられれば参加いただけます。
              </h2>
            </Reveal>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
              {VALUES.map((v, i) => (
                <Reveal key={v.title} delay={i * 100} y={20}>
                  <div
                    className="hm-lift hm-tilt"
                    style={{
                      display: 'flex',
                      gap: 20,
                      padding: 24,
                      border: `1px solid ${corpColor.lineSoft}`,
                      borderRadius: corpRadius.md,
                      boxShadow: corpShadow.card,
                      background: corpColor.surface,
                    }}
                  >
                    <span style={{ flexShrink: 0, fontFamily: corpFont.mincho, fontSize: 22, fontWeight: 700, color: corpColor.moss }}>
                      {v.n}
                    </span>
                    <div>
                      <h3 style={{ margin: '0 0 8px', fontFamily: corpFont.mincho, fontSize: 17, fontWeight: 600, color: corpColor.ink, lineHeight: 1.6 }}>
                        {v.title}
                      </h3>
                      <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.9, color: corpColor.inkSoft, fontFamily: corpFont.body }}>
                        {v.body}
                      </p>
                    </div>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* 以下は運営ダッシュボード（サイトCMS）から自由に編集・追加・並び替えできる */}
        <BlockRenderer blocks={blocks} />

        <section style={{ background: corpColor.surfaceSoft, padding: '56px 24px 72px', borderTop: `1px solid ${corpColor.lineSoft}` }}>
          <div style={{ maxWidth: 720, margin: '0 auto' }}>
            <Reveal>
              <p style={{ margin: '0 0 20px', fontSize: 13, lineHeight: 2, color: corpColor.inkSoft, fontFamily: corpFont.body }}>
                この取り組みは始まったばかりで、導入実績はまだありません。授業時間・生徒の人数・お題の作り方など、
                まずは気軽にご相談ください。
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'center' }}>
                <a
                  href="/company/contact"
                  className="hm-lift hm-btn"
                  style={{
                    display: 'inline-block',
                    padding: '15px 32px',
                    background: corpColor.moss,
                    color: corpColor.white,
                    textDecoration: 'none',
                    fontWeight: 700,
                    fontSize: 14,
                    fontFamily: corpFont.body,
                    letterSpacing: '0.05em',
                    borderRadius: corpRadius.sm,
                    boxShadow: corpShadow.card,
                  }}
                >
                  お問い合わせ
                </a>
                <a
                  href="/company/works"
                  className="hm-ul"
                  style={{
                    fontSize: 13,
                    color: corpColor.moss,
                    fontWeight: 700,
                    fontFamily: corpFont.body,
                    paddingBottom: 2,
                  }}
                >
                  実績を見る →
                </a>
              </div>
            </Reveal>
          </div>
        </section>
      </main>

      <CorpFooter />
    </div>
  );
}
