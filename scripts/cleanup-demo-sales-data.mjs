// scripts/seed-demo-sales-data.mjs で投入した営業デモ用の合成データを全て削除する。
// session_code='demo-sales-20260720' でタグ付けされたものだけを対象にするため、
// 実データを誤って消す心配はない。
//
// 使い方: node scripts/cleanup-demo-sales-data.mjs

import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

function loadEnvLocal() {
  const text = readFileSync(new URL('../.env.local', import.meta.url), 'utf-8');
  for (const line of text.split('\n')) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
  }
}
loadEnvLocal();

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const SESSION_CODE = 'demo-sales-20260720';
const DEMO_EMAIL_DOMAIN = 'demo-sales.hitomap.invalid';

async function main() {
  console.log('デモの痕跡IDを取得中...');
  const { data: traces, error: traceErr } = await supabase
    .from('traces')
    .select('id')
    .eq('session_code', SESSION_CODE);
  if (traceErr) throw new Error(traceErr.message);
  const traceIds = (traces ?? []).map((t) => t.id);
  console.log(`対象の痕跡: ${traceIds.length}件`);

  if (traceIds.length > 0) {
    await supabase.from('trace_reactions').delete().in('trace_id', traceIds);
    await supabase.from('trace_comments').delete().in('trace_id', traceIds);
    await supabase.from('appointment_requests').delete().in('trace_id', traceIds);
    await supabase.from('traces').delete().in('id', traceIds);
  }

  console.log('デモのイベント（routes）を削除中...');
  await supabase.from('routes').delete().eq('session_code', SESSION_CODE);

  console.log('デモのダッシュボードアクセス・リードを削除中...');
  await supabase.from('dashboard_access').delete().eq('token', `demo-${SESSION_CODE}`);
  await supabase.from('client_leads').delete().eq('memo', SESSION_CODE);

  console.log('デモ利用者アカウントを削除中...');
  const { data: userList, error: listErr } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (listErr) throw new Error(listErr.message);
  const demoUsers = (userList?.users ?? []).filter((u) => u.email?.endsWith(`@${DEMO_EMAIL_DOMAIN}`));
  for (const u of demoUsers) {
    await supabase.auth.admin.deleteUser(u.id);
  }
  console.log(`削除したデモ利用者: ${demoUsers.length}人`);

  console.log('\n=== 完了：デモデータを全て削除しました ===');
}

main().catch((err) => {
  console.error('失敗:', err.message);
  process.exit(1);
});
