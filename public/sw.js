// 最小構成のService Worker。オフラインキャッシュは持たず、PWAとしてホーム画面に追加できる状態にするためだけのもの。
// 古いバンドルをキャッシュして「更新が反映されない」事故を起こさないよう、あえて何もキャッシュしない。
self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', () => {
  // 何もしない＝常に通常のネットワークフェッチに任せる
});
