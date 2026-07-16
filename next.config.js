// Supabase Storageの公開画像ホストをnext/imageの許可リストに追加する。
// URLはプロジェクトごとに異なるため、ビルド時の環境変数から動的に読み取る。
function supabaseImageHost() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) return null;
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

const supabaseHost = supabaseImageHost();

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: supabaseHost
      ? [{ protocol: 'https', hostname: supabaseHost, pathname: '/storage/v1/object/public/**' }]
      : [],
  },
  // /business等の直下URLは、内容が同一の /company/* に評価が分散していたSEO上の重複だった。
  // 301（permanent）で正規URLに一本化し、被リンク評価とクロール予算を集約する。
  async redirects() {
    return [
      { source: '/business', destination: '/company/business', permanent: true },
      { source: '/service', destination: '/company/service', permanent: true },
      { source: '/school', destination: '/company/school', permanent: true },
      { source: '/works', destination: '/company/works', permanent: true },
      { source: '/works/:slug', destination: '/company/works/:slug', permanent: true },
      { source: '/blog', destination: '/company/blog', permanent: true },
      { source: '/blog/:slug', destination: '/company/blog/:slug', permanent: true },
      { source: '/team', destination: '/company/team', permanent: true },
      { source: '/contact', destination: '/company/contact', permanent: true },
    ];
  },
};

module.exports = nextConfig;
