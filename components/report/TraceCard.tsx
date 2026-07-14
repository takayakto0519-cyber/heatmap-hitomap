import Image from 'next/image';
import type { Trace } from '@/lib/types';
import { getEmotion } from '@/lib/emotions';
import { getCategory } from '@/lib/categories';
import { getArchiveType, getVoiceRelation } from '@/lib/archiveTypes';
import { haversine } from '@/lib/geo';
import { appColor, appRadius, appShadow } from '@/lib/appTokens';
import { PinIcon, ClockIcon, MicIcon, EditIcon, TrashIcon, RepeatIcon, SpeakIcon, MapIcon, BookIcon } from '@/components/icons';
import { EMOTION_ICONS, CATEGORY_ICONS, ARCHIVE_TYPE_ICONS } from './tagIcons';

function formatDistance(m: number) {
  if (m < 1000) return `${Math.round(m)}m`;
  return `${(m / 1000).toFixed(1)}km`;
}

interface Props {
  trace: Trace;
  onClick?: () => void;
  onShowOnMap?: (trace: Trace) => void;
  userPos?: [number, number] | null;
  avatarUrl?: string;
  isOwn?: boolean;
  onEdit?: (trace: Trace) => void;
  onDelete?: (trace: Trace) => void;
}

export default function TraceCard({ trace: t, onClick, onShowOnMap, userPos, avatarUrl, isOwn, onEdit, onDelete }: Props) {
  const archiveType = getArchiveType(t.archive_type);
  const emotionList = archiveType
    ? []
    : (t.emotion_keys ?? (t.emotion_key ? [t.emotion_key] : []))
        .map(getEmotion)
        .filter((e): e is NonNullable<typeof e> => e !== null);
  const category = archiveType ? null : getCategory(t.category);
  const voiceRelation = getVoiceRelation(t.voice_relation);
  const distance = userPos
    ? haversine(userPos[0], userPos[1], t.latitude, t.longitude)
    : null;

  return (
    <article
      onClick={onClick}
      style={{
        border: 'none', borderRadius: appRadius.md, overflow: 'hidden',
        background: appColor.surface, boxShadow: appShadow.sm,
        cursor: onClick ? 'pointer' : 'default',
        transition: 'box-shadow 0.15s, transform 0.1s',
        display: 'flex', flexDirection: 'column',
      }}
      onMouseEnter={e => { if (onClick) { (e.currentTarget as HTMLElement).style.boxShadow = appShadow.md; (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)'; } }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.boxShadow = appShadow.sm; (e.currentTarget as HTMLElement).style.transform = 'none'; }}
    >
      {/* 写真 */}
      {t.photo_url ? (
        <div style={{ position: 'relative', height: 160 }}>
          <Image
            src={t.photo_url}
            alt={t.title}
            fill
            sizes="(max-width: 600px) 100vw, 260px"
            style={{ objectFit: 'cover' }}
          />
          {/* 距離バッジ */}
          {distance !== null && (
            <span style={{
              position: 'absolute', top: 8, right: 8,
              background: 'rgba(33,30,27,0.6)', color: '#fff',
              padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 700,
              backdropFilter: 'blur(4px)', display: 'inline-flex', alignItems: 'center', gap: 3,
            }}>
              <PinIcon size={11} /> {formatDistance(distance)}
            </span>
          )}
          {t.is_past_memory && (
            <span style={{
              position: 'absolute', top: 8, left: 8,
              background: 'rgba(245,237,221,0.92)', color: appColor.warning,
              padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 700,
              display: 'inline-flex', alignItems: 'center', gap: 3,
            }}><ClockIcon size={11} /> 記憶</span>
          )}
        </div>
      ) : (
        distance !== null && (
          <div style={{ padding: '6px 12px 0', display: 'flex', justifyContent: 'flex-end' }}>
            <span style={{ fontSize: 11, color: appColor.inkGhost, display: 'inline-flex', alignItems: 'center', gap: 3 }}>
              <PinIcon size={11} /> {formatDistance(distance)}
            </span>
          </div>
        )
      )}

      <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>

        {/* バッジ行 */}
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', alignItems: 'center' }}>
          {archiveType && (() => {
            const TagI = ARCHIVE_TYPE_ICONS[archiveType.key];
            return (
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                padding: '3px 8px', borderRadius: appRadius.sm + 12,
                background: archiveType.color + '22', color: archiveType.color, fontSize: 12, fontWeight: 700,
              }}>
                {TagI && <TagI size={12} />} {archiveType.label}
              </span>
            );
          })()}
          {emotionList.map(emotion => {
            const EmoI = EMOTION_ICONS[emotion.key];
            return (
              <span key={emotion.key} style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                padding: '3px 8px', borderRadius: appRadius.sm + 12,
                background: emotion.color + '22', color: emotion.color, fontSize: 12, fontWeight: 700,
              }}>
                {EmoI && <EmoI size={12} />} {emotion.label}
              </span>
            );
          })}
          {category && (() => {
            const CatI = CATEGORY_ICONS[category.key];
            return (
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                padding: '3px 8px', borderRadius: appRadius.sm + 12,
                background: appColor.lineSoft, color: appColor.inkFaint, fontSize: 11,
              }}>
                {CatI && <CatI size={11} />} {category.label}
              </span>
            );
          })()}
          {t.intensity != null && (
            <span style={{ fontSize: 11, color: appColor.lineSoft, letterSpacing: 1 }}>
              {'●'.repeat(t.intensity)}{'○'.repeat(5 - t.intensity)}
            </span>
          )}
          {t.audio_url && (
            <span style={{ color: appColor.danger, display: 'inline-flex' }} title="録音あり"><MicIcon size={13} /></span>
          )}
        </div>

        {/* タイトル */}
        <h3 style={{ margin: 0, fontSize: 15, lineHeight: 1.4, fontWeight: 700 }}>
          {t.title}
          {t.yomi && <span style={{ fontWeight: 400, color: appColor.inkGhost, fontSize: 12 }}>（{t.yomi}）</span>}
        </h3>

        {/* 時代・語り手 */}
        {(t.era_label || voiceRelation) && (
          <p style={{ margin: 0, fontSize: 11, color: appColor.inkFaint }}>
            {[t.era_label, voiceRelation ? `語り手：${voiceRelation.label}` : null].filter(Boolean).join(' · ')}
          </p>
        )}

        {/* why */}
        {t.why && (
          <p style={{
            margin: 0, fontSize: 13, color: appColor.inkSoft, lineHeight: 1.5,
            display: '-webkit-box', WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical', overflow: 'hidden',
          }}>
            {t.why}
          </p>
        )}

        {/* 文献の出典 */}
        {t.source_ref && (
          <p style={{
            margin: 0, fontSize: 11, color: appColor.warning,
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            display: 'flex', alignItems: 'center', gap: 4,
          }}>
            <BookIcon size={11} /> {t.source_ref}
          </p>
        )}

        {/* タグ */}
        {(t.custom_tags ?? []).length > 0 && (
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {(t.custom_tags ?? []).map(tag => (
              <span key={tag} style={{ fontSize: 10, color: appColor.inkFaint, background: appColor.lineSoft, padding: '1px 6px', borderRadius: 8 }}>
                #{tag}
              </span>
            ))}
          </div>
        )}

        {/* フッター行 */}
        <div style={{ marginTop: 'auto', paddingTop: 4, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: appColor.inkGhost }}>
            {avatarUrl && (
              <img src={avatarUrl} alt="" style={{ width: 16, height: 16, borderRadius: '50%', objectFit: 'cover' }} />
            )}
            {t.want_revisit && <span style={{ display: 'inline-flex' }}><RepeatIcon size={12} /></span>}
            {t.want_to_share && <span style={{ display: 'inline-flex' }}><SpeakIcon size={12} /></span>}
            <time>{new Date(t.created_at).toLocaleDateString('ja-JP')}</time>
            {t.nickname && <span>· {t.nickname}</span>}
          </div>

          <div style={{ display: 'flex', gap: 6 }}>
            {/* 自分の記録：編集・削除（開いて探さなくていいよう、カード上に直接出す） */}
            {isOwn && onEdit && (
              <button
                onClick={e => { e.stopPropagation(); onEdit(t); }}
                title="編集する"
                style={{
                  background: 'none', border: `1px solid ${appColor.line}`, borderRadius: 8,
                  color: appColor.accent, fontSize: 11, cursor: 'pointer',
                  padding: '3px 8px', fontWeight: 700,
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                }}
              >
                <EditIcon size={12} /> 編集
              </button>
            )}
            {isOwn && onDelete && (
              <button
                onClick={e => { e.stopPropagation(); onDelete(t); }}
                title="削除する"
                style={{
                  background: 'none', border: `1px solid ${appColor.line}`, borderRadius: 8,
                  color: appColor.danger, fontSize: 11, cursor: 'pointer',
                  padding: '3px 8px', fontWeight: 700,
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                }}
              >
                <TrashIcon size={12} /> 削除
              </button>
            )}
            {/* 地図で見る */}
            {onShowOnMap && (
              <button
                onClick={e => { e.stopPropagation(); onShowOnMap(t); }}
                style={{
                  background: 'none', border: `1px solid ${appColor.line}`, borderRadius: 8,
                  color: appColor.teal, fontSize: 11, cursor: 'pointer',
                  padding: '3px 8px', fontWeight: 700,
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                }}
              >
                <MapIcon size={12} /> 地図
              </button>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}
