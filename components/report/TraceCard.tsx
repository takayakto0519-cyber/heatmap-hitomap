import type { Trace } from '@/lib/types';
import { getEmotion } from '@/lib/emotions';
import { getCategory } from '@/lib/categories';
import { getArchiveType, getVoiceRelation } from '@/lib/archiveTypes';

function haversine(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function formatDistance(m: number) {
  if (m < 1000) return `${Math.round(m)}m`;
  return `${(m / 1000).toFixed(1)}km`;
}

interface Props {
  trace: Trace;
  onClick?: () => void;
  onShowOnMap?: (trace: Trace) => void;
  userPos?: [number, number] | null;
}

export default function TraceCard({ trace: t, onClick, onShowOnMap, userPos }: Props) {
  const archiveType = getArchiveType(t.archive_type);
  const emotion = archiveType ? null : getEmotion(t.emotion_key);
  const category = archiveType ? null : getCategory(t.category);
  const voiceRelation = getVoiceRelation(t.voice_relation);
  const distance = userPos
    ? haversine(userPos[0], userPos[1], t.latitude, t.longitude)
    : null;

  return (
    <article
      onClick={onClick}
      style={{
        border: '1px solid #eee', borderRadius: 14, overflow: 'hidden',
        background: '#fff', boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'box-shadow 0.15s, transform 0.1s',
        display: 'flex', flexDirection: 'column',
      }}
      onMouseEnter={e => { if (onClick) { (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 16px rgba(0,0,0,0.12)'; (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)'; } }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.boxShadow = '0 1px 4px rgba(0,0,0,0.06)'; (e.currentTarget as HTMLElement).style.transform = 'none'; }}
    >
      {/* 写真 */}
      {t.photo_url ? (
        <div style={{ position: 'relative' }}>
          <img
            src={t.photo_url}
            alt={t.title}
            loading="lazy"
            style={{ width: '100%', height: 160, objectFit: 'cover', display: 'block' }}
          />
          {/* 距離バッジ */}
          {distance !== null && (
            <span style={{
              position: 'absolute', top: 8, right: 8,
              background: 'rgba(0,0,0,0.55)', color: '#fff',
              padding: '2px 7px', borderRadius: 10, fontSize: 11, fontWeight: 700,
              backdropFilter: 'blur(4px)',
            }}>
              📍 {formatDistance(distance)}
            </span>
          )}
          {t.is_past_memory && (
            <span style={{
              position: 'absolute', top: 8, left: 8,
              background: 'rgba(255,243,205,0.9)', color: '#856404',
              padding: '2px 7px', borderRadius: 10, fontSize: 11, fontWeight: 700,
            }}>🕰 記憶</span>
          )}
        </div>
      ) : (
        distance !== null && (
          <div style={{ padding: '6px 12px 0', display: 'flex', justifyContent: 'flex-end' }}>
            <span style={{ fontSize: 11, color: '#aaa' }}>📍 {formatDistance(distance)}</span>
          </div>
        )
      )}

      <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>

        {/* バッジ行 */}
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', alignItems: 'center' }}>
          {archiveType && (
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 3,
              padding: '3px 8px', borderRadius: 20,
              background: archiveType.color + '22', color: archiveType.color, fontSize: 12, fontWeight: 700,
            }}>
              {archiveType.emoji} {archiveType.label}
            </span>
          )}
          {emotion && (
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 3,
              padding: '3px 8px', borderRadius: 20,
              background: emotion.color + '22', color: emotion.color, fontSize: 12, fontWeight: 700,
            }}>
              {emotion.emoji} {emotion.label}
            </span>
          )}
          {category && (
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 3,
              padding: '3px 8px', borderRadius: 20,
              background: '#f0f0f0', color: '#888', fontSize: 11,
            }}>
              {category.emoji} {category.label}
            </span>
          )}
          {t.intensity != null && (
            <span style={{ fontSize: 11, color: '#ddd', letterSpacing: 1 }}>
              {'●'.repeat(t.intensity)}{'○'.repeat(5 - t.intensity)}
            </span>
          )}
          {t.audio_url && (
            <span style={{ fontSize: 11, color: '#E55039' }} title="録音あり">🎙️</span>
          )}
        </div>

        {/* タイトル */}
        <h3 style={{ margin: 0, fontSize: 15, lineHeight: 1.4, fontWeight: 700 }}>
          {t.title}
          {t.yomi && <span style={{ fontWeight: 400, color: '#aaa', fontSize: 12 }}>（{t.yomi}）</span>}
        </h3>

        {/* 時代・語り手 */}
        {(t.era_label || voiceRelation) && (
          <p style={{ margin: 0, fontSize: 11, color: '#999' }}>
            {[t.era_label, voiceRelation ? `語り手：${voiceRelation.label}` : null].filter(Boolean).join(' · ')}
          </p>
        )}

        {/* why */}
        {t.why && (
          <p style={{
            margin: 0, fontSize: 13, color: '#555', lineHeight: 1.5,
            display: '-webkit-box', WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical', overflow: 'hidden',
          }}>
            {t.why}
          </p>
        )}

        {/* 文献の出典 */}
        {t.source_ref && (
          <p style={{
            margin: 0, fontSize: 11, color: '#B7791F',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>
            📚 {t.source_ref}
          </p>
        )}

        {/* タグ */}
        {(t.custom_tags ?? []).length > 0 && (
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {(t.custom_tags ?? []).map(tag => (
              <span key={tag} style={{ fontSize: 10, color: '#999', background: '#f5f5f5', padding: '1px 6px', borderRadius: 8 }}>
                #{tag}
              </span>
            ))}
          </div>
        )}

        {/* フッター行 */}
        <div style={{ marginTop: 'auto', paddingTop: 4, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', gap: 6, fontSize: 11, color: '#bbb' }}>
            {t.want_revisit && <span>🔁</span>}
            {t.want_to_share && <span>🗣</span>}
            <time>{new Date(t.created_at).toLocaleDateString('ja-JP')}</time>
            {t.nickname && <span>· {t.nickname}</span>}
          </div>

          {/* 地図で見る */}
          {onShowOnMap && (
            <button
              onClick={e => { e.stopPropagation(); onShowOnMap(t); }}
              style={{
                background: 'none', border: '1px solid #eee', borderRadius: 8,
                color: '#38ADA9', fontSize: 11, cursor: 'pointer',
                padding: '3px 8px', fontWeight: 700,
              }}
            >
              🗺 地図
            </button>
          )}
        </div>
      </div>
    </article>
  );
}
