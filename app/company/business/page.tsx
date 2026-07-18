import type { Metadata } from 'next';
import CorpHeader from '@/components/corp/CorpHeader';
import CorpFooter from '@/components/corp/CorpFooter';
import BlockRenderer from '@/components/corp/BlockRenderer';
import Reveal from '@/components/corp/Reveal';
import CharReveal from '@/components/corp/CharReveal';
import { corpColor, corpFont, corpRadius, corpShadow } from '@/components/corp/tokens';
import type { SiteBlock } from '@/lib/siteBlocks';

const PAIN_POINTS = [
  '社員インタビューをしても、当たり障りのない「模範解答」しか出てこない',
  '採用サイトの言葉が、どこの会社を見ても同じに見えてしまう',
  '地域とのつながりが、単発のイベントで終わり、次に続かない',
];

const VALUES = [
  {
    n: '壱',
    title: '痕跡から人を読む採用インターン',
    body: '社員が実際に使い込んだモノを、学生が本人に会う前に観察・解読します。「なぜここがすり減っているのか」を考えるうちに、模範解答では出てこないその人らしさが言葉になっていきます。',
  },
  {
    n: '弐',
    title: 'モノの痕跡による組織ブランディング',
    body: '解読の過程を、社員トレーディングカードや共創型のショート動画として形に残します。取り繕った言葉ではなく、痕跡という嘘のつけない事実が採用広報の芯になります。',
  },
  {
    n: '参',
    title: '一度きりで終わらない関係設計',
    body: 'イベント当日だけで終わらせず、参加者と組織・地域との関わりを記録として積み重ねる設計にしています。見返りを先に求めない「推譲」の考え方を、仕組みに落とし込んでいます。',
  },
];

export const metadata: Metadata = {
  title: '法人・行政の方へ｜組織の分断・孤独を解決する環境設計',
  description:
    '社員の離職・部署間の分断・地域の孤立に悩む企業・行政向けの支援です。痕跡から人と組織の生き様を可視化し、採用インターン・組織ブランディングに活かします。',
  alternates: { canonical: '/company/business' },
};

export const revalidate = 60;

async function fetchBlocks(): Promise<SiteBlock[]> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return [];
  try {
    const { supabaseServer } = await import('@/lib/supabase/server');
    const { data } = await supabaseServer
      .from('site_blocks')
      .select('*')
      .eq('page', 'business')
      .eq('is_visible', true)
      .order('sort_order', { ascending: true });
    return (data ?? []) as SiteBlock[];
  } catch {
    return [];
  }
}

export default async function CompanyBusinessPage() {
  const blocks = await fetchBlocks();

  return (
    <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', background: corpColor.surface }}>
      <CorpHeader />

      <main style={{ flex: 1 }}>
        {/* 行政・法人トラックは、青(trust)の信頼トーンで個人向けと視覚的に区別する */}
        <section style={{ padding: '64px 24px 40px' }}>
          <div style={{ maxWidth: 720, margin: '0 auto' }}>
            <Reveal immediate y={16}>
              <p style={{ margin: '0 0 18px', fontSize: 12, letterSpacing: '0.2em', color: corpColor.trust, fontFamily: corpFont.body, fontWeight: 700 }}>
                FOR BUSINESS / GOVERNMENT
              </p>
            </Reveal>
            <CharReveal
              lines={['言葉は、取り繕うことができます。', 'しかし、モノに残った痕跡は、取り繕えません。']}
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
                社員の離職・部署間の分断・地域との関係の希薄化——原因は「取り繕われた言葉」の中には見つかりません。
                ヒトマップは、個人の「まちあるき記録」の技術と思想を、企業・行政の組織づくりに応用しています。
                社員が分岐点で見ていたモノ・言葉・行動の痕跡から、取り繕われていない「その組織らしさ」を可視化し、
                採用・組織ブランディング・地域振興に活かします。
              </p>
            </Reveal>
          </div>
        </section>

        {/* 信頼の要素バンド：行政担当者が最初に安心できる事実を先に提示 */}
        <section style={{ background: corpColor.trustSoft, borderTop: `1px solid ${corpColor.trust}22`, borderBottom: `1px solid ${corpColor.trust}22`, padding: '28px 24px' }}>
          <div style={{ maxWidth: 720, margin: '0 auto', display: 'flex', flexWrap: 'wrap', gap: '16px 28px' }}>
            {[
              { icon: '🗺️', label: '国土地理院の地図基盤', note: '行政利用に耐える公式タイル' },
              { icon: '📊', label: '表示するのは実データのみ', note: '捏造した数字を使わない' },
              { icon: '🏛️', label: '自治体ダッシュボード', note: '地図範囲で集計・発行できる' },
            ].map((t) => (
              <div key={t.label} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, flex: '1 1 200px' }}>
                <span style={{ fontSize: 18, lineHeight: 1.2 }} aria-hidden="true">{t.icon}</span>
                <span style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: corpColor.trustDeep, fontFamily: corpFont.body }}>{t.label}</span>
                  <span style={{ fontSize: 11.5, color: corpColor.gray, fontFamily: corpFont.body }}>{t.note}</span>
                </span>
              </div>
            ))}
          </div>
        </section>

        <section style={{ background: corpColor.surfaceSoft, padding: '48px 24px 64px' }}>
          <div style={{ maxWidth: 720, margin: '0 auto' }}>
            <Reveal y={16}>
              <p style={{ margin: '0 0 28px', fontSize: 12, letterSpacing: '0.2em', color: corpColor.trust, fontFamily: corpFont.body, fontWeight: 700 }}>
                こんな課題はありませんか
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
              <p style={{ margin: '0 0 12px', fontSize: 12, letterSpacing: '0.2em', color: corpColor.trust, fontFamily: corpFont.body, fontWeight: 700 }}>
                ヒトマップが提供する価値
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
                痕跡から、取り繕われていない組織の姿をお届けします。
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
                    <span
                      style={{
                        flexShrink: 0,
                        fontFamily: corpFont.mincho,
                        fontSize: 22,
                        fontWeight: 700,
                        color: corpColor.trust,
                      }}
                    >
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

        <section style={{ background: corpColor.trustSoft, padding: '56px 24px 72px' }}>
          <div style={{ maxWidth: 720, margin: '0 auto' }}>
            <Reveal>
              <p style={{ margin: '0 0 20px', fontSize: 13, lineHeight: 2, color: corpColor.inkSoft, fontFamily: corpFont.body }}>
                この支援は始まったばかりで、導入実績はまだありません。だからこそ、最初の一社・一自治体と一緒に、
                手探りで作っていきたいと考えています。まずは、お話を聞かせてください。
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'center' }}>
                <a
                  href="/company/contact"
                  className="hm-lift hm-btn"
                  style={{
                    display: 'inline-block',
                    padding: '15px 32px',
                    background: corpColor.trust,
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
                    color: corpColor.trust,
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
