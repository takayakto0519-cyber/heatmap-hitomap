import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { supabaseServer } from '@/lib/supabase/server';
import { getEmotion } from '@/lib/emotions';
import { notifyDiscordError } from '@/lib/discord';
import type { Trace } from '@/lib/types';

interface Props {
  params: { id: string };
}

async function getPublicTrace(id: string): Promise<Trace | null> {
  // .single()は0件/複数件で例外を返すため、単純な「無ければ見せない」判定には.maybeSingle()の方が安全
  const { data, error } = await supabaseServer.from('traces').select('*').eq('id', id).maybeSingle();
  if (error) notifyDiscordError('GET /t/[id]', error);
  if (error || !data || data.is_deleted || data.visibility !== 'public') return null;
  return data as Trace;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const trace = await getPublicTrace(params.id);
  if (!trace) {
    return { title: 'ヒトマップ' };
  }
  const description = trace.why ?? trace.interpretation ?? 'ヒトマップに記録された痕跡';
  return {
    title: `${trace.title} | ヒトマップ`,
    description,
    openGraph: {
      title: trace.title,
      description,
      images: [`/t/${trace.id}/opengraph-image`],
    },
    twitter: {
      card: 'summary_large_image',
      title: trace.title,
      description,
    },
  };
}

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://hitomap.com';

export default async function TracePermalinkPage({ params }: Props) {
  const trace = await getPublicTrace(params.id);
  if (!trace) notFound();

  const emotion = getEmotion(trace.emotion_key);
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CreativeWork',
    name: trace.title,
    description: trace.why ?? trace.interpretation ?? 'ヒトマップに記録された痕跡',
    url: `${SITE_URL}/t/${trace.id}`,
    ...(trace.photo_url ? { image: trace.photo_url } : {}),
    ...(trace.created_at ? { dateCreated: trace.created_at } : {}),
    isPartOf: { '@type': 'WebSite', name: 'ヒトマップ', url: SITE_URL },
  };

  return (
    <div style={{ minHeight: '100dvh', background: '#fafafa' }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      {trace.photo_url && (
        (trace.photo_urls && trace.photo_urls.length > 1) ? (
          <div style={{ display: 'flex', overflowX: 'auto', scrollSnapType: 'x mandatory' }}>
            {trace.photo_urls.map((url, i) => (
              <img key={i} src={url} alt={`${trace.title} ${i + 1}`}
                style={{ width: '100%', maxHeight: 360, objectFit: 'cover', display: 'block', flexShrink: 0, scrollSnapAlign: 'start' }} />
            ))}
          </div>
        ) : (
          <img src={trace.photo_url} alt={trace.title} style={{ width: '100%', maxHeight: 360, objectFit: 'cover', display: 'block' }} />
        )
      )}
      <div style={{ maxWidth: 560, margin: '0 auto', padding: '24px 20px 60px' }}>
        <a href="/map" style={{ fontSize: 13, color: '#38ADA9', textDecoration: 'none', fontWeight: 700 }}>← ヒトマップの地図を見る</a>

        {emotion && (
          <div style={{ marginTop: 16 }}>
            <span style={{
              padding: '4px 10px', borderRadius: 20,
              background: emotion.color + '22', color: emotion.color,
              fontSize: 13, fontWeight: 700,
            }}>{emotion.emoji} {emotion.label}</span>
          </div>
        )}

        <h1 style={{ fontSize: 24, fontWeight: 800, margin: '12px 0 20px' }}>{trace.title}</h1>

        {trace.why && (
          <div style={{ marginBottom: 16 }}>
            <p style={{ fontSize: 12, color: '#bbb', margin: '0 0 4px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>なぜ気になった</p>
            <p style={{ margin: 0, fontSize: 15, lineHeight: 1.8, color: '#333' }}>{trace.why}</p>
          </div>
        )}
        {trace.interpretation && (
          <div style={{ marginBottom: 16 }}>
            <p style={{ fontSize: 12, color: '#bbb', margin: '0 0 4px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>見えた暮らし・想い</p>
            <p style={{ margin: 0, fontSize: 15, lineHeight: 1.8, color: '#333' }}>{trace.interpretation}</p>
          </div>
        )}
        {trace.audio_url && (
          <div style={{ marginBottom: 16 }}>
            <p style={{ fontSize: 12, color: '#bbb', margin: '0 0 4px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>🎙️ 録音</p>
            <audio controls src={trace.audio_url} style={{ width: '100%' }} />
            {trace.audio_transcript && (
              <div style={{ marginTop: 8, background: '#fafafa', borderRadius: 10, padding: '10px 12px' }}>
                <p style={{ fontSize: 11, color: '#aaa', margin: '0 0 4px', fontWeight: 700 }}>📝 文字起こし</p>
                <p style={{ fontSize: 13, color: '#555', margin: 0, lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{trace.audio_transcript}</p>
              </div>
            )}
          </div>
        )}

        <p style={{ fontSize: 12, color: '#ccc', marginTop: 24 }}>
          {new Date(trace.created_at).toLocaleString('ja-JP')}
          {trace.nickname ? ` ・ ${trace.nickname}` : ''}
        </p>

        <a href={trace.region ? `/map?region=${encodeURIComponent(trace.region)}` : '/map'} style={{
          display: 'block', textAlign: 'center', marginTop: 24, padding: '14px',
          borderRadius: 12, border: 'none', color: '#fff', fontSize: 15, fontWeight: 800,
          textDecoration: 'none', background: 'linear-gradient(135deg, #FF6B9D, #FF9068)',
        }}>🗾 地図でこの場所を見る</a>
      </div>
    </div>
  );
}
