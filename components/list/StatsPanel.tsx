import type { Trace } from '@/lib/types';
import { EMOTIONS } from '@/lib/emotions';
import { CATEGORIES } from '@/lib/categories';

interface Props {
  traces: Trace[];
  sessionCode?: string;
}

export default function StatsPanel({ traces, sessionCode }: Props) {
  if (traces.length === 0) return null;

  const total = traces.length;
  const emotionStats = EMOTIONS
    .map(e => ({ ...e, count: traces.filter(t => t.emotion_key === e.key).length }))
    .filter(e => e.count > 0)
    .sort((a, b) => b.count - a.count);

  const categoryStats = CATEGORIES
    .map(c => ({ ...c, count: traces.filter(t => t.category === c.key).length }))
    .filter(c => c.count > 0)
    .sort((a, b) => b.count - a.count);

  const withPhoto = traces.filter(t => t.photo_url).length;
  const topEmotion = emotionStats[0];

  const minSize = 32;
  const maxSize = 56;
  const maxCount = emotionStats[0]?.count ?? 1;

  return (
    <div style={{
      background: 'linear-gradient(135deg, #fff8fc 0%, #f0f8ff 100%)',
      border: '1.5px solid #ffd6e7',
      borderRadius: 14, padding: '14px 16px', marginBottom: 14,
    }}>
      {/* ヘッダー */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 12 }}>
        <span style={{ fontSize: 22, fontWeight: 800, color: '#222' }}>{total}</span>
        <span style={{ fontSize: 13, color: '#888' }}>件の痕跡</span>
        {sessionCode && (
          <span style={{
            marginLeft: 4, padding: '2px 8px', borderRadius: 10,
            background: '#FF6B9D22', color: '#FF6B9D', fontSize: 11, fontWeight: 700,
          }}>🔖 {sessionCode}</span>
        )}
        {withPhoto > 0 && (
          <span style={{ marginLeft: 'auto', fontSize: 11, color: '#bbb' }}>
            📷 {withPhoto}件
          </span>
        )}
      </div>

      {/* 感情バブル */}
      {emotionStats.length > 0 && (
        <>
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', marginBottom: 8, flexWrap: 'wrap' }}>
            {emotionStats.map(e => {
              const size = minSize + ((e.count / maxCount) * (maxSize - minSize));
              return (
                <div key={e.key} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                  <div style={{
                    width: size, height: size, borderRadius: '50%',
                    background: e.color + 'cc',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: size * 0.4,
                    boxShadow: `0 2px 8px ${e.color}44`,
                    transition: 'all 0.2s',
                  }}>
                    {e.emoji}
                  </div>
                  <span style={{ fontSize: 10, color: e.color, fontWeight: 700 }}>{e.count}</span>
                </div>
              );
            })}
          </div>
          {topEmotion && (
            <p style={{ margin: 0, fontSize: 11, color: '#aaa' }}>
              「{topEmotion.label}」が最も多い感情 · {Math.round((topEmotion.count / total) * 100)}%
            </p>
          )}
        </>
      )}

      {/* カテゴリ内訳（2件以上あるとき） */}
      {categoryStats.length > 1 && (
        <div style={{ marginTop: 10, display: 'flex', gap: 5, flexWrap: 'wrap' }}>
          {categoryStats.map(c => (
            <span key={c.key} style={{
              padding: '2px 8px', borderRadius: 12,
              background: '#f0f0f0', color: '#666', fontSize: 11,
            }}>
              {c.emoji} {c.label} {c.count}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
