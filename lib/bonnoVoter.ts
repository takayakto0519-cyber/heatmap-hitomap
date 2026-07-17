// 煩悩オークション：BONNO投資の匿名識別子（voter_token）
// ブラウザ側でcrypto.randomUUID()により生成しlocalStorageに保持する。
// 投資ページ・投影ウォール（タップ投資）の両方から使う共通ロジック。
export function voterTokenKey(eventSlug: string): string {
  return `bonno_voter_token_${eventSlug}`;
}

export function getOrCreateVoterToken(eventSlug: string): string {
  const key = voterTokenKey(eventSlug);
  const existing = localStorage.getItem(key);
  if (existing) return existing;
  const created = crypto.randomUUID();
  localStorage.setItem(key, created);
  return created;
}
