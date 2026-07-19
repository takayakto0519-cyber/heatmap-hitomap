// biz_model_ideas（運営ダッシュボードの「ビジネスモデル案」タブ）を、
// Supabase SQL Editorを介さずに本番APIへ直接反映するためのスクリプト。
//
// 従来はUPDATE文を生成してSQL Editorに手動貼り付けしてもらう運用だったが、
// report_md/memo/statusの更新程度であれば、管理API(/api/admin/biz-model-ideas)を
// ADMIN_PASSWORDで直接叩く方が単純。スキーマ変更(列追加等)は引き続き
// Supabase SQL Editorでの手動マイグレーションが必要（このスクリプトの対象外）。
//
// 使い方:
//   ADMIN_PASSWORD=xxx node scripts/push-biz-model-report.mjs --title "案の完全一致タイトル" --append path/to/append.md
//   ADMIN_PASSWORD=xxx node scripts/push-biz-model-report.mjs --title "..." --status building
//   ADMIN_PASSWORD=xxx node scripts/push-biz-model-report.mjs --title "..." --memo "ひとことメモ"
//   SITE_URL=http://localhost:3000 で本番以外に向けることも可能（省略時 https://hitomap.com）
//
// ADMIN_PASSWORDは .env.local から読み込む想定:
//   export ADMIN_PASSWORD=$(grep -m1 '^ADMIN_PASSWORD=' .env.local | cut -d= -f2-)

import { readFileSync } from 'node:fs';

const SITE = process.env.SITE_URL || 'https://hitomap.com';
const PW = process.env.ADMIN_PASSWORD;
if (!PW) { console.error('ADMIN_PASSWORD未設定'); process.exit(1); }

const args = process.argv.slice(2);
function getArg(name) {
  const i = args.indexOf(name);
  return i === -1 ? undefined : args[i + 1];
}

const title = getArg('--title');
const appendPath = getArg('--append');
const newStatus = getArg('--status');
const newMemo = getArg('--memo');
const contest = getArg('--contest'); // 省略可。絞り込みたい時だけ指定

if (!title) { console.error('使い方: --title "完全一致タイトル" に加えて --append/--status/--memo のいずれかを指定'); process.exit(1); }
if (!appendPath && !newStatus && !newMemo) { console.error('--append / --status / --memo のいずれかが必要です'); process.exit(1); }

const listUrl = new URL(`${SITE}/api/admin/biz-model-ideas`);
if (contest) listUrl.searchParams.set('contest', contest);

const listRes = await fetch(listUrl, { headers: { 'x-admin-password': PW } });
const listData = await listRes.json();
if (!listData.ok) { console.error('一覧取得失敗:', listData.error); process.exit(1); }

const idea = listData.ideas.find(i => i.title === title);
if (!idea) {
  console.error('該当アイデアが見つかりません:', title);
  console.error('存在するタイトル一覧:', listData.ideas.map(i => i.title));
  process.exit(1);
}

const updates = {};
if (appendPath) updates.report_md = (idea.report_md || '') + readFileSync(appendPath, 'utf-8');
if (newStatus) updates.status = newStatus;
if (newMemo) updates.memo = newMemo;

const patchRes = await fetch(`${SITE}/api/admin/biz-model-ideas/${idea.id}`, {
  method: 'PATCH',
  headers: { 'Content-Type': 'application/json', 'x-admin-password': PW },
  body: JSON.stringify(updates),
});
const patchData = await patchRes.json();
if (!patchData.ok) { console.error('更新失敗:', patchData.error); process.exit(1); }

console.log('OK: 更新完了。', Object.keys(updates).join(', '), 'を反映しました。');
