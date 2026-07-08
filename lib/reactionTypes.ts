export const REACTION_TYPES = ['empathy', 'want_to_visit', 'nostalgic'] as const;
export type ReactionType = typeof REACTION_TYPES[number];

export function isReactionType(v: unknown): v is ReactionType {
  return typeof v === 'string' && (REACTION_TYPES as readonly string[]).includes(v);
}
