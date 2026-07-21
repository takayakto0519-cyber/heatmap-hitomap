#!/usr/bin/env node
// Vercel Cron（PCが閉じていても動くGmail返信チェック）用の、サーバー側Gmail認証情報を
// 一度だけ発行するスクリプト。agents/gmail_watch.py と同じ hitomap-bot プロジェクトの
// OAuthクライアントを使う想定だが、あちらは「ローカルファイル保存（会長のPCでしか動かない）」
// なのに対し、こちらは「環境変数保存（Vercelの本番でも動く）」という別物として新規に作る。
// scripts/setup-google-calendar-oauth.mjs と全く同じ作り。
//
// 事前準備（会長の作業・Google Cloud Console）：
//   1. https://console.cloud.google.com/apis/credentials?project=hitomap-bot を開く
//   2. 「認証情報を作成」→「OAuthクライアントID」→ 種類「デスクトップアプリ」、名前は例えば
//      「hitomap_gmail_cron（Vercel Cron用）」
//   3. 作成後、クライアントID・シークレットが表示される。それを .env.local に以下の形で追加：
//        GOOGLE_GMAIL_CLIENT_ID=...
//        GOOGLE_GMAIL_CLIENT_SECRET=...
//   4. Google Cloud Console の OAuth同意画面で、対象アカウント（hitomap.info@gmail.com）が
//      テストユーザーとして登録済みであることを確認（gmail_watch.py設定時に済んでいるはず）。
//
// このスクリプトの実行（1回だけ・PowerShellで）：
//   node scripts/setup-google-gmail-oauth.mjs
// ブラウザで許可画面が開くので、hitomap.info@gmail.com でログインして許可してください。
// 完了すると、追加すべき環境変数（リフレッシュトークン）がターミナルに表示されます。
// それを .env.local と、Vercelのプロジェクト設定（Environment Variables）の両方に追加してください。

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { exec } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const ENV_PATH = path.join(ROOT, '.env.local');

const PORT = 8735; // calendarの8734と衝突しないよう別ポート
const REDIRECT_URI = `http://127.0.0.1:${PORT}/oauth2callback`;
// 読み取り(gmail_watch.pyと同じ)＋送信(日程調整サイトの却下/キャンセル通知メール用)。
// 削除・ラベル変更等の権限は持たせない。
const SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.send',
].join(' ');

function loadEnvLocal() {
  const env = {};
  if (!fs.existsSync(ENV_PATH)) return env;
  for (const line of fs.readFileSync(ENV_PATH, 'utf-8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue;
    const idx = trimmed.indexOf('=');
    env[trimmed.slice(0, idx).trim()] = trimmed.slice(idx + 1).trim();
  }
  return env;
}

function openBrowser(url) {
  const cmd = process.platform === 'win32' ? `start "" "${url}"`
    : process.platform === 'darwin' ? `open "${url}"`
    : `xdg-open "${url}"`;
  exec(cmd, () => { /* 失敗してもURLは表示済みなので手動で開いてもらえばよい */ });
}

async function main() {
  const env = loadEnvLocal();
  const clientId = env.GOOGLE_GMAIL_CLIENT_ID;
  const clientSecret = env.GOOGLE_GMAIL_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    console.error([
      '',
      '❌ .env.local に GOOGLE_GMAIL_CLIENT_ID / GOOGLE_GMAIL_CLIENT_SECRET がありません。',
      '   このファイル冒頭のコメントの手順1〜3を先に行い、.env.local に追加してから再実行してください。',
      '',
    ].join('\n'));
    process.exit(1);
  }

  const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  authUrl.searchParams.set('client_id', clientId);
  authUrl.searchParams.set('redirect_uri', REDIRECT_URI);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('scope', SCOPES);
  authUrl.searchParams.set('access_type', 'offline'); // リフレッシュトークンをもらうために必須
  authUrl.searchParams.set('prompt', 'consent'); // 再認可時も確実にrefresh_tokenを返してもらう

  console.log('\n以下のURLをブラウザで開いて、hitomap.info@gmail.com で許可してください：\n');
  console.log(authUrl.toString());
  console.log('\n（自動でブラウザが開かない場合は、上のURLを手動でコピーして開いてください）\n');
  openBrowser(authUrl.toString());

  const code = await new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const url = new URL(req.url, `http://127.0.0.1:${PORT}`);
      if (url.pathname !== '/oauth2callback') { res.writeHead(404); res.end(); return; }
      const code = url.searchParams.get('code');
      const error = url.searchParams.get('error');
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      if (error) {
        res.end(`<html><body><h2>許可がキャンセルされました（${error}）。ターミナルに戻ってください。</h2></body></html>`);
        server.close();
        reject(new Error(error));
        return;
      }
      res.end('<html><body><h2>✓ 許可されました。このタブは閉じて、ターミナルに戻ってください。</h2></body></html>');
      server.close();
      resolve(code);
    });
    server.listen(PORT);
  });

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: REDIRECT_URI,
      grant_type: 'authorization_code',
    }),
  });
  const tokenData = await tokenRes.json();

  if (!tokenRes.ok || !tokenData.refresh_token) {
    console.error('\n❌ トークン交換に失敗しました：', tokenData);
    if (!tokenData.refresh_token) {
      console.error('\nrefresh_tokenが返りませんでした。一度 https://myaccount.google.com/permissions で');
      console.error('このアプリへの既存の許可を取り消してから、もう一度実行してみてください。');
    }
    process.exit(1);
  }

  console.log('\n✅ 完了しました！以下を .env.local に追加（無ければ追記）し、');
  console.log('   同じ内容をVercelのプロジェクト環境変数にも追加してください：\n');
  console.log(`GOOGLE_GMAIL_CLIENT_ID=${clientId}`);
  console.log(`GOOGLE_GMAIL_CLIENT_SECRET=${clientSecret}`);
  console.log(`GOOGLE_GMAIL_REFRESH_TOKEN=${tokenData.refresh_token}`);
  console.log('');
}

main().catch((e) => {
  console.error('\n❌ エラー:', e.message ?? e);
  process.exit(1);
});
