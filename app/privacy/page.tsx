import LegalLayout from '@/components/LegalLayout';

export const metadata = {
  title: 'プライバシーポリシー | ヒトマップ',
};

export default function PrivacyPage() {
  return (
    <LegalLayout title="プライバシーポリシー" updatedAt="2026年7月8日（ドラフト）">
      <p style={{ fontSize: 12, color: '#E55039', marginTop: 0 }}>
        ※このページはドラフトです。正式公開前に内容を確認・修正してください。
      </p>

      <h2 style={{ fontSize: 16, fontWeight: 800, marginTop: 24 }}>1. 収集する情報</h2>
      <p>本サービスは、以下の情報を取得することがあります。</p>
      <ul style={{ paddingLeft: 20 }}>
        <li>アカウント情報（メールアドレス、ユーザー名）</li>
        <li>投稿内容（位置情報、写真、音声、テキスト）</li>
        <li>利用状況に関するログ情報</li>
      </ul>
      <p>本名・電話番号など、投稿に不要な個人特定情報の入力は求めません。ニックネームは任意です。</p>

      <h2 style={{ fontSize: 16, fontWeight: 800, marginTop: 24 }}>2. 利用目的</h2>
      <p>取得した情報は、本サービスの提供・改善、不正利用の防止、利用者からの問い合わせ対応のために利用します。</p>

      <h2 style={{ fontSize: 16, fontWeight: 800, marginTop: 24 }}>3. 第三者提供</h2>
      <p>法令に基づく場合を除き、利用者の同意なく個人情報を第三者に提供することはありません。地域の傾向を示す統計データは、個人を特定できない形に加工したうえで、自治体・企業等に提供することがあります。</p>

      <h2 style={{ fontSize: 16, fontWeight: 800, marginTop: 24 }}>4. 公開範囲の管理</h2>
      <p>アカウントで投稿する場合、投稿ごとに公開範囲（非公開・フォロワー限定・全国公開）を選択できます。利用者は、いつでも自らの投稿を編集・削除できます。</p>

      <h2 style={{ fontSize: 16, fontWeight: 800, marginTop: 24 }}>5. 位置情報の取り扱い</h2>
      <p>投稿に紐づく位置情報は、地図表示・地域理解のための機能に利用します。現在地の取得は端末の設定で許可した場合のみ行われます。</p>

      <h2 style={{ fontSize: 16, fontWeight: 800, marginTop: 24 }}>6. お問い合わせ</h2>
      <p>本ポリシーに関するお問い合わせ、および自己の情報の開示・削除に関するご要望は、運営者までご連絡ください。</p>
    </LegalLayout>
  );
}
