// 運営メンバー名簿の初期データ投入。会長の実名「たかや」を代表(is_lead)として登録する。
// 使い方: node scripts/seed-team-members-20260721.mjs
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

async function main() {
  const { data: existing } = await supabase.from('team_members').select('id, name');
  if (existing && existing.length > 0) {
    console.log('既にメンバーが登録されています。何もしません:', existing.map(m => m.name).join(', '));
    return;
  }
  const { error } = await supabase.from('team_members').insert({ name: 'たかや', role: '代表', is_lead: true, sort_order: 0 });
  if (error) console.error('✗', error.message);
  else console.log('✓ たかや（代表）を登録しました');
}

main();
