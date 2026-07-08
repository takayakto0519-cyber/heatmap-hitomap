import LegalLayout from '@/components/LegalLayout';

export const metadata = {
  title: '利用規約 | ヒトマップ',
};

export default function TermsPage() {
  return (
    <LegalLayout title="利用規約" updatedAt="2026年7月8日（ドラフト）">
      <p style={{ fontSize: 12, color: '#E55039', marginTop: 0 }}>
        ※このページはドラフトです。正式公開前に内容を確認・修正してください。
      </p>

      <h2 style={{ fontSize: 16, fontWeight: 800, marginTop: 24 }}>第1条（適用）</h2>
      <p>本規約は、ヒトマップ（以下「本サービス」）の利用に関する条件を、利用者と運営者との間で定めるものです。利用者は本サービスを利用することで、本規約に同意したものとみなします。</p>

      <h2 style={{ fontSize: 16, fontWeight: 800, marginTop: 24 }}>第2条（投稿コンテンツ）</h2>
      <p>利用者が投稿する写真・文章・音声等（以下「投稿コンテンツ」）の著作権は投稿者に帰属します。ただし、本サービスの運営・改善・紹介のために必要な範囲で、運営者が投稿コンテンツを表示・複製・改変できるものとします。</p>
      <p>他者の権利（肖像権・著作権・プライバシー等）を侵害する投稿、公序良俗に反する投稿は禁止します。</p>

      <h2 style={{ fontSize: 16, fontWeight: 800, marginTop: 24 }}>第3条（投稿の削除）</h2>
      <p>利用者は、自らが投稿したコンテンツをいつでも削除できます。運営者は、本規約に違反する投稿や通報のあった投稿について、利用者への事前通知なく削除できるものとします。</p>

      <h2 style={{ fontSize: 16, fontWeight: 800, marginTop: 24 }}>第4条（禁止事項）</h2>
      <p>法令または公序良俗に違反する行為、本サービスの運営を妨害する行為、他の利用者や第三者に不利益・損害を与える行為を禁止します。</p>

      <h2 style={{ fontSize: 16, fontWeight: 800, marginTop: 24 }}>第5条（免責事項）</h2>
      <p>運営者は、本サービスの内容の正確性・完全性について保証しません。本サービスの利用により生じた損害について、運営者は故意または重過失がある場合を除き、責任を負わないものとします。</p>

      <h2 style={{ fontSize: 16, fontWeight: 800, marginTop: 24 }}>第6条（規約の変更）</h2>
      <p>運営者は、必要と判断した場合、利用者への通知なく本規約を変更できるものとします。変更後の規約は、本ページに掲載した時点で効力を生じるものとします。</p>

      <h2 style={{ fontSize: 16, fontWeight: 800, marginTop: 24 }}>第7条（お問い合わせ）</h2>
      <p>本規約に関するお問い合わせは、運営者までご連絡ください。</p>
    </LegalLayout>
  );
}
