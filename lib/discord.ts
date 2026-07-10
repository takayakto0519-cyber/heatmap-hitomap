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
