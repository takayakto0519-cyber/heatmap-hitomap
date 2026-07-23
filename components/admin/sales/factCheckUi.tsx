// 事実確認・送信キューまわりのUIパーツを共有する小さなモジュール。
// ClientLeadsTab（学校・法人）・RelationPopulationTab（自治体）の両方が同じ見た目・同じ送信ガードを使うための共通部品。
export type Confidence = 'high' | 'medium' | 'low' | null | undefined;
export type FactCheckStatus = 'verified' | 'unverified' | 'flagged' | null | undefined;

export const CONFIDENCE_BADGE: Record<'high' | 'medium' | 'low', { label: string; color: string }> = {
  high: { label: '🟢 確度高', color: '#27AE60' },
  medium: { label: '🟡 要確認', color: '#E5A139' },
  low: { label: '🔴 フォームのみ', color: '#E74C3C' },
};

export const FACT_CHECK_BADGE: Record<'verified' | 'flagged', { label: string; color: string }> = {
  verified: { label: '✓ 事実確認済み', color: '#27AE60' },
  flagged: { label: '⚠ 要修正フラグ', color: '#E74C3C' },
};

export function subjectOf(draft: string): string {
  const line = draft.split('\n').find((l) => /^件名[：:]/.test(l.trim()));
  return line ? line.trim().replace(/^件名[：:]\s*/, '') : '（件名未設定）';
}

/** 送信ボタンを有効化してよいか＝宛先あり×確度high/medium×事実確認済み（送信APIのガードと同じ基準）。 */
export function canSendDraft(email: string | null | undefined, confidence: Confidence, factCheckStatus: FactCheckStatus): boolean {
  return Boolean(email) && (confidence === 'high' || confidence === 'medium') && factCheckStatus === 'verified';
}
