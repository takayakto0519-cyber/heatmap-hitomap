import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

// 静的ロゴのみだった旧OGPを、検索から来た法人・行政担当者に事業内容が一目で伝わる形に差し替える。
export default async function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
          justifyContent: 'flex-end', position: 'relative',
          backgroundColor: '#1F4E5F',
          backgroundImage: 'linear-gradient(135deg, #1F4E5F, #4A90A4)',
        }}
      >
        <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', padding: '56px 64px' }}>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 20 }}>
            <img src={`${SITE_URL}/logo.png`} height={44} style={{ marginRight: 12 }} />
            <div style={{
              display: 'flex', padding: '6px 16px', borderRadius: 20,
              background: 'rgba(255,255,255,0.16)', color: '#fff', fontSize: 20, fontWeight: 700,
            }}>法人・行政の方へ</div>
          </div>
          <div style={{ display: 'flex', fontSize: 52, fontWeight: 800, color: '#fff', lineHeight: 1.35, maxWidth: 1040 }}>
            AI顧問業・生成AI導入支援・自治体DX
          </div>
          <div style={{ display: 'flex', fontSize: 24, color: 'rgba(255,255,255,0.85)', marginTop: 18 }}>
            痕跡から、組織と地域の生き様を可視化する ｜ ヒトマップ
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
