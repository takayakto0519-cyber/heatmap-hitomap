import type { Trace } from '@/lib/types';
import { getEmotion } from '@/lib/emotions';
import { getCategory } from '@/lib/categories';

interface Props {
  trace: Trace;
  onClick?: () => void;
}

export default function TraceCard({ trace: t, onClick }: Props) {
  const emotion = getEmotion(t.emotion_key);
  const category = getCategory(t.category);

  return (
    <article
      onClick={onClick}
      style={{
        border: '1px solid #eee', borderRadius: 12, overflow: 'hidden',
        background: '#fff', boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'box-shadow 0.15s',
      }}
      onMouseEnter={e => { if (onClick) (e.currentTarget as HTMLElement).style.boxShadow = '0 3px 12px rgba(0,0,0,0.12)'; }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.boxShadow = '0 1px 4px rgba(0,0,0,0.06)'; }}
    >
      {t.photo_url && (
        <img
          src={t.photo_url}
          alt={t.title}
          loading="lazy"
          style={{ width: '100%', height: 160, objectFit: 'cover', display: 'block' }}
        />
      )}
      <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 7 }}>

        {/* 感情・カテゴリ・強度 */}
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', alignItems: 'center' }}>
          {emotion && (
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 3,
              padding: '3px 9px', borderRadius: 20,
              background: emotion.color + '22',
              color: emotion.color, fontSize: 12, fontWeight: 700,
            }}>
              {emotion.emoji} {emotion.label}
            </span>
          )}
          {category && (
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 3,
              padding: '3px 9px', borderRadius: 20,
              background: '#f0f0f0', color: '#888', fontSize: 11,
            }}>
              {category.emoji} {category.label}
            </span>
          )}
          {t.intensity && (
            <span style={{ fontSize: 11, color: '#ccc', letterSpacing: 1 }}>
              {'●'.repeat(t.intensity)}{'○'.repeat(5 - t.intensity)}
            </span>
          )}
        </div>

        <h3 style={{ margin: 0, fontSize: 15, lineHeight: 1.4 }}>{t.title}</h3>

        {t.why && (
          <p style={{ margin: 0, fontSize: 13, color: '#555', lineHeight: 1.5,
            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
            <span style={{ color: '#bbb' }}>なぜ：</span>{t.why}
          </p>
        )}

        <div style={{ display: 'flex', gap: 6, fontSize: 11, color: '#aaa' }}>
          {t.want_revisit && <span>🔁 また来たい</span>}
          {t.want_to_share && <span>🗣 話したい</span>}
        </div>

        <time style={{ fontSize: 11, color: '#ccc' }}>
          {new Date(t.created_at).toLocaleString('ja-JP')}
          {t.nickname ? ` · ${t.nickname}` : ''}
        </time>
      </div>
    </article>
  );
}
