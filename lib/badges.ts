// 実績バッジの判定ロジック。既存の投稿データ（traces）とルート踏破数だけから算出し、
// 新しいDBカラムは増やさない。カテゴリごとに最高到達段階のみをバッジとして返す。
import { EMOTIONS } from './emotions';
import { getIsoWeekKey } from './quests';
import type { Trace } from './types';

export interface Badge {
  id: string;
  emoji: string;
  label: string;
  description: string;
}

interface Tier {
  min: number;
  emoji: string;
  label: string;
}

function highestTier(count: number, tiers: readonly Tier[]): Tier | null {
  return [...tiers].reverse().find((t) => count >= t.min) ?? null;
}

const REGION_TIERS: Tier[] = [
  { min: 1, emoji: '🥉', label: '最初の一歩' },
  { min: 3, emoji: '🌱', label: '芽生え' },
  { min: 5, emoji: '🥈', label: '歩く人' },
  { min: 10, emoji: '🔦', label: '探し人' },
  { min: 15, emoji: '🥇', label: '旅する人' },
  { min: 25, emoji: '🧭', label: '道しるべ' },
  { min: 30, emoji: '👑', label: '痕跡の探求者' },
  { min: 50, emoji: '🏔', label: '町の語り部' },
  { min: 75, emoji: '🌍', label: 'まちあるきの達人' },
  { min: 100, emoji: '⭐', label: '伝説の記録者' },
];

const POST_COUNT_TIERS: Tier[] = [
  { min: 1, emoji: '📍', label: '記録はじめ' },
  { min: 10, emoji: '📌', label: '記録する人' },
  { min: 30, emoji: '🗂', label: '記録の達人' },
  { min: 50, emoji: '📚', label: '痕跡コレクター' },
  { min: 100, emoji: '🏛', label: '痕跡アーカイブ' },
  { min: 200, emoji: '🏆', label: '殿堂入り記録者' },
];

const STREAK_TIERS: Tier[] = [
  { min: 2, emoji: '🔥', label: '継続の芽' },
  { min: 4, emoji: '🔥🔥', label: '続ける人' },
  { min: 8, emoji: '🔥🔥🔥', label: '習慣の人' },
  { min: 12, emoji: '💎', label: '継続の証' },
];

const QUEST_WEEK_TIERS: Tier[] = [
  { min: 3, emoji: '🎯', label: 'お題ハンター' },
  { min: 10, emoji: '🏹', label: 'お題の常連' },
  { min: 20, emoji: '🎖', label: 'お題マスター' },
];

const ROUTE_TIERS: Tier[] = [
  { min: 1, emoji: '🚶', label: 'ルート踏破' },
  { min: 5, emoji: '🥾', label: 'ルート踏破の達人' },
  { min: 10, emoji: '🗺', label: 'ルート踏破マスター' },
];

// ISO週番号の連続記録（継続）の最大値を数える
function longestWeekStreak(weekKeys: Set<string>): number {
  const sorted = [...weekKeys].sort();
  let longest = 0;
  let current = 0;
  let prevYear = -1;
  let prevWeek = -1;
  for (const key of sorted) {
    const [yearStr, weekStr] = key.split('-W');
    const year = Number(yearStr);
    const week = Number(weekStr);
    const isConsecutive = prevYear === year && prevWeek === week - 1;
    current = isConsecutive ? current + 1 : 1;
    longest = Math.max(longest, current);
    prevYear = year;
    prevWeek = week;
  }
  return longest;
}

export function computeBadges(traces: Trace[], routeCompletionCount = 0): Badge[] {
  const badges: Badge[] = [];

  const regionCount = new Set(traces.map((t) => t.region).filter(Boolean)).size;
  const regionTier = highestTier(regionCount, REGION_TIERS);
  if (regionTier) {
    badges.push({
      id: 'region',
      emoji: regionTier.emoji,
      label: regionTier.label,
      description: `${regionCount}の町に痕跡を残した`,
    });
  }

  const postTier = highestTier(traces.length, POST_COUNT_TIERS);
  if (postTier) {
    badges.push({
      id: 'posts',
      emoji: postTier.emoji,
      label: postTier.label,
      description: `${traces.length}件の記録を残した`,
    });
  }

  const weekKeys = new Set(traces.map((t) => getIsoWeekKey(new Date(t.created_at))));
  const streak = longestWeekStreak(weekKeys);
  const streakTier = highestTier(streak, STREAK_TIERS);
  if (streakTier) {
    badges.push({
      id: 'streak',
      emoji: streakTier.emoji,
      label: streakTier.label,
      description: `${streak}週連続で記録した`,
    });
  }

  const questTier = highestTier(weekKeys.size, QUEST_WEEK_TIERS);
  if (questTier) {
    badges.push({
      id: 'quest-weeks',
      emoji: questTier.emoji,
      label: questTier.label,
      description: `${weekKeys.size}週にわたって記録に参加した`,
    });
  }

  const usedEmotions = new Set(
    traces.flatMap((t) => (t.emotion_keys?.length ? t.emotion_keys : t.emotion_key ? [t.emotion_key] : []))
  );
  if (usedEmotions.size >= EMOTIONS.length) {
    badges.push({
      id: 'emotion-complete',
      emoji: '🌈',
      label: '感受性豊かな人',
      description: '10種類すべての感情タグを使った',
    });
  }

  const hours = traces.map((t) => new Date(t.created_at).getHours());
  if (hours.filter((h) => h >= 5 && h < 8).length >= 3) {
    badges.push({ id: 'early-bird', emoji: '🌅', label: '朝活の人', description: '早朝に3回以上記録した' });
  }
  if (hours.filter((h) => h >= 23 || h < 4).length >= 3) {
    badges.push({ id: 'night-owl', emoji: '🌙', label: '夜歩く人', description: '深夜に3回以上記録した' });
  }

  const routeTier = highestTier(routeCompletionCount, ROUTE_TIERS);
  if (routeTier) {
    badges.push({
      id: 'route',
      emoji: routeTier.emoji,
      label: routeTier.label,
      description: `${routeCompletionCount}件のルートを踏破した`,
    });
  }

  return badges;
}
