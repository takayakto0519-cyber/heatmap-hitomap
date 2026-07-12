// 運営ダッシュボード（新規投稿・通報など）の動きをDiscordへ通知する。
// DISCORD_WEBHOOK_URL未設定の場合は何もしない。失敗しても投稿処理自体は継続させるためawaitせず握りつぶす。
export function notifyDiscord(content: string): void {
  const url = process.env.DISCORD_WEBHOOK_URL;
  if (!url) return;
  fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content }),
  }).catch(() => {});
}

// サーバーエラー専用の通知。パソコンを開いていなくても障害に気づけるようにする。
// 同じエラーでDiscordが埋め尽くされないよう、直近と同じ内容は短時間は再送しない。
const recentErrorSignatures = new Map<string, number>();
const ERROR_DEDUPE_MS = 5 * 60 * 1000; // 同一エラーは5分間は再通知しない

export function notifyDiscordError(context: string, error: unknown): void {
  const message = error instanceof Error ? error.message : String(error);
  const signature = `${context}:${message}`;
  const now = Date.now();
  const last = recentErrorSignatures.get(signature);
  if (last && now - last < ERROR_DEDUPE_MS) return;
  recentErrorSignatures.set(signature, now);

  notifyDiscord(`🚨 エラー発生（${context}）\n\`\`\`${message.slice(0, 500)}\`\`\``);
}
