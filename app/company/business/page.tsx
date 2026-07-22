import type { Metadata } from 'next';
import CorpHeader from '@/components/corp/CorpHeader';
import CorpFooter from '@/components/corp/CorpFooter';
import BlockRenderer from '@/components/corp/BlockRenderer';
import Reveal from '@/components/corp/Reveal';
import CharReveal from '@/components/corp/CharReveal';
import { corpColor, corpFont, corpRadius, corpShadow } from '@/components/corp/tokens';
import { IconLayers, IconChart, IconBuilding } from '@/components/corp/icons';
import type { SiteBlock } from '@/lib/siteBlocks';

const PAIN_POINTS = [
  '社員インタビューをしても、当たり障りのない「模範解答」しか出てこない',
  '採用サイトの言葉が、どこの会社を見ても同じに見えてしまう',
  '地域とのつながりが、単発のイベントで終わり、次に続かない',
];

// 提供メニュー4本。価格は目安（会長確認前の仮値）。実数値が固まり次第、運営が更新する。
const SERVICES = [
  {
    id: 'advisory',
    icon: '🧭',
    title: 'AI顧問業',
    lead: '生成AIの導入は、道具を渡すことでは終わらない。',
    body: '現場の痕跡（今どこで詰まっているか）を毎月読み解き、次の一手を決める。ツールの説明会ではなく、伴走する顧問契約です。',
    price: '月額 5万円〜（初回相談無料）',
  },
  {
    id: 'kit',
    icon: '📦',
    title: '導入キット',
    lead: '同じ悩みを、また一から解く必要はない。',
    body: '業種ごとに磨いた「AI利用ルール・業務棚卸し・月次レポート」を型として提供します。自走できる組織を前提に設計しています。',
    price: '20万円〜（業種・規模により見積り）',
  },
  {
    id: 'training',
    icon: '🎓',
    title: '生成AI研修',
    lead: '知ることと、行うことを分けない。',
    body: '座学だけでは現場は変わりません。実際の業務データを使い、その場で手を動かす研修です。学校・自治体・企業、いずれも対応します。',
    price: '1回 10万円〜（半日〜1日）',
  },
  {
    id: 'tourism-ambassador',
    icon: '🗺',
    title: 'デジタル観光大使AI',
    lead: '名所ではなく、そこで生きた人に会いに行く。',
    body: '地域に眠る痕跡データを使い、訪れた人をその土地の言葉で案内するAIナビゲーターを設計・実装します。自治体の関係人口施策の核になります。',
    price: 'ご相談（実証実験からのスモールスタートも可）',
  },
] as const;

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
  title: 'AI顧問・生成AI導入支援・自治体DX｜ヒトマップ 法人・行政の方へ',
  description:
    '生成AI導入支援・AI顧問業・自治体DX・採用インターン・組織ブランディングまで。痕跡から人と組織の生き様を可視化し、社員の離職・部署間の分断・地域の孤立という課題に取り組みます。',
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
              { Icon: IconLayers, label: '国土地理院の地図基盤', note: '行政利用に耐える公式タイル' },
              { Icon: IconChart, label: '表示するのは実データのみ', note: '捏造した数字を使わない' },
              { Icon: IconBuilding, label: '自治体ダッシュボード', note: '地図範囲で集計・発行できる' },
            ].map((t) => (
              <div key={t.label} style={{ display: 'flex', alignItems: 'center', gap: 12, flex: '1 1 200px' }}>
                <span style={{
                  width: 36, height: 36, borderRadius: corpRadius.pill, background: corpColor.surface,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>
                  <t.Icon size={20} color={corpColor.trust} />
                </span>
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
                  fontFamily: corpFont.body,
                  fontSize: 'clamp(20px, 2.8vw, 26px)',
                  lineHeight: 1.7,
                  color: corpColor.ink,
                  fontWeight: 700,
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
                      <h3 style={{ margin: '0 0 8px', fontFamily: corpFont.body, fontSize: 17, fontWeight: 700, color: corpColor.ink, lineHeight: 1.6 }}>
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

        {/* 提供メニュー：AI顧問・導入キット・研修・観光大使AI。検索から直接たどり着けるよう見出しに事業名を明記する */}
        <section style={{ padding: '56px 24px', background: corpColor.surfaceSoft }} id="services">
          <div style={{ maxWidth: 720, margin: '0 auto' }}>
            <Reveal y={16}>
              <p style={{ margin: '0 0 12px', fontSize: 12, letterSpacing: '0.2em', color: corpColor.trust, fontFamily: corpFont.body, fontWeight: 700 }}>
                提供メニュー
              </p>
              <h2 style={{ margin: '0 0 36px', fontFamily: corpFont.body, fontSize: 'clamp(20px, 2.8vw, 26px)', lineHeight: 1.7, color: corpColor.ink, fontWeight: 700 }}>
                AI顧問業・導入キット・生成AI研修・デジタル観光大使AI。
              </h2>
            </Reveal>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {SERVICES.map((s, i) => (
                <Reveal key={s.id} delay={i * 90} y={16}>
                  <div id={s.id} className="hm-lift" style={{
                    padding: 24, border: `1px solid ${corpColor.lineSoft}`, borderRadius: corpRadius.md,
                    boxShadow: corpShadow.card, background: corpColor.surface,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                      <span style={{
                        width: 40, height: 40, borderRadius: corpRadius.pill, background: corpColor.moss,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 19, flexShrink: 0,
                      }}>{s.icon}</span>
                      <h3 style={{ margin: 0, fontFamily: corpFont.body, fontSize: 17, fontWeight: 700, color: corpColor.ink }}>{s.title}</h3>
                    </div>
                    <p style={{ margin: '0 0 8px', fontSize: 14, fontWeight: 700, color: corpColor.trust, fontFamily: corpFont.body }}>{s.lead}</p>
                    <p style={{ margin: '0 0 14px', fontSize: 13.5, lineHeight: 1.9, color: corpColor.inkSoft, fontFamily: corpFont.body }}>{s.body}</p>
                    <p style={{ margin: 0, fontSize: 12.5, color: corpColor.gray, fontFamily: corpFont.body }}>{s.price}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* すでに取り組みがある自治体様への一言（標茶町からの返信を踏まえ追加。営業メールの
            ペルソナC方針（営業メール/自治体向け初回接触メール方針.md）と表現を揃えている） */}
        <section style={{ padding: '48px 24px 0' }}>
          <div style={{ maxWidth: 720, margin: '0 auto' }}>
            <Reveal>
              <div style={{
                padding: 24, borderRadius: corpRadius.md, background: corpColor.trustSoft,
                border: `1px solid ${corpColor.trust}22`,
              }}>
                <p style={{ margin: '0 0 8px', fontSize: 13, fontWeight: 700, color: corpColor.trustDeep, fontFamily: corpFont.body }}>
                  すでに関係人口・観光施策に取り組んでいる自治体様へ
                </p>
                <p style={{ margin: 0, fontSize: 13, lineHeight: 1.9, color: corpColor.inkSoft, fontFamily: corpFont.body }}>
                  今ある取り組みを置き換える必要はありません。ヒトマップは、すでにある入口の先——一度きりの来訪を
                  「もう一度関わりたい」に育てる部分に、痕跡という新しいレイヤーを重ねるだけです。
                </p>
              </div>
            </Reveal>
          </div>
        </section>

        {/* 以下は運営ダッシュボード（サイトCMS）から自由に編集・追加・並び替えできる */}
        <BlockRenderer blocks={blocks} />

        <section style={{ background: corpColor.trustSoft, padding: '56px 24px 72px' }}>
          <div style={{ maxWidth: 720, margin: '0 auto' }}>
            <Reveal>
              <p style={{ margin: '0 0 20px', fontSize: 13, lineHeight: 2, color: corpColor.inkSoft, fontFamily: corpFont.body }}>
                栃木県那珂川町・千葉県茂原市では、地域の方々と交流イベントを重ねてきました（
                <a href="/company/works" style={{ color: corpColor.trust, fontWeight: 700 }}>実績はこちら</a>
                ）。栃木県佐野市とは、痕跡データを使った実証実験にも取り組んでいます。法人・自治体向けの導入実績は、
                まだこれからです。だからこそ、最初の一社・一自治体と一緒に、手探りで作っていきたいと考えています。
                早く始める分、条件面でも一緒に相談しながら進められます。まずは、お話を聞かせてください。
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
                    borderRadius: corpRadius.pill,
                    boxShadow: corpShadow.card,
                  }}
                >
                  お問い合わせ
                </a>
                <a
                  href="/schedule"
                  className="hm-lift hm-btn"
                  style={{
                    display: 'inline-block',
                    padding: '15px 32px',
                    background: corpColor.white,
                    color: corpColor.trust,
                    textDecoration: 'none',
                    fontWeight: 700,
                    fontSize: 14,
                    fontFamily: corpFont.body,
                    letterSpacing: '0.05em',
                    borderRadius: corpRadius.pill,
                    border: `1.5px solid ${corpColor.trust}`,
                  }}
                >
                  🗓 初回相談（無料）を予約
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
