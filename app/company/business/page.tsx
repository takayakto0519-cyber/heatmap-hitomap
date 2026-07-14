import type { Metadata } from 'next';
import CorpHeader from '@/components/corp/CorpHeader';
import CorpFooter from '@/components/corp/CorpFooter';
import { corpColor, corpFont } from '@/components/corp/tokens';

export const metadata: Metadata = {
  title: '法人・行政の方へ',
  description:
    '痕跡から人と組織の生き様を伝える、解読型の採用・組織ブランディング支援。言葉ではなくモノの痕跡から、組織の「らしさ」を可視化します。',
};

const sectionStyle: React.CSSProperties = {
  borderTop: `1px solid ${corpColor.line}`,
  padding: '32px 0',
};

const PHASES = [
  ['Phase 1', 'ホスト選定・心理的安全性の醸成'],
  ['Phase 2', 'エディター育成ワークショップ'],
  ['Phase 3', '密着取材・編集作業'],
  ['Phase 4', '成果発表・経営陣へのプレゼン'],
];

export default function CompanyBusinessPage() {
  return (
    <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', background: corpColor.ground }}>
      <CorpHeader />

      <main style={{ flex: 1 }}>
        <section style={{ padding: '64px 24px 40px' }}>
          <div style={{ maxWidth: 720, margin: '0 auto' }}>
            <p style={{ margin: '0 0 18px', fontSize: 12, letterSpacing: '0.2em', color: corpColor.moss, fontFamily: corpFont.body, fontWeight: 700 }}>
              FOR BUSINESS / GOVERNMENT
            </p>
            <h1
              style={{
                margin: '0 0 24px',
                fontFamily: corpFont.mincho,
                fontSize: 'clamp(24px, 3.6vw, 32px)',
                lineHeight: 1.8,
                color: corpColor.ink,
                fontWeight: 600,
              }}
            >
              言葉は取り繕える。
              <br />
              しかし、モノに残った痕跡は取り繕えない。
            </h1>
            <p style={{ margin: 0, fontSize: 15, lineHeight: 2, color: corpColor.inkSoft, fontFamily: corpFont.body, maxWidth: 560 }}>
              ヒトマップは、個人の「まちあるき記録」の技術と思想を、企業・行政の組織づくりにも応用しています。
              社員が分岐点で見ていたモノ・言葉・行動の痕跡から、取り繕われていない「その組織らしさ」を可視化し、
              採用・組織ブランディング・地域振興に活かします。ヒトマップを用いたこの支援は始まったばかりで、
              導入実績はまだありません。
            </p>
          </div>
        </section>

        <section style={{ background: corpColor.white, padding: '8px 24px 72px' }}>
          <div style={{ maxWidth: 720, margin: '0 auto' }}>
            <div style={sectionStyle}>
              <h2 style={{ fontFamily: corpFont.mincho, fontSize: 19, fontWeight: 600, color: corpColor.ink, margin: '0 0 14px' }}>
                解読型の採用・組織ブランディング
              </h2>
              <p style={{ fontSize: 14, color: corpColor.inkSoft, lineHeight: 2, margin: 0, fontFamily: corpFont.body }}>
                「面白い人に会いに行く」対話型のインターンではなく、その人が使い込んだモノ・現場の痕跡を
                先に読み解いてから本人と向き合う「解読型」の設計を採ります。表層的な共感ではなく、
                「この痕跡が自分の中の何かと共鳴した」という、本人にも説明しきれない必然の接続をつくることを目的にしています。
              </p>
            </div>

            <div style={sectionStyle}>
              <h2 style={{ fontFamily: corpFont.mincho, fontSize: 19, fontWeight: 600, color: corpColor.ink, margin: '0 0 14px' }}>
                ヒトマップ型採用インターンシップ
              </h2>
              <p style={{ fontSize: 14, color: corpColor.inkSoft, lineHeight: 2, margin: '0 0 20px', fontFamily: corpFont.body }}>
                社員一人ひとりの痕跡を取材・記録し、社員トレーディングカードやショート動画などの成果物に落とし込みながら、
                学生と社員の関係を一度きりのイベントで終わらせず、その後も続く「縁」として設計します。
              </p>
              <div style={{ display: 'grid', gap: 10 }}>
                {PHASES.map(([phase, desc]) => (
                  <div key={phase} style={{ display: 'flex', gap: 16, alignItems: 'baseline' }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: corpColor.moss, flexShrink: 0, width: 70, fontFamily: corpFont.body }}>
                      {phase}
                    </span>
                    <span style={{ fontSize: 14, color: corpColor.inkSoft, fontFamily: corpFont.body }}>{desc}</span>
                  </div>
                ))}
              </div>
            </div>

            <div style={sectionStyle}>
              <h2 style={{ fontFamily: corpFont.mincho, fontSize: 19, fontWeight: 600, color: corpColor.ink, margin: '0 0 14px' }}>
                成果物の例
              </h2>
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: 14, color: corpColor.inkSoft, lineHeight: 2.1, fontFamily: corpFont.body }}>
                <li>社員トレーディングカード</li>
                <li>共創型ショート動画（30〜60秒・縦型）</li>
                <li>取材を通じて生まれる、社員と学生の持続的な関係</li>
              </ul>
            </div>

            <div style={sectionStyle}>
              <h2 style={{ fontFamily: corpFont.mincho, fontSize: 19, fontWeight: 600, color: corpColor.ink, margin: '0 0 14px' }}>
                行政・地域の方へ
              </h2>
              <p style={{ fontSize: 14, color: corpColor.inkSoft, lineHeight: 2, margin: 0, fontFamily: corpFont.body }}>
                まちあるき記録アプリには、地域ごとの痕跡・感情の記録が積み重なっています。
                地域振興や観光施策への活用については、現在対話を始めた段階です。
                ご関心をお持ちの自治体・地域団体の方は、まずは個別にご相談ください。
              </p>
            </div>

            <div style={{ ...sectionStyle, borderBottom: `1px solid ${corpColor.line}` }}>
              <a
                href="/contact"
                style={{
                  display: 'inline-block',
                  padding: '15px 32px',
                  background: corpColor.ink,
                  color: corpColor.white,
                  textDecoration: 'none',
                  fontWeight: 700,
                  fontSize: 14,
                  fontFamily: corpFont.body,
                  letterSpacing: '0.05em',
                }}
              >
                お問い合わせ
              </a>
            </div>
          </div>
        </section>
      </main>

      <CorpFooter />
    </div>
  );
}
